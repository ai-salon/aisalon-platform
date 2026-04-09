"""add_hosting_interest

Revision ID: 1206ff71cd86
Revises: ebaef3f8beeb
Create Date: 2026-02-28 20:56:04.565027

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1206ff71cd86'
down_revision: Union[str, Sequence[str], None] = 'ebaef3f8beeb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('hosting_interest',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=256), nullable=False),
        sa.Column('email', sa.String(length=256), nullable=False),
        sa.Column('city', sa.String(length=256), nullable=False),
        sa.Column('interest_type', sa.String(length=32), nullable=False),
        sa.Column('existing_chapter', sa.String(length=256), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('hosting_interest')
