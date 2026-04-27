from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
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
