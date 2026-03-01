"""Seed a superadmin user.

Usage:
    cd backend && poetry run python scripts/seed_admin.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
import app.models.chapter  # noqa: F401 — required for SQLAlchemy relationship resolution
import app.models.team_member  # noqa: F401
import app.models.api_key  # noqa: F401
import app.models.job  # noqa: F401
import app.models.article  # noqa: F401
import app.models.hosting_interest  # noqa: F401
from app.models.user import User, UserRole


async def main() -> None:
    email = os.getenv("SEED_EMAIL", "admin@aisalon.xyz")
    password = os.getenv("SEED_PASSWORD", "changeme123")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"User '{email}' already exists — skipping.")
            return

        user = User(
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.superadmin,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        print(f"Created superadmin: {email}")


if __name__ == "__main__":
    asyncio.run(main())
