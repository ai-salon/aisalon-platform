"""notifications handled state

Revision ID: cd6a100d240b
Revises: b2c1e9a4d6f7
Create Date: 2026-09-06 12:08:05.707105

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd6a100d240b'
down_revision: Union[str, Sequence[str], None] = 'b2c1e9a4d6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'digest_runs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('recipients_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('period_start'),
    )
    op.add_column(
        'contact_messages',
        sa.Column(
            'status',
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'new'"),
        ),
    )
    op.add_column(
        'contact_messages',
        sa.Column('handled_by', sa.String(length=36), nullable=True),
    )
    op.add_column(
        'contact_messages',
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
    )
    # FK constraints skipped for SQLite compatibility; enforced at app level
    # (matches the existing convention, e.g. articles.user_id).
    op.add_column(
        'hosting_interest',
        sa.Column(
            'status',
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'new'"),
        ),
    )
    op.add_column(
        'hosting_interest',
        sa.Column('handled_by', sa.String(length=36), nullable=True),
    )
    op.add_column(
        'hosting_interest',
        sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'hosting_interest',
        sa.Column('chapter_id', sa.String(length=36), nullable=True),
    )
    op.create_index(
        op.f('ix_hosting_interest_chapter_id'),
        'hosting_interest',
        ['chapter_id'],
        unique=False,
    )
    op.add_column(
        'users',
        sa.Column(
            'digest_opt_out', sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )

    # Backfill hosting_interest.chapter_id for existing host_existing rows by
    # matching existing_chapter's name against Chapter.name (case-insensitive,
    # trimmed). UPDATE ... FROM is Postgres syntax; SQLite needs the
    # correlated-subquery form.
    op.execute(
        sa.text(
            "UPDATE hosting_interest SET chapter_id = c.id "
            "FROM chapters c "
            "WHERE hosting_interest.interest_type = 'host_existing' "
            "AND hosting_interest.chapter_id IS NULL "
            "AND lower(trim(hosting_interest.existing_chapter)) = lower(trim(c.name))"
        )
        if op.get_bind().dialect.name == "postgresql"
        else sa.text(
            "UPDATE hosting_interest SET chapter_id = "
            "(SELECT c.id FROM chapters c WHERE lower(trim(hosting_interest.existing_chapter)) = lower(trim(c.name))) "
            "WHERE interest_type = 'host_existing' AND chapter_id IS NULL"
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'digest_opt_out')
    op.drop_index(
        op.f('ix_hosting_interest_chapter_id'), table_name='hosting_interest'
    )
    op.drop_column('hosting_interest', 'chapter_id')
    op.drop_column('hosting_interest', 'handled_at')
    op.drop_column('hosting_interest', 'handled_by')
    op.drop_column('hosting_interest', 'status')
    op.drop_column('contact_messages', 'handled_at')
    op.drop_column('contact_messages', 'handled_by')
    op.drop_column('contact_messages', 'status')
    op.drop_table('digest_runs')
