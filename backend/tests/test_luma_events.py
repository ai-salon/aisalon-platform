"""Tests for the Luma events service and the events endpoints."""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter
from app.services import luma_events

CAL = "cal-TEST123"


def _iso(days: int) -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _entry(api_id: str, name: str, days: int, tags: list[str], city: str = "X") -> dict:
    return {
        "api_id": f"calev-{api_id}",
        "guest_count": 12,
        "tags": [{"api_id": f"tag-{t}", "name": t} for t in tags],
        "event": {
            "api_id": f"evt-{api_id}",
            "name": name,
            "start_at": _iso(days),
            "end_at": _iso(days),
            "timezone": "UTC",
            "url": f"slug-{api_id}",
            "cover_url": f"https://img/{api_id}.jpg",
            "geo_address_info": {"city": city},
        },
    }


PAST = [
    _entry("p1", "SF salon", -3, ["SF", "Salon"], "San Francisco"),
    _entry("p2", "Berlin salon", -10, ["Berlin"], "Berlin"),
    _entry("p3", "Old SF symposium", -400, ["SF", "Symposium"], "San Francisco"),
    _entry("p4", "NY salon", -20, ["NY"], "New York"),
]
FUTURE = [_entry("f1", "Upcoming SF", 5, ["SF"])]


async def _boom(params: dict) -> dict:
    raise RuntimeError("luma down")


@pytest.fixture(autouse=True)
def fake_luma(monkeypatch):
    """Replace Luma's API with canned pages; record calls."""
    calls: list[dict] = []

    async def fake_get_items(params: dict) -> dict:
        calls.append(dict(params))
        data = PAST if params["period"] == "past" else FUTURE
        # Two-page pagination to exercise the cursor loop.
        if params.get("pagination_cursor") == "page2":
            return {"entries": data[2:], "has_more": False}
        return {"entries": data[:2], "has_more": len(data) > 2, "next_cursor": "page2"}

    luma_events.clear_cache()
    monkeypatch.setattr(luma_events, "_get_items", fake_get_items)
    yield calls
    luma_events.clear_cache()


# ── source parsing ──────────────────────────────────────────────────────────

class TestParseSource:
    def test_parses_calendar_and_tag(self):
        src = luma_events.parse_source(
            f"https://lu.ma/embed/calendar/{CAL}/events?lt=light&tag=sf", ""
        )
        assert src == luma_events.LumaSource(calendar_api_id=CAL, tag="sf")

    def test_no_tag_means_whole_calendar(self):
        src = luma_events.parse_source(f"https://luma.com/embed/calendar/{CAL}/events", "")
        assert src == luma_events.LumaSource(calendar_api_id=CAL, tag=None)

    def test_tag_falls_back_to_event_link(self):
        src = luma_events.parse_source(
            f"https://lu.ma/embed/calendar/{CAL}/events", "https://lu.ma/Ai-salon?tag=Berlin"
        )
        assert src == luma_events.LumaSource(calendar_api_id=CAL, tag="Berlin")

    @pytest.mark.parametrize(
        "embed", ["", "https://example.com/cal", "https://lu.ma/embed/calendar/sf"]
    )
    def test_non_luma_returns_none(self, embed):
        assert luma_events.parse_source(embed, "") is None


# ── fetching and filtering ──────────────────────────────────────────────────

