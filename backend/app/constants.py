from typing import Literal

Stage = Literal["new", "contacted", "meeting_scheduled", "proposal_sent", "won", "lost"]
Temperature = Literal["hot", "warm", "cold"]
Role = Literal["owner", "rep"]

STAGES: list[str] = ["new", "contacted", "meeting_scheduled", "proposal_sent", "won", "lost"]
STAGE_LABELS: dict[str, str] = {
    "new": "New",
    "contacted": "Contacted",
    "meeting_scheduled": "Meeting scheduled",
    "proposal_sent": "Proposal sent",
    "won": "Won",
    "lost": "Lost",
}
CLOSED_STAGES = {"won", "lost"}
TEMPERATURES: list[str] = ["hot", "warm", "cold"]

# Shown in the Source dropdown even before any lead uses them; other sources come from the data.
DEFAULT_SOURCES = ["IndiaMART", "Meta", "Google", "WhatsApp", "Website form", "Referral"]
