import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import mapped_column, Mapped
from app.models.base import Base


class UserLoginEvent(Base):
    __tablename__ = "user_login_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    logged_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
