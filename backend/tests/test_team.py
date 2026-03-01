"""Tests for /team endpoints."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter
from app.models.team_member import TeamMember


async def _seed(session: AsyncSession):
    sf = Chapter(code="sf", name="San Francisco", title="t", description="d",
                 tagline="t", about="a", event_link="e", calendar_embed="c",
                 events_description="e", status="active")
    berlin = Chapter(code="berlin", name="Berlin", title="t", description="d",
                     tagline="t", about="a", event_link="e", calendar_embed="c",
                     events_description="e", status="active")
    session.add_all([sf, berlin])
    await session.flush()

    session.add_all([
        TeamMember(name="Ian Eisenberg", role="Co-Founder", chapter_id=sf.id,
                   profile_image_url="images/ian.jpg", is_cofounder=True, display_order=1),
        TeamMember(name="Cecilia Callas", role="Co-Founder", chapter_id=sf.id,
                   profile_image_url="images/cecilia.jpg", is_cofounder=True, display_order=2),
        TeamMember(name="Justin Shenk", role="Berlin Co-Lead", chapter_id=berlin.id,
                   profile_image_url="images/justin.jpg", is_cofounder=False, display_order=1),
    ])
    await session.commit()


class TestListTeam:
    async def test_empty_returns_empty_list(self, client: AsyncClient):
        r = await client.get("/team")
        assert r.status_code == 200
        assert r.json() == []

    async def test_returns_all_members(self, client: AsyncClient, db_session: AsyncSession):
        await _seed(db_session)
        r = await client.get("/team")
        assert r.status_code == 200
        assert len(r.json()) == 3

    async def test_filter_by_chapter(self, client: AsyncClient, db_session: AsyncSession):
        await _seed(db_session)
        r = await client.get("/team?chapter=sf")
        assert r.status_code == 200
        names = {m["name"] for m in r.json()}
        assert names == {"Ian Eisenberg", "Cecilia Callas"}

    async def test_member_shape(self, client: AsyncClient, db_session: AsyncSession):
        await _seed(db_session)
        r = await client.get("/team")
        m = r.json()[0]
        for key in ("id", "name", "role", "profile_image_url", "is_cofounder", "chapter_id"):
            assert key in m
