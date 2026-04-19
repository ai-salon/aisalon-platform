"""add_scheduling_url_to_users

Revision ID: a782dddf5630
Revises: b7e3f091c284
Create Date: 2026-04-18 21:37:33.739035

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a782dddf5630'
down_revision: Union[str, Sequence[str], None] = 'b7e3f091c284'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('scheduling_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'scheduling_url')
