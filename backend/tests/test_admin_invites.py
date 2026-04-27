"""Tests for /admin/invites — invite gating by chapter status."""


async def test_create_invite_blocked_for_archived_chapter(
    client, admin_headers, db_session
):
    from app.models.chapter import Chapter
    arch = Chapter(
        code="zzz", name="Z", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="archived",
    )
    db_session.add(arch)
    await db_session.commit()
    await db_session.refresh(arch)

    r = await client.post("/admin/invites", headers=admin_headers, json={
        "chapter_id": arch.id,
        "role": "host",
        "max_uses": 1,
    })
    assert r.status_code == 400


async def test_create_invite_allowed_for_draft_chapter(
    client, admin_headers, db_session
):
    from app.models.chapter import Chapter
    draft = Chapter(
        code="dd", name="D", title="t", description="d",
        tagline="t", about="a", event_link="e", calendar_embed="c",
        events_description="e", status="draft",
    )
    db_session.add(draft)
    await db_session.commit()
    await db_session.refresh(draft)

    r = await client.post("/admin/invites", headers=admin_headers, json={
        "chapter_id": draft.id,
        "role": "host",
        "max_uses": 1,
    })
    assert r.status_code == 201
