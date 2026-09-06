"""move blurb into empty about

Revision ID: b2c1e9a4d6f7
Revises: f8658d047258
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c1e9a4d6f7'
down_revision: Union[str, Sequence[str], None] = 'f8658d047258'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Data migration: for chapters with no About text yet, move the Card
    Blurb (description) into About and clear the blurb, since it was likely
    mistakenly used as the only long-form copy for the chapter.

    Portable SQL — works on both SQLite and Postgres.
    """
    op.execute(
        sa.text(
            "UPDATE chapters SET about = description, description = '' "
            "WHERE TRIM(COALESCE(about, '')) = ''"
        )
    )


def downgrade() -> None:
    """No-op.

    This data move is intentionally irreversible: once a chapter's blurb has
    been copied into About and cleared, we no longer know which chapters
    were touched (a chapter could have legitimately had an empty blurb and a
    freshly-written About afterward), so there's no reliable way to restore
    the original description value.
    """
    pass
