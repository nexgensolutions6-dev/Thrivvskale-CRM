import io
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session, contains_eager

from ..constants import CLOSED_STAGES, DEFAULT_SOURCES, STAGE_LABELS, Stage, Temperature
from ..deps import get_current_user, get_db, require_owner
from ..models import Lead, User
from ..schemas import (
    BulkDelete,
    BulkResult,
    BulkUpdate,
    ImportResult,
    ImportRowError,
    LeadCreate,
    LeadDetail,
    LeadListOut,
    LeadMeta,
    LeadOut,
    LeadUpdate,
    NoteCreate,
)
from ..services import excel
from ..services.leads import clean_email, clean_text, find_duplicate, log_activity, phone_key

router = APIRouter(prefix="/leads", tags=["leads"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_REPORTED_ERRORS = 50

SortField = Literal["name", "company", "source", "assigned", "next_follow_up", "created_at"]
SORT_COLUMNS = {
    "name": Lead.name,
    "company": Lead.company,
    "source": Lead.source,
    "assigned": User.name,
    "next_follow_up": Lead.next_follow_up,
    "created_at": Lead.created_at,
}


def lead_filters(
    q: str | None = None,
    temperature: Temperature | None = None,
    source: str | None = None,
    qualified: Literal["true", "false", "unreviewed"] | None = None,
    assigned_to: str | None = Query(default=None, description="User id, or 'unassigned'"),
    stage: Stage | None = None,
) -> list[Any]:
    conditions: list[Any] = []
    if q and q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        conditions.append(
            or_(*(col.ilike(pattern, escape="\\") for col in (Lead.name, Lead.company, Lead.phone, Lead.email)))
        )
    if temperature:
        conditions.append(Lead.temperature == temperature)
    if source:
        conditions.append(Lead.source == source)
    if qualified == "true":
        conditions.append(Lead.qualified.is_(True))
    elif qualified == "false":
        conditions.append(Lead.qualified.is_(False))
    elif qualified == "unreviewed":
        conditions.append(Lead.qualified.is_(None))
    if assigned_to == "unassigned":
        conditions.append(Lead.assigned_to_id.is_(None))
    elif assigned_to:
        if not assigned_to.isdigit():
            raise HTTPException(422, "Invalid assigned_to")
        conditions.append(Lead.assigned_to_id == int(assigned_to))
    if stage:
        conditions.append(Lead.stage == stage)
    return conditions


def leads_query(conditions: list[Any], sort: SortField, order: Literal["asc", "desc"]):
    column = SORT_COLUMNS[sort]
    direction = column.asc() if order == "asc" else column.desc()
    return (
        select(Lead)
        .outerjoin(Lead.assigned_to)
        .options(contains_eager(Lead.assigned_to))
        .where(*conditions)
        .order_by(direction.nulls_last(), Lead.id.desc())
    )


def get_lead_or_404(db: Session, lead_id: int) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    return lead


def get_assignee(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(422, "Assigned user not found")
    return user


def duplicate_error(lead: Lead) -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT, f"{lead.name} already has this phone number or email"
    )


def apply_changes(db: Session, lead: Lead, changes: dict[str, Any], user: User) -> None:
    """Set fields on a lead and write a timeline line for each change worth tracking."""
    if changes.get("stage", lead.stage) in CLOSED_STAGES:
        changes["next_follow_up"] = None

    if "stage" in changes and changes["stage"] != lead.stage:
        log_activity(
            db, lead.id, user.id,
            f"Stage changed from {STAGE_LABELS[lead.stage]} to {STAGE_LABELS[changes['stage']]}",
        )
    if "temperature" in changes and changes["temperature"] != lead.temperature:
        log_activity(db, lead.id, user.id, f"Temperature set to {changes['temperature'].capitalize()}")
    if "qualified" in changes and changes["qualified"] != lead.qualified:
        label = {True: "True lead", False: "False lead", None: "Not reviewed"}[changes["qualified"]]
        log_activity(db, lead.id, user.id, f"Marked as {label}")
    if "assigned_to_id" in changes and changes["assigned_to_id"] != lead.assigned_to_id:
        assignee = changes["assigned_to_id"] and get_assignee(db, changes["assigned_to_id"])
        log_activity(db, lead.id, user.id, f"Assigned to {assignee.name}" if assignee else "Unassigned")

    for field, value in changes.items():
        setattr(lead, field, value)


@router.get("", response_model=LeadListOut)
def list_leads(
    conditions: list[Any] = Depends(lead_filters),
    sort: SortField = "created_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    total = db.scalar(select(func.count()).select_from(Lead).where(*conditions)) or 0
    stmt = leads_query(conditions, sort, order).limit(page_size).offset((page - 1) * page_size)
    return LeadListOut(
        items=[LeadOut.model_validate(lead) for lead in db.scalars(stmt).all()],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/meta", response_model=LeadMeta)
def lead_meta(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    used = db.scalars(select(Lead.source).where(Lead.source.is_not(None)).distinct()).all()
    extra = sorted(set(used) - set(DEFAULT_SOURCES), key=str.lower)
    return LeadMeta(sources=DEFAULT_SOURCES + extra)


@router.get("/reminders", response_model=list[LeadOut])
def reminders(
    until: datetime,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Open leads with a follow-up due by `until`. The browser sends the end of its own local day."""
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    conditions = [
        Lead.next_follow_up.is_not(None),
        Lead.next_follow_up <= until.astimezone(timezone.utc),
        Lead.stage.not_in(CLOSED_STAGES),
    ]
    if user.role != "owner":
        conditions.append(Lead.assigned_to_id == user.id)
    stmt = leads_query(conditions, "next_follow_up", "asc").limit(50)
    return db.scalars(stmt).all()


@router.get("/export")
def export_leads(
    conditions: list[Any] = Depends(lead_filters),
    sort: SortField = "created_at",
    order: Literal["asc", "desc"] = "desc",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    content = excel.build_export(db.scalars(leads_query(conditions, sort, order)).all())
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="leads.xlsx"'},
    )


@router.post("/import", response_model=ImportResult)
def import_leads(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is larger than 10 MB")
    try:
        rows = excel.read_rows(content, file.filename or "")
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    users = db.scalars(select(User).where(User.is_active.is_(True))).all()
    users_by_name = {u.name.strip().lower(): u.id for u in users}
    first_names = [u.name.split()[0].lower() for u in users]
    for u in users:
        first = u.name.split()[0].lower()
        if first_names.count(first) == 1:
            users_by_name.setdefault(first, u.id)

    seen_phones = set(db.scalars(select(Lead.phone_key).where(Lead.phone_key.is_not(None))).all())
    seen_emails = set(db.scalars(select(Lead.email).where(Lead.email.is_not(None))).all())

    created = duplicates = failed = 0
    errors: list[ImportRowError] = []

    def fail(row: int, message: str) -> None:
        nonlocal failed
        failed += 1
        if len(errors) < MAX_REPORTED_ERRORS:
            errors.append(ImportRowError(row=row, message=message))

    for number, raw in rows:
        name = excel.text_value(raw.get("name"))
        phone = excel.text_value(raw.get("phone"))
        email = clean_email(excel.text_value(raw.get("email")))
        if not name:
            fail(number, "Name is missing")
            continue
        if not phone and not email:
            fail(number, "Phone and email are both missing")
            continue

        key = phone_key(phone)
        if (key and key in seen_phones) or (email and email in seen_emails):
            duplicates += 1
            continue

        lead = Lead(
            name=name[:200],
            company=excel.text_value(raw.get("company")),
            phone=phone,
            phone_key=key,
            email=email,
            source=excel.text_value(raw.get("source")),
            created_by_id=user.id,
        )
        try:
            if "qualified" in raw:
                lead.qualified = excel.parse_qualified(raw["qualified"])
            lead.temperature = excel.parse_temperature(raw["temperature"]) if "temperature" in raw else "warm"
            lead.stage = excel.parse_stage(raw["stage"]) if "stage" in raw else "new"
            if "next_follow_up" in raw and lead.stage not in CLOSED_STAGES:
                lead.next_follow_up = excel.parse_follow_up(raw["next_follow_up"])
            if "assigned" in raw:
                assignee = users_by_name.get(str(raw["assigned"]).strip().lower())
                if assignee is None:
                    raise ValueError(f"No user named '{raw['assigned']}'")
                lead.assigned_to_id = assignee
        except ValueError as exc:
            fail(number, str(exc))
            continue

        db.add(lead)
        created += 1
        if key:
            seen_phones.add(key)
        if email:
            seen_emails.add(email)

    db.commit()
    return ImportResult(created=created, duplicates=duplicates, failed=failed, errors=errors)


@router.post("/bulk", response_model=BulkResult)
def bulk_update(
    payload: BulkUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    changes = payload.changes.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "Nothing to change")
    leads = db.scalars(select(Lead).where(Lead.id.in_(payload.ids))).all()
    for lead in leads:
        apply_changes(db, lead, dict(changes), user)
    db.commit()
    return BulkResult(affected=len(leads))


@router.post("/bulk-delete", response_model=BulkResult)
def bulk_delete(
    payload: BulkDelete,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    leads = db.scalars(select(Lead).where(Lead.id.in_(payload.ids))).all()
    for lead in leads:
        db.delete(lead)
    db.commit()
    return BulkResult(affected=len(leads))


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    phone = clean_text(payload.phone)
    email = clean_email(payload.email)
    if duplicate := find_duplicate(db, phone, email):
        raise duplicate_error(duplicate)

    if "assigned_to_id" in payload.model_fields_set:
        assigned_to_id = payload.assigned_to_id
    else:
        assigned_to_id = user.id
    if assigned_to_id is not None:
        get_assignee(db, assigned_to_id)

    lead = Lead(
        name=payload.name.strip(),
        company=clean_text(payload.company),
        phone=phone,
        phone_key=phone_key(phone),
        email=email,
        source=clean_text(payload.source),
        qualified=payload.qualified,
        temperature=payload.temperature,
        stage=payload.stage,
        assigned_to_id=assigned_to_id,
        next_follow_up=None if payload.stage in CLOSED_STAGES else payload.next_follow_up,
        created_by_id=user.id,
    )
    db.add(lead)
    db.flush()
    log_activity(db, lead.id, user.id, "Lead created")
    db.commit()
    return lead


@router.get("/{lead_id}", response_model=LeadDetail)
def get_lead(lead_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_lead_or_404(db, lead_id)


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)
    changes = payload.model_dump(exclude_unset=True)

    for field in ("name", "temperature", "stage"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be empty")
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    for field in ("company", "phone", "source"):
        if field in changes:
            changes[field] = clean_text(changes[field])
    if "email" in changes:
        changes["email"] = clean_email(changes["email"])

    phone = changes.get("phone", lead.phone)
    email = changes.get("email", lead.email)
    if not phone and not email:
        raise HTTPException(422, "Enter a phone number or an email")
    if "phone" in changes or "email" in changes:
        if duplicate := find_duplicate(db, phone, email, exclude_id=lead.id):
            raise duplicate_error(duplicate)
        changes["phone_key"] = phone_key(phone)

    apply_changes(db, lead, changes, user)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    db.delete(get_lead_or_404(db, lead_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{lead_id}/notes", response_model=LeadDetail, status_code=status.HTTP_201_CREATED)
def add_note(
    lead_id: int,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)
    log_activity(db, lead.id, user.id, payload.body.strip(), kind="note")
    db.commit()
    db.refresh(lead)
    return lead
