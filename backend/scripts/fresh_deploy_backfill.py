#!/usr/bin/env python3
"""One-shot backfill script for fresh production deploys.

Idempotent. Re-runnable. Run after a prod merge to populate state that the
startup seed hooks don't cover.

Currently:
- Upserts Article rows from docs/substack-articles.md (keyed on substack_url).
- Deletes the orphaned `cecilia-callas` user produced by the team_members
  drop migration (the seed creates `cecilia` separately).
- Marks profile-less base chapter users (e.g. `sf@aisalon.xyz` when no lead
  profile is seeded) as `hide_from_team=True` so they never surface on the
  public Team page even if a profile is later filled in by accident.

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
from app.core.seed import _CHAPTERS  # noqa: E402
from app.models.article import Article, ArticleStatus  # noqa: E402
from app.models.chapter import Chapter  # noqa: E402
from app.models.user import User  # noqa: E402

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


async def backfill_cecilia_dedup() -> None:
    """Resolve the cecilia / cecilia-callas duplicate from the team_members migration.

    The historical migration `273ca096786e_drop_team_members_and_backfill_users`
    created a slugified `cecilia-callas` user. The seed `_FOUNDERS` entry then
    created a second `cecilia` user. This function leaves only `cecilia`.
    Idempotent.
    """
    async with AsyncSessionLocal() as db:
        slug_row = await db.execute(select(User).where(User.username == "cecilia-callas"))
        slug_user = slug_row.scalar_one_or_none()
        if not slug_user:
            print("cecilia dedup: no `cecilia-callas` row found, nothing to do")
            return

        canonical_row = await db.execute(select(User).where(User.username == "cecilia"))
        canonical = canonical_row.scalar_one_or_none()

        if canonical:
            await db.delete(slug_user)
            await db.commit()
            print(f"cecilia dedup: deleted orphaned `cecilia-callas` ({slug_user.id})")
        else:
            slug_user.username = "cecilia"
            slug_user.email = "cecilia@aisalon.placeholder"
            await db.commit()
            print(f"cecilia dedup: renamed `cecilia-callas` -> `cecilia` ({slug_user.id})")


async def backfill_hide_profile_less_base_users() -> None:
    """Mark profile-less chapter base users (`username=<code>`) as hide_from_team.

    The seed creates a base user per chapter regardless of whether a lead
    person is attached. Where no lead profile is set (e.g. SF, London), the
    account is a ghost admin login — it should never appear on the public
    Team page. Setting `hide_from_team=True` makes that explicit even if
    profile fields are populated by mistake later. Idempotent.
    """
    chapter_codes = {ch["code"] for ch in _CHAPTERS}
    hidden = 0
    async with AsyncSessionLocal() as db:
        for code in chapter_codes:
            row = await db.execute(select(User).where(User.username == code))
            user = row.scalar_one_or_none()
            if not user:
                continue
            if user.profile_completed_at:
                continue  # Carries a real profile (e.g. Apurba on berlin@) — leave visible
            if not user.hide_from_team:
                user.hide_from_team = True
                hidden += 1
        await db.commit()
    print(f"base-user hide: {hidden} profile-less base user(s) marked hide_from_team")


async def main() -> None:
    print(f"=== fresh_deploy_backfill (DATABASE_URL={'set' if os.getenv('DATABASE_URL') else 'sqlite (local)'}) ===\n")
    await backfill_substack_articles()
    await backfill_cecilia_dedup()
    await backfill_hide_profile_less_base_users()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
