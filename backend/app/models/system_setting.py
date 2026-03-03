import uuid
from sqlalchemy import String, Text
from sqlalchemy.orm import mapped_column, Mapped
from app.models.base import Base, TimestampMixin


class SystemSetting(Base, TimestampMixin):
    __tablename__ = "system_settings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    key: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
