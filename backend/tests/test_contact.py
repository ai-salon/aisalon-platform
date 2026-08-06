from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models.contact_message import ContactMessage

VALID = {"name": "Vis Itor", "email": "vis@x.co", "message": "Hello chapter, tell me more!"}


async def _post(client, code, payload):
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)) as m:
        r = await client.post(f"/chapters/{code}/contact", json=payload)
    return r, m


async def test_contact_stores_row_and_emails_leads(
    client, sf_chapter, chapter_lead, db_session
):
    r, mail = await _post(client, sf_chapter.code, VALID)
    assert r.status_code == 202
    rows = (await db_session.execute(select(ContactMessage))).scalars().all()
    assert len(rows) == 1
    assert rows[0].chapter_id == sf_chapter.id
    mail.assert_awaited_once()
    to = mail.await_args.args[0] if mail.await_args.args else mail.await_args.kwargs["to"]
    assert chapter_lead.email in to
    assert mail.await_args.kwargs.get("reply_to") == "vis@x.co"


async def test_contact_falls_back_to_superadmins(client, sf_chapter, superadmin, db_session):
    # sf_chapter with no chapter_lead user in this test's fixtures
    r, mail = await _post(client, sf_chapter.code, VALID)
    assert r.status_code == 202
    to = mail.await_args.args[0] if mail.await_args.args else mail.await_args.kwargs["to"]
    assert superadmin.email in to


async def test_contact_honeypot_drops_silently(client, sf_chapter, db_session):
    r, mail = await _post(client, sf_chapter.code, {**VALID, "website": "spam.biz"})
    assert r.status_code == 202
    rows = (await db_session.execute(select(ContactMessage))).scalars().all()
    assert rows == []
    mail.assert_not_awaited()


async def test_contact_validates_message_length(client, sf_chapter):
    r, _ = await _post(client, sf_chapter.code, {**VALID, "message": "short"})
    assert r.status_code == 422


async def test_contact_404_on_unknown_chapter(client):
    r, _ = await _post(client, "nope", VALID)
    assert r.status_code == 404
