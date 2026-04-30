import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum, DateTime, Integer, Text
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    chapter_lead = "chapter_lead"
    host = "host"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.chapter_lead)
    chapter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hosting_guide_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lead_guide_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scheduling_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Profile fields (added 2026-04-26)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(160), nullable=True)
    is_founder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    profile_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hide_from_team: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    chapter: Mapped["Chapter | None"] = relationship("Chapter", back_populates="users")  # noqa: F821
