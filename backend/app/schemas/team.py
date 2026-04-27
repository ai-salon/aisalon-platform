from pydantic import BaseModel


class TeamMemberOut(BaseModel):
    id: str
    name: str
    title: str | None
    description: str | None
    profile_image_url: str
    linkedin: str | None
    is_founder: bool
    chapter_code: str | None
    chapter_name: str | None

    model_config = {"from_attributes": True}
