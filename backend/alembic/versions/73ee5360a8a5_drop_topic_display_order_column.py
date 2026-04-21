"""drop topic display_order column

Revision ID: 73ee5360a8a5
Revises: 94ffe84c1c70
Create Date: 2026-04-21 16:01:20.956828

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '73ee5360a8a5'
down_revision: Union[str, Sequence[str], None] = '94ffe84c1c70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('topics') as batch_op:
        batch_op.drop_column('display_order')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('topics') as batch_op:
        batch_op.add_column(sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'))
