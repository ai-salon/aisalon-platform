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
