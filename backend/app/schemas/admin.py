from datetime import datetime, date
from typing import Any
from pydantic import BaseModel, field_validator
from app.models.api_key import APIKeyProvider
from app.models.job import JobStatus
from app.models.article import ArticleStatus


# ── Chapters ──────────────────────────────────────────────────────────────────

class ChapterUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    description: str | None = None
    tagline: str | None = None
    about: str | None = None
    event_link: str | None = None
    calendar_embed: str | None = None
    events_description: str | None = None
    about_blocks: Any | None = None
    events_blocks: Any | None = None
    status: str | None = None
    chapter_guide: str | None = None


class ChapterResponse(BaseModel):
    id: str
    code: str
    name: str
    title: str
    description: str
    tagline: str
    about: str
    event_link: str
    calendar_embed: str
    events_description: str
    about_blocks: Any
    events_blocks: Any
    status: str
    chapter_guide: str | None = None

    model_config = {"from_attributes": True}


# ── Team Members ──────────────────────────────────────────────────────────────

class TeamMemberCreate(BaseModel):
    name: str
    role: str
    chapter_id: str
    description: str | None = None
    profile_image_url: str = ""
    linkedin: str | None = None
    is_cofounder: bool = False
    display_order: int = 0


class TeamMemberUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    description: str | None = None
    profile_image_url: str | None = None
    linkedin: str | None = None
    is_cofounder: bool | None = None
    display_order: int | None = None


class TeamMemberResponse(BaseModel):
    id: str
    name: str
    role: str
    chapter_id: str
    description: str | None
    profile_image_url: str
    linkedin: str | None
    is_cofounder: bool
    display_order: int

    model_config = {"from_attributes": True}


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
    step: str | None
    chapter_id: str
    input_filename: str | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Articles ─────────────────────────────────────────────────────────────────

class ArticleResponse(BaseModel):
    id: str
    title: str
    content_md: str
    anonymized_transcript: str | None
    substack_url: str | None
    status: ArticleStatus
    chapter_id: str
    job_id: str | None
    meta: Any | None
    publish_date: date | None = None
    substack_draft_id: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ArticleUpdate(BaseModel):
    title: str | None = None
    content_md: str | None = None
    substack_url: str | None = None
    status: ArticleStatus | None = None
    publish_date: date | None = None


class ArticleCreate(BaseModel):
    title: str
    substack_url: str
    publish_date: date | None = None
    chapter_id: str | None = None

    @field_validator("substack_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("substack_url must be a valid HTTP or HTTPS URL")
        return v


# ── Users ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    username: str | None = None
    password: str
    role: str = "chapter_lead"
    chapter_id: str | None = None


class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: str | None = None
    chapter_id: str | None = None
    password: str | None = None


class UserResponse(BaseModel):
    id: str
    email: str
    username: str | None
    role: str
    chapter_id: str | None
    is_active: bool
    last_login_at: datetime | None = None
    login_count_30d: int = 0
    has_api_key: bool = False
    has_uploaded: bool = False
    has_article: bool = False
    has_read_hosting_guide: bool = False
    has_read_lead_guide: bool = False
    scheduling_url: str | None = None

    model_config = {"from_attributes": True}


class GuideReadRequest(BaseModel):
    guide: str  # "hosting" | "lead"


# ── Invites ────────────────────────────────────────────────────────────────────

class InviteCreate(BaseModel):
    chapter_id: str
    role: str = "host"
    max_uses: int = 1


class InviteResponse(BaseModel):
    id: str
    token: str
    chapter_id: str
    role: str
    max_uses: int
    use_count: int
    is_active: bool

    model_config = {"from_attributes": True}


# ── Community Stats ──────────────────────────────────────────────────────────

class ChapterStats(BaseModel):
    chapter_id: str | None = None
    chapter_name: str
    chapter_code: str
    articles_count: int = 0
    published_count: int = 0
    draft_count: int = 0
    jobs_count: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    team_size: int = 0


class CommunityStatsResponse(BaseModel):
    chapters: list[ChapterStats]
    totals: ChapterStats


# ── System Settings ──────────────────────────────────────────────────────────

class SystemSettingRequest(BaseModel):
    key: str
    value: str


class SystemSettingResponse(BaseModel):
    key: str
    has_value: bool
