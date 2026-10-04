"""Read a chapter's events from Luma's public calendar data.

Chapters don't store events. Each chapter's ``calendar_embed`` is a Luma embed
URL (``…/embed/calendar/<cal-id>/events?tag=<tag>``); we parse the calendar id
and tag out of it and read events from Luma's public, unauthenticated
``/calendar/get-items`` endpoint — the one Luma's own calendar pages use. It is
undocumented, so every failure maps to ``EventsUnavailable`` and callers
degrade (hide the section / show an error) rather than 500.

All chapters share one Luma calendar, so we fetch the whole calendar per period
once, cache it, and filter by tag locally. Tag matching ignores case, mirroring
luma.com (``?tag=sf`` matches the "SF" tag). An unmatched tag yields no events —
never the whole calendar, which is what Luma's endpoint does with a bad tag.
"""
from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass
from typing import Literal
from urllib.parse import parse_qs, urlparse

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

Period = Literal["past", "future"]

LUMA_API = "https://api.lu.ma/calendar/get-items"
PAGE_SIZE = 50
MAX_PAGES = 20  # 1,000 events per period — far above today's ~125
CACHE_TTL_SECONDS = 600
TIMEOUT_SECONDS = 10.0

_CAL_RE = re.compile(r"/calendar/(cal-[A-Za-z0-9]+)")
_LUMA_HOSTS = {"lu.ma", "www.lu.ma", "luma.com", "www.luma.com"}


class EventsUnavailable(Exception):
    """Luma could not be reached and nothing usable is cached."""


@dataclass(frozen=True)
class LumaSource:
    calendar_api_id: str
    tag: str | None


@dataclass(frozen=True)
class LumaEvent:
    id: str
    name: str
    start_at: str  # ISO 8601 UTC, as Luma returns it
    end_at: str | None
    timezone: str | None
    url: str
    cover_url: str | None
    city: str | None
    tags: list[str]
    guest_count: int | None


def _tag_from(url: str) -> str | None:
    tags = parse_qs(urlparse(url).query).get("tag")
    if not tags:
        return None
    return tags[0].strip() or None


def parse_source(calendar_embed: str, event_link: str) -> LumaSource | None:
    """Extract the Luma calendar id and chapter tag from a chapter's URLs."""
    parsed = urlparse(calendar_embed or "")
    if parsed.hostname not in _LUMA_HOSTS:
        return None
    match = _CAL_RE.search(parsed.path)
    if not match:
        return None
    tag = _tag_from(calendar_embed) or _tag_from(event_link or "")
    return LumaSource(calendar_api_id=match.group(1), tag=tag)


# ── upstream ────────────────────────────────────────────────────────────────

async def _get_items(params: dict) -> dict:
    """One page from Luma. Patched out in tests."""
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        r = await client.get(LUMA_API, params=params, headers={"Accept": "application/json"})
        r.raise_for_status()
        return r.json()


def _to_event(entry: dict) -> LumaEvent | None:
    ev = entry.get("event") or {}
    if not ev.get("api_id") or not ev.get("start_at"):
        return None
    slug = ev.get("url") or ev["api_id"]
    geo = ev.get("geo_address_info") or {}
    return LumaEvent(
        id=ev["api_id"],
        name=ev.get("name") or "Untitled event",
        start_at=ev["start_at"],
        end_at=ev.get("end_at"),
        timezone=ev.get("timezone"),
        url=f"https://luma.com/{slug}",
        cover_url=ev.get("cover_url"),
        city=geo.get("city") or geo.get("city_state"),
        tags=[t["name"] for t in (entry.get("tags") or []) if t.get("name")],
        guest_count=entry.get("guest_count"),
    )


async def _fetch_calendar(calendar_api_id: str, period: Period) -> list[LumaEvent]:
    events: list[LumaEvent] = []
    params: dict = {
        "calendar_api_id": calendar_api_id,
        "period": period,
        "pagination_limit": PAGE_SIZE,
    }
    for _ in range(MAX_PAGES):
        page = await _get_items(params)
        events.extend(e for e in map(_to_event, page.get("entries") or []) if e)
        cursor = page.get("next_cursor")
        if not page.get("has_more") or not cursor:
            break
        params = {**params, "pagination_cursor": cursor}
    events.sort(key=lambda e: e.start_at, reverse=(period == "past"))
    return events


# ── cache ───────────────────────────────────────────────────────────────────

_cache: dict[tuple[str, str], tuple[float, list[LumaEvent]]] = {}
_locks: dict[tuple[str, str], asyncio.Lock] = {}


def clear_cache() -> None:
    _cache.clear()
    _locks.clear()


def expire_cache() -> None:
    """Mark every entry stale (kept for fallback). Test hook."""
    for key, (_, events) in list(_cache.items()):
        _cache[key] = (0.0, events)


async def calendar_events(calendar_api_id: str, period: Period) -> list[LumaEvent]:
    """All events on a calendar for a period, cached; stale data beats none."""
    key = (calendar_api_id, period)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL_SECONDS:
        return hit[1]
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_TTL_SECONDS:
            return hit[1]
        try:
            events = await _fetch_calendar(calendar_api_id, period)
        except Exception as exc:
            logger.warning(
                "luma_fetch_failed",
                calendar_api_id=calendar_api_id,
                period=period,
                error_type=type(exc).__name__,
                served_stale=bool(hit),
            )
            if hit:
                return hit[1]
            raise EventsUnavailable(str(exc)) from exc
        _cache[key] = (time.monotonic(), events)
        return events


def matches(event: LumaEvent, tag: str | None) -> bool:
    if tag is None:
        return True
    wanted = tag.casefold()
    return any(t.casefold() == wanted for t in event.tags)


async def events_for(source: LumaSource, period: Period) -> list[LumaEvent]:
    events = await calendar_events(source.calendar_api_id, period)
    return [e for e in events if matches(e, source.tag)]


async def tag_matched(source: LumaSource) -> bool:
    """Whether the chapter's tag appears on any event (past or upcoming)."""
    if source.tag is None:
        return True
    for period in ("past", "future"):
        if any(matches(e, source.tag) for e in await calendar_events(source.calendar_api_id, period)):
            return True
    return False
