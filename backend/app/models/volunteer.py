import uuid
import enum
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.chapter import Chapter


class ApplicationStatus(str, enum.Enum):
    pending = "pending"
    reviewed = "reviewed"
    accepted = "accepted"
    rejected = "rejected"


class VolunteerRole(Base, TimestampMixin):
    __tablename__ = "volunteer_role"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    slug: Mapped[str] = mapped_column(String(256), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_commitment: Mapped[str | None] = mapped_column(String(128), nullable=True)
    chapter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    chapter: Mapped["Chapter | None"] = relationship(
        "Chapter", foreign_keys=[chapter_id], lazy="select"
    )
    applications: Mapped[list["VolunteerApplication"]] = relationship(
        "VolunteerApplication", back_populates="role", lazy="select"
    )


class VolunteerApplication(Base, TimestampMixin):
    __tablename__ = "volunteer_application"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    role_id: Mapped[str] = mapped_column(String(36), ForeignKey("volunteer_role.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    email: Mapped[str] = mapped_column(String(256), nullable=False)
    city: Mapped[str] = mapped_column(String(256), nullable=False)
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    resume_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    why_interested: Mapped[str] = mapped_column(Text, nullable=False)
    relevant_experience: Mapped[str] = mapped_column(Text, nullable=False)
    availability: Mapped[str] = mapped_column(String(64), nullable=False)
    how_heard: Mapped[str | None] = mapped_column(String(256), nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(String(32), default=ApplicationStatus.pending, nullable=False)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    role: Mapped["VolunteerRole"] = relationship("VolunteerRole", back_populates="applications")
