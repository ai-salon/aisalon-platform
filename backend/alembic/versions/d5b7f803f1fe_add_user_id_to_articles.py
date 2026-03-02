"""add_user_id_to_articles

Revision ID: d5b7f803f1fe
Revises: a3f9c2d1e847
Create Date: 2026-03-01 15:30:48.159278

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5b7f803f1fe'
down_revision: Union[str, Sequence[str], None] = 'a3f9c2d1e847'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('articles', sa.Column('user_id', sa.String(length=36), nullable=True))
    # FK constraint skipped for SQLite compatibility; enforced at app level


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('articles', 'user_id')
