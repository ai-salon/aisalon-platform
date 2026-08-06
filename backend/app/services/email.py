import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

RESEND_URL = "https://api.resend.com/emails"


async def send_email(
    to: list[str],
    subject: str,
    html: str,
    reply_to: str | None = None,
) -> bool:
    """Send a transactional email via Resend. Fail-closed: returns False
    (never raises) when unconfigured or on any transport/API error."""
    if not settings.RESEND_API_KEY:
        logger.warning("email_not_configured", subject=subject)
        return False
    payload: dict = {
        "from": settings.EMAIL_FROM,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
    except httpx.HTTPError as exc:
        logger.error("email_send_transport_error", error=str(exc), subject=subject)
        return False
    if resp.status_code >= 400:
        logger.error(
            "email_send_failed", status=resp.status_code, body=resp.text, subject=subject
        )
        return False
    logger.info("email_sent", to_count=len(to), subject=subject)
    return True