class TestEventsFor:
    async def test_tag_match_is_case_insensitive(self):
        events = await luma_events.events_for(luma_events.LumaSource(CAL, "sf"), "past")
        assert [e.name for e in events] == ["SF salon", "Old SF symposium"]

    async def test_unknown_tag_returns_nothing_not_everything(self):
        events = await luma_events.events_for(luma_events.LumaSource(CAL, "nyc"), "past")
        assert events == []

    async def test_no_tag_returns_all(self):
        events = await luma_events.events_for(luma_events.LumaSource(CAL, None), "past")
        assert len(events) == 4

    async def test_past_sorted_newest_first(self):
        past = await luma_events.events_for(luma_events.LumaSource(CAL, None), "past")
        starts = [e.start_at for e in past]
        assert starts == sorted(starts, reverse=True)

    async def test_event_fields(self):
        [e] = await luma_events.events_for(luma_events.LumaSource(CAL, "sf"), "future")
        assert e.id == "evt-f1"
        assert e.url == "https://luma.com/slug-f1"
        assert e.cover_url == "https://img/f1.jpg"
        assert e.city == "X"
        assert e.tags == ["SF"]
        assert e.guest_count == 12

    async def test_follows_pagination_and_caches(self, fake_luma):
        await luma_events.events_for(luma_events.LumaSource(CAL, "sf"), "past")
        await luma_events.events_for(luma_events.LumaSource(CAL, "berlin"), "past")
        past_calls = [c for c in fake_luma if c["period"] == "past"]
        assert len(past_calls) == 2  # two pages, fetched once, shared across tags
        assert past_calls[1]["pagination_cursor"] == "page2"

    async def test_upstream_failure_raises_unavailable(self, monkeypatch):
        monkeypatch.setattr(luma_events, "_get_items", _boom)
        with pytest.raises(luma_events.EventsUnavailable):
            await luma_events.events_for(luma_events.LumaSource(CAL, "sf"), "past")

    async def test_serves_stale_cache_when_upstream_fails(self, monkeypatch):
        src = luma_events.LumaSource(CAL, "sf")
        first = await luma_events.events_for(src, "past")
        luma_events.expire_cache()
        monkeypatch.setattr(luma_events, "_get_items", _boom)
        assert await luma_events.events_for(src, "past") == first


class TestTagMatched:
    async def test_known_and_unknown_tags(self):
        assert await luma_events.tag_matched(luma_events.LumaSource(CAL, "berlin")) is True
        assert await luma_events.tag_matched(luma_events.LumaSource(CAL, "nyc")) is False
        assert await luma_events.tag_matched(luma_events.LumaSource(CAL, None)) is True


# ── endpoints ───────────────────────────────────────────────────────────────

async def _chapter(
    db: AsyncSession, code: str, tag: str | None, status: str = "active"
) -> Chapter:
    q = f"?lt=light&tag={tag}" if tag else ""
    ch = Chapter(
        code=code, name=code.upper(), title="t", description="d", tagline="t", about="",
        event_link=f"https://lu.ma/Ai-salon{q}",
        calendar_embed=f"https://lu.ma/embed/calendar/{CAL}/events{q}",
        events_description="", status=status,
    )
    db.add(ch)
    await db.commit()
    await db.refresh(ch)
    return ch


class TestPublicChapterEvents:
    async def test_lists_past_events_for_chapter(self, client: AsyncClient, db_session):
        await _chapter(db_session, "sf", "sf")
        r = await client.get("/chapters/sf/events?period=past")
        assert r.status_code == 200
        assert [e["name"] for e in r.json()] == ["SF salon", "Old SF symposium"]

    async def test_defaults_to_past(self, client: AsyncClient, db_session):
        await _chapter(db_session, "sf", "sf")
        r = await client.get("/chapters/sf/events")
        assert [e["name"] for e in r.json()] == ["SF salon", "Old SF symposium"]

    async def test_limit(self, client: AsyncClient, db_session):
        await _chapter(db_session, "sf", "sf")
        r = await client.get("/chapters/sf/events?period=past&limit=1")
        assert [e["name"] for e in r.json()] == ["SF salon"]

    async def test_draft_chapter_404(self, client: AsyncClient, db_session):
        await _chapter(db_session, "sf", "sf", status="draft")
        r = await client.get("/chapters/sf/events")
        assert r.status_code == 404

    async def test_chapter_without_luma_calendar_is_empty(self, client: AsyncClient, db_session):
        ch = await _chapter(db_session, "sf", "sf")
        ch.calendar_embed = ""
        await db_session.commit()
        r = await client.get("/chapters/sf/events")
        assert r.status_code == 200
        assert r.json() == []

    async def test_upstream_failure_is_503(self, client: AsyncClient, db_session, monkeypatch):
        await _chapter(db_session, "sf", "sf")
        monkeypatch.setattr(luma_events, "_get_items", _boom)
        r = await client.get("/chapters/sf/events")
        assert r.status_code == 503

    async def test_bad_period_422(self, client: AsyncClient, db_session):
        await _chapter(db_session, "sf", "sf")
        r = await client.get("/chapters/sf/events?period=all")
        assert r.status_code == 422


