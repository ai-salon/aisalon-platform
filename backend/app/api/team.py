from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.team_member import TeamMember
from app.models.chapter import Chapter
from app.schemas.team import TeamMemberOut

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=list[TeamMemberOut])
async def list_team(
    chapter: str | None = Query(None, description="Filter by chapter code"),
    db: AsyncSession = Depends(get_db),
):
    q = select(TeamMember).order_by(TeamMember.display_order)
    if chapter:
        q = q.join(Chapter).where(Chapter.code == chapter)
    result = await db.execute(q)
    return result.scalars().all()
