from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ProfileCompleteRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    profile_image_url: str = Field(..., min_length=1, max_length=512)
    linkedin: str | None = Field(default=None, max_length=512)
    description: str | None = Field(default=None, max_length=350)

    @field_validator("linkedin")
    @classmethod
    def _normalize_linkedin(cls, v: str | None) -> str | None:
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

    model_config = {"from_attributes": True}


class ProfilePhotoResponse(BaseModel):
    url: str
