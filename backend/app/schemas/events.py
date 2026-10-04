from pydantic import BaseModel


class EventOut(BaseModel):
    id: str
    name: str
    start_at: str
    end_at: str | None
    timezone: str | None
    url: str
    cover_url: str | None
    city: str | None
    guest_count: int | None

    model_config = {"from_attributes": True}


class AdminEventOut(EventOut):
    chapter_id: str
    chapter_code: str
    chapter_name: str
    is_past: bool


class EventsChapterOut(BaseModel):
    id: str
    code: str
    name: str
    status: str
    luma_tag: str | None
    has_calendar: bool  # a Luma calendar embed is configured
    tag_matched: bool  # some Luma event carries this chapter's tag


class AdminEventsResponse(BaseModel):
    chapters: list[EventsChapterOut]
    events: list[AdminEventOut]  # oldest first
    error: str | None = None  # set when Luma was unreachable
