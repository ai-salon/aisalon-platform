"""Public articles endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.article import Article, ArticleStatus

router = APIRouter(prefix="/articles", tags=["articles"])


class ArticleSummary(BaseModel):
    id: str
    title: str
    status: str
    chapter_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleDetail(ArticleSummary):
    content_md: str


@router.get("", response_model=list[ArticleSummary])
async def list_articles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Article)
        .where(Article.status == ArticleStatus.published)
        .order_by(Article.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{article_id}", response_model=ArticleDetail)
async def get_article(article_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article or article.status != ArticleStatus.published:
        raise HTTPException(status_code=404, detail="Article not found")
    return article
