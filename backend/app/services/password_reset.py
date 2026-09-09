"""Emailed password reset links.

Used by the public "Forgot password?" flow and by superadmins creating accounts
for people (the link doubles as "set your password" for a fresh account).
Tokens are single-use, stored hashed, and expire after RESET_TTL_HOURS.
"""
import hashlib
import html
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models.user import User
from app.services.email import send_email

logger = get_logger(__name__)

RESET_TTL_HOURS = 24


def email_configured() -> bool:
    return bool(settings.RESEND_API_KEY)


def issue_reset_token(user: User) -> str:
    """Attach a fresh reset token to ``user`` (caller commits) and return the raw token."""
    token = secrets.token_urlsafe(32)
    user.password_reset_token_hash = hashlib.sha256(token.encode()).hexdigest()
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=RESET_TTL_HOURS
    )
    return token


def reset_link(token: str) -> str:
    return f"{settings.FRONTEND_URL}/reset-password?token={token}"


async def send_password_reset_email(
    to_email: str, token: str, *, new_account: bool = False
) -> bool:
    link = html.escape(reset_link(token))
    if new_account:
        subject = "Set your Ai Salon password"
        intro = (
            "<p>An Ai Salon account has been created for you. "
            "Click the link below to choose your password and sign in:</p>"
        )
    else:
        subject = "Reset your Ai Salon password"
        intro = "<p>Click the link below to choose a new password for aisalon.xyz:</p>"
    body = (
        f"{intro}"
        f'<p><a href="{link}">{link}</a></p>'
        f"<p>This link expires in {RESET_TTL_HOURS} hours and can be used once. "
        f"If you didn't expect this email, you can ignore it.</p>"
    )
    return await send_email([to_email], subject, body)


async def find_user_by_reset_token(db: AsyncSession, token: str) -> User | None:
    """Return the user holding a live token, or None if unknown/expired."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(User).where(User.password_reset_token_hash == token_hash)
    )
    user = result.scalar_one_or_none()
    if user is None or user.password_reset_expires_at is None:
        return None
    expires = user.password_reset_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)  # SQLite drops tzinfo
    if expires < datetime.now(timezone.utc):
        return None
    return user


def clear_reset_token(user: User) -> None:
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
