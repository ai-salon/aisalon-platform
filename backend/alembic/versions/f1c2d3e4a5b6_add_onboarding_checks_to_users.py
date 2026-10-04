"""add_onboarding_checks_to_users

Revision ID: f1c2d3e4a5b6
Revises: e5f6a7b8c9d0
Create Date: 2026-10-04 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1c2d3e4a5b6'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('onboarding_checks', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'onboarding_checks')
