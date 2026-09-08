"""Unit tests for migration d4e8a1b2c3f5 (move founder profile off the admin ghost).

The migration's core logic is a plain function over a sync connection, so it is
exercised here against an in-memory SQLite schema built from the ORM models.
"""
import importlib.util
from datetime import datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models.base import Base
from app.models.chapter import Chapter
from app.models.user import User, UserRole

_MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic" / "versions" / "d4e8a1b2c3f5_move_founder_profile_off_admin_ghost.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location("mig_admin_ghost", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def engine():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


def _admin(**over) -> User:
    base = dict(
        username="admin", email="admin@aisalon.xyz", hashed_password="x",
        role=UserRole.superadmin, is_active=True,
        name="Ian Eisenberg", title="Co-Founder", description="bio",
        profile_image_url="/images/people/ian_eisenberg.jpeg",
        linkedin="https://linkedin.com/in/ian", is_founder=True, display_order=90,
        profile_completed_at=datetime(2026, 1, 1),
    )
    base.update(over)
    return User(**base)


def _sf() -> Chapter:
    return Chapter(
        code="sf", name="San Francisco", title="t", description="d", tagline="t",
        about="a", event_link="e", calendar_embed="c", events_description="e",
        status="active",
    )


def _run(engine) -> str:
    mig = _load_migration()
    with engine.begin() as conn:
        return mig.transfer_founder_profile(conn)


def _user(session, **where) -> User:
    stmt = select(User)
    for k, v in where.items():
        stmt = stmt.where(getattr(User, k) == v)
    return session.execute(stmt).scalar_one()


def test_transfers_profile_to_account_matched_by_name(engine):
    with Session(engine) as s:
        s.add_all([
            _sf(), _admin(),
            User(username="ian", email="me@example.com", hashed_password="x",
                 role=UserRole.chapter_lead, is_active=True, name="Ian Eisenberg",
                 title="SF Chapter Lead", profile_completed_at=None),
            User(username="cecilia", email="cecilia@aisalon.placeholder",
                 hashed_password="x", role=UserRole.host, is_active=True,
                 name="Cecilia Callas", is_founder=True, display_order=91),
        ])
        s.commit()

    assert _run(engine) == "transferred"

    with Session(engine) as s:
        real = _user(s, username="ian")
        admin = _user(s, username="admin")
        sf = s.execute(select(Chapter).where(Chapter.code == "sf")).scalar_one()

    assert real.role == UserRole.superadmin
    assert real.is_founder is True
    assert real.hide_from_team is False
    assert real.chapter_id == sf.id
    assert real.title == "SF Chapter Lead"  # existing value kept
    assert real.description == "bio"  # empty field filled from admin
    assert real.profile_image_url == "/images/people/ian_eisenberg.jpeg"
    assert real.linkedin == "https://linkedin.com/in/ian"
    assert real.profile_completed_at is not None
    assert real.display_order < 91  # lists before Cecilia

    assert admin.name is None
    assert admin.title is None
    assert admin.profile_image_url is None
    assert admin.is_founder is False
    assert admin.hide_from_team is True
    assert admin.role == UserRole.superadmin
    assert admin.profile_completed_at is not None  # still logs in without onboarding


def test_matches_by_surname_in_email_when_profile_incomplete(engine):
    with Session(engine) as s:
        s.add_all([
            _sf(), _admin(),
            User(username=None, email="ian.eisenberg@example.com", hashed_password="x",
                 role=UserRole.host, is_active=True, name=None),
        ])
        s.commit()

    assert _run(engine) == "transferred"

    with Session(engine) as s:
        real = _user(s, email="ian.eisenberg@example.com")
    assert real.name == "Ian Eisenberg"
    assert real.title == "Co-Founder"
    assert real.is_founder is True
    assert real.role == UserRole.superadmin
    assert real.profile_completed_at is not None


def test_keeps_existing_chapter(engine):
    with Session(engine) as s:
        other = Chapter(
            code="nyc", name="New York City", title="t", description="d", tagline="t",
            about="a", event_link="e", calendar_embed="c", events_description="e",
            status="active",
        )
        s.add_all([_sf(), other])
        s.flush()
        s.add_all([
            _admin(),
            User(username="ian", email="me@example.com", hashed_password="x",
                 role=UserRole.chapter_lead, is_active=True, name="ian eisenberg",
                 chapter_id=other.id),
        ])
        s.commit()
        nyc_id = other.id

    assert _run(engine) == "transferred"
    with Session(engine) as s:
        assert _user(s, username="ian").chapter_id == nyc_id


def test_noop_when_no_candidate(engine):
    with Session(engine) as s:
        s.add_all([_sf(), _admin()])
        s.commit()

    assert _run(engine) == "no-unique-match"

    with Session(engine) as s:
        admin = _user(s, username="admin")
    assert admin.name == "Ian Eisenberg"
    assert admin.is_founder is True
    assert admin.hide_from_team is False


def test_noop_when_ambiguous(engine):
    with Session(engine) as s:
        s.add_all([
            _sf(), _admin(),
            User(username="a", email="a@example.com", hashed_password="x",
                 role=UserRole.host, is_active=True, name="Ian Eisenberg"),
            User(username="b", email="ian.eisenberg@example.com", hashed_password="x",
                 role=UserRole.host, is_active=True),
        ])
        s.commit()

    assert _run(engine) == "no-unique-match"
    with Session(engine) as s:
        assert _user(s, username="admin").name == "Ian Eisenberg"
        assert _user(s, username="a").is_founder is False
        assert _user(s, username="b").is_founder is False


def test_noop_when_admin_already_a_ghost(engine):
    with Session(engine) as s:
        s.add_all([
            _sf(),
            _admin(name=None, title=None, is_founder=False, hide_from_team=True),
            User(username="ian", email="me@example.com", hashed_password="x",
                 role=UserRole.superadmin, is_active=True, name="Ian Eisenberg",
                 is_founder=True),
        ])
        s.commit()

    assert _run(engine) == "nothing-to-transfer"


def test_noop_without_admin_user(engine):
    assert _run(engine) == "no-admin"
