"""add_anonymized_transcript_to_articles

Revision ID: a3f9c2d1e847
Revises: 1206ff71cd86
Create Date: 2026-02-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f9c2d1e847'
down_revision: Union[str, Sequence[str], None] = '1206ff71cd86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('articles', sa.Column('anonymized_transcript', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('articles', 'anonymized_transcript')
