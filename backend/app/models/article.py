import uuid
import enum
from typing import Any
from sqlalchemy import String, Text, JSON, Date, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin
import datetime as _dt


class ArticleStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    published = "published"


class Article(Base, TimestampMixin):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("jobs.id"), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    anonymized_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    substack_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    meta: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ArticleStatus] = mapped_column(String(32), nullable=False, default=ArticleStatus.draft)
    publish_date: Mapped[_dt.date | None] = mapped_column(Date, nullable=True)
    substack_draft_id: Mapped[str | None] = mapped_column(String(256), nullable=True)

    job: Mapped["Job | None"] = relationship("Job", back_populates="article")  # noqa: F821
    chapter: Mapped["Chapter"] = relationship("Chapter")  # noqa: F821
