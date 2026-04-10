"""Topics API: public listing + admin CRUD."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.topic import Topic
from app.models.user import User, UserRole

router = APIRouter(tags=["topics"])


def _require_admin(user: User) -> None:
    if user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


class TopicPublic(BaseModel):
    id: str
    title: str
    description: str
    opening_question: str
    prompts: list[str]
    display_order: int
    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    title: str
    description: str
    opening_question: str
    prompts: list[str] = []
    is_active: bool = True
    display_order: int = 0


class TopicUpdate(BaseModel):
    title: str
    description: str
    opening_question: str
    prompts: list[str]
    is_active: bool | None = None
    display_order: int | None = None


class TopicResponse(BaseModel):
    id: str
    title: str
    description: str
    opening_question: str
    prompts: list[str]
    is_active: bool
    display_order: int
    model_config = {"from_attributes": True}


@router.get("/topics", response_model=list[TopicPublic])
async def list_topics(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Topic)
        .where(Topic.is_active.is_(True))
        .order_by(Topic.display_order, Topic.title)
    )
    return result.scalars().all()


@router.get("/admin/topics", response_model=list[TopicResponse])
async def admin_list_topics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Topic).order_by(Topic.display_order, Topic.title))
    return result.scalars().all()


@router.post(
    "/admin/topics",
    response_model=TopicResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_topic(
    body: TopicCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    topic = Topic(**body.model_dump())
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.put("/admin/topics/{topic_id}", response_model=TopicResponse)
async def admin_update_topic(
    topic_id: str,
    body: TopicUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    for key, val in body.model_dump(exclude_none=True).items():
        setattr(topic, key, val)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/admin/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_topic(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    topic.is_active = False
    await db.commit()
