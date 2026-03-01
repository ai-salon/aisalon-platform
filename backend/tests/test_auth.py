"""Tests for /auth endpoints and JWT middleware."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import hash_password


async def _seed_user(session: AsyncSession, email: str = "ian@aisalon.xyz",
                     password: str = "secret", role: UserRole = UserRole.superadmin) -> User:
    user = User(
        email=email,
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
        r = await client.post("/auth/login", json={"email": "ian@aisalon.xyz", "password": "secret"})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    async def test_wrong_password_is_401(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_user(db_session)
        r = await client.post("/auth/login", json={"email": "ian@aisalon.xyz", "password": "wrong"})
        assert r.status_code == 401

    async def test_unknown_email_is_401(self, client: AsyncClient):
        r = await client.post("/auth/login", json={"email": "nobody@aisalon.xyz", "password": "x"})
        assert r.status_code == 401

    async def test_inactive_user_is_401(self, client: AsyncClient, db_session: AsyncSession):
        user = await _seed_user(db_session)
        user.is_active = False
        await db_session.commit()
        r = await client.post("/auth/login", json={"email": "ian@aisalon.xyz", "password": "secret"})
        assert r.status_code == 401


class TestProtectedEndpoint:
    async def test_no_token_is_401(self, client: AsyncClient):
        r = await client.get("/admin/me")
        assert r.status_code == 401

    async def test_invalid_token_is_401(self, client: AsyncClient):
        r = await client.get("/admin/me", headers={"Authorization": "Bearer notavalidtoken"})
        assert r.status_code == 401

    async def test_valid_token_returns_user(self, client: AsyncClient, db_session: AsyncSession):
        await _seed_user(db_session)
        login = await client.post("/auth/login", json={"email": "ian@aisalon.xyz", "password": "secret"})
        token = login.json()["access_token"]

        r = await client.get("/admin/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["email"] == "ian@aisalon.xyz"
        assert r.json()["role"] == "superadmin"
