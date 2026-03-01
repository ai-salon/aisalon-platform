import uuid
import enum
from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    chapter_lead = "chapter_lead"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), nullable=False, default=UserRole.chapter_lead)
    chapter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("chapters.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    chapter: Mapped["Chapter | None"] = relationship("Chapter", back_populates="users")  # noqa: F821
