"""Community upload API: public upload + admin queue management."""
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.community_upload import CommunityUpload, UploadStatus
from app.models.user import User, UserRole
from app.services.storage import save_upload

router = APIRouter(tags=["community"])

AUDIO_MAGIC_BYTES = {
    b"RIFF": "wav",
    b"ID3": "mp3",
    b"\xff\xfb": "mp3",
    b"\xff\xf3": "mp3",
    b"\xff\xf2": "mp3",
    b"fLaC": "flac",
    b"OggS": "ogg",
    b"\x00\x00\x00": "m4a",
}

MAX_UPLOAD_SIZE = 500 * 1024 * 1024


def _require_lead_or_above(user: User) -> None:
    if user.role not in (UserRole.superadmin, UserRole.chapter_lead):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _is_audio(data: bytes) -> bool:
    for magic in AUDIO_MAGIC_BYTES:
        if data[: len(magic)] == magic:
            return True
    return False


class CommunityUploadResponse(BaseModel):
    id: str
    name: str | None
    email: str | None
    topic_id: str | None
    audio_path: str
    notes: str | None
    status: UploadStatus
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class CommunityUploadUpdate(BaseModel):
    status: UploadStatus


@router.post(
    "/community/upload",
    response_model=CommunityUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def community_upload(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    email: str | None = Form(None),
    topic_id: str | None = Form(None),
    notes: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    data = await file.read()
    if not _is_audio(data):
        raise HTTPException(status_code=400, detail="Only audio files are accepted")
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 500 MB)")
    key = await save_upload(f"community/{file.filename or 'upload'}", data)
    upload = CommunityUpload(
        name=name,
        email=email,
        topic_id=topic_id,
        audio_path=key,
        notes=notes,
    )
    db.add(upload)
    await db.commit()
    await db.refresh(upload)
    return upload


@router.get(
    "/admin/community-uploads",
    response_model=list[CommunityUploadResponse],
)
async def admin_list_uploads(
    upload_status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    stmt = select(CommunityUpload).order_by(CommunityUpload.created_at.desc())
    if upload_status:
        stmt = stmt.where(CommunityUpload.status == upload_status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch(
    "/admin/community-uploads/{upload_id}",
    response_model=CommunityUploadResponse,
)
async def admin_update_upload(
    upload_id: str,
    body: CommunityUploadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    result = await db.execute(
        select(CommunityUpload).where(CommunityUpload.id == upload_id)
    )
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")
    upload.status = body.status
    await db.commit()
    await db.refresh(upload)
    return upload
