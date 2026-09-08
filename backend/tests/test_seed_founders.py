"""Tests for the superadmin + founder seed.

The seeded ``admin`` login is a break-glass system account, like the
``<chapter>@aisalon.xyz`` ghosts: it must never carry a person's profile or
appear on the Team page. Founder profiles belong on real people's accounts.
"""
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.seed import _FOUNDERS, seed_founders, seed_superadmin
from app.models.user import User, UserRole


def test_no_founder_entry_targets_the_admin_login():
    for f in _FOUNDERS:
        assert f.get("match_username") != "admin"
        assert f.get("username") != "admin"


async def test_seed_superadmin_creates_a_hidden_ghost(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_superadmin()
    async with TestSession() as session:
        admin = (
            await session.execute(select(User).where(User.username == "admin"))
        ).scalar_one()
    assert admin.role == UserRole.superadmin
    assert admin.hide_from_team is True
    assert admin.name is None
    assert admin.is_founder is False


async def test_seed_founders_leaves_the_admin_login_untouched(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_superadmin()
        await seed_founders()
    async with TestSession() as session:
        admin = (
            await session.execute(select(User).where(User.username == "admin"))
        ).scalar_one()
        founders = (
            await session.execute(select(User).where(User.is_founder.is_(True)))
        ).scalars().all()
    assert admin.name is None
    assert admin.is_founder is False
    assert admin.profile_completed_at is None
    assert admin.hide_from_team is True
    # Seeded founders get their own accounts, never the admin login.
    assert all(f.username != "admin" for f in founders)
    assert len(founders) == len(_FOUNDERS)


async def test_seed_founders_is_idempotent(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_founders()
        await seed_founders()
    async with TestSession() as session:
        founders = (
            await session.execute(select(User).where(User.is_founder.is_(True)))
        ).scalars().all()
    assert len(founders) == len(_FOUNDERS)
