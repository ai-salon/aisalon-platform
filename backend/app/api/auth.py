import hashlib
import html
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.logging import get_logger
from app.core.security import verify_password, create_access_token, hash_password
from app.core.deps import get_current_user
from app.models.user import User
from app.models.invite import Invite
from app.models.chapter import Chapter
from app.models.login_event import UserLoginEvent
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, UserOut, InviteInfoResponse,
    ChangePasswordRequest, VerifyEmailChangeRequest, VerifyEmailChangeResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.services import password_reset
from app.services.email import send_email

logger = get_logger(__name__)

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.ENVIRONMENT not in ("development", "test"),
)
router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("5/15minutes")
async def login(
    request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User).where(
            or_(User.email == body.identifier, User.username == body.identifier)
        )
    )
    user = result.scalar_one_or_none()

    if (
        not user
        or not verify_password(body.password, user.hashed_password)
        or not user.is_active
    ):
        logger.warning("login_failed", identifier=body.identifier)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(timezone.utc)
    user.last_login_at = now
    db.add(UserLoginEvent(user_id=user.id, logged_in_at=now))
    await db.commit()

    logger.info("login_success", user_id=user.id, role=user.role.value)
    token = create_access_token(
        {"sub": user.id, "email": user.email, "role": user.role.value}
    )
    return TokenResponse(access_token=token)


@router.get("/auth/invite/{token}", response_model=InviteInfoResponse)
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Invite).where(Invite.token == token))
    invite = result.scalar_one_or_none()
    if not invite or not invite.is_active:
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    if invite.use_count >= invite.max_uses:
        raise HTTPException(status_code=410, detail="Invite has been fully used")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invite has expired")

    ch_result = await db.execute(
        select(Chapter).where(Chapter.id == invite.chapter_id)
    )
    chapter = ch_result.scalar_one_or_none()
    return InviteInfoResponse(
        chapter_name=chapter.name if chapter else "Unknown",
        role=invite.role,
    )


@router.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invite).where(Invite.token == body.invite_token)
    )
    invite = result.scalar_one_or_none()
    if not invite or not invite.is_active:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if invite.use_count >= invite.max_uses:
        raise HTTPException(status_code=400, detail="Invite has been fully used")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")

    existing = await db.execute(
        select(User).where(
            or_(User.email == body.email, User.username == body.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail="Email or username already taken"
        )

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        role=invite.role,
        chapter_id=invite.chapter_id,
        is_active=True,
    )
    db.add(user)
    invite.use_count += 1
    await db.commit()
    await db.refresh(user)

    logger.info(
        "user_registered",
        user_id=user.id,
        role=invite.role,
        chapter_id=str(invite.chapter_id),
    )
    token = create_access_token(
        {"sub": user.id, "email": user.email, "role": user.role.value}
    )
    return TokenResponse(access_token=token)


@router.get("/admin/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/auth/verify-email-change", response_model=VerifyEmailChangeResponse)
@limiter.limit("10/15minutes")
async def verify_email_change(
    request: Request,
    body: VerifyEmailChangeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    result = await db.execute(
        select(User).where(User.email_change_token_hash == token_hash)
    )
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    expires = user.email_change_expires_at if user else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)  # SQLite drops tzinfo
    if not user or not user.pending_email or not expires or expires < now:
        raise HTTPException(status_code=400, detail="Invalid or expired link")
    taken = await db.execute(
        select(User).where(User.email == user.pending_email, User.id != user.id)
    )
    if taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")
    old_email = user.email
    user.email = user.pending_email
    user.pending_email = None
    user.email_change_token_hash = None
    user.email_change_expires_at = None
    db.add(user)
    await db.commit()
    logger.info("email_change_verified", user_id=user.id)
    background_tasks.add_task(
        send_email,
        [old_email],
        "Your Ai Salon login email was changed",
        f"<p>Your login email was changed to <b>{html.escape(user.email)}</b>. "
        f"If this wasn't you, contact an administrator immediately.</p>",
    )
    return VerifyEmailChangeResponse(email=user.email)


@router.post("/auth/forgot-password", status_code=202)
@limiter.limit("5/15minutes")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Email a single-use reset link. Always 202 so addresses can't be probed."""
    if not password_reset.email_configured():
        raise HTTPException(
            status_code=503,
            detail="Email is not configured — contact an administrator",
        )
    email = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        token = password_reset.issue_reset_token(user)
        db.add(user)
        await db.commit()
        background_tasks.add_task(
            password_reset.send_password_reset_email, user.email, token
        )
        logger.info("password_reset_requested", user_id=user.id)
    else:
        logger.info("password_reset_requested_unknown")
    return {"detail": "If that email has an account, a reset link is on its way."}


@router.post("/auth/reset-password", status_code=204)
@limiter.limit("10/15minutes")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await password_reset.find_user_by_reset_token(db, body.token)
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid or expired link")
    user.hashed_password = hash_password(body.new_password)
    password_reset.clear_reset_token(user)
    db.add(user)
    await db.commit()
    logger.info("password_reset_completed", user_id=user.id)


@router.post("/auth/change-password", status_code=204)
@limiter.limit("10/15minutes")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        logger.warning("change_password_wrong_current", user_id=current_user.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    logger.info("change_password_success", user_id=current_user.id)
