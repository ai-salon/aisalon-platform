"""Admin Events page data: each chapter's Luma events, past and upcoming.

Visible to every signed-in role. Leads and hosts see only their own chapter
(any requested ``chapter_id`` is ignored); superadmins see every chapter at
any status, optionally narrowed to one.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.chapter import Chapter
from app.models.user import User, UserRole
from app.schemas.events import AdminEventOut, AdminEventsResponse, EventsChapterOut
from app.services import luma_events

admin_router = APIRouter(prefix="/admin/events", tags=["events-admin"])


@admin_router.get("", response_model=AdminEventsResponse)
async def list_events(
    chapter_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Chapter).order_by(Chapter.name)
    if current_user.role == UserRole.superadmin:
        if chapter_id:
            stmt = stmt.where(Chapter.id == chapter_id)
    else:
        # Leads and hosts: own chapter only. No chapter → nothing, never everything.
        stmt = stmt.where(Chapter.id == (current_user.chapter_id or ""))
    chapters = (await db.execute(stmt)).scalars().all()

    chapter_out: list[EventsChapterOut] = []
    events: list[AdminEventOut] = []
    error: str | None = None
    for ch in chapters:
        source = luma_events.parse_source(ch.calendar_embed, ch.event_link)
        matched = False
        if source is not None and error is None:
            try:
                for period in ("past", "future"):
                    for e in await luma_events.events_for(source, period):
                        events.append(
                            AdminEventOut(
                                **e.__dict__,
                                chapter_id=ch.id,
                                chapter_code=ch.code,
                                chapter_name=ch.name,
                                is_past=(period == "past"),
                            )
                        )
                matched = await luma_events.tag_matched(source)
            except luma_events.EventsUnavailable:
                error = "Couldn't reach Luma. Event data may be incomplete; try again shortly."
        chapter_out.append(
            EventsChapterOut(
                id=ch.id,
                code=ch.code,
                name=ch.name,
                status=ch.status,
                luma_tag=source.tag if source else None,
                has_calendar=source is not None,
                tag_matched=matched,
            )
        )

    if error:
        events = []  # partial data would misstate counts; show the error instead
    events.sort(key=lambda e: e.start_at)
    return AdminEventsResponse(chapters=chapter_out, events=events, error=error)
