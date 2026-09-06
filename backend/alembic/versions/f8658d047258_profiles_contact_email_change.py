"""profiles contact email change

Revision ID: f8658d047258
Revises: b7e2c9f4a1d3
Create Date: 2026-08-05 22:43:20.156688

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f8658d047258'
down_revision: Union[str, Sequence[str], None] = 'b7e2c9f4a1d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('contact_messages',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('chapter_id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=256), nullable=True),
    sa.Column('email', sa.String(length=256), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('forwarded_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_contact_messages_chapter_id'), 'contact_messages', ['chapter_id'], unique=False)
    op.drop_column('chapters', 'about_blocks')
    op.drop_column('chapters', 'events_blocks')
    op.add_column('users', sa.Column('pending_email', sa.String(length=256), nullable=True))
    op.add_column('users', sa.Column('email_change_token_hash', sa.String(length=64), nullable=True))
    op.add_column('users', sa.Column('email_change_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'email_change_expires_at')
    op.drop_column('users', 'email_change_token_hash')
    op.drop_column('users', 'pending_email')
    op.add_column(
        'chapters',
        sa.Column(
            'events_blocks', sa.JSON(), nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.add_column(
        'chapters',
        sa.Column(
            'about_blocks', sa.JSON(), nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.drop_index(op.f('ix_contact_messages_chapter_id'), table_name='contact_messages')
    op.drop_table('contact_messages')
