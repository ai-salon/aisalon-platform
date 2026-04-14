#!/usr/bin/env python3
"""
Push a volunteer role from a knowledge-base markdown file to the platform.

Reads a role markdown from knowledge-base/06-Volunteer-Roles/ and upserts it
via the admin API (creates if the slug is new, updates if it already exists).

Usage:
    # Push a single role to dev (default)
    AISALON_EMAIL=admin@aisalon.xyz AISALON_PASSWORD=salonconvo \\
        poetry run python scripts/push_volunteer_role.py ../../knowledge-base/06-Volunteer-Roles/Marketing-Social-Lead.md

    # Wipe all existing roles then push all three
    AISALON_EMAIL=admin@aisalon.xyz AISALON_PASSWORD=salonconvo \\
        poetry run python scripts/push_volunteer_role.py \\
        ../../knowledge-base/06-Volunteer-Roles/*.md --wipe

    # Production
    poetry run python scripts/push_volunteer_role.py path/to/Role.md --env prod

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
    slug = re.sub(r"[&]", "", slug)
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def parse_role_markdown(path: Path) -> dict:
    text = path.read_text()

    title_match = re.search(r"^# (.+)$", text, re.MULTILINE)
    if not title_match:
        raise ValueError(f"No top-level heading found in {path}")
    title = title_match.group(1).strip()

    about = _section(text, "About This Role") or _section(text, "Overview")
    if not about:
        raise ValueError(f"No '## About This Role' section found in {path}")

    who = _section(text, "Who Would Be a Good Fit?") or _section(text, "Requirements")
    time_commitment = _section(text, "Time Commitment") or None

    # Build the full markdown block — headings included so the page renders them
    description = f"## About This Role\n\n{about}"
    if who:
        description += f"\n\n## Who Would Be a Good Fit?\n\n{who}"

    return {
        "title": title,
        "slug": _slug_from_title(title),
        "description": description,
        "requirements": None,   # folded into description
        "time_commitment": time_commitment,
    }


# ── API helpers ───────────────────────────────────────────────────────────────

def login(client: httpx.Client, email: str, password: str) -> str:
    resp = client.post("/auth/login", json={"identifier": email, "password": password})
    if resp.status_code != 200:
        sys.exit(f"Login failed ({resp.status_code}): {resp.text}")
    return resp.json()["access_token"]


def list_all_roles(client: httpx.Client, token: str) -> list[dict]:
    """List all roles (including inactive) via the admin endpoint."""
    resp = client.get(
        "/admin/volunteer-roles",
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()


def wipe_all_roles(client: httpx.Client, token: str) -> None:
    """Hard-delete all volunteer roles via the admin API."""
    roles = list_all_roles(client, token)
    if not roles:
        print("  No existing roles to wipe.")
        return
    for role in roles:
        resp = client.delete(
            f"/admin/volunteer-roles/{role['id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code not in (200, 204):
            print(f"  Warning: could not delete {role['slug']} ({resp.status_code})")
        else:
            print(f"  Deleted: {role['title']}")


def get_existing_role_by_slug(client: httpx.Client, token: str, slug: str) -> dict | None:
    """Find a role by slug using the admin endpoint (includes inactive roles)."""
    roles = list_all_roles(client, token)
    return next((r for r in roles if r["slug"] == slug), None)


def create_role(client: httpx.Client, token: str, payload: dict, display_order: int) -> dict:
    resp = client.post(
        "/admin/volunteer-roles",
        json={**payload, "display_order": display_order},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()


def update_role(client: httpx.Client, token: str, role_id: str, payload: dict) -> dict:
    resp = client.patch(
        f"/admin/volunteer-roles/{role_id}",
        json={**payload, "is_active": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp.raise_for_status()
    return resp.json()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Push volunteer role markdown files to the platform.")
    parser.add_argument("files", type=Path, nargs="+", help="One or more role .md files")
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
        "--wipe",
        action="store_true",
        help="Delete all existing volunteer roles before pushing",
    )
    parser.add_argument(
        "--display-order-start",
        type=int,
        default=0,
        help="display_order for the first new role; increments per file (default: 0)",
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

    for f in args.files:
        if not f.exists():
            sys.exit(f"File not found: {f}")

    # Parse all files first so we fail fast on bad markdown
    parsed = []
    for f in args.files:
        print(f"Parsing {f.name}...")
        role = parse_role_markdown(f)
        print(f"  title: {role['title']}  slug: {role['slug']}  time: {role['time_commitment']}")
        parsed.append(role)

    with httpx.Client(base_url=base_url, timeout=15) as client:
        print(f"\nAuthenticating against {base_url}...")
        token = login(client, email, password)
        print("  OK")

        if args.wipe:
            print("\nWiping all existing volunteer roles...")
            wipe_all_roles(client, token)

        for i, role_data in enumerate(parsed):
            display_order = args.display_order_start + i
            existing = get_existing_role_by_slug(client, token, role_data["slug"])
            if existing:
                print(f"\nRole '{role_data['slug']}' exists — updating...")
                result = update_role(client, token, existing["id"], role_data)
                print(f"  Updated: {result['title']} (id={result['id']})")
            else:
                print(f"\nRole '{role_data['slug']}' not found — creating (order={display_order})...")
                result = create_role(client, token, role_data, display_order)
                print(f"  Created: {result['title']} (id={result['id']})")

    print("\nDone.")


if __name__ == "__main__":
    main()
