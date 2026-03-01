from typing import Any
from pydantic import BaseModel


class ChapterSummary(BaseModel):
    id: str
    code: str
    name: str
    title: str
    tagline: str
    status: str

    model_config = {"from_attributes": True}


class TeamMemberPublic(BaseModel):
    id: str
    name: str
    role: str
    description: str | None
    profile_image_url: str
    linkedin: str | None
    is_cofounder: bool
    display_order: int

    model_config = {"from_attributes": True}


class ChapterDetail(ChapterSummary):
    description: str
    about: str
    event_link: str
    calendar_embed: str
    events_description: str
    about_blocks: Any
    events_blocks: Any
    team_members: list[TeamMemberPublic] = []
