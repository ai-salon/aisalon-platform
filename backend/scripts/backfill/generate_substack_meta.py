#!/usr/bin/env python3
"""
Generate meta.json files from Substack article content (local utility).

For each article in data/graph-seed-articles.json that has no meta_file,
fetches the Substack page, extracts themes/insights/questions from the
article body, and writes a meta.json to AiSalonContent/outputs/articles/.

Prerequisite for backfill_graph.py when running locally without Railway access.
For Railway, backfill_graph.py scrapes on-the-fly and doesn't need this.

Usage:
    poetry run python scripts/backfill/generate_substack_meta.py
    poetry run python scripts/backfill/generate_substack_meta.py --dry-run
    poetry run python scripts/backfill/generate_substack_meta.py --url https://aisalon.substack.com/p/...
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

REPO_ROOT = Path(__file__).resolve().parents[4]  # AiSalon/
SEED_FILE = Path(__file__).resolve().parent / "data" / "graph-seed-articles.json"
META_DIR = REPO_ROOT / "AiSalonContent" / "outputs" / "articles"

TAKEAWAY_KEYWORDS = {"takeaway", "takeaways", "insight", "insights", "finding", "findings"}
QUESTION_KEYWORDS = {"question", "questions"}
SKIP_HEADINGS = {
    "conclusion", "notes from the conversation", "notes", "looking forward",
    "key links", "resources", "further reading",
}

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)})


def fetch_soup(url: str) -> BeautifulSoup:
    resp = SESSION.get(url, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def _heading_key(text: str) -> str:
    return re.sub(r"[^a-z\s]", "", text.lower()).strip()


def _node_text(node: Tag) -> str:
    return node.get_text(separator="\n", strip=True)


def _collect_until_next_h2(heading_tag: Tag) -> list[Tag]:
    siblings: list[Tag] = []
    for sib in heading_tag.next_siblings:
        if not isinstance(sib, Tag):
            continue
        if sib.name == "h2":
            break
        siblings.append(sib)
    return siblings


def _siblings_to_text(siblings: list[Tag]) -> str:
    return "\n".join(
        t for t in (_node_text(tag).strip() for tag in siblings) if t
    )


def _extract_list_items(siblings: list[Tag]) -> list[str]:
    items: list[str] = []
    for tag in siblings:
        if tag.name in ("ol", "ul"):
            items.extend(_node_text(li).strip() for li in tag.find_all("li"))
        elif tag.name == "p":
            text = _node_text(tag).strip()
            if not text:
                continue
            if re.match(r"^\d+[.)]\s", text):
                items.append(re.sub(r"^\d+[.)]\s*", "", text).strip())
            else:
                items.append(text)
    return [i for i in items if i]


def _format_numbered_list(items: list[str]) -> str:
    return "\n".join(f"{i+1}. {item}" for i, item in enumerate(items))


def extract_sections(soup: BeautifulSoup) -> dict[str, str]:
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
        siblings = _collect_until_next_h2(h2)

        if any(k in key for k in QUESTION_KEYWORDS):
            items = _extract_list_items(siblings)
            sections["questions"] = _format_numbered_list(items) if items else _siblings_to_text(siblings)
        elif any(k in key for k in TAKEAWAY_KEYWORDS):
            items = _extract_list_items(siblings)
            sections["insights"] = _format_numbered_list(items) if items else _siblings_to_text(siblings)
        elif not any(skip in key for skip in SKIP_HEADINGS):
            title = _node_text(h2).strip()
            body_text = _siblings_to_text(siblings)
            theme_blocks.append(f"## {title}\n{body_text}" if body_text else f"## {title}")

    sections["themes"] = "\n\n".join(theme_blocks)
    return sections


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


def output_path(article: dict) -> Path:
    slug = article["substack_url"].rstrip("/").split("/")[-1]
    return META_DIR / f"{article['publish_date']}-{slug}_substack_meta.json"


def process_article(article: dict, dry_run: bool = False) -> Path | None:
    dest = output_path(article)
    if dest.exists():
        print(f"  [skip] {dest.name}")
        return dest

    print(f"  Fetching: {article['title']}")
    try:
        soup = fetch_soup(article["substack_url"])
    except Exception as exc:
        print(f"  [error] {exc}")
        return None

    sections = extract_sections(soup)
    found = [k for k, v in sections.items() if v]
    missing = [k for k, v in sections.items() if not v]
    print(f"    Found: {found or 'none'}" + (f"  Missing: {missing}" if missing else ""))

    meta = build_meta(sections)
    if dry_run:
        print(f"    [dry-run] would write: {dest.name}")
        return dest

    META_DIR.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(meta, indent=2, ensure_ascii=False))
    print(f"    Wrote: {dest.name}")
    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--url")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    articles: list[dict] = json.loads(SEED_FILE.read_text())

    if args.url:
        match = next((a for a in articles if a["substack_url"] == args.url), None)
        targets = [match] if match else [{
            "title": args.url.split("/")[-1],
            "substack_url": args.url,
            "chapter_code": None,
            "publish_date": datetime.now(timezone.utc).date().isoformat(),
            "meta_file": None,
        }]
    else:
        targets = [a for a in articles if a["meta_file"] is None or args.force]

    print(f"Processing {len(targets)} article(s)…\n")
    success = 0
    for i, article in enumerate(targets):
        print(f"[{i+1}/{len(targets)}] {article['title']}")
        if process_article(article, dry_run=args.dry_run):
            success += 1
        if i < len(targets) - 1:
            time.sleep(1.5)

    print(f"\nDone: {success}/{len(targets)} succeeded.")
    if success < len(targets):
        sys.exit(1)


if __name__ == "__main__":
    main()
