"""Tests for /admin/team member CRUD."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chapter import Chapter
from app.models.team_member import TeamMember


async def _make_other_chapter(session: AsyncSession) -> Chapter:
    ch = Chapter(
        code="nyc2", name="NYC", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="active",
    )
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


async def _seed_member(session: AsyncSession, chapter_id: str, name: str = "Alice") -> TeamMember:
    m = TeamMember(name=name, role="Speaker", chapter_id=chapter_id)
    session.add(m)
    await session.commit()
    await session.refresh(m)
    return m


class TestCreateTeamMember:
    async def test_requires_auth(self, client: AsyncClient, sf_chapter):
        r = await client.post("/admin/team", json={
            "name": "Bob", "role": "Speaker", "chapter_id": sf_chapter.id
        })
        assert r.status_code == 401

    async def test_superadmin_creates(self, client: AsyncClient, admin_headers, sf_chapter):
        r = await client.post("/admin/team", json={
            "name": "Bob", "role": "Speaker", "chapter_id": sf_chapter.id
        }, headers=admin_headers)
        assert r.status_code == 201
        assert r.json()["name"] == "Bob"
        assert r.json()["chapter_id"] == sf_chapter.id

    async def test_chapter_lead_can_create_for_own(
        self, client: AsyncClient, lead_headers, sf_chapter
    ):
        r = await client.post("/admin/team", json={
            "name": "Carol", "role": "Organizer", "chapter_id": sf_chapter.id
        }, headers=lead_headers)
        assert r.status_code == 201

    async def test_chapter_lead_cannot_create_for_other(
        self, client: AsyncClient, lead_headers, db_session: AsyncSession
    ):
        other = await _make_other_chapter(db_session)
        r = await client.post("/admin/team", json={
            "name": "Eve", "role": "Speaker", "chapter_id": other.id
        }, headers=lead_headers)
        assert r.status_code == 403


class TestUpdateTeamMember:
    async def test_requires_auth(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        m = await _seed_member(db_session, sf_chapter.id)
        r = await client.patch(f"/admin/team/{m.id}", json={"name": "Updated"})
        assert r.status_code == 401

    async def test_update_member(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        m = await _seed_member(db_session, sf_chapter.id)
        r = await client.patch(f"/admin/team/{m.id}", json={"name": "Updated Name", "role": "Lead"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "Updated Name"
        assert r.json()["role"] == "Lead"

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.patch("/admin/team/nonexistent", json={"name": "x"}, headers=admin_headers)
        assert r.status_code == 404


class TestDeleteTeamMember:
    async def test_requires_auth(self, client: AsyncClient, sf_chapter, db_session: AsyncSession):
        m = await _seed_member(db_session, sf_chapter.id)
        r = await client.delete(f"/admin/team/{m.id}")
        assert r.status_code == 401

    async def test_delete_member(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        m = await _seed_member(db_session, sf_chapter.id)
        r = await client.delete(f"/admin/team/{m.id}", headers=admin_headers)
        assert r.status_code == 204

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.delete("/admin/team/nonexistent", headers=admin_headers)
        assert r.status_code == 404

    async def test_chapter_lead_cannot_delete_from_other_chapter(
        self, client: AsyncClient, lead_headers, db_session: AsyncSession
    ):
        other = await _make_other_chapter(db_session)
        m = await _seed_member(db_session, other.id)
        r = await client.delete(f"/admin/team/{m.id}", headers=lead_headers)
        assert r.status_code == 403
