"""move founder profile off the admin ghost login

Revision ID: d4e8a1b2c3f5
Revises: cd6a100d240b
Create Date: 2026-09-07 21:40:00.000000

The startup seed used to pin the founder's profile (name, title, photo,
LinkedIn, is_founder) onto the generic ``admin@aisalon.xyz`` login. That login
is chapterless by design, so the founder showed up on the Team page with no
chapter, and any real account the founder logged in with became a second copy
of the same person.

This migration moves the founder profile onto the founder's real account and
turns ``admin`` back into a nameless, hidden break-glass login:

* the real account is found by display name (case-insensitive) or by surname in
  the email address; only an exact single match is acted on;
* on the real account only empty fields are filled, and it becomes
  ``is_founder``, ``superadmin``, public, and gets the SF chapter if it has none;
  its display_order is set below every other founder so it lists first;
* ``admin`` keeps its email, password and completed-profile flag (so it still
  logs in without an onboarding prompt) but loses the person's data and is
  hidden from the Team page.

If no unique match exists the migration changes nothing; the seed no longer
touches ``admin``, so the founder can finish the job from the Users and Team
pages. Not reversible.
"""
from datetime import datetime, timezone
import logging
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e8a1b2c3f5"
down_revision: Union[str, Sequence[str], None] = "cd6a100d240b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

log = logging.getLogger("alembic.runtime.migration")

_PROFILE_COLS = "name, title, description, profile_image_url, linkedin"


def transfer_founder_profile(bind: sa.Connection) -> str:
    """Core logic, separated from ``upgrade`` so it can be unit-tested.

    Returns one of: ``no-admin``, ``nothing-to-transfer``, ``no-unique-match``,
    ``transferred``.
    """
    admin = bind.execute(sa.text(
        f"SELECT id, {_PROFILE_COLS}, display_order, is_founder "
        "FROM users WHERE username = 'admin'"
    )).mappings().fetchone()
    if admin is None:
        return "no-admin"
    if not admin["is_founder"] or not (admin["name"] or "").strip():
        return "nothing-to-transfer"

    full_name = admin["name"].strip()
    surname = full_name.split()[-1].lower()
    candidates = bind.execute(sa.text(
        f"SELECT id, {_PROFILE_COLS}, chapter_id, profile_completed_at "
        "FROM users "
        "WHERE id != :admin_id "
        "  AND (lower(trim(name)) = :full_name OR lower(email) LIKE :pattern)"
    ), {
        "admin_id": admin["id"],
        "full_name": full_name.lower(),
        "pattern": f"%{surname}%",
    }).mappings().fetchall()
    if len(candidates) != 1:
        return "no-unique-match"
    real = candidates[0]

    # List first: strictly below every other founder's display_order.
    other_min = bind.execute(sa.text(
        "SELECT MIN(display_order) FROM users "
        "WHERE is_founder = TRUE AND id NOT IN (:admin_id, :real_id)"
    ), {"admin_id": admin["id"], "real_id": real["id"]}).scalar()
    display_order = admin["display_order"] or 0
    if other_min is not None:
        display_order = min(display_order, other_min - 1)

    sf = bind.execute(
        sa.text("SELECT id FROM chapters WHERE code = 'sf'")
    ).fetchone()

    set_clauses = [
        "name = COALESCE(name, :name)",
        "title = COALESCE(title, :title)",
        "description = COALESCE(description, :description)",
        "profile_image_url = COALESCE(profile_image_url, :profile_image_url)",
        "linkedin = COALESCE(linkedin, :linkedin)",
        "is_founder = TRUE",
        "hide_from_team = FALSE",
        "role = 'superadmin'",
        "display_order = :display_order",
        "profile_completed_at = COALESCE(profile_completed_at, :now)",
    ]
    params = {
        "id": real["id"],
        "name": admin["name"],
        "title": admin["title"],
        "description": admin["description"],
        "profile_image_url": admin["profile_image_url"],
        "linkedin": admin["linkedin"],
        "display_order": display_order,
        "now": datetime.now(timezone.utc),
    }
    if sf is not None and real["chapter_id"] is None:
        set_clauses.append("chapter_id = :sf_id")
        params["sf_id"] = sf[0]

    bind.execute(
        sa.text(f"UPDATE users SET {', '.join(set_clauses)} WHERE id = :id"),
        params,
    )
    bind.execute(sa.text(
        "UPDATE users SET name = NULL, title = NULL, description = NULL, "
        "profile_image_url = NULL, linkedin = NULL, is_founder = FALSE, "
        "display_order = 0, hide_from_team = TRUE "
        "WHERE id = :admin_id"
    ), {"admin_id": admin["id"]})
    return "transferred"


def upgrade() -> None:
    outcome = transfer_founder_profile(op.get_bind())
    log.info("move_founder_profile_off_admin_ghost: %s", outcome)


def downgrade() -> None:
    # Profile data has moved between rows; not recoverable from here.
    pass
