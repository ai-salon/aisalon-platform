import uuid
from typing import Any
from sqlalchemy import String, Text, JSON
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class Chapter(Base, TimestampMixin):
    __tablename__ = "chapters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tagline: Mapped[str] = mapped_column(String(256), nullable=False)
    about: Mapped[str] = mapped_column(Text, nullable=False)
    event_link: Mapped[str] = mapped_column(String(512), nullable=False)
    calendar_embed: Mapped[str] = mapped_column(String(512), nullable=False)
    events_description: Mapped[str] = mapped_column(Text, nullable=False)
    about_blocks: Mapped[Any] = mapped_column(JSON, nullable=False, default=list)
    events_blocks: Mapped[Any] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    chapter_guide: Mapped[str | None] = mapped_column(Text, nullable=True)

    team_members: Mapped[list["TeamMember"]] = relationship(  # noqa: F821
        "TeamMember", back_populates="chapter", lazy="select"
    )
    users: Mapped[list["User"]] = relationship(  # noqa: F821
        "User", back_populates="chapter", lazy="select"
    )
