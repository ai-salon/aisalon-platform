"""reset_chapter_ghost_user_profiles

Revision ID: 9e2d4a1f8b73
Revises: 8a3f1b2c4d5e
Create Date: 2026-05-03 09:00:00.000000

Strips profile data from the seeded `<chapter.code>@aisalon.xyz` chapter-lead
"ghost" users so they're once again pure system logins (no name, no photo,
hidden from /people). Real chapter-lead profiles will be added back as
separate user accounts when each lead supplies their info.
"""
from alembic import op
import sqlalchemy as sa


revision = "9e2d4a1f8b73"
down_revision = "8a3f1b2c4d5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE users
            SET name = NULL,
                title = NULL,
                description = NULL,
                profile_image_url = NULL,
                linkedin = NULL,
                profile_completed_at = NULL,
                is_founder = FALSE,
                display_order = 0,
                hide_from_team = TRUE
            WHERE role = 'chapter_lead'
              AND username IS NOT NULL
              AND email = username || '@aisalon.xyz'
              AND username IN (SELECT code FROM chapters)
            """
        )
    )


def downgrade() -> None:
    # Profile data is not recoverable from this migration; no-op.
    pass
