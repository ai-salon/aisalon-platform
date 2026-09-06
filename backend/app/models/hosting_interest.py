import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import mapped_column, Mapped
from app.models.base import Base, TimestampMixin


class InterestType(str, enum.Enum):
    start_chapter = "start_chapter"
    host_existing = "host_existing"


class HostingInterest(Base, TimestampMixin):
    __tablename__ = "hosting_interest"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    email: Mapped[str] = mapped_column(String(256), nullable=False)
    city: Mapped[str] = mapped_column(String(256), nullable=False)
    interest_type: Mapped[InterestType] = mapped_column(String(32), nullable=False)
    existing_chapter: Mapped[str | None] = mapped_column(String(256), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    salons_attended: Mapped[str | None] = mapped_column(Text, nullable=True)
    facilitated_before: Mapped[str | None] = mapped_column(Text, nullable=True)
    themes_interested: Mapped[str | None] = mapped_column(Text, nullable=True)
    why_hosting: Mapped[str | None] = mapped_column(Text, nullable=True)
    hosting_frequency: Mapped[str | None] = mapped_column(String(64), nullable=True)
    space_options: Mapped[str | None] = mapped_column(Text, nullable=True)
    leadership_experience: Mapped[str | None] = mapped_column(Text, nullable=True)
    support_network: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    handled_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    handled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    chapter_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("chapters.id"), nullable=True, index=True
    )
