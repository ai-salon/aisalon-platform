"""Tests for /auth endpoints and JWT middleware."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.invite import Invite
from app.models.chapter import Chapter
from app.core.security import hash_password


async def _seed_user(session: AsyncSession, email: str = "ian@aisalon.xyz",
                     password: str = "secret", role: UserRole = UserRole.superadmin,
                     username: str | None = None) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


class TestLogin:
    async def test_success_returns_token(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_user(db_session)
        r = await client.post("/auth/login", json={"identifier": "ian@aisalon.xyz", "password": "secret"})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    async def test_login_with_username(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_user(db_session, username="ian")
        r = await client.post("/auth/login", json={"identifier": "ian", "password": "secret"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    async def test_wrong_password_is_401(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_user(db_session)
        r = await client.post("/auth/login", json={"identifier": "ian@aisalon.xyz", "password": "wrong"})
        assert r.status_code == 401

    async def test_unknown_email_is_401(self, client: AsyncClient):
        r = await client.post("/auth/login", json={"identifier": "nobody@aisalon.xyz", "password": "x"})
        assert r.status_code == 401

    async def test_inactive_user_is_401(self, client: AsyncClient, db_session: AsyncSession):
        user = await _seed_user(db_session)
        user.is_active = False
        await db_session.commit()
        r = await client.post("/auth/login", json={"identifier": "ian@aisalon.xyz", "password": "secret"})
        assert r.status_code == 401


class TestProtectedEndpoint:
    async def test_no_token_is_401(self, client: AsyncClient):
        r = await client.get("/admin/me")
        assert r.status_code == 401

    async def test_invalid_token_is_401(self, client: AsyncClient):
        r = await client.get("/admin/me", headers={"Authorization": "Bearer notavalidtoken"})
        assert r.status_code == 401

    async def test_valid_token_returns_user(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_user(db_session, username="iantest")
        login = await client.post("/auth/login", json={"identifier": "ian@aisalon.xyz", "password": "secret"})
        token = login.json()["access_token"]

        r = await client.get("/admin/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["email"] == "ian@aisalon.xyz"
        assert r.json()["role"] == "superadmin"
        assert r.json()["username"] == "iantest"


class TestInviteInfo:
    async def test_valid_invite(self, client: AsyncClient, db_session: AsyncSession):
        ch = Chapter(code="test", name="Test Chapter", title="t", description="d",
                     tagline="t", about="a", event_link="e", calendar_embed="c",
                     events_description="e", status="active")
        db_session.add(ch)
        await db_session.flush()
        user = await _seed_user(db_session)
        invite = Invite(chapter_id=ch.id, role="host", created_by=user.id, token="testtoken123")
        db_session.add(invite)
        await db_session.commit()

        r = await client.get("/auth/invite/testtoken123")
        assert r.status_code == 200
        assert r.json()["chapter_name"] == "Test Chapter"
        assert r.json()["role"] == "host"

    async def test_invalid_invite_404(self, client: AsyncClient):
        r = await client.get("/auth/invite/nonexistent")
        assert r.status_code == 404

    async def test_fully_used_invite_410(self, client: AsyncClient, db_session: AsyncSession):
        ch = Chapter(code="test2", name="Test", title="t", description="d",
                     tagline="t", about="a", event_link="e", calendar_embed="c",
                     events_description="e", status="active")
        db_session.add(ch)
        await db_session.flush()
        user = await _seed_user(db_session)
        invite = Invite(chapter_id=ch.id, role="host", created_by=user.id,
                        token="usedtoken", max_uses=1, use_count=1)
        db_session.add(invite)
        await db_session.commit()

        r = await client.get("/auth/invite/usedtoken")
        assert r.status_code == 410


class TestRegister:
    async def test_register_with_invite(self, client: AsyncClient, db_session: AsyncSession):
        ch = Chapter(code="reg", name="Reg Chapter", title="t", description="d",
                     tagline="t", about="a", event_link="e", calendar_embed="c",
                     events_description="e", status="active")
        db_session.add(ch)
        await db_session.flush()
        user = await _seed_user(db_session)
        invite = Invite(chapter_id=ch.id, role="host", created_by=user.id,
                        token="regtoken", max_uses=5)
        db_session.add(invite)
        await db_session.commit()

        r = await client.post("/auth/register", json={
            "invite_token": "regtoken",
            "username": "newhost",
            "email": "newhost@example.com",
            "password": "SecurePass123!",
        })
        assert r.status_code == 201
        assert "access_token" in r.json()

        # Verify can login with username
        login = await client.post("/auth/login", json={"identifier": "newhost", "password": "SecurePass123!"})
        assert login.status_code == 200

    async def test_register_invalid_invite(self, client: AsyncClient):
        r = await client.post("/auth/register", json={
            "invite_token": "badtoken",
            "username": "user1",
            "email": "user1@example.com",
            "password": "SecurePass123!",
        })
        assert r.status_code == 400

    async def test_register_duplicate_email(self, client: AsyncClient, db_session: AsyncSession):
        ch = Chapter(code="dup", name="Dup", title="t", description="d",
                     tagline="t", about="a", event_link="e", calendar_embed="c",
                     events_description="e", status="active")
        db_session.add(ch)
        await db_session.flush()
        user = await _seed_user(db_session)
        invite = Invite(chapter_id=ch.id, role="host", created_by=user.id,
                        token="duptoken", max_uses=5)
        db_session.add(invite)
        await db_session.commit()

        r = await client.post("/auth/register", json={
            "invite_token": "duptoken",
            "username": "another",
            "email": user.email,
            "password": "SecurePass123!",
        })
        assert r.status_code == 409
