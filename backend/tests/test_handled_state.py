from sqlalchemy import select

from app.models.contact_message import ContactMessage
from app.models.hosting_interest import HostingInterest


async def _mk_contact(db_session, chapter_id, **kw):
    msg = ContactMessage(
        chapter_id=chapter_id, email="v@x.co", message="hello there friend", **kw
    )
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)
    return msg


async def test_lead_lists_own_chapter_contact_messages(
    client, lead_headers, sf_chapter, db_session
):
    await _mk_contact(db_session, sf_chapter.id)
    r = await client.get("/admin/contact-messages", headers=lead_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["status"] == "new"


async def test_lead_cannot_see_other_chapters_messages(
    client, lead_headers, sf_chapter, db_session, admin_headers
):
    # create a second chapter via admin API, put a message there
    rc = await client.post(
        "/admin/chapters", json={"code": "zz", "name": "Zed"}, headers=admin_headers
    )
    other_id = rc.json()["id"]
    await _mk_contact(db_session, other_id)
    r = await client.get("/admin/contact-messages", headers=lead_headers)
    assert r.json() == []


async def test_mark_contact_handled_sets_audit_fields(
    client, lead_headers, chapter_lead, sf_chapter, db_session
):
    msg = await _mk_contact(db_session, sf_chapter.id)
    r = await client.patch(
        f"/admin/contact-messages/{msg.id}", json={"status": "handled"},
        headers=lead_headers,
    )
    assert r.status_code == 200
    assert r.json()["chapter_name"] == sf_chapter.name
    await db_session.refresh(msg)
    assert msg.status == "handled"
    assert msg.handled_by == chapter_lead.id
    assert msg.handled_at is not None


async def test_host_cannot_patch_contact(client, host_headers, sf_chapter, db_session):
    msg = await _mk_contact(db_session, sf_chapter.id)
    r = await client.patch(
        f"/admin/contact-messages/{msg.id}", json={"status": "handled"},
        headers=host_headers,
    )
    assert r.status_code == 403


async def test_public_hosting_interest_resolves_chapter(client, sf_chapter, db_session):
    r = await client.post(
        "/hosting-interest",
        json={
            "name": "T", "email": "t@x.co", "city": "SF",
            "interest_type": "host_existing",
            "existing_chapter": f"  {sf_chapter.name.upper()}  ",
        },
    )
    assert r.status_code in (200, 201)
    row = (await db_session.execute(select(HostingInterest))).scalars().one()
    assert row.chapter_id == sf_chapter.id
    assert row.status == "new"


async def test_lead_patches_own_hosting_interest_only(
    client, lead_headers, sf_chapter, db_session
):
    hi = HostingInterest(
        name="A", email="a@x.co", city="SF", interest_type="start_chapter"
    )
    db_session.add(hi)
    await db_session.commit()
    await db_session.refresh(hi)
    r = await client.patch(
        f"/admin/hosting-interest/{hi.id}", json={"status": "handled"},
        headers=lead_headers,
    )
    assert r.status_code == 404  # start_chapter is admin-only


async def test_lead_lists_only_own_chapter_host_existing_interest(
    client, lead_headers, sf_chapter, db_session, admin_headers
):
    rc = await client.post(
        "/admin/chapters", json={"code": "zz2", "name": "Zed Two"}, headers=admin_headers
    )
    other_id = rc.json()["id"]

    own = HostingInterest(
        name="Own", email="own@x.co", city="SF",
        interest_type="host_existing", chapter_id=sf_chapter.id,
    )
    other = HostingInterest(
        name="Other", email="other@x.co", city="LA",
        interest_type="host_existing", chapter_id=other_id,
    )
    starter = HostingInterest(
        name="Starter", email="start@x.co", city="NY", interest_type="start_chapter"
    )
    db_session.add_all([own, other, starter])
    await db_session.commit()

    r = await client.get("/admin/hosting-interest", headers=lead_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["chapter_id"] == sf_chapter.id
    assert body[0]["chapter_name"] == sf_chapter.name
    assert body[0]["status"] == "new"


async def test_superadmin_lists_all_hosting_interest(
    client, admin_headers, sf_chapter, db_session
):
    rc = await client.post(
        "/admin/chapters", json={"code": "zz3", "name": "Zed Three"}, headers=admin_headers
    )
    other_id = rc.json()["id"]

    own = HostingInterest(
        name="Own", email="own@x.co", city="SF",
        interest_type="host_existing", chapter_id=sf_chapter.id,
    )
    other = HostingInterest(
        name="Other", email="other@x.co", city="LA",
        interest_type="host_existing", chapter_id=other_id,
    )
    starter = HostingInterest(
        name="Starter", email="start@x.co", city="NY", interest_type="start_chapter"
    )
    db_session.add_all([own, other, starter])
    await db_session.commit()

    r = await client.get("/admin/hosting-interest", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 3
    by_name = {row["name"]: row for row in body}
    assert by_name["Own"]["chapter_name"] == sf_chapter.name
    assert by_name["Other"]["chapter_name"] == "Zed Three"
    assert by_name["Starter"]["chapter_name"] is None


async def test_host_cannot_list_hosting_interest(client, host_headers):
    r = await client.get("/admin/hosting-interest", headers=host_headers)
    assert r.status_code == 403


async def test_lead_patches_own_host_existing_hosting_interest_round_trip(
    client, lead_headers, chapter_lead, sf_chapter, db_session
):
    hi = HostingInterest(
        name="Own", email="own@x.co", city="SF",
        interest_type="host_existing", chapter_id=sf_chapter.id,
    )
    db_session.add(hi)
    await db_session.commit()
    await db_session.refresh(hi)

    r = await client.patch(
        f"/admin/hosting-interest/{hi.id}", json={"status": "handled"},
        headers=lead_headers,
    )
    assert r.status_code == 200
    assert r.json()["chapter_name"] == sf_chapter.name
    await db_session.refresh(hi)
    assert hi.status == "handled"
    assert hi.handled_by == chapter_lead.id
    assert hi.handled_at is not None

    r2 = await client.patch(
        f"/admin/hosting-interest/{hi.id}", json={"status": "new"},
        headers=lead_headers,
    )
    assert r2.status_code == 200
    assert r2.json()["chapter_name"] == sf_chapter.name
    await db_session.refresh(hi)
    assert hi.status == "new"
    assert hi.handled_by is None
    assert hi.handled_at is None


async def test_superadmin_patches_chapterless_hosting_interest_chapter_name_null(
    client, admin_headers, db_session
):
    """A start_chapter interest has no chapter — the PATCH response's
    chapter_name must come back null, not a stale/omitted field."""
    hi = HostingInterest(
        name="Starter", email="start@x.co", city="NY", interest_type="start_chapter"
    )
    db_session.add(hi)
    await db_session.commit()
    await db_session.refresh(hi)

    r = await client.patch(
        f"/admin/hosting-interest/{hi.id}", json={"status": "handled"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["chapter_name"] is None


async def test_public_hosting_interest_no_match_leaves_chapter_id_none(
    client, db_session
):
    r = await client.post(
        "/hosting-interest",
        json={
            "name": "T", "email": "t3@x.co", "city": "SF",
            "interest_type": "host_existing",
            "existing_chapter": "Nonexistent Chapter",
        },
    )
    assert r.status_code in (200, 201)
    row = (await db_session.execute(select(HostingInterest))).scalars().one()
    assert row.chapter_id is None
