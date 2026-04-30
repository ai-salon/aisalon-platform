#!/usr/bin/env python3
"""One-shot backfill script for fresh production deploys.

Idempotent. Re-runnable. Run after a prod merge to populate state that the
startup seed hooks don't cover.

Currently:
- Upserts Article rows from docs/substack-articles.md (keyed on substack_url).

Run locally:
    cd backend && poetry run python scripts/fresh_deploy_backfill.py

Run on Railway:
    railway run --service backend poetry run python scripts/fresh_deploy_backfill.py
"""
from __future__ import annotations

import asyncio
import datetime as _dt
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

import app.models.api_key  # noqa: F401, E402
import app.models.hosting_interest  # noqa: F401, E402
import app.models.job  # noqa: F401, E402
import app.models.topic  # noqa: F401, E402
import app.models.user  # noqa: F401, E402
import app.models.volunteer  # noqa: F401, E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.article import Article, ArticleStatus  # noqa: E402
from app.models.chapter import Chapter  # noqa: E402

ARTICLES_MD = Path(__file__).resolve().parents[1] / "docs" / "substack-articles.md"

# Maps the "Chapter" column text to a Chapter.name in the DB.
# Entries with value None are silently skipped (newsletters, conference one-offs).
_CHAPTER_NAME_MAP: dict[str, str | None] = {
    "San Francisco": "San Francisco",
    "Berlin": "Berlin",
    "London": "London",
    "Bangalore": "Bangalore",
    "Lagos": "Lagos",
    "Vancouver": "Vancouver",
    "Zurich": "Zurich",
    "NYC": "New York City",
    "New York City": "New York City",
    "Newsletter": None,
    "Las Vegas (HumanX)": None,
}

_TABLE_ROW_RE = re.compile(r"^\|(.+)\|\s*$")
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parse_articles_md(path: Path) -> list[dict]:
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = _TABLE_ROW_RE.match(line.strip())
        if not m:
            continue
        cells = [c.strip() for c in m.group(1).split("|")]
        if len(cells) < 5:
            continue
        title, url, chapter, published, _transcript = cells[:5]
        if title.lower() == "title" or set(title) <= {"-", " "}:
            continue
        if not url.startswith("http") or not _DATE_RE.match(published):
            continue
        rows.append({
            "title": title,
            "url": url,
            "chapter": chapter,
            "publish_date": _dt.date.fromisoformat(published),
        })
    return rows


async def backfill_substack_articles() -> tuple[int, int, int]:
    if not ARTICLES_MD.exists():
        print(f"ERROR: {ARTICLES_MD} not found")
        return 0, 0, 0

    parsed = _parse_articles_md(ARTICLES_MD)
    print(f"Parsed {len(parsed)} article rows from {ARTICLES_MD.name}")

    created = updated = skipped = 0
    async with AsyncSessionLocal() as db:
        chapter_rows = await db.execute(select(Chapter))
        chapters_by_name = {c.name: c for c in chapter_rows.scalars().all()}

        for row in parsed:
            mapped_name = _CHAPTER_NAME_MAP.get(row["chapter"], row["chapter"])
            if mapped_name is None:
                skipped += 1
                continue
            chapter = chapters_by_name.get(mapped_name)
            if not chapter:
                print(f"  [skip] chapter not found in DB: {row['chapter']!r} -> {mapped_name!r}")
                skipped += 1
                continue

            existing_q = await db.execute(
                select(Article).where(Article.substack_url == row["url"])
            )
            article = existing_q.scalar_one_or_none()
            if article:
                article.title = row["title"]
                article.chapter_id = chapter.id
                article.publish_date = row["publish_date"]
                article.status = ArticleStatus.published
                updated += 1
            else:
                db.add(Article(
                    title=row["title"],
                    chapter_id=chapter.id,
                    substack_url=row["url"],
                    publish_date=row["publish_date"],
                    status=ArticleStatus.published,
                    content_md="",
                ))
                created += 1
                print(f"  + {row['publish_date']} | {mapped_name:18} | {row['title']}")

        await db.commit()

    print(f"\nArticles: {created} created, {updated} updated, {skipped} skipped")
    return created, updated, skipped


async def main() -> None:
    print(f"=== fresh_deploy_backfill (DATABASE_URL={'set' if os.getenv('DATABASE_URL') else 'sqlite (local)'}) ===\n")
    await backfill_substack_articles()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
