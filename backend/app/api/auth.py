from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, hash_password
from app.core.deps import get_current_user
from app.models.user import User
from app.models.invite import Invite
from app.models.chapter import Chapter
from app.models.login_event import UserLoginEvent
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, UserOut, InviteInfoResponse,
)

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            or_(User.email == body.identifier, User.username == body.identifier)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(timezone.utc)
    user.last_login_at = now
    db.add(UserLoginEvent(user_id=user.id, logged_in_at=now))
    await db.commit()

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role.value})
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

    ch_result = await db.execute(select(Chapter).where(Chapter.id == invite.chapter_id))
    chapter = ch_result.scalar_one_or_none()
    return InviteInfoResponse(
        chapter_name=chapter.name if chapter else "Unknown",
        role=invite.role,
    )


@router.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Validate invite
    result = await db.execute(select(Invite).where(Invite.token == body.invite_token))
    invite = result.scalar_one_or_none()
    if not invite or not invite.is_active:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if invite.use_count >= invite.max_uses:
        raise HTTPException(status_code=400, detail="Invite has been fully used")
    if invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite has expired")

    # Check uniqueness
    existing = await db.execute(
        select(User).where(or_(User.email == body.email, User.username == body.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email or username already taken")

    # Create user
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

    token = create_access_token({"sub": user.id, "email": user.email, "role": user.role})
    return TokenResponse(access_token=token)


@router.get("/admin/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
