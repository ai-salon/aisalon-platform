"""Tests for /chapters endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter


async def _seed_chapter(session: AsyncSession, code: str = "sf", name: str = "San Francisco") -> Chapter:
    ch = Chapter(
        code=code,
        name=name,
        title="Shaping the Future of AI Together",
        description="The SF chapter.",
        tagline="Where AI meets conversation",
        about="Our founding chapter.",
        event_link="https://lu.ma/Ai-salon",
        calendar_embed="https://lu.ma/embed/calendar/sf",
        events_description="Join us for salons.",
        status="active",
    )
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


class TestListChapters:
    async def test_empty_returns_empty_list(self, client: AsyncClient):
        r = await client.get("/chapters")
        assert r.status_code == 200
        assert r.json() == []

    async def test_returns_seeded_chapters(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_chapter(db_session, "sf", "San Francisco")
        await _seed_chapter(db_session, "berlin", "Berlin")
        r = await client.get("/chapters")
        assert r.status_code == 200
        codes = {ch["code"] for ch in r.json()}
        assert codes == {"sf", "berlin"}

    async def test_chapter_shape(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_chapter(db_session)
        r = await client.get("/chapters")
        ch = r.json()[0]
        for key in ("id", "code", "name", "title", "tagline", "status"):
            assert key in ch


class TestGetChapter:
    async def test_returns_chapter(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_chapter(db_session, "sf", "San Francisco")
        r = await client.get("/chapters/sf")
        assert r.status_code == 200
        assert r.json()["code"] == "sf"
        assert r.json()["name"] == "San Francisco"

    async def test_includes_full_detail(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_chapter(db_session)
        r = await client.get("/chapters/sf")
        for key in ("about", "event_link", "calendar_embed", "about_blocks", "events_blocks"):
            assert key in r.json()

    async def test_not_found(self, client: AsyncClient):
        r = await client.get("/chapters/notexist")
        assert r.status_code == 404


async def test_list_chapters_excludes_draft(client, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="draft1", name="Draft", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    ))
    await db_session.commit()
    r = await client.get("/chapters")
    codes = [c["code"] for c in r.json()]
    assert "draft1" not in codes


async def test_list_chapters_excludes_archived(client, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="arch1", name="Arch", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    ))
    await db_session.commit()
    r = await client.get("/chapters")
    codes = [c["code"] for c in r.json()]
    assert "arch1" not in codes


async def test_get_draft_chapter_returns_404(client, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="draft2", name="D2", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    ))
    await db_session.commit()
    r = await client.get("/chapters/draft2")
    assert r.status_code == 404


async def test_get_archived_chapter_returns_404(client, db_session):
    from app.models.chapter import Chapter
    db_session.add(Chapter(
        code="arch2", name="A2", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    ))
    await db_session.commit()
    r = await client.get("/chapters/arch2")
    assert r.status_code == 404
