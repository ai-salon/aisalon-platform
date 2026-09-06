from unittest.mock import AsyncMock, patch

from app.services.email import send_email


async def test_send_email_refuses_when_unconfigured(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.RESEND_API_KEY", "")
    ok = await send_email(["a@b.co"], "Hi", "<p>hi</p>")
    assert ok is False


async def test_send_email_posts_to_resend(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.RESEND_API_KEY", "re_test_123")
    monkeypatch.setattr(
        "app.services.email.settings.EMAIL_FROM", "Ai Salon <noreply@aisalon.xyz>"
    )
    fake_resp = AsyncMock()
    fake_resp.status_code = 200
    with patch("app.services.email.httpx.AsyncClient.post", return_value=fake_resp) as post:
        ok = await send_email(
            ["lead@x.co"], "Subject", "<p>body</p>", reply_to="visitor@y.co"
        )
    assert ok is True
    payload = post.call_args.kwargs["json"]
    assert payload["to"] == ["lead@x.co"]
    assert payload["from"] == "Ai Salon <noreply@aisalon.xyz>"
    assert payload["reply_to"] == "visitor@y.co"


async def test_send_email_returns_false_on_http_error(monkeypatch):
    monkeypatch.setattr("app.services.email.settings.RESEND_API_KEY", "re_test_123")
    fake_resp = AsyncMock()
    fake_resp.status_code = 422
    fake_resp.text = "invalid"
    with patch("app.services.email.httpx.AsyncClient.post", return_value=fake_resp):
        ok = await send_email(["a@b.co"], "Hi", "<p>hi</p>")
    assert ok is False
