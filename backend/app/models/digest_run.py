import uuid
from datetime import date
from sqlalchemy import String, Date, Integer
from sqlalchemy.orm import mapped_column, Mapped
from app.models.base import Base, TimestampMixin


class DigestRun(Base, TimestampMixin):
    __tablename__ = "digest_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    recipients_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
