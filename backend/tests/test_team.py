"""Tests for public /team endpoint (User-backed)."""
from datetime import datetime, timezone
from httpx import AsyncClient

from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.core.security import hash_password


async def _make_completed_user(
    db, *, email, name, role, chapter_id=None, is_founder=False,
    title=None, display_order=0,
):
    u = User(
        email=email,
        username=email.split("@")[0],
        hashed_password=hash_password("x"),
        role=role,
        chapter_id=chapter_id,
        is_active=True,
        name=name,
        profile_image_url=f"/uploads/{name.lower().replace(' ', '_')}.jpg",
        title=title or role.value,
        is_founder=is_founder,
        display_order=display_order,
        profile_completed_at=datetime.now(timezone.utc),
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def test_team_includes_founders(client: AsyncClient, db_session):
    await _make_completed_user(
        db_session, email="ian@x", name="Ian E", role=UserRole.superadmin,
        is_founder=True, title="Founder, Executive Director",
    )
    r = await client.get("/team")
    assert r.status_code == 200
    body = r.json()
    names = [m["name"] for m in body]
    assert "Ian E" in names
    ian = next(m for m in body if m["name"] == "Ian E")
    assert ian["is_founder"] is True


async def test_team_includes_active_chapter_leads(client: AsyncClient, db_session, sf_chapter):
    await _make_completed_user(
        db_session, email="lead@x", name="Lead Person", role=UserRole.chapter_lead,
        chapter_id=sf_chapter.id, title="San Francisco Chapter Lead",
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Lead Person" in names


async def test_team_excludes_chapter_leads_from_draft_chapters(
    client: AsyncClient, db_session
):
    draft = Chapter(
        code="dr", name="Dr", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    )
    db_session.add(draft)
    await db_session.commit()
    await db_session.refresh(draft)
    await _make_completed_user(
        db_session, email="dlead@x", name="Draft Lead", role=UserRole.chapter_lead,
        chapter_id=draft.id,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Draft Lead" not in names


async def test_team_excludes_chapter_leads_from_archived_chapters(
    client: AsyncClient, db_session
):
    arch = Chapter(
        code="ar", name="Ar", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    )
    db_session.add(arch)
    await db_session.commit()
    await db_session.refresh(arch)
    await _make_completed_user(
        db_session, email="alead@x", name="Arch Lead", role=UserRole.chapter_lead,
        chapter_id=arch.id,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Arch Lead" not in names


async def test_team_excludes_hosts(client: AsyncClient, db_session, sf_chapter):
    await _make_completed_user(
        db_session, email="host@x", name="Host Person", role=UserRole.host,
        chapter_id=sf_chapter.id,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Host Person" not in names


async def test_team_includes_founder_who_is_host(client: AsyncClient, db_session, sf_chapter):
    # Cecilia case: role=host, is_founder=true → should appear
    await _make_completed_user(
        db_session, email="cec@x", name="Cecilia", role=UserRole.host,
        chapter_id=sf_chapter.id, is_founder=True, title="Co-Founder, Advisor",
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert "Cecilia" in names


async def test_team_excludes_users_with_incomplete_profile(
    client: AsyncClient, db_session, sf_chapter
):
    u = User(
        email="incomplete@x", username="incomplete",
        hashed_password=hash_password("x"),
        role=UserRole.chapter_lead, chapter_id=sf_chapter.id, is_active=True,
    )
    db_session.add(u)
    await db_session.commit()
    r = await client.get("/team")
    names = [m["name"] for m in r.json() if m.get("name")]
    assert "incomplete" not in names


async def test_team_sort_order_founders_first(
    client: AsyncClient, db_session, sf_chapter
):
    await _make_completed_user(
        db_session, email="lead@x", name="Lead Person", role=UserRole.chapter_lead,
        chapter_id=sf_chapter.id,
    )
    await _make_completed_user(
        db_session, email="ian@x", name="Ian E", role=UserRole.superadmin,
        is_founder=True,
    )
    r = await client.get("/team")
    names = [m["name"] for m in r.json()]
    assert names.index("Ian E") < names.index("Lead Person")
