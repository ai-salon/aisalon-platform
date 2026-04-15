"""Volunteer roles: public listing/apply + admin management."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.chapter import Chapter
from app.models.user import User, UserRole
from app.models.volunteer import VolunteerRole, VolunteerApplication, ApplicationStatus

router = APIRouter(tags=["volunteer"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _require_lead_or_above(user: User) -> None:
    if user.role not in (UserRole.superadmin, UserRole.chapter_lead):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _chapter_filter(user: User):
    if user.role in (UserRole.chapter_lead, UserRole.host):
        return user.chapter_id
    return None


# ── Public Schemas ───────────────────────────────────────────────────────────

class VolunteerRolePublic(BaseModel):
    id: str
    title: str
    slug: str
    description: str
    requirements: str | None
    time_commitment: str | None
    chapter_id: str | None
    chapter_code: str | None = None
    chapter_name: str | None = None
    display_order: int

    model_config = {"from_attributes": True}


class VolunteerApplyRequest(BaseModel):
    name: str
    email: str
    city: str
    linkedin_url: str | None = None
    why_interested: str
    relevant_experience: str
    availability: str
    how_heard: str | None = None


class VolunteerApplyResponse(BaseModel):
    id: str
    role_id: str
    name: str
    email: str
    status: ApplicationStatus

    model_config = {"from_attributes": True}


# ── Admin Schemas ────────────────────────────────────────────────────────────

class VolunteerRoleCreate(BaseModel):
    title: str
    slug: str
    description: str
    requirements: str | None = None
    time_commitment: str | None = None
    chapter_id: str | None = None
    is_active: bool = True
    display_order: int = 0


class VolunteerRoleUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    description: str | None = None
    requirements: str | None = None
    time_commitment: str | None = None
    chapter_id: str | None = None
    is_active: bool | None = None
    display_order: int | None = None


class VolunteerRoleResponse(BaseModel):
    id: str
    title: str
    slug: str
    description: str
    requirements: str | None
    time_commitment: str | None
    chapter_id: str | None
    chapter_code: str | None = None
    chapter_name: str | None = None
    is_active: bool
    display_order: int
    application_count: int = 0

    model_config = {"from_attributes": True}


class VolunteerApplicationResponse(BaseModel):
    id: str
    role_id: str
    role_title: str = ""
    name: str
    email: str
    city: str
    linkedin_url: str | None
    why_interested: str
    relevant_experience: str
    availability: str
    how_heard: str | None
    status: ApplicationStatus
    admin_notes: str | None
    reviewed_by: str | None
    reviewed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VolunteerApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None
    admin_notes: str | None = None


# ── Response builders ────────────────────────────────────────────────────────

def _role_public(role: VolunteerRole) -> VolunteerRolePublic:
    ch = role.chapter
    return VolunteerRolePublic(
        id=role.id,
        title=role.title,
        slug=role.slug,
        description=role.description,
        requirements=role.requirements,
        time_commitment=role.time_commitment,
        chapter_id=role.chapter_id,
        chapter_code=ch.code if ch else None,
        chapter_name=ch.name if ch else None,
        display_order=role.display_order,
    )


def _role_response(role: VolunteerRole, application_count: int = 0) -> VolunteerRoleResponse:
    ch = role.chapter
    return VolunteerRoleResponse(
        id=role.id,
        title=role.title,
        slug=role.slug,
        description=role.description,
        requirements=role.requirements,
        time_commitment=role.time_commitment,
        chapter_id=role.chapter_id,
        chapter_code=ch.code if ch else None,
        chapter_name=ch.name if ch else None,
        is_active=role.is_active,
        display_order=role.display_order,
        application_count=application_count,
    )


# ── Public Endpoints ─────────────────────────────────────────────────────────

@router.get("/volunteer-roles", response_model=list[VolunteerRolePublic])
async def list_volunteer_roles(
    chapter_code: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(VolunteerRole)
        .options(selectinload(VolunteerRole.chapter))
        .where(VolunteerRole.is_active.is_(True))
    )
    if chapter_code:
        # Show global roles + roles for the requested chapter
        chapter_result = await db.execute(
            select(Chapter).where(Chapter.code == chapter_code)
        )
        chapter = chapter_result.scalar_one_or_none()
        chapter_id = chapter.id if chapter else None
        stmt = stmt.where(
            (VolunteerRole.chapter_id == chapter_id) | (VolunteerRole.chapter_id.is_(None))
        )
    stmt = stmt.order_by(VolunteerRole.display_order, VolunteerRole.title)
    result = await db.execute(stmt)
    return [_role_public(r) for r in result.scalars().all()]


@router.get("/volunteer-roles/{slug}", response_model=VolunteerRolePublic)
async def get_volunteer_role(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VolunteerRole)
        .options(selectinload(VolunteerRole.chapter))
        .where(VolunteerRole.slug == slug, VolunteerRole.is_active.is_(True))
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return _role_public(role)


@router.post(
    "/volunteer-roles/{slug}/apply",
    response_model=VolunteerApplyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def apply_for_role(
    slug: str,
    body: VolunteerApplyRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VolunteerRole)
        .where(VolunteerRole.slug == slug, VolunteerRole.is_active.is_(True))
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    application = VolunteerApplication(
        role_id=role.id,
        name=body.name,
        email=body.email,
        city=body.city,
        linkedin_url=body.linkedin_url,
        why_interested=body.why_interested,
        relevant_experience=body.relevant_experience,
        availability=body.availability,
        how_heard=body.how_heard,
    )
    db.add(application)
    await db.commit()
    await db.refresh(application)
    return application


# ── Admin Endpoints ──────────────────────────────────────────────────────────

@router.get("/admin/volunteer-roles", response_model=list[VolunteerRoleResponse])
async def admin_list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    ch = _chapter_filter(current_user)

    stmt = select(VolunteerRole).options(selectinload(VolunteerRole.chapter))
    if ch:
        stmt = stmt.where(
            (VolunteerRole.chapter_id == ch) | (VolunteerRole.chapter_id.is_(None))
        )
    stmt = stmt.order_by(VolunteerRole.display_order, VolunteerRole.title)
    result = await db.execute(stmt)
    roles = result.scalars().all()

    # Attach application counts
    role_ids = [r.id for r in roles]
    if role_ids:
        count_result = await db.execute(
            select(
                VolunteerApplication.role_id,
                func.count(VolunteerApplication.id),
            )
            .where(VolunteerApplication.role_id.in_(role_ids))
            .group_by(VolunteerApplication.role_id)
        )
        counts = dict(count_result.all())
    else:
        counts = {}

    return [_role_response(r, counts.get(r.id, 0)) for r in roles]


@router.post(
    "/admin/volunteer-roles",
    response_model=VolunteerRoleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def admin_create_role(
    body: VolunteerRoleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    role = VolunteerRole(**body.model_dump())
    db.add(role)
    await db.commit()
    await db.refresh(role, attribute_names=["chapter"])
    return _role_response(role)


@router.patch("/admin/volunteer-roles/{role_id}", response_model=VolunteerRoleResponse)
async def admin_update_role(
    role_id: str,
    body: VolunteerRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    result = await db.execute(select(VolunteerRole).where(VolunteerRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    for key, val in body.model_dump(exclude_none=True).items():
        setattr(role, key, val)
    await db.commit()
    await db.refresh(role, attribute_names=["chapter"])
    return _role_response(role)


@router.delete("/admin/volunteer-roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_role(
    role_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    result = await db.execute(select(VolunteerRole).where(VolunteerRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role.is_active = False
    await db.commit()


@router.get(
    "/admin/volunteer-applications",
    response_model=list[VolunteerApplicationResponse],
)
async def admin_list_applications(
    role_id: str | None = None,
    app_status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    ch = _chapter_filter(current_user)

    stmt = (
        select(VolunteerApplication)
        .join(VolunteerRole)
        .options(selectinload(VolunteerApplication.role))
    )
    if ch:
        stmt = stmt.where(
            (VolunteerRole.chapter_id == ch) | (VolunteerRole.chapter_id.is_(None))
        )
    if role_id:
        stmt = stmt.where(VolunteerApplication.role_id == role_id)
    if app_status:
        stmt = stmt.where(VolunteerApplication.status == app_status)

    stmt = stmt.order_by(VolunteerApplication.created_at.desc())
    result = await db.execute(stmt)
    apps = result.scalars().all()

    out = []
    for a in apps:
        data = VolunteerApplicationResponse.model_validate(a)
        data.role_title = a.role.title if a.role else ""
        out.append(data)
    return out


@router.get(
    "/admin/volunteer-applications/{app_id}",
    response_model=VolunteerApplicationResponse,
)
async def admin_get_application(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    result = await db.execute(
        select(VolunteerApplication)
        .options(selectinload(VolunteerApplication.role))
        .where(VolunteerApplication.id == app_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    ch = _chapter_filter(current_user)
    if ch and app.role and app.role.chapter_id and app.role.chapter_id != ch:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    data = VolunteerApplicationResponse.model_validate(app)
    data.role_title = app.role.title if app.role else ""
    return data


@router.patch(
    "/admin/volunteer-applications/{app_id}",
    response_model=VolunteerApplicationResponse,
)
async def admin_update_application(
    app_id: str,
    body: VolunteerApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_lead_or_above(current_user)
    result = await db.execute(
        select(VolunteerApplication)
        .options(selectinload(VolunteerApplication.role))
        .where(VolunteerApplication.id == app_id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    ch = _chapter_filter(current_user)
    if ch and app.role and app.role.chapter_id and app.role.chapter_id != ch:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    for key, val in body.model_dump(exclude_none=True).items():
        setattr(app, key, val)

    if body.status is not None:
        app.reviewed_by = current_user.id
        app.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(app, attribute_names=["role"])
    data = VolunteerApplicationResponse.model_validate(app)
    data.role_title = app.role.title if app.role else ""
    return data
