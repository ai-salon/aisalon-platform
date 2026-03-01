import uuid
from sqlalchemy import String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class TeamMember(Base, TimestampMixin):
    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")
    linkedin: Mapped[str | None] = mapped_column(String(512), nullable=True)
    chapter_id: Mapped[str] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=False)
    is_cofounder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    chapter: Mapped["Chapter"] = relationship("Chapter", back_populates="team_members")  # noqa: F821