class TestAdminEvents:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/events")
        assert r.status_code in (401, 403)

    async def test_lead_sees_only_own_chapter(
        self, client: AsyncClient, db_session, lead_headers, sf_chapter
    ):
        sf_chapter.calendar_embed = f"https://lu.ma/embed/calendar/{CAL}/events?tag=sf"
        db_session.add(sf_chapter)
        await db_session.commit()
        await _chapter(db_session, "berlin", "berlin")
        r = await client.get("/admin/events", headers=lead_headers)
        assert r.status_code == 200
        body = r.json()
        assert [c["code"] for c in body["chapters"]] == [sf_chapter.code]
        names = {e["name"] for e in body["events"]}
        assert names == {"SF salon", "Old SF symposium", "Upcoming SF"}
        assert all(e["chapter_code"] == sf_chapter.code for e in body["events"])

    async def test_lead_cannot_widen_scope(
        self, client: AsyncClient, db_session, lead_headers, sf_chapter
    ):
        berlin = await _chapter(db_session, "berlin", "berlin")
        r = await client.get(f"/admin/events?chapter_id={berlin.id}", headers=lead_headers)
        assert r.status_code == 200
        assert [c["code"] for c in r.json()["chapters"]] == [sf_chapter.code]

    async def test_host_can_view(self, client: AsyncClient, host_headers):
        r = await client.get("/admin/events", headers=host_headers)
        assert r.status_code == 200

    async def test_superadmin_sees_all_chapters_including_drafts(
        self, client: AsyncClient, db_session, admin_headers
    ):
        await _chapter(db_session, "sfx", "SF")
        await _chapter(db_session, "berlin", "berlin", status="draft")
        await _chapter(db_session, "nyc", "nyc")
        r = await client.get("/admin/events", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        by_code = {c["code"]: c for c in body["chapters"]}
        assert {"sfx", "berlin", "nyc"} <= set(by_code)
        assert by_code["nyc"]["luma_tag"] == "nyc"
        assert by_code["nyc"]["tag_matched"] is False
        assert by_code["berlin"]["tag_matched"] is True
        by_name = {e["name"]: e["chapter_code"] for e in body["events"]}
        assert by_name["Berlin salon"] == "berlin"
        assert by_name["SF salon"] == "sfx"
        assert "NY salon" not in by_name  # no chapter claims the NY tag

    async def test_superadmin_can_filter_one_chapter(
        self, client: AsyncClient, db_session, admin_headers
    ):
        await _chapter(db_session, "sfx", "SF")
        berlin = await _chapter(db_session, "berlin", "berlin")
        r = await client.get(f"/admin/events?chapter_id={berlin.id}", headers=admin_headers)
        assert [c["code"] for c in r.json()["chapters"]] == ["berlin"]
        assert {e["name"] for e in r.json()["events"]} == {"Berlin salon"}

    async def test_upstream_failure_reports_error_not_500(
        self, client: AsyncClient, db_session, admin_headers, monkeypatch
    ):
        await _chapter(db_session, "sfx", "SF")
        monkeypatch.setattr(luma_events, "_get_items", _boom)
        r = await client.get("/admin/events", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["events"] == []
        assert r.json()["error"]
