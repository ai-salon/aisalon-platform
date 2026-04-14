#!/usr/bin/env python3
"""
Push a volunteer role from a knowledge-base markdown file to the platform.

Reads a role markdown from knowledge-base/06-Volunteer-Roles/ and upserts it
via the admin API (creates if the slug is new, updates if it already exists).

Usage:
    # Dev server (default)
    poetry run python scripts/push_volunteer_role.py ../../knowledge-base/06-Volunteer-Roles/Chapter-Lead.md

    # Production
    poetry run python scripts/push_volunteer_role.py ../../knowledge-base/06-Volunteer-Roles/Chapter-Lead.md --env prod

    # Custom URL
    poetry run python scripts/push_volunteer_role.py path/to/Role.md --url https://my-server.example.com

Auth (provide one way):
    AISALON_EMAIL and AISALON_PASSWORD env vars  (recommended)
    --email / --password flags
"""
import argparse
import os
import re
import sys
from pathlib import Path

import httpx

# ── Server targets ────────────────────────────────────────────────────────────

SERVERS = {
    "dev": "http://localhost:8000",
    "prod": "https://aisalon-platform-production.up.railway.app",
}

# ── Markdown parser ───────────────────────────────────────────────────────────

def _section(text: str, heading: str) -> str:
    """Extract the body of a ## heading section (stops at next ## or end)."""
    pattern = rf"^## {re.escape(heading)}\s*\n(.*?)(?=^## |\Z)"
    match = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    return match.group(1).strip() if match else ""


def _slug_from_title(title: str) -> str:
    slug = title.lower()
    slug = re.sub(r"[&]", "", slug)          # drop ampersands
    slug = re.sub(r"[^a-z0-9]+", "-", slug)  # non-alphanum → hyphen
    return slug.strip("-")


def parse_role_markdown(path: Path) -> dict:
    text = path.read_text()

    # Title from first # heading
    title_match = re.search(r"^# (.+)$", text, re.MULTILINE)
    if not title_match:
        raise ValueError(f"No top-level heading found in {path}")
    title = title_match.group(1).strip()

    # Support both heading styles
    description = _section(text, "About This Role") or _section(text, "Overview")
    if not description:
        raise ValueError(f"No '## About This Role' section found in {path}")

    requirements_raw = (
        _section(text, "Who Would Be a Good Fit?")
        or _section(text, "Requirements")
    )
    time_commitment = _section(text, "Time Commitment") or None

    return {
        "title": title,
        "slug": _slug_from_title(title),
        "description": description,
        "requirements": requirements_raw or None,
        "time_commitment": time_commitment,
    }


# ── API helpers ───────────────────────────────────────────────────────────────

def login(client: httpx.Client, email: str, password: str) -> str:
    resp = client.post("/auth/login", json={"identifier": email, "password": password})
    if resp.status_code != 200:
        sys.exit(f"Login failed ({resp.status_code}): {resp.text}")
    return resp.json()["access_token"]


def get_existing_role(client: httpx.Client, slug: str) -> dict | None:
    """Check if a role with this slug already exists via the public endpoint."""
    resp = client.get(f"/volunteer-roles/{slug}")
    if resp.status_code == 200:
        return resp.json()
    if resp.status_code == 404:
        return None
    resp.raise_for_status()


def create_role(client: httpx.Client, token: str, payload: dict, display_order: int) -> dict:
    payload = {**payload, "display_order": display_order}
    resp = client.post(
        "/admin/volunteer-roles",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()


def update_role(client: httpx.Client, token: str, role_id: str, payload: dict) -> dict:
    resp = client.patch(
        f"/admin/volunteer-roles/{role_id}",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Push a volunteer role markdown to the platform.")
    parser.add_argument("file", type=Path, help="Path to the role .md file")
    parser.add_argument(
        "--env",
        choices=["dev", "prod"],
        default="dev",
        help="Target environment (default: dev)",
    )
    parser.add_argument("--url", help="Override base URL (e.g. http://localhost:8000)")
    parser.add_argument("--email", help="Admin email (or set AISALON_EMAIL)")
    parser.add_argument("--password", help="Admin password (or set AISALON_PASSWORD)")
    parser.add_argument(
        "--display-order",
        type=int,
        default=0,
        help="display_order for new roles (ignored on update, default: 0)",
    )
    args = parser.parse_args()

    base_url = args.url or SERVERS[args.env]
    email = args.email or os.environ.get("AISALON_EMAIL")
    password = args.password or os.environ.get("AISALON_PASSWORD")

    if not email or not password:
        sys.exit(
            "Credentials required. Set AISALON_EMAIL / AISALON_PASSWORD env vars "
            "or pass --email / --password."
        )

    if not args.file.exists():
        sys.exit(f"File not found: {args.file}")

    # Parse markdown
    print(f"Parsing {args.file.name}...")
    role_data = parse_role_markdown(args.file)
    print(f"  title: {role_data['title']}")
    print(f"  slug:  {role_data['slug']}")
    print(f"  time:  {role_data['time_commitment']}")

    with httpx.Client(base_url=base_url, timeout=15) as client:
        # Authenticate
        print(f"\nAuthenticating against {base_url}...")
        token = login(client, email, password)
        print("  OK")

        # Upsert
        existing = get_existing_role(client, role_data["slug"])
        if existing:
            print(f"\nRole '{role_data['slug']}' exists (id={existing['id']}) — updating...")
            result = update_role(client, token, existing["id"], role_data)
            print(f"  Updated: {result['title']} (id={result['id']})")
        else:
            print(f"\nRole '{role_data['slug']}' not found — creating...")
            result = create_role(client, token, role_data, args.display_order)
            print(f"  Created: {result['title']} (id={result['id']})")

    print("\nDone.")


if __name__ == "__main__":
    main()
