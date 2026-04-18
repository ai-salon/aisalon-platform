"""add guide read fields to users

Revision ID: 7f8d819605d9
Revises: a07dec79548e
Create Date: 2026-04-17 23:45:15.084858

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f8d819605d9'
down_revision: Union[str, Sequence[str], None] = 'a07dec79548e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('hosting_guide_read_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('lead_guide_read_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'lead_guide_read_at')
    op.drop_column('users', 'hosting_guide_read_at')
