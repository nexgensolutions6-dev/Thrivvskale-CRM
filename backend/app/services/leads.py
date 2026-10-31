import re

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models import Lead, LeadActivity


def phone_key(phone: str | None) -> str | None:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-10:] if len(digits) >= 7 else None


def clean_text(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def clean_email(email: str | None) -> str | None:
    return (clean_text(email) or "").lower() or None


def find_duplicate(
    db: Session, phone: str | None, email: str | None, exclude_id: int | None = None
) -> Lead | None:
    conditions = []
    if key := phone_key(phone):
        conditions.append(Lead.phone_key == key)
    if email:
        conditions.append(Lead.email == email)
    if not conditions:
        return None
    stmt = select(Lead).where(or_(*conditions)).limit(1)
    if exclude_id is not None:
        stmt = stmt.where(Lead.id != exclude_id)
    return db.scalar(stmt)


def log_activity(db: Session, lead_id: int, user_id: int | None, body: str, kind: str = "system") -> None:
    db.add(LeadActivity(lead_id=lead_id, user_id=user_id, kind=kind, body=body))
