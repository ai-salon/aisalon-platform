"""Per-user onboarding checklist state (Getting Started checks)."""


async def test_me_starts_with_no_checks(client, host_headers):
    r = await client.get("/admin/me", headers=host_headers)
    assert r.status_code == 200
    assert r.json()["onboarding_checks"] == {}


async def test_check_persists_on_me(client, host_headers):
    r = await client.put(
        "/admin/me/onboarding-checks",
        json={"key": "host-first-event", "done": True},
        headers=host_headers,
    )
    assert r.status_code == 200
    assert r.json() == {"onboarding_checks": {"host-first-event": True}}

    me = await client.get("/admin/me", headers=host_headers)
    assert me.json()["onboarding_checks"] == {"host-first-event": True}


async def test_uncheck_removes_key(client, host_headers):
    await client.put(
        "/admin/me/onboarding-checks",
        json={"key": "host-website", "done": True},
        headers=host_headers,
    )
    await client.put(
        "/admin/me/onboarding-checks",
        json={"key": "host-lead-1on1", "done": True},
        headers=host_headers,
    )
    r = await client.put(
        "/admin/me/onboarding-checks",
        json={"key": "host-website", "done": False},
        headers=host_headers,
    )
    assert r.json() == {"onboarding_checks": {"host-lead-1on1": True}}


async def test_checks_are_per_user(client, host_headers, lead_headers):
    await client.put(
        "/admin/me/onboarding-checks",
        json={"key": "host-website", "done": True},
        headers=host_headers,
    )
    me = await client.get("/admin/me", headers=lead_headers)
    assert me.json()["onboarding_checks"] == {}


async def test_rejects_malformed_key(client, host_headers):
    r = await client.put(
        "/admin/me/onboarding-checks",
        json={"key": "Bad Key!", "done": True},
        headers=host_headers,
    )
    assert r.status_code == 422


async def test_requires_auth(client):
    r = await client.put(
        "/admin/me/onboarding-checks", json={"key": "host-website", "done": True}
    )
    assert r.status_code in (401, 403)


async def test_chapter_leads_prefers_real_name(client, db_session, host_headers, chapter_lead):
    chapter_lead.name = "Priya Raman"
    await db_session.commit()
    r = await client.get("/admin/chapter-leads", headers=host_headers)
    assert r.status_code == 200
    assert [lead["name"] for lead in r.json()] == ["Priya Raman"]


async def test_me_reports_guide_read_and_scheduling_url(client, lead_headers):
    """/admin/me is the full UserResponse (a slim duplicate route used to shadow it)."""
    await client.post("/admin/me/guide-read", json={"guide": "hosting"}, headers=lead_headers)
    await client.patch(
        "/admin/me/scheduling-url",
        json={"scheduling_url": "https://cal.com/lead"},
        headers=lead_headers,
    )
    me = (await client.get("/admin/me", headers=lead_headers)).json()
    assert me["has_read_hosting_guide"] is True
    assert me["scheduling_url"] == "https://cal.com/lead"


async def test_chapter_leads_skip_nameless_ghost_login(client, db_session, host_headers, chapter_lead, sf_chapter):
    """The seeded <chapter>@aisalon.xyz ghost is nameless; it must never be offered as a 1:1."""
    from tests.conftest import _make_user
    from app.models.user import UserRole

    ghost = await _make_user(db_session, "sf@aisalon.xyz", UserRole.chapter_lead, sf_chapter.id, username="sf-ghost")
    ghost.hide_from_team = True
    chapter_lead.name = "Priya Raman"
    await db_session.commit()

    r = await client.get("/admin/chapter-leads", headers=host_headers)
    assert [lead["name"] for lead in r.json()] == ["Priya Raman"]


async def test_chapter_leads_empty_when_only_ghost(client, host_headers, chapter_lead):
    # The fixture lead has no name — exactly the ghost shape.
    r = await client.get("/admin/chapter-leads", headers=host_headers)
    assert r.json() == []
