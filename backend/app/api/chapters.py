from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.chapter import Chapter
from app.schemas.chapter import ChapterSummary, ChapterDetail

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.get("", response_model=list[ChapterSummary])
async def list_chapters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Chapter)
        .where(Chapter.status == "active")
        .order_by(Chapter.name)
    )
    return result.scalars().all()


@router.get("/{identifier}", response_model=ChapterDetail)
async def get_chapter(identifier: str, db: AsyncSession = Depends(get_db)):
    # Accept either code (string slug) or id (UUID)
    stmt = (
        select(Chapter)
        .options(selectinload(Chapter.team_members))
        .where(
            (Chapter.status == "active")
            & ((Chapter.code == identifier) | (Chapter.id == identifier))
        )
    )
    result = await db.execute(stmt)
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter
