"""rename scheduled_publish_date to publish_date

Revision ID: a1b2c3d4e5f6
Revises: c6a309d66dc5
Create Date: 2026-04-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e3f091c284'
down_revision: Union[str, Sequence[str], None] = 'c6a309d66dc5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("articles", schema=None) as batch_op:
        batch_op.alter_column("scheduled_publish_date", new_column_name="publish_date")


def downgrade() -> None:
    with op.batch_alter_table("articles", schema=None) as batch_op:
        batch_op.alter_column("publish_date", new_column_name="scheduled_publish_date")
