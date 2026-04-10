import re

from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    identifier: str
    password: str


class RegisterRequest(BaseModel):
    invite_token: str
    username: str
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    username: str | None
    role: str
    chapter_id: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class InviteInfoResponse(BaseModel):
    chapter_name: str
    role: str
