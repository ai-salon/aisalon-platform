#!/usr/bin/env python3
"""
Generate meta.json files from Substack article content.

For each article in docs/graph-seed-articles.json that has no meta_file,
fetches the Substack page, extracts themes/insights/questions from the
article body, and writes a meta.json to AiSalonContent/outputs/articles/.

Usage:
    poetry run python scripts/generate_meta_from_substack.py
    poetry run python scripts/generate_meta_from_substack.py --dry-run
    poetry run python scripts/generate_meta_from_substack.py --url https://aisalon.substack.com/p/...
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]  # AiSalon/
SEED_FILE = REPO_ROOT / "aisalon-platform" / "docs" / "graph-seed-articles.json"
META_DIR = REPO_ROOT / "AiSalonContent" / "outputs" / "articles"

# Articles use a consistent 3-section structure:
#   1. First h2: "Main Takeaways" or "Key Takeaways"  → insights
#   2. Middle h2 sections (the named theme discussions) → themes
#   3. Last h2: "Questions"                            → questions
# Terminal headings mark the end of the themes region.
TAKEAWAY_KEYWORDS = {"takeaway", "takeaways", "insight", "insights", "finding", "findings"}
QUESTION_KEYWORDS = {"question", "questions"}
SKIP_HEADINGS = {
    "conclusion", "notes from the conversation", "notes", "looking forward",
    "key links", "resources", "further reading",
}


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
)


def fetch_soup(url: str) -> BeautifulSoup:
    resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _heading_key(text: str) -> str:
    return re.sub(r"[^a-z\s]", "", text.lower()).strip()


def _node_text(node: Tag) -> str:
    return node.get_text(separator="\n", strip=True)


def _collect_until_next_h2(heading_tag: Tag) -> list[Tag]:
    """Collect sibling tags until the next h2."""
    siblings: list[Tag] = []
    for sib in heading_tag.next_siblings:
        if not isinstance(sib, Tag):
            continue
        if sib.name == "h2":
            break
        siblings.append(sib)
    return siblings


def _siblings_to_text(siblings: list[Tag]) -> str:
    parts: list[str] = []
    for tag in siblings:
        text = _node_text(tag).strip()
        if text:
            parts.append(text)
    return "\n".join(parts)


def _extract_list_items(siblings: list[Tag]) -> list[str]:
    """
    Extract list items from sibling tags.
    Handles <ol>, pre-numbered <p> text, and plain <p> paragraphs (auto-numbered).
    """
    items: list[str] = []
    for tag in siblings:
        if tag.name in ("ol", "ul"):
            items.extend(_node_text(li).strip() for li in tag.find_all("li"))
        elif tag.name == "p":
            text = _node_text(tag).strip()
            if not text:
                continue
            if re.match(r"^\d+[.)]\s", text):
                # Already numbered — strip prefix
                items.append(re.sub(r"^\d+[.)]\s*", "", text).strip())
            else:
                # Plain paragraph — treat as one list item
                items.append(text)
    return [item for item in items if item]


def _format_numbered_list(items: list[str]) -> str:
    return "\n".join(f"{i+1}. {item}" for i, item in enumerate(items))


def _section_to_theme_block(heading_tag: Tag) -> str:
    """Format one h2 section as '## Title\nBody text'."""
    title = _node_text(heading_tag).strip()
    body_tags = _collect_until_next_h2(heading_tag)
    body = _siblings_to_text(body_tags)
    if body:
        return f"## {title}\n{body}"
    return f"## {title}"


def extract_sections(soup: BeautifulSoup) -> dict[str, str]:
    """
    AI Salon Substack articles follow a consistent structure:
      - First h2: "Main Takeaways" / "Key Takeaways"  → insights
      - Middle h2s: named discussion themes             → themes
      - Last h2: "Questions"                            → questions

    Returns dict with 'themes', 'insights', 'questions' as formatted strings.
    """
    body = (
        soup.find("div", class_=re.compile(r"available-content|post-content|body"))
        or soup.find("article")
        or soup
    )

    sections: dict[str, str] = {"themes": "", "insights": "", "questions": ""}
    h2_tags = body.find_all("h2")
    if not h2_tags:
        return sections

    theme_blocks: list[str] = []

    for h2 in h2_tags:
        key = _heading_key(h2.get_text())

        # Questions section
        if any(k in key for k in QUESTION_KEYWORDS):
            siblings = _collect_until_next_h2(h2)
            items = _extract_list_items(siblings)
            if items:
                sections["questions"] = _format_numbered_list(items)
            else:
                sections["questions"] = _siblings_to_text(siblings)
            continue

        # Takeaways / insights section (usually first h2)
        if any(k in key for k in TAKEAWAY_KEYWORDS):
            siblings = _collect_until_next_h2(h2)
            items = _extract_list_items(siblings)
            if items:
                sections["insights"] = _format_numbered_list(items)
            else:
                sections["insights"] = _siblings_to_text(siblings)
            continue

        # Skip terminal/boilerplate sections
        if any(skip in key for skip in SKIP_HEADINGS):
            continue

        # Everything else is a theme section
        block = _section_to_theme_block(h2)
        if block:
            theme_blocks.append(block)

    sections["themes"] = "\n\n".join(theme_blocks)
    return sections


# ---------------------------------------------------------------------------
# Meta file generation
# ---------------------------------------------------------------------------

def build_meta(sections: dict[str, str]) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "type": "article",
        "source": "substack_scrape",
        "analysis": {
            "insights": sections["insights"],
            "questions": sections["questions"],
            "themes": sections["themes"],
        },
    }


def output_filename(article: dict) -> str:
    slug = article["substack_url"].rstrip("/").split("/")[-1]
    date = article["publish_date"]
    return f"{date}-{slug}_substack_meta.json"


def process_article(article: dict, dry_run: bool = False) -> Path | None:
    url = article["substack_url"]
    title = article["title"]
    dest = META_DIR / output_filename(article)

    if dest.exists():
        print(f"  [skip] already exists: {dest.name}")
        return dest

    print(f"  Fetching: {title}")
    print(f"    {url}")

    try:
        soup = fetch_soup(url)
    except requests.HTTPError as exc:
        print(f"  [error] HTTP {exc.response.status_code}: {url}")
        return None
    except Exception as exc:
        print(f"  [error] {exc}: {url}")
        return None

    sections = extract_sections(soup)

    found = [k for k, v in sections.items() if v]
    missing = [k for k, v in sections.items() if not v]
    print(f"    Found: {found or 'none'}")
    if missing:
        print(f"    Missing: {missing}")

    if not any(sections.values()):
        print("  [warn] no structured content found — writing empty meta")

    meta = build_meta(sections)

    if dry_run:
        print(f"    [dry-run] would write: {dest.name}")
        print(json.dumps(meta, indent=2)[:500] + "...")
        return dest

    META_DIR.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"    Wrote: {dest.name}")
    return dest


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print output without writing files")
    parser.add_argument("--url", help="Process a single Substack URL instead of the full seed list")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-generate even if meta_file already listed in seed JSON",
    )
    args = parser.parse_args()

    articles: list[dict] = json.loads(SEED_FILE.read_text())

    if args.url:
        # Find the matching article or create a minimal stub
        match = next((a for a in articles if a["substack_url"] == args.url), None)
        if not match:
            match = {
                "title": args.url.split("/")[-1],
                "substack_url": args.url,
                "chapter_code": None,
                "publish_date": datetime.now(timezone.utc).date().isoformat(),
                "meta_file": None,
            }
        targets = [match]
    else:
        targets = [a for a in articles if a["meta_file"] is None or args.force]

    print(f"Processing {len(targets)} article(s)…\n")
    success = 0
    for i, article in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] {article['title']}")
        result = process_article(article, dry_run=args.dry_run)
        if result:
            success += 1
        if i < len(targets) - 1:
            time.sleep(1.5)  # polite crawl delay

    print(f"\nDone: {success}/{len(targets)} succeeded.")
    if success < len(targets):
        sys.exit(1)


if __name__ == "__main__":
    main()
