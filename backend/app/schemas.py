from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from .constants import Role, Stage, Temperature


def _as_utc(value: datetime) -> datetime:
    """Naive datetimes are treated as UTC so the API always returns an explicit offset."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    role: Role


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=72)
    role: Role = "rep"


class LoginIn(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    user: UserOut


class LeadFields(BaseModel):
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    source: str | None = Field(default=None, max_length=80)
    qualified: bool | None = None
    assigned_to_id: int | None = None
    next_follow_up: UTCDateTime | None = None


class LeadCreate(LeadFields):
    name: str = Field(min_length=1, max_length=200)
    temperature: Temperature = "warm"
    stage: Stage = "new"

    @model_validator(mode="after")
    def needs_contact(self) -> "LeadCreate":
        if not (self.phone or "").strip() and not (self.email or "").strip():
            raise ValueError("Enter a phone number or an email")
        return self


class LeadUpdate(LeadFields):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    temperature: Temperature | None = None
    stage: Stage | None = None


class LeadOut(ORMModel):
    id: int
    name: str
    company: str | None
    phone: str | None
    email: str | None
    source: str | None
    qualified: bool | None
    temperature: Temperature
    stage: Stage
    assigned_to_id: int | None
    assigned_to_name: str | None
    next_follow_up: UTCDateTime | None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class ActivityOut(ORMModel):
    id: int
    kind: str
    body: str
    user_name: str | None
    created_at: UTCDateTime


class LeadDetail(LeadOut):
    activities: list[ActivityOut]


class LeadListOut(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    page_size: int


class NoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class BulkChanges(BaseModel):
    stage: Stage | None = None
    temperature: Temperature | None = None
    assigned_to_id: int | None = None


class BulkUpdate(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)
    changes: BulkChanges


class BulkDelete(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)


class BulkResult(BaseModel):
    affected: int


class LeadMeta(BaseModel):
    sources: list[str]


class ImportRowError(BaseModel):
    row: int
    message: str


class ImportResult(BaseModel):
    created: int
    duplicates: int
    failed: int
    errors: list[ImportRowError]
