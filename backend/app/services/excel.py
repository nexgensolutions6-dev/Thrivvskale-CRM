"""Reading leads from Excel / CSV uploads and writing them back out as .xlsx."""

import csv
import io
import re
from collections.abc import Iterable
from datetime import date, datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font

from ..config import get_settings
from ..constants import STAGE_LABELS
from ..models import Lead

# Header spellings accepted for each lead field, compared after _header_key()
HEADER_ALIASES: dict[str, list[str]] = {
    "name": ["name", "full name", "lead name", "contact name", "customer name", "client name"],
    "company": ["company", "company name", "organisation", "organization", "firm", "business"],
    "phone": ["phone", "phone number", "mobile", "mobile number", "mobile no", "contact number", "whatsapp"],
    "email": ["email", "email id", "email address", "e mail", "mail"],
    "source": ["source", "lead source"],
    "qualified": ["qualified", "qualification", "lead quality"],
    "temperature": ["temperature", "temp", "lead temperature"],
    "stage": ["stage", "status", "lead stage"],
    "assigned": ["assigned", "assigned to", "rep", "sales rep", "owner"],
    "next_follow_up": ["next follow up", "next followup", "follow up", "followup", "follow up date"],
}
_ALIAS_TO_FIELD = {alias: field for field, aliases in HEADER_ALIASES.items() for alias in aliases}

_STAGE_LOOKUP = {label.lower(): key for key, label in STAGE_LABELS.items()} | {k: k for k in STAGE_LABELS}
_TRUE_VALUES = {"true", "true lead", "yes", "y", "1", "qualified"}
_FALSE_VALUES = {"false", "false lead", "no", "n", "0", "not qualified", "unqualified"}

# Day comes first: dates in these sheets are written the Indian way (29/10/2026)
_DATE_FORMATS = [
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
    "%d/%m/%Y %H:%M", "%d/%m/%Y", "%d-%m-%Y %H:%M", "%d-%m-%Y",
    "%d %b %Y %H:%M", "%d %b %Y",
]

EXPORT_COLUMNS = [
    "Name", "Company", "Phone", "Email", "Source", "Qualified", "Temperature",
    "Stage", "Assigned To", "Next Follow-up", "Created At",
]


def _header_key(header: Any) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", str(header or "").lower()).split())


def _rows_from_xlsx(content: bytes) -> Iterable[tuple[Any, ...]]:
    workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    return list(workbook.active.iter_rows(values_only=True))


def _rows_from_csv(content: bytes) -> Iterable[tuple[Any, ...]]:
    text = content.decode("utf-8-sig", errors="replace")
    return [tuple(row) for row in csv.reader(io.StringIO(text))]


def read_rows(content: bytes, filename: str) -> list[tuple[int, dict[str, Any]]]:
    """Return (sheet row number, {lead field: raw value}) for each non-empty row."""
    name = filename.lower()
    try:
        if name.endswith(".xlsx"):
            rows = _rows_from_xlsx(content)
        elif name.endswith(".csv"):
            rows = _rows_from_csv(content)
        else:
            raise ValueError("Upload an .xlsx or .csv file")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Could not read this file. Is it a valid Excel sheet?") from exc

    rows = list(rows)
    if not rows:
        raise ValueError("The file is empty")

    columns = [_ALIAS_TO_FIELD.get(_header_key(cell)) for cell in rows[0]]
    if "name" not in columns:
        raise ValueError("No 'Name' column found in the first row")

    parsed = []
    for number, row in enumerate(rows[1:], start=2):
        values = {
            field: value
            for field, value in zip(columns, row)
            if field and value is not None and str(value).strip() != ""
        }
        if values:
            parsed.append((number, values))
    return parsed


def text_value(value: Any) -> str | None:
    if value is None:
        return None
    # Excel stores phone numbers as numbers: 9820144310.0 -> "9820144310"
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip() or None


def parse_qualified(value: Any) -> bool | None:
    text = str(value).strip().lower()
    if text in _TRUE_VALUES:
        return True
    if text in _FALSE_VALUES:
        return False
    raise ValueError(f"Unknown qualified value '{value}'")


def parse_temperature(value: Any) -> str:
    text = str(value).strip().lower()
    if text in ("hot", "warm", "cold"):
        return text
    raise ValueError(f"Unknown temperature '{value}'")


def parse_stage(value: Any) -> str:
    stage = _STAGE_LOOKUP.get(str(value).strip().lower())
    if stage is None:
        raise ValueError(f"Unknown stage '{value}'")
    return stage


def parse_follow_up(value: Any) -> datetime:
    """Sheet times have no timezone, so they're read in the business timezone and stored as UTC."""
    tz = ZoneInfo(get_settings().app_timezone)
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime(value.year, value.month, value.day)
    else:
        for fmt in _DATE_FORMATS:
            try:
                parsed = datetime.strptime(str(value).strip(), fmt)
                break
            except ValueError:
                continue
        else:
            raise ValueError(f"Unknown date '{value}'")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=tz)
    return parsed.astimezone(timezone.utc)


def _local_text(value: datetime | None) -> str:
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(ZoneInfo(get_settings().app_timezone)).strftime("%Y-%m-%d %H:%M")


def build_export(leads: Iterable[Lead]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Leads"
    sheet.append(EXPORT_COLUMNS)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    sheet.freeze_panes = "A2"

    for lead in leads:
        qualified = {True: "True lead", False: "False lead", None: ""}[lead.qualified]
        sheet.append([
            lead.name, lead.company, lead.phone, lead.email, lead.source, qualified,
            lead.temperature.capitalize(), STAGE_LABELS[lead.stage], lead.assigned_to_name,
            _local_text(lead.next_follow_up), _local_text(lead.created_at),
        ])

    for column, width in zip("ABCDEFGHIJK", [24, 24, 16, 30, 14, 12, 12, 20, 16, 18, 18]):
        sheet.column_dimensions[column].width = width

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()
