"""Tests for admin /people listing and member editing."""
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.chapter import Chapter
from app.models.user import User, UserRole


async def _member(
    session, email: str, role: UserRole, chapter_id: str | None, *,
    name: str | None = None, is_founder: bool = False, hide: bool = False,
) -> User:
    user = User(
        email=email, username=email.split("@")[0], hashed_password=hash_password("password"),
        role=role, chapter_id=chapter_id, is_active=True,
        name=name, is_founder=is_founder, hide_from_team=hide,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def _chapter(session, code: str, name: str) -> Chapter:
    ch = Chapter(
        code=code, name=name, title="t", description="d", tagline="t", about="a",
        event_link="e", calendar_embed="c", events_description="e", status="active",
    )
    session.add(ch)
    await session.commit()
    await session.refresh(ch)
    return ch


def _by_id(body: list[dict], user_id: str) -> dict | None:
    return next((p for p in body if p["id"] == user_id), None)


# ── Listing ──────────────────────────────────────────────────────────────────

async def test_list_people_requires_auth(client: AsyncClient):
    r = await client.get("/admin/people")
    assert r.status_code in (401, 403)


async def test_list_people_returns_users(
    client: AsyncClient, admin_headers, host_user
):
    r = await client.get("/admin/people", headers=admin_headers)
    assert r.status_code == 200
    assert _by_id(r.json(), host_user.id) is not None


async def test_host_can_list_chapter_people(
    client: AsyncClient, host_headers, host_user, chapter_lead
):
    r = await client.get("/admin/people", headers=host_headers)
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    assert host_user.id in ids
    assert chapter_lead.id in ids


async def test_hidden_nameless_account_excluded_from_people_listing(
    client: AsyncClient, admin_headers, host_user
):
    # host_user has no name -> behaves like a chapter ghost login once hidden
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=admin_headers, json={"hide_from_team": True},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=admin_headers)
    assert _by_id(listed.json(), host_user.id) is None


async def test_hidden_named_member_listed_for_superadmin_with_flag(
    client: AsyncClient, db_session, admin_headers, sf_chapter
):
    hidden = await _member(db_session, "shy@aisalon.xyz", UserRole.host, sf_chapter.id, name="Shy Host", hide=True)
    r = await client.get("/admin/people", headers=admin_headers)
    row = _by_id(r.json(), hidden.id)
    assert row is not None
    assert row["hide_from_team"] is True


async def test_hidden_named_member_listed_for_chapter_lead(
    client: AsyncClient, db_session, lead_headers, sf_chapter
):
    hidden = await _member(db_session, "shy@aisalon.xyz", UserRole.host, sf_chapter.id, name="Shy Host", hide=True)
    r = await client.get("/admin/people", headers=lead_headers)
    assert _by_id(r.json(), hidden.id) is not None


async def test_hidden_member_not_listed_for_host(
    client: AsyncClient, db_session, host_headers, sf_chapter
):
    hidden = await _member(db_session, "shy@aisalon.xyz", UserRole.host, sf_chapter.id, name="Shy Host", hide=True)
    r = await client.get("/admin/people", headers=host_headers)
    assert _by_id(r.json(), hidden.id) is None


# ── Superadmin editing (unchanged) ───────────────────────────────────────────

async def test_people_endpoint_ignores_is_founder(
    client: AsyncClient, admin_headers, host_user
):
    """Founder is an account attribute, edited on the Users page only."""
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=admin_headers,
        json={"is_founder": True, "title": "Co-Founder"},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=admin_headers)
    row = _by_id(listed.json(), host_user.id)
    assert row["is_founder"] is False
    assert row["title"] == "Co-Founder"


async def test_host_cannot_patch_person(
    client: AsyncClient, host_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=host_headers, json={"title": "x"},
    )
    assert r.status_code == 403


# ── Chapter-lead editing (own chapter, presentational fields only) ───────────

