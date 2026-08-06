from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ProfileCompleteRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    profile_image_url: str | None = Field(default=None, max_length=512)
    linkedin: str | None = Field(default=None, max_length=512)
    description: str | None = Field(default=None, max_length=350)

    @field_validator("profile_image_url", "linkedin")
    @classmethod
    def _normalize_optional(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        return v.strip()


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    profile_image_url: str | None = Field(default=None, max_length=512)
    linkedin: str | None = Field(default=None, max_length=512)
    description: str | None = Field(default=None, max_length=350)
    title: str | None = Field(default=None, max_length=160)
    scheduling_url: str | None = Field(default=None, max_length=512)
    hide_from_team: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _validate_name_not_null(cls, v):
        """Reject explicit null for name (consistent with min_length=1 intent)."""
        if v is None:
            raise ValueError("name cannot be null (omit the field to leave unchanged)")
        return v

    @field_validator("hide_from_team", mode="before")
    @classmethod
    def _validate_hide_from_team_not_null(cls, v):
        """Reject explicit null for hide_from_team (NOT NULL database constraint)."""
        if v is None:
            raise ValueError("hide_from_team cannot be null (omit the field to leave unchanged)")
        return v

    @field_validator("profile_image_url", "linkedin", "scheduling_url")
    @classmethod
    def _normalize_optional(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        return v.strip()


class ProfileResponse(BaseModel):
    id: str
    name: str | None
    profile_image_url: str | None
    linkedin: str | None
    description: str | None
    title: str | None
    is_founder: bool
    profile_completed_at: datetime | None
    email: str
    scheduling_url: str | None
    hide_from_team: bool
    pending_email: str | None

    model_config = {"from_attributes": True}


class ProfilePhotoResponse(BaseModel):
    url: str
