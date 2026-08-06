from pydantic import BaseModel, Field


class ContactRequest(BaseModel):
    name: str | None = Field(default=None, max_length=256)
    email: str = Field(..., max_length=256, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    message: str = Field(..., min_length=10, max_length=5000)
    website: str | None = Field(default=None, max_length=256)  # honeypot
