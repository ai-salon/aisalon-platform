from pydantic import BaseModel


class LoginRequest(BaseModel):
    identifier: str
    password: str


class RegisterRequest(BaseModel):
    invite_token: str
    username: str
    email: str
    password: str


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
