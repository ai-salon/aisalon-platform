from datetime import datetime, date
from typing import Any, Literal
from pydantic import BaseModel, Field, field_validator
from app.models.api_key import APIKeyProvider
from app.models.job import JobStatus
from app.models.article import ArticleStatus
from app.models.user import UserRole
from app.models.hosting_interest import InterestType


# ── Chapters ──────────────────────────────────────────────────────────────────

class ChapterCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=32, pattern=r"^[a-z0-9-]+$")
    name: str = Field(..., min_length=1, max_length=128)


class ChapterUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    description: str | None = Field(default=None, max_length=120)
    tagline: str | None = None
    about: str | None = None
    event_link: str | None = None
    calendar_embed: str | None = None
    events_description: str | None = None
    status: Literal["draft", "active", "archived"] | None = None
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
    status: str
    chapter_guide: str | None = None

    model_config = {"from_attributes": True}


# ── API Keys ────────────────────────────────────────────────────────────────

class APIKeySetRequest(BaseModel):
    provider: APIKeyProvider
    key: str


class APIKeyResponse(BaseModel):
    provider: str
    has_key: bool  # effective: user OR system env var
    user_has_key: bool = False
    system_has_key: bool = False


# ── Jobs ─────────────────────────────────────────────────────────────────────

class JobResponse(BaseModel):
    id: str
    status: JobStatus
    step: str | None
    chapter_id: str
    input_filename: str | None
    source_article_id: str | None = None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Articles ─────────────────────────────────────────────────────────────────

class ArticleResponse(BaseModel):
    id: str
    title: str
    content_md: str
    anonymized_transcript: str | None
    source_filename: str | None = None
    content_hash: str | None = None
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
    """Superadmin edit of any account. Optional text fields sent as "" are cleared."""
    is_active: bool | None = None
    role: str | None = None
    chapter_id: str | None = None
    password: str | None = None
    title: str | None = None
    name: str | None = None
    email: str | None = None
    username: str | None = None
    linkedin: str | None = None
    description: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().lower()
        if "@" not in v or v.startswith("@") or v.endswith("@"):
            raise ValueError("email must be a valid address")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str | None) -> str | None:
        if v is not None and v not in {r.value for r in UserRole}:
            raise ValueError(f"role must be one of: {', '.join(r.value for r in UserRole)}")
        return v


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
    title: str | None = None
    name: str | None = None
    linkedin: str | None = None
    description: str | None = None

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


# ── Processing config (admin-managed keys + model) ────────────────────────────

class ProcessingConfigResponse(BaseModel):
    assemblyai_set: bool
    google_set: bool
    model: str
    model_source: str  # "setting" | "env" | "default"


class ProcessingTestRequest(BaseModel):
    target: str  # "assemblyai" | "google" | "model"
    value: str


class ProcessingTestResponse(BaseModel):
    ok: bool
    message: str


# ── Handled state (contact messages + hosting interest) ───────────────────────

class HandledPatch(BaseModel):
    status: Literal["new", "handled"]


class ContactMessageOut(BaseModel):
    id: str
    chapter_id: str
    chapter_name: str | None = None
    name: str | None
    email: str
    message: str
    status: str
    handled_by: str | None
    handled_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class HostingInterestAdminResponse(BaseModel):
    id: str
    name: str
    email: str
    city: str
    interest_type: InterestType
    existing_chapter: str | None
    message: str | None
    status: str
    handled_by: str | None
    handled_at: datetime | None
    chapter_id: str | None
    chapter_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Notifications summary ───────────────────────────────────────────────────

class NotificationsSummaryResponse(BaseModel):
    contact_messages: int
    hosting_interest: int
    volunteer_applications: int
    new_members: int
    community_uploads: int


# ── Digest test-send ─────────────────────────────────────────────────────────

class DigestRunTestRequest(BaseModel):
    window_days: int = Field(default=7, ge=1, le=31)
    only_me: bool = True


class DigestRunTestResponse(BaseModel):
    sent: int
    window_days: int
