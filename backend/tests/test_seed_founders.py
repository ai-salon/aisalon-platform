"""Tests for the system-login seed.

The seeded ``admin`` login is a break-glass system account, like the
``<chapter>@aisalon.xyz`` ghosts: nameless, hidden from the Team page, never a
person. People (founders included) are never seeded; a superadmin creates them.
"""
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core import seed
from app.core.seed import seed_chapter_leads, seed_chapters, seed_superadmin
from app.models.user import User, UserRole


def test_nobody_is_seeded_as_a_person():
    assert not hasattr(seed, "seed_founders")
    assert not hasattr(seed, "_FOUNDERS")


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
    assert admin.profile_completed_at is None


async def test_all_seeded_logins_are_nameless_and_hidden(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_superadmin()
        await seed_chapters()
        await seed_chapter_leads()
    async with TestSession() as session:
        users = (await session.execute(select(User))).scalars().all()
    assert len(users) >= 2
    assert all(u.name is None and u.hide_from_team and not u.is_founder for u in users)
