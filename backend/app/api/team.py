from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.chapter import Chapter
from app.schemas.team import TeamMemberOut

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=list[TeamMemberOut])
async def list_team(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(User)
        .options(selectinload(User.chapter))
        .outerjoin(Chapter, User.chapter_id == Chapter.id)
        .where(User.profile_completed_at.is_not(None))
        .where(User.hide_from_team.is_(False))
        .where(
            (User.is_founder.is_(True))
            | ((User.role == UserRole.chapter_lead) & (Chapter.status == "active"))
        )
    )
    result = await db.execute(stmt)
    users = result.scalars().unique().all()

    def sort_key(u: User) -> tuple:
        founder_bucket = 0 if u.is_founder else 1
        chapter_name = (u.chapter.name if u.chapter else "")
        return (founder_bucket, chapter_name, u.display_order, u.created_at)

    users.sort(key=sort_key)

    return [
        TeamMemberOut(
            id=u.id,
            name=u.name or "",
            title=u.title,
            description=u.description,
            profile_image_url=u.profile_image_url or "",
            linkedin=u.linkedin,
            is_founder=u.is_founder,
            chapter_code=(u.chapter.code if u.chapter else None),
            chapter_name=(u.chapter.name if u.chapter else None),
        )
        for u in users
    ]
