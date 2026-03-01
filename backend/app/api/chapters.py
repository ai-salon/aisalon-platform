from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.chapter import Chapter
from app.schemas.chapter import ChapterSummary, ChapterDetail

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("", response_model=list[ChapterSummary])
async def list_chapters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chapter).order_by(Chapter.name))
    return result.scalars().all()


@router.get("/{code}", response_model=ChapterDetail)
async def get_chapter(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Chapter).where(Chapter.code == code))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter
