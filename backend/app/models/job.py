import uuid
import enum
from typing import Any
from datetime import datetime
from sqlalchemy import String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class JobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=False)
    status: Mapped[JobStatus] = mapped_column(String(32), nullable=False, default=JobStatus.pending)
    input_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    input_storage_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    output_data: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")  # noqa: F821
    chapter: Mapped["Chapter"] = relationship("Chapter")  # noqa: F821
    article: Mapped["Article | None"] = relationship("Article", back_populates="job", uselist=False)  # noqa: F821
