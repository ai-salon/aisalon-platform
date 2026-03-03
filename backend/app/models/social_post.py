import uuid
import enum
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped
from app.models.base import Base, TimestampMixin


class SocialPostStatus(str, enum.Enum):
    pending = "pending"
    posted = "posted"
    failed = "failed"


class SocialPost(Base, TimestampMixin):
    __tablename__ = "social_posts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    article_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("articles.id"), nullable=True
    )
    platform: Mapped[str] = mapped_column(String(64), nullable=False, default="linkedin")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    external_post_id: Mapped[str | None] = mapped_column(String(256), nullable=True)
    status: Mapped[SocialPostStatus] = mapped_column(
        String(32), nullable=False, default=SocialPostStatus.pending
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
