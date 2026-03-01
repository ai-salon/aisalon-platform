from pydantic import BaseModel


class TeamMemberOut(BaseModel):
    id: str
    name: str
    role: str
    description: str | None
    profile_image_url: str
    linkedin: str | None
    chapter_id: str
    is_cofounder: bool
    display_order: int

    model_config = {"from_attributes": True}
