"""add step to jobs

Revision ID: 37a850afeda2
Revises: 302267ee9598
Create Date: 2026-03-01 17:33:06.934090

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '37a850afeda2'
down_revision: Union[str, Sequence[str], None] = '302267ee9598'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('step', sa.String(length=128), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'step')
