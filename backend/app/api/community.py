"""Community upload API: public upload + admin queue management."""
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import limiter
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

MAX_UPLOAD_SIZE = 150 * 1024 * 1024  # 150 MB


def _require_lead_or_above(user: User) -> None:
    if user.role not in (UserRole.superadmin, UserRole.chapter_lead):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _is_audio(data: bytes) -> bool:
    for magic in AUDIO_MAGIC_BYTES:
        if data[: len(magic)] == magic:
            return True
    return False


class CommunityUploadPublicResponse(BaseModel):
    id: str
    status: UploadStatus
    created_at: datetime
    model_config = {"from_attributes": True}


class CommunityUploadResponse(BaseModel):
    id: str
    name: str | None
    email: str | None
    topic_id: str | None
    topic_text: str | None
    city: str
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
    response_model=CommunityUploadPublicResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/hour")
async def community_upload(
    request: Request,
    file: UploadFile = File(...),
    name: str | None = Form(None),
    email: str | None = Form(None),
    topic_id: str | None = Form(None),
    topic_text: str | None = Form(None),
    city: str = Form(...),
    notes: str | None = Form(None),
    website: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # Honeypot — bots fill this; real users don't
    if website:
        return JSONResponse(
            {"id": "submitted", "status": "pending", "created_at": datetime.utcnow().isoformat()},
            status_code=200,
        )

    if not topic_id and not (topic_text and topic_text.strip()):
        raise HTTPException(status_code=422, detail="topic_id or topic_text is required")

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 150 MB)")

    data = await file.read()
    if not _is_audio(data):
        raise HTTPException(status_code=400, detail="Only audio files are accepted")
    if len(data) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 150 MB)")

    key = await save_upload(f"community/{file.filename or 'upload'}", data)
    upload = CommunityUpload(
        name=name,
        email=email,
        topic_id=topic_id,
        topic_text=topic_text,
        city=city,
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
