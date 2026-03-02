"""Tests for /admin/users endpoints (user management)."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import hash_password


async def _make_chapter_lead(session: AsyncSession, email: str, chapter_id: str) -> User:
    u = User(
        email=email,
        hashed_password=hash_password("password"),
        role=UserRole.chapter_lead,
        chapter_id=chapter_id,
        is_active=True,
    )
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u


class TestListUsers:
    async def test_requires_auth(self, client: AsyncClient):
        r = await client.get("/admin/users")
        assert r.status_code == 401

    async def test_requires_superadmin(self, client: AsyncClient, lead_headers):
        r = await client.get("/admin/users", headers=lead_headers)
        assert r.status_code == 403

    async def test_lists_users(self, client: AsyncClient, admin_headers, superadmin):
        r = await client.get("/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1
        emails = [u["email"] for u in r.json()]
        assert superadmin.email in emails

    async def test_user_shape(self, client: AsyncClient, admin_headers):
        r = await client.get("/admin/users", headers=admin_headers)
        u = r.json()[0]
        for key in ("id", "email", "username", "role", "is_active"):
            assert key in u
        assert "hashed_password" not in u


class TestCreateUser:
    async def test_requires_superadmin(self, client: AsyncClient, lead_headers):
        r = await client.post("/admin/users",
                              json={"email": "x@x.com", "password": "pass", "role": "chapter_lead"},
                              headers=lead_headers)
        assert r.status_code == 403

    async def test_creates_user(self, client: AsyncClient, admin_headers, sf_chapter):
        r = await client.post("/admin/users", json={
            "email": "newlead@aisalon.xyz",
            "password": "securepass",
            "role": "chapter_lead",
            "chapter_id": sf_chapter.id,
        }, headers=admin_headers)
        assert r.status_code == 201
        assert r.json()["email"] == "newlead@aisalon.xyz"
        assert r.json()["role"] == "chapter_lead"
        assert "hashed_password" not in r.json()

    async def test_duplicate_email_is_409(self, client: AsyncClient, admin_headers, superadmin):
        r = await client.post("/admin/users", json={
            "email": superadmin.email,
            "password": "x",
            "role": "chapter_lead",
        }, headers=admin_headers)
        assert r.status_code == 409


class TestUpdateUser:
    async def test_deactivate_user(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        lead = await _make_chapter_lead(db_session, "lead2@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"is_active": False},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_active"] is False

    async def test_reassign_chapter(
        self, client: AsyncClient, admin_headers, sf_chapter, db_session: AsyncSession
    ):
        from app.models.chapter import Chapter
        other = Chapter(code="tokyo", name="Tokyo", title="t", description="d",
                        tagline="t", about="a", event_link="e", calendar_embed="c",
                        events_description="e", status="active")
        db_session.add(other)
        await db_session.commit()
        await db_session.refresh(other)
        lead = await _make_chapter_lead(db_session, "lead3@aisalon.xyz", sf_chapter.id)
        r = await client.patch(f"/admin/users/{lead.id}",
                               json={"chapter_id": other.id},
                               headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["chapter_id"] == other.id

    async def test_not_found(self, client: AsyncClient, admin_headers):
        r = await client.patch("/admin/users/nonexistent", json={"is_active": False}, headers=admin_headers)
        assert r.status_code == 404
