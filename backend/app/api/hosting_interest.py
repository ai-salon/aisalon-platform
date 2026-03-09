"""Public hosting interest endpoint."""
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.hosting_interest import HostingInterest, InterestType

router = APIRouter(tags=["hosting-interest"])


class HostingInterestCreate(BaseModel):
    name: str
    email: str
    city: str
    interest_type: InterestType
    existing_chapter: str | None = None
    message: str | None = None
    salons_attended: str | None = None
    facilitated_before: str | None = None
    themes_interested: str | None = None
    why_hosting: str | None = None
    hosting_frequency: str | None = None
    space_options: str | None = None


class HostingInterestResponse(BaseModel):
    id: str
    name: str
    email: str
    city: str
    interest_type: InterestType
    existing_chapter: str | None
    message: str | None
    salons_attended: str | None
    facilitated_before: str | None
    themes_interested: str | None
    why_hosting: str | None
    hosting_frequency: str | None
    space_options: str | None

    model_config = {"from_attributes": True}


@router.post(
    "/hosting-interest",
    response_model=HostingInterestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_hosting_interest(
    body: HostingInterestCreate,
    db: AsyncSession = Depends(get_db),
):
    record = HostingInterest(
        name=body.name,
        email=body.email,
        city=body.city,
        interest_type=body.interest_type,
        existing_chapter=body.existing_chapter,
        message=body.message,
        salons_attended=body.salons_attended,
        facilitated_before=body.facilitated_before,
        themes_interested=body.themes_interested,
        why_hosting=body.why_hosting,
        hosting_frequency=body.hosting_frequency,
        space_options=body.space_options,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record
