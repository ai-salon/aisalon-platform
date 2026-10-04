"""merge onboarding checks and nyc luma tag heads

Revision ID: b8d4f2a6c1e3
Revises: f1c2d3e4a5b6, a7c3e9f1b2d4
Create Date: 2026-10-04 16:39:31.587471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8d4f2a6c1e3'
down_revision: Union[str, Sequence[str], None] = ('f1c2d3e4a5b6', 'a7c3e9f1b2d4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
