from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.chapter import Chapter
from app.models.user import User
from app.schemas.profile import (
    ProfileCompleteRequest,
    ProfileResponse,
    ProfilePhotoResponse,
)
from app.services.storage import save_upload

router = APIRouter(prefix="/profile", tags=["profile"])

MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_PREFIXES = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")  # jpeg, png


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


async def _default_title(user: User, db: AsyncSession) -> str | None:
    if user.role.value == "chapter_lead" and user.chapter_id:
        result = await db.execute(select(Chapter).where(Chapter.id == user.chapter_id))
        ch = result.scalar_one_or_none()
        if ch:
            return f"{ch.name} Chapter Lead"
    if user.role.value == "host":
        return "Host"
    return None
