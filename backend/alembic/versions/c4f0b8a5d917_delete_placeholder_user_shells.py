"""delete_placeholder_user_shells

Revision ID: c4f0b8a5d917
Revises: 9e2d4a1f8b73
Create Date: 2026-05-03 13:30:00.000000

Removes the inactive `<slug>@aisalon.placeholder` user shells the old
TeamMember backfill (`273ca096786e`) created for founders / chapter leads
who didn't match an existing seeded user. These were never real logins
(`is_active=False`, random unusable password) and were only cluttering
the admin Team page (e.g. `justin-shenk@aisalon.placeholder`,
`cecilia-callas@aisalon.placeholder` — the duplicate of the proper
`cecilia@aisalon.placeholder` row).

Always preserves `cecilia@aisalon.placeholder` (Cecilia Callas, the
co-founder seeded by `seed_founders`).
"""
from alembic import op
import sqlalchemy as sa


revision = "c4f0b8a5d917"
down_revision = "9e2d4a1f8b73"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id FROM users
            WHERE email LIKE '%@aisalon.placeholder'
              AND email <> 'cecilia@aisalon.placeholder'
            """
        )
    ).fetchall()
    for row in rows:
        uid = row[0]
        bind.execute(
            sa.text("UPDATE articles SET user_id = NULL WHERE user_id = :uid"),
            {"uid": uid},
        )
        bind.execute(
            sa.text(
                "UPDATE volunteer_application SET reviewed_by = NULL WHERE reviewed_by = :uid"
            ),
            {"uid": uid},
        )
        bind.execute(
            sa.text("DELETE FROM jobs WHERE user_id = :uid"), {"uid": uid}
        )
        bind.execute(
            sa.text("DELETE FROM user_api_keys WHERE user_id = :uid"), {"uid": uid}
        )
        bind.execute(
            sa.text("DELETE FROM invites WHERE created_by = :uid"), {"uid": uid}
        )
        bind.execute(
            sa.text("DELETE FROM users WHERE id = :uid"), {"uid": uid}
        )


def downgrade() -> None:
    # Deleted shells aren't recoverable from this migration; no-op.
    pass
