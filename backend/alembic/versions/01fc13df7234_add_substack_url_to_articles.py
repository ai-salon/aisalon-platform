"""add substack_url to articles

Revision ID: 01fc13df7234
Revises: 37a850afeda2
Create Date: 2026-03-01 22:24:17.911347

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '01fc13df7234'
down_revision: Union[str, Sequence[str], None] = '37a850afeda2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('articles', sa.Column('substack_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('articles', 'substack_url')
