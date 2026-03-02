import uuid
import secrets
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class Invite(Base, TimestampMixin):
    __tablename__ = "invites"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True,
        default=lambda: secrets.token_urlsafe(32),
    )
    chapter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("chapters.id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="host")
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    chapter: Mapped["Chapter"] = relationship("Chapter")  # noqa: F821
    creator: Mapped["User"] = relationship("User")  # noqa: F821
