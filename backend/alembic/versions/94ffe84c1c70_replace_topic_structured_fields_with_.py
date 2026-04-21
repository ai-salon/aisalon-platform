"""replace topic structured fields with content

Revision ID: 94ffe84c1c70
Revises: e3f1a2b4c8d9
Create Date: 2026-04-21 15:12:27.936146

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '94ffe84c1c70'
down_revision: Union[str, Sequence[str], None] = 'e3f1a2b4c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('topics', sa.Column('content', sa.Text(), nullable=True, server_default=''))
    op.drop_column('topics', 'prompts')
    op.drop_column('topics', 'opening_question')
    op.drop_column('topics', 'description')
    with op.batch_alter_table('topics') as batch_op:
        batch_op.alter_column('content', nullable=False, server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('topics', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('topics', sa.Column('opening_question', sa.Text(), nullable=True))
    op.add_column('topics', sa.Column('prompts', sa.JSON(), nullable=True))
    op.drop_column('topics', 'content')
