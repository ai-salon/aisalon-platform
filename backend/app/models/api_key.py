import uuid
import enum
from sqlalchemy import String, UniqueConstraint, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.models.base import Base, TimestampMixin


class APIKeyProvider(str, enum.Enum):
    assemblyai = "assemblyai"
    anthropic = "anthropic"
    google = "google"


class UserAPIKey(Base, TimestampMixin):
    __tablename__ = "user_api_keys"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_provider"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    provider: Mapped[APIKeyProvider] = mapped_column(String(32), nullable=False)
    encrypted_key: Mapped[str] = mapped_column(String(1024), nullable=False)

    user: Mapped["User"] = relationship("User")  # noqa: F821
