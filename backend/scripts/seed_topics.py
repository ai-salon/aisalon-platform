#!/usr/bin/env python3
"""Seed salon topics from docs/topics/*.md into the database.

Upserts by title — safe to re-run. Updates content and display_order
if a topic already exists; creates it if not.

Usage:
    cd backend && poetry run python scripts/seed_topics.py

For Railway:
    railway run poetry run python scripts/seed_topics.py
"""

import asyncio
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite+aiosqlite:///{Path(__file__).resolve().parent.parent / 'dev.db'}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

TOPICS_DIR = Path(__file__).resolve().parents[2] / "docs" / "topics"

# Explicit ordering — edit this list to reorder topics on the site
DISPLAY_ORDER = [
    "being-human",
    "creativity-and-expression",
    "relationships-and-intimacy",
    "future-of-work-and-education",
    "culture-spirituality-and-meaning",
    "democracy-and-governance",
    "trustworthy-ai",
    "science-fiction-and-long-term-futures",
    "ai-in-society-and-global-context",
]


def parse_topic_file(path: Path) -> dict:
    """Parse a topic markdown file into title + content fields."""
    text = path.read_text(encoding="utf-8").strip()

    # Extract the # Title line as title
    lines = text.splitlines()
    title = ""
    body_start = 0
    for i, line in enumerate(lines):
        m = re.match(r"^#\s+(.+)", line)
        if m:
            title = m.group(1).strip()
            body_start = i + 1
            break

    # Skip blank lines after the title
    while body_start < len(lines) and not lines[body_start].strip():
        body_start += 1

    content = "\n".join(lines[body_start:]).strip()
    return {"title": title, "content": content}


async def seed() -> None:
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.models.topic import Topic

    if not TOPICS_DIR.exists():
        print(f"ERROR: topics directory not found: {TOPICS_DIR}")
        sys.exit(1)

    md_files = sorted(TOPICS_DIR.glob("*.md"))
    if not md_files:
        print(f"No .md files found in {TOPICS_DIR}")
        sys.exit(1)

    engine = create_async_engine(DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    created = updated = 0

    async with Session() as db:
        for path in md_files:
            slug = path.stem
            order = DISPLAY_ORDER.index(slug) if slug in DISPLAY_ORDER else len(DISPLAY_ORDER)
            parsed = parse_topic_file(path)

            if not parsed["title"]:
                print(f"  SKIP {path.name} — no title found")
                continue

            result = await db.execute(select(Topic).where(Topic.title == parsed["title"]))
            topic = result.scalar_one_or_none()

            if topic:
                topic.content = parsed["content"]
                topic.display_order = order
                topic.is_active = True
                print(f"  updated: {parsed['title']}")
                updated += 1
            else:
                db.add(Topic(
                    title=parsed["title"],
                    content=parsed["content"],
                    display_order=order,
                    is_active=True,
                ))
                print(f"  created: {parsed['title']}")
                created += 1

        await db.commit()

    print(f"\nDone: {created} created, {updated} updated")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