async def test_lead_can_set_title_for_own_chapter_host(
    client: AsyncClient, lead_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=lead_headers, json={"title": "SF Host"},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=lead_headers)
    assert _by_id(listed.json(), host_user.id)["title"] == "SF Host"


async def test_lead_can_set_display_order_for_own_chapter_host(
    client: AsyncClient, lead_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=lead_headers, json={"display_order": 7},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=lead_headers)
    assert _by_id(listed.json(), host_user.id)["display_order"] == 7


async def test_lead_can_hide_and_unhide_own_chapter_host(
    client: AsyncClient, db_session, lead_headers, sf_chapter
):
    host = await _member(db_session, "named@aisalon.xyz", UserRole.host, sf_chapter.id, name="Named Host")
    r = await client.patch(
        f"/admin/people/{host.id}", headers=lead_headers, json={"hide_from_team": True},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=lead_headers)
    assert _by_id(listed.json(), host.id)["hide_from_team"] is True
    r = await client.patch(
        f"/admin/people/{host.id}", headers=lead_headers, json={"hide_from_team": False},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=lead_headers)
    assert _by_id(listed.json(), host.id)["hide_from_team"] is False


async def test_lead_can_edit_own_title(
    client: AsyncClient, lead_headers, chapter_lead
):
    r = await client.patch(
        f"/admin/people/{chapter_lead.id}", headers=lead_headers, json={"title": "SF Chapter Lead"},
    )
    assert r.status_code == 200


async def test_lead_cannot_set_is_founder(
    client: AsyncClient, lead_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=lead_headers, json={"is_founder": True},
    )
    assert r.status_code == 200  # unknown field, silently ignored
    listed = await client.get("/admin/people", headers=lead_headers)
    assert _by_id(listed.json(), host_user.id)["is_founder"] is False


async def test_lead_cannot_set_profile_image_url(
    client: AsyncClient, lead_headers, host_user
):
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=lead_headers,
        json={"profile_image_url": "https://example.com/x.png"},
    )
    assert r.status_code == 403


async def test_lead_cannot_edit_member_of_other_chapter(
    client: AsyncClient, db_session, lead_headers
):
    nyc = await _chapter(db_session, "nyc", "New York City")
    other = await _member(db_session, "nyc-host@aisalon.xyz", UserRole.host, nyc.id, name="NYC Host")
    r = await client.patch(
        f"/admin/people/{other.id}", headers=lead_headers, json={"title": "Hijacked"},
    )
    assert r.status_code == 404


async def test_lead_cannot_edit_superadmin_in_own_chapter(
    client: AsyncClient, db_session, lead_headers, sf_chapter
):
    boss = await _member(db_session, "boss@aisalon.xyz", UserRole.superadmin, sf_chapter.id, name="Boss")
    r = await client.patch(
        f"/admin/people/{boss.id}", headers=lead_headers, json={"title": "Nope"},
    )
    assert r.status_code == 403


async def test_lead_cannot_edit_founder_in_own_chapter(
    client: AsyncClient, db_session, lead_headers, sf_chapter
):
    founder = await _member(
        db_session, "founder@aisalon.xyz", UserRole.host, sf_chapter.id, name="Founder", is_founder=True,
    )
    r = await client.patch(
        f"/admin/people/{founder.id}", headers=lead_headers, json={"title": "Nope"},
    )
    assert r.status_code == 403


async def test_superadmin_can_set_profile_image_url(
    client: AsyncClient, admin_headers, host_user
):
    """The Team page lets a superadmin swap any member's photo in place."""
    r = await client.patch(
        f"/admin/people/{host_user.id}", headers=admin_headers,
        json={"profile_image_url": "/uploads/abc/photo.jpg"},
    )
    assert r.status_code == 200
    listed = await client.get("/admin/people", headers=admin_headers)
    assert _by_id(listed.json(), host_user.id)["profile_image_url"] == "/uploads/abc/photo.jpg"
