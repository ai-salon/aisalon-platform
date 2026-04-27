#!/usr/bin/env python3
"""
Backfill the knowledge graph from all Ai Salon Substack articles.

For each article in data/graph-seed-articles.json:
  1. Finds or creates the Article DB record
  2. Loads meta from an existing _meta.json file, or scrapes Substack on-the-fly
  3. Saves meta to the Article record
  4. Runs GraphIngestionService.ingest_article() with source='backfill'

Requires a Google API key (for embeddings). Reads from:
  - GOOGLE_API_KEY env var, or
  - the UserAPIKey table (any google key, decrypted with SECRET_KEY)

Usage:
    # Local SQLite
    poetry run python scripts/backfill/backfill_graph.py

    # Railway (injects DATABASE_URL + SECRET_KEY automatically)
    railway run poetry run python scripts/backfill/backfill_graph.py

    # Dry-run: create Article records and set meta, skip graph ingestion
    poetry run python scripts/backfill/backfill_graph.py --dry-run

    # Single article
    poetry run python scripts/backfill/backfill_graph.py --url https://aisalon.substack.com/p/...

    # Re-run ingestion even if graph nodes already exist
    poetry run python scripts/backfill/backfill_graph.py --force
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths & config
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[3]  # AiSalon/
PLATFORM_ROOT = SCRIPT_DIR.parents[2]  # aisalon-platform/
SEED_FILE = SCRIPT_DIR / "data" / "graph-seed-articles.json"
META_DIR = REPO_ROOT / "AiSalonContent" / "outputs" / "articles"

# Add backend to path for app imports
sys.path.insert(0, str(PLATFORM_ROOT / "backend"))

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite+aiosqlite:///{PLATFORM_ROOT / 'backend' / 'dev.db'}")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# ---------------------------------------------------------------------------
# Substack extraction (same logic as generate_substack_meta.py)
# ---------------------------------------------------------------------------

TAKEAWAY_KEYWORDS = {"takeaway", "takeaways", "insight", "insights", "finding", "findings"}
QUESTION_KEYWORDS = {"question", "questions"}
SKIP_HEADINGS = {
    "conclusion", "notes from the conversation", "notes", "looking forward",
    "key links", "resources", "further reading",
}


def _fetch_and_extract(url: str) -> dict:
    """Fetch a Substack article and extract themes/insights/questions."""
    import requests
    from bs4 import BeautifulSoup, Tag

    def _key(text: str) -> str:
        return re.sub(r"[^a-z\s]", "", text.lower()).strip()

    def _text(node: Tag) -> str:
        return node.get_text(separator="\n", strip=True)

    def _siblings(h2: Tag) -> list[Tag]:
        result = []
        for sib in h2.next_siblings:
            if not isinstance(sib, Tag):
                continue
            if sib.name == "h2":
                break
            result.append(sib)
        return result

    def _items(sibs: list[Tag]) -> list[str]:
        out = []
        for tag in sibs:
            if tag.name in ("ol", "ul"):
                out.extend(_text(li).strip() for li in tag.find_all("li"))
            elif tag.name == "p":
                t = _text(tag).strip()
                if not t:
                    continue
                if re.match(r"^\d+[.)]\s", t):
                    out.append(re.sub(r"^\d+[.)]\s*", "", t).strip())
                else:
                    out.append(t)
        return [i for i in out if i]

    def _numbered(items: list[str]) -> str:
        return "\n".join(f"{i+1}. {item}" for i, item in enumerate(items))

    def _sibs_text(sibs: list[Tag]) -> str:
        return "\n".join(t for t in (_text(tag).strip() for tag in sibs) if t)

    resp = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    body = (
        soup.find("div", class_=re.compile(r"available-content|post-content|body"))
        or soup.find("article")
        or soup
    )

    sections: dict[str, str] = {"themes": "", "insights": "", "questions": ""}
    theme_blocks: list[str] = []

    for h2 in body.find_all("h2"):
        key = _key(h2.get_text())
        sibs = _siblings(h2)
        if any(k in key for k in QUESTION_KEYWORDS):
            its = _items(sibs)
            sections["questions"] = _numbered(its) if its else _sibs_text(sibs)
        elif any(k in key for k in TAKEAWAY_KEYWORDS):
            its = _items(sibs)
            sections["insights"] = _numbered(its) if its else _sibs_text(sibs)
        elif not any(skip in key for skip in SKIP_HEADINGS):
            title = _text(h2).strip()
            body_text = _sibs_text(sibs)
            theme_blocks.append(f"## {title}\n{body_text}" if body_text else f"## {title}")

    sections["themes"] = "\n\n".join(theme_blocks)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "type": "article",
        "source": "substack_scrape",
        "analysis": sections,
    }


def _load_meta(article: dict) -> dict | None:
    """Load meta from an existing file, or scrape Substack. Returns None on failure."""
    # 1. Pre-existing transcript-derived meta file
    meta_file = article.get("meta_file")
    if meta_file:
        path = META_DIR / meta_file
        if path.exists():
            return json.loads(path.read_text())

    # 2. Substack-scraped meta file generated by generate_substack_meta.py
    slug = article["substack_url"].rstrip("/").split("/")[-1]
    scraped = META_DIR / f"{article['publish_date']}-{slug}_substack_meta.json"
    if scraped.exists():
        return json.loads(scraped.read_text())

    # 3. Scrape on-the-fly
    print(f"    Scraping {article['substack_url']}")
    try:
        meta = _fetch_and_extract(article["substack_url"])
        time.sleep(1.0)
        return meta
    except Exception as exc:
        print(f"    [error] scrape failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

async def _get_google_key(db, settings) -> str | None:
    """Return a decrypted Google API key from env or UserAPIKey table."""
    from_env = os.environ.get("GOOGLE_API_KEY")
    if from_env:
        return from_env

    from sqlalchemy import select
    from app.models.api_key import UserAPIKey, APIKeyProvider
    from app.core.encryption import decrypt_key

    result = await db.execute(
        select(UserAPIKey).where(UserAPIKey.provider == APIKeyProvider.google).limit(1)
    )
    row = result.scalar_one_or_none()
    if row:
        return decrypt_key(row.encrypted_key, settings.SECRET_KEY)
    return None


async def _find_or_create_article(db, entry: dict, chapter_map: dict) -> "Article | None":
    from sqlalchemy import select
    from app.models.article import Article, ArticleStatus

    result = await db.execute(
        select(Article).where(Article.substack_url == entry["substack_url"])
    )
    article = result.scalar_one_or_none()
    if article:
        return article

    chapter_code = entry.get("chapter_code")
    chapter = chapter_map.get(chapter_code) if chapter_code else None
    if not chapter:
        # Use SF as fallback for HumanX / unknown chapters
        chapter = chapter_map.get("sf")
    if not chapter:
        print(f"    [skip] no chapter for code={chapter_code!r}")
        return None

    from datetime import date
    publish_date = date.fromisoformat(entry["publish_date"]) if entry.get("publish_date") else None

    article = Article(
        title=entry["title"],
        substack_url=entry["substack_url"],
        chapter_id=chapter.id,
        publish_date=publish_date,
        status=ArticleStatus.published,
        content_md="",
    )
    db.add(article)
    await db.flush()
    print(f"    Created article: {entry['title'][:60]}")
    return article


async def _has_graph_node(db, article_id: str) -> bool:
    from sqlalchemy import select
    from app.models.graph import GraphNode

    result = await db.execute(
        select(GraphNode.id).where(
            GraphNode.external_table == "articles",
            GraphNode.external_id == article_id,
        )
    )
    return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def run(targets: list[dict], dry_run: bool, force: bool) -> None:
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import select
    from app.core.config import Settings
    # Import all models so SQLAlchemy can resolve inter-model relationships
    import app.models.chapter, app.models.user  # noqa: F401
    import app.models.api_key, app.models.job, app.models.article  # noqa: F401
    import app.models.hosting_interest, app.models.invite  # noqa: F401
    import app.models.system_setting, app.models.social_post  # noqa: F401
    import app.models.login_event, app.models.volunteer  # noqa: F401
    import app.models.topic, app.models.community_upload, app.models.graph  # noqa: F401
    from app.models.chapter import Chapter

    settings = Settings()
    engine = create_async_engine(DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # Build chapter map
        result = await db.execute(select(Chapter))
        chapter_map = {ch.code: ch for ch in result.scalars().all()}

        google_key = await _get_google_key(db, settings)
        if not google_key and not dry_run:
            print("ERROR: No Google API key found. Set GOOGLE_API_KEY or add one via /admin/settings.")
            sys.exit(1)

        from app.services.graph import GraphIngestionService

        ok = skipped = failed = 0

        for i, entry in enumerate(targets):
            title = entry["title"]
            print(f"\n[{i+1}/{len(targets)}] {title}")

            article = await _find_or_create_article(db, entry, chapter_map)
            if not article:
                failed += 1
                continue

            # Load / set meta
            if not article.meta:
                meta = _load_meta(entry)
                if not meta:
                    print("    [warn] no meta available — skipping graph ingestion")
                    skipped += 1
                    await db.commit()
                    continue
                article.meta = meta
                await db.flush()
                await db.commit()
                print("    Meta saved")
            else:
                print("    Meta already set")

            # Graph ingestion
            if not force and await _has_graph_node(db, article.id):
                print("    Graph node already exists — skipping (use --force to re-run)")
                skipped += 1
                continue

            if dry_run:
                print("    [dry-run] would run graph ingestion")
                ok += 1
                continue

            try:
                svc = GraphIngestionService(db, google_key)
                await svc.ingest_article(
                    article_id=article.id,
                    chapter_id=article.chapter_id,
                    publish_date=article.publish_date,
                    meta=article.meta,
                    source="backfill",
                )
                print("    Graph ingestion complete")
                ok += 1
            except Exception as exc:
                print(f"    [error] graph ingestion failed: {exc}")
                failed += 1

    print(f"\n{'='*50}")
    print(f"Done: {ok} ingested, {skipped} skipped, {failed} failed")
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="Create/update Article records but skip graph ingestion")
    parser.add_argument("--url", help="Process a single article by Substack URL")
    parser.add_argument("--force", action="store_true",
                        help="Re-run ingestion even if graph node already exists")
    args = parser.parse_args()

    articles: list[dict] = json.loads(SEED_FILE.read_text())

    if args.url:
        targets = [a for a in articles if a["substack_url"] == args.url]
        if not targets:
            print(f"URL not found in seed file: {args.url}")
            sys.exit(1)
    else:
        targets = articles

    print(f"Backfilling graph for {len(targets)} article(s)…")
    asyncio.run(run(targets, dry_run=args.dry_run, force=args.force))


if __name__ == "__main__":
    main()
