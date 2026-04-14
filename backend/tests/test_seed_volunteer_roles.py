"""Tests for volunteer role seed data."""
from unittest.mock import patch

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.seed import _VOLUNTEER_ROLES, seed_volunteer_roles
from app.models.volunteer import VolunteerRole


EXPECTED_SLUGS = [
    "marketing-social-lead",
    "online-community-manager",
    "insights-lead",
]


def test_seed_data_contains_expected_slugs():
    slugs = [r["slug"] for r in _VOLUNTEER_ROLES]
    for expected in EXPECTED_SLUGS:
        assert expected in slugs, f"Missing expected role: {expected}"


def test_seed_data_has_correct_count():
    assert len(_VOLUNTEER_ROLES) == 3


def test_all_roles_have_required_fields():
    required = {"title", "slug", "description", "requirements", "time_commitment", "display_order"}
    for role in _VOLUNTEER_ROLES:
        missing = required - set(role.keys())
        assert not missing, f"Role {role.get('slug', '?')} missing fields: {missing}"


def test_display_orders_are_unique():
    orders = [r["display_order"] for r in _VOLUNTEER_ROLES]
    assert len(orders) == len(set(orders)), "Duplicate display_order values"


def test_all_roles_time_commitment():
    for role in _VOLUNTEER_ROLES:
        assert role["time_commitment"] == "2-4 hours/week", (
            f"Role {role['slug']} has unexpected time_commitment: {role['time_commitment']}"
        )


def test_marketing_social_lead_content():
    role = next(r for r in _VOLUNTEER_ROLES if r["slug"] == "marketing-social-lead")
    assert "LinkedIn" in role["description"]
    assert "Substack" in role["description"]


def test_online_community_manager_content():
    role = next(r for r in _VOLUNTEER_ROLES if r["slug"] == "online-community-manager")
    assert "community" in role["description"].lower()
    assert "Discord" in role["description"] or "WhatsApp" in role["description"]


def test_insights_lead_content():
    role = next(r for r in _VOLUNTEER_ROLES if r["slug"] == "insights-lead")
    assert "insights" in role["description"].lower() or "reports" in role["description"].lower()


async def test_seed_volunteer_roles_creates_all(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_volunteer_roles()
    async with TestSession() as session:
        result = await session.execute(select(VolunteerRole))
        roles = result.scalars().all()
    slugs = [r.slug for r in roles]
    assert len(slugs) == 3
    for expected in EXPECTED_SLUGS:
        assert expected in slugs


async def test_seed_volunteer_roles_is_idempotent(db_engine):
    TestSession = async_sessionmaker(db_engine, expire_on_commit=False)
    with patch("app.core.seed.AsyncSessionLocal", TestSession):
        await seed_volunteer_roles()
        await seed_volunteer_roles()
    async with TestSession() as session:
        result = await session.execute(select(VolunteerRole))
        roles = result.scalars().all()
    assert len(roles) == 3
