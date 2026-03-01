from datetime import datetime
from typing import Any
from pydantic import BaseModel
from app.models.api_key import APIKeyProvider
from app.models.job import JobStatus
from app.models.article import ArticleStatus


# ── API Keys ────────────────────────────────────────────────────────────────

class APIKeySetRequest(BaseModel):
    provider: APIKeyProvider
    key: str


class APIKeyResponse(BaseModel):
    provider: str
    has_key: bool


# ── Jobs ─────────────────────────────────────────────────────────────────────

class JobResponse(BaseModel):
    id: str
    status: JobStatus
    chapter_id: str
    input_filename: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Articles ─────────────────────────────────────────────────────────────────

class ArticleResponse(BaseModel):
    id: str
    title: str
    content_md: str
    status: ArticleStatus
    chapter_id: str
    job_id: str | None
    meta: Any | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ArticleUpdate(BaseModel):
    title: str | None = None
    content_md: str | None = None
    status: ArticleStatus | None = None
