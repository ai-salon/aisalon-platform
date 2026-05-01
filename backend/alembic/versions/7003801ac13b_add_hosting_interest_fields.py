"""add_hosting_interest_fields

Revision ID: 7003801ac13b
Revises: 3c53e190a0b0
Create Date: 2026-03-03 07:54:23.892653

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7003801ac13b'
down_revision: Union[str, Sequence[str], None] = '3c53e190a0b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'hosting_interest' not in inspector.get_table_names():
        # Table was never created (migration 1206ff71cd86 was skipped on this DB).
        # Create it with the full schema including the columns added here.
        op.create_table(
            'hosting_interest',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('name', sa.String(length=256), nullable=False),
            sa.Column('email', sa.String(length=256), nullable=False),
            sa.Column('city', sa.String(length=256), nullable=False),
            sa.Column('interest_type', sa.String(length=32), nullable=False),
            sa.Column('existing_chapter', sa.String(length=256), nullable=True),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('salons_attended', sa.Text(), nullable=True),
            sa.Column('facilitated_before', sa.Text(), nullable=True),
            sa.Column('themes_interested', sa.Text(), nullable=True),
            sa.Column('why_hosting', sa.Text(), nullable=True),
            sa.Column('hosting_frequency', sa.String(length=64), nullable=True),
            sa.Column('space_options', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )
    else:
        op.add_column('hosting_interest', sa.Column('salons_attended', sa.Text(), nullable=True))
        op.add_column('hosting_interest', sa.Column('facilitated_before', sa.Text(), nullable=True))
        op.add_column('hosting_interest', sa.Column('themes_interested', sa.Text(), nullable=True))
        op.add_column('hosting_interest', sa.Column('why_hosting', sa.Text(), nullable=True))
        op.add_column('hosting_interest', sa.Column('hosting_frequency', sa.String(length=64), nullable=True))
        op.add_column('hosting_interest', sa.Column('space_options', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('hosting_interest', 'space_options')
    op.drop_column('hosting_interest', 'hosting_frequency')
    op.drop_column('hosting_interest', 'why_hosting')
    op.drop_column('hosting_interest', 'themes_interested')
    op.drop_column('hosting_interest', 'facilitated_before')
    op.drop_column('hosting_interest', 'salons_attended')
