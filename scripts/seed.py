#!/usr/bin/env python3
"""
Seed the database from existing JSON/YAML source files.

Usage (from repo root):
    cd backend && poetry run python ../scripts/seed.py

Requires DATABASE_URL env var (or uses SQLite dev.db by default).
"""
import asyncio
import json
import os
import sys
from pathlib import Path

import yaml
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, delete

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.models.base import Base
from app.models.chapter import Chapter
from app.models.team_member import TeamMember
from app.models.user import User, UserRole
from app.core.security import hash_password

SOURCE_ROOT = Path(__file__).resolve().parent.parent.parent / "aisalon.github.io"
CHAPTERS_DIR = SOURCE_ROOT / "data" / "chapters"
TEAM_FILE = SOURCE_ROOT / "data" / "team.yml"

DATABASE_URL = os.environ.get("DATABASE_URL") or "sqlite+aiosqlite:///./dev.db"

# Superadmin accounts to create
SUPERADMINS = [
    {"email": "ian@aisalon.xyz", "password": os.environ.get("IAN_PASSWORD", "changeme-ian"), "name": "Ian Eisenberg"},
    {"email": "cecilia@aisalon.xyz", "password": os.environ.get("CECILIA_PASSWORD", "changeme-cecilia"), "name": "Cecilia Callas"},
]

# Chapter lead email mapping (code → email)
CHAPTER_LEAD_EMAILS = {
    "sf": None,  # SF is run by co-founders (superadmins)
    "bangalore": "sharat@aisalon.xyz",
    "vancouver": "mikhail@aisalon.xyz",
    "lagos": "francis@aisalon.xyz",
    "berlin": "apurba@aisalon.xyz",
    "nyc": "rupi@aisalon.xyz",
    "london": "london@aisalon.xyz",
}


async def seed(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as db:
        # ── Chapters ──────────────────────────────────────────────────
        print("Seeding chapters...")
        chapter_map: dict[str, Chapter] = {}
        for json_file in sorted(CHAPTERS_DIR.glob("*.json")):
            code = json_file.stem
            data = json.loads(json_file.read_text())
            result = await db.execute(select(Chapter).where(Chapter.code == code))
            ch = result.scalar_one_or_none()
            if ch is None:
                ch = Chapter(code=code)
            ch.name = data["chapter_name"]
            ch.title = data.get("chapter_title", "")
            ch.description = data.get("chapter_description", "")
            ch.tagline = data.get("chapter_tagline", "")
            ch.about = data.get("chapter_about", "")
            ch.event_link = data.get("chapter_event_link", "")
            ch.calendar_embed = data.get("chapter_calendar_embed", "")
            ch.events_description = data.get("chapter_events_description", "")
            ch.about_blocks = data.get("chapter_about_blocks", [])
            ch.events_blocks = data.get("chapter_events_blocks", [])
            ch.status = "active"
            db.add(ch)
            chapter_map[code] = ch
            print(f"  ✓ {code}: {ch.name}")

        await db.flush()

        # ── Team Members ───────────────────────────────────────────────
        print("\nSeeding team members...")
        raw = yaml.safe_load(TEAM_FILE.read_text())
        for i, member in enumerate(raw.get("team_members", [])):
            chapter_code = member.get("chapter", "sf")
            ch = chapter_map.get(chapter_code)
            if ch is None:
                print(f"  ⚠ Unknown chapter '{chapter_code}' for {member['name']}, skipping")
                continue
            result = await db.execute(
                select(TeamMember).where(TeamMember.name == member["name"])
            )
            tm = result.scalar_one_or_none()
            if tm is None:
                tm = TeamMember()
            tm.name = member["name"]
            tm.role = member.get("role", "")
            tm.description = member.get("description") or None
            tm.profile_image_url = member.get("profile_image", "")
            tm.linkedin = member.get("linkedin") or None
            tm.chapter_id = ch.id
            tm.is_cofounder = "Co-Founder" in member.get("role", "")
            tm.display_order = i
            db.add(tm)
            print(f"  ✓ {tm.name} ({chapter_code})")

        await db.flush()

        # ── Users ──────────────────────────────────────────────────────
        print("\nSeeding users...")
        for admin in SUPERADMINS:
            result = await db.execute(select(User).where(User.email == admin["email"]))
            user = result.scalar_one_or_none()
            if user is None:
                user = User(email=admin["email"])
            user.hashed_password = hash_password(admin["password"])
            user.role = UserRole.superadmin
            user.is_active = True
            db.add(user)
            print(f"  ✓ superadmin: {admin['email']}")

        for code, email in CHAPTER_LEAD_EMAILS.items():
            if email is None:
                continue
            ch = chapter_map.get(code)
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user is None:
                user = User(email=email)
            user.hashed_password = hash_password(f"changeme-{code}")
            user.role = UserRole.chapter_lead
            user.chapter_id = ch.id if ch else None
            user.is_active = True
            db.add(user)
            print(f"  ✓ chapter_lead ({code}): {email}")

        await db.commit()
        print("\n✅ Seed complete.")


if __name__ == "__main__":
    engine = create_async_engine(DATABASE_URL)
    asyncio.run(seed(engine))
