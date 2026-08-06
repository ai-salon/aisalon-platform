from pydantic import BaseModel


class ChapterSummary(BaseModel):
    id: str
    code: str
    name: str
    title: str
    tagline: str
    description: str
    status: str

    model_config = {"from_attributes": True}


class ChapterDetail(ChapterSummary):
    description: str
    about: str
    event_link: str
    calendar_embed: str
    events_description: str
