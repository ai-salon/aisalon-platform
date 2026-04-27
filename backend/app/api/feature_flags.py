"""Feature flag endpoints.

Flags are stored in the existing system_settings table under keys prefixed
with `feature_flag.<name>`. Values are encrypted (Fernet) by SystemSetting,
and serialized as the literal strings "true" / "false".

A registry below declares the known flags, their defaults, and whether each
flag is exposed to unauthenticated callers.
"""
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import decrypt_key, encrypt_key
from app.models.system_setting import SystemSetting
from app.models.user import User, UserRole

KEY_PREFIX = "feature_flag."


@dataclass(frozen=True)
class FlagDef:
    name: str
    default: bool
    public: bool
    description: str


REGISTRY: dict[str, FlagDef] = {
    "insights_enabled": FlagDef(
        name="insights_enabled",
        default=False,
        public=True,
        description="Public Insights pages and the Concept Graph. When off, "
                    "the routes 404 and nav links are hidden.",
    ),
}


class FlagValue(BaseModel):
    name: str
    value: bool
    description: str


class FlagUpdate(BaseModel):
    value: bool


router = APIRouter(tags=["feature-flags"])


def _storage_key(name: str) -> str:
    return f"{KEY_PREFIX}{name}"


async def _read_flag(db: AsyncSession, name: str) -> bool:
    flag = REGISTRY.get(name)
    if flag is None:
        raise HTTPException(status_code=404, detail="Unknown feature flag")
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == _storage_key(name))
    )
    row = result.scalar_one_or_none()
    if row is None:
        return flag.default
    raw = decrypt_key(row.encrypted_value, settings.SECRET_KEY)
    return raw.strip().lower() == "true"


@router.get("/public-feature-flags", response_model=dict[str, bool])
async def get_public_feature_flags(db: AsyncSession = Depends(get_db)):
    out: dict[str, bool] = {}
    for name, flag in REGISTRY.items():
        if not flag.public:
            continue
        out[name] = await _read_flag(db, name)
    return out


@router.get("/admin/feature-flags", response_model=list[FlagValue])
async def list_feature_flags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    out: list[FlagValue] = []
    for name, flag in REGISTRY.items():
        out.append(
            FlagValue(
                name=name,
                value=await _read_flag(db, name),
                description=flag.description,
            )
        )
    return out


@router.put("/admin/feature-flags/{name}", response_model=FlagValue)
async def set_feature_flag(
    name: str,
    body: FlagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    flag = REGISTRY.get(name)
    if flag is None:
        raise HTTPException(status_code=404, detail="Unknown feature flag")

    storage_key = _storage_key(name)
    encrypted = encrypt_key("true" if body.value else "false", settings.SECRET_KEY)
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == storage_key)
    )
    existing = result.scalar_one_or_none()
    if existing is None:
        db.add(SystemSetting(key=storage_key, encrypted_value=encrypted))
    else:
        existing.encrypted_value = encrypted
    await db.commit()
    return FlagValue(name=name, value=body.value, description=flag.description)
