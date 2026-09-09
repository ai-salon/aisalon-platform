import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import limiter
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import verify_password
from app.models.chapter import Chapter
from app.models.user import User
from app.schemas.profile import (
    EmailChangeRequest,
    ProfileCompleteRequest,
    ProfileUpdateRequest,
    ProfileResponse,
    ProfilePhotoResponse,
)
from app.services.email import send_email
from app.services.storage import save_upload

router = APIRouter(prefix="/profile", tags=["profile"])

MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_PREFIXES = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")  # jpeg, png
EMAIL_CHANGE_TTL_HOURS = 24


@router.post("/photo", response_model=ProfilePhotoResponse)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    data = await file.read()
    if len(data) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")
    if not any(data.startswith(p) for p in ALLOWED_IMAGE_PREFIXES):
        raise HTTPException(status_code=400, detail="Only JPEG or PNG images are allowed")
    filename = file.filename or "photo.jpg"
    key = await save_upload(filename, data)
    return ProfilePhotoResponse(url=f"/uploads/{key}")


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.post("/complete", response_model=ProfileResponse)
async def complete_profile(
    body: ProfileCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.name = body.name
    current_user.profile_image_url = body.profile_image_url
    current_user.linkedin = body.linkedin
    current_user.description = body.description
    if current_user.profile_completed_at is None:
        current_user.profile_completed_at = datetime.now(timezone.utc)
    if not current_user.title:
        current_user.title = await _default_title(current_user, db)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.patch("/me", response_model=ProfileResponse)
async def update_my_profile(
    body: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    if current_user.name and current_user.profile_completed_at is None:
        current_user.profile_completed_at = datetime.now(timezone.utc)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/email-change", status_code=202)
@limiter.limit("3/hour")
async def initiate_email_change(
    request: Request,
    body: EmailChangeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    new_email = body.new_email.strip().lower()
    if new_email == current_user.email.lower():
        raise HTTPException(status_code=400, detail="That is already your email")
    existing = await db.execute(select(User).where(User.email == new_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already in use")
    if not settings.RESEND_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Email is not configured — contact an administrator",
        )
    token = secrets.token_urlsafe(32)
    current_user.pending_email = new_email
    current_user.email_change_token_hash = hashlib.sha256(token.encode()).hexdigest()
    current_user.email_change_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=EMAIL_CHANGE_TTL_HOURS
    )
    db.add(current_user)
    await db.commit()
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    background_tasks.add_task(
        send_email,
        [new_email],
        "Confirm your new Ai Salon login email",
        f"<p>Click to confirm your new login email for aisalon.xyz:</p>"
        f'<p><a href="{link}">{link}</a></p>'
        f"<p>This link expires in {EMAIL_CHANGE_TTL_HOURS} hours. "
        f"If you didn't request this, ignore this email.</p>",
    )
    return {"detail": f"Verification sent to {new_email}"}


@router.delete("/email-change", status_code=204)
async def cancel_email_change(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.pending_email = None
    current_user.email_change_token_hash = None
    current_user.email_change_expires_at = None
    db.add(current_user)
    await db.commit()


async def _default_title(user: User, db: AsyncSession) -> str | None:
    if user.role.value == "chapter_lead" and user.chapter_id:
        result = await db.execute(select(Chapter).where(Chapter.id == user.chapter_id))
        ch = result.scalar_one_or_none()
        if ch:
            return f"{ch.name} Chapter Lead"
    if user.role.value == "host":
        return "Host"
    return None
