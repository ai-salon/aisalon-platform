from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.models.contact_message import ContactMessage

VALID = {"name": "Vis Itor", "email": "vis@x.co", "message": "Hello chapter, tell me more!"}


async def _post(client, code, payload):
    with patch("app.api.chapters.send_email", new=AsyncMock(return_value=True)) as m:
        r = await client.post(f"/chapters/{code}/contact", json=payload)
    return r, m


async def _post_with_send_result(client, code, payload, send_result):
    with patch(
        "app.api.chapters.send_email", new=AsyncMock(return_value=send_result)
    ) as m:
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


async def test_contact_failed_send_leaves_forwarded_at_null(
    client, sf_chapter, chapter_lead, db_session
):
    r, mail = await _post_with_send_result(client, sf_chapter.code, VALID, False)
    assert r.status_code == 202
    mail.assert_awaited_once()
    rows = (await db_session.execute(select(ContactMessage))).scalars().all()
    assert len(rows) == 1
    assert rows[0].forwarded_at is None


async def test_contact_email_html_escapes_message(client, sf_chapter, chapter_lead):
    payload = {**VALID, "message": "Hello <b>hi</b> there, please respond soon"}
    r, mail = await _post(client, sf_chapter.code, payload)
    assert r.status_code == 202
    html_body = mail.await_args.args[2]
    assert "&lt;b&gt;hi&lt;/b&gt;" in html_body
    assert "<b>hi</b>" not in html_body
