"""Public articles endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, nullslast
from pydantic import BaseModel
from datetime import datetime, date

from app.core.database import get_db
from app.models.article import Article, ArticleStatus

router = APIRouter(prefix="/articles", tags=["articles"])


class ArticleSummary(BaseModel):
    id: str
    title: str
    status: str
    substack_url: str | None
    chapter_id: str
    created_at: datetime
    publish_date: date | None = None

    model_config = {"from_attributes": True}


class ArticleDetail(ArticleSummary):
    content_md: str


@router.get("", response_model=list[ArticleSummary])
async def list_articles(
    chapter_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Article)
        .where(Article.status == ArticleStatus.published)
        .order_by(
            nullslast(Article.publish_date.desc()),
            Article.created_at.desc(),
        )
    )
    if chapter_id:
        stmt = stmt.where(Article.chapter_id == chapter_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{article_id}", response_model=ArticleDetail)
async def get_article(article_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()
    if not article or article.status != ArticleStatus.published:
        raise HTTPException(status_code=404, detail="Article not found")
    return article
