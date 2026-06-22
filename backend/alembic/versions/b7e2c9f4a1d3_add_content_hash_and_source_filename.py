"""add content_hash and source_filename for dedup + regenerate

Adds:
- jobs.content_hash (indexed)       — SHA-256 of uploaded bytes for dup detection
- jobs.source_article_id (indexed)  — source article for regenerate-from-transcript jobs
- articles.content_hash (indexed)   — inherited from the producing job; dedup lookup target
- articles.source_filename          — original uploaded filename, denormalized from the job

Backfills articles.source_filename from the producing job's input_filename.

Revision ID: b7e2c9f4a1d3
Revises: c4f0b8a5d917
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7e2c9f4a1d3'
down_revision: Union[str, Sequence[str], None] = 'c4f0b8a5d917'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('content_hash', sa.String(length=64), nullable=True))
    op.add_column('jobs', sa.Column('source_article_id', sa.String(length=36), nullable=True))
    op.create_index('ix_jobs_content_hash', 'jobs', ['content_hash'])
    op.create_index('ix_jobs_source_article_id', 'jobs', ['source_article_id'])

    op.add_column('articles', sa.Column('content_hash', sa.String(length=64), nullable=True))
    op.add_column('articles', sa.Column('source_filename', sa.String(length=512), nullable=True))
    op.create_index('ix_articles_content_hash', 'articles', ['content_hash'])

    # Backfill source_filename from the producing job. Correlated-subquery form works on
    # both SQLite (dev) and Postgres (prod); only text columns, so no asyncpg type issues.
    op.execute(
        "UPDATE articles SET source_filename = "
        "(SELECT jobs.input_filename FROM jobs WHERE jobs.id = articles.job_id) "
        "WHERE job_id IS NOT NULL AND source_filename IS NULL"
    )


def downgrade() -> None:
    op.drop_index('ix_articles_content_hash', table_name='articles')
    op.drop_column('articles', 'source_filename')
    op.drop_column('articles', 'content_hash')

    op.drop_index('ix_jobs_source_article_id', table_name='jobs')
    op.drop_index('ix_jobs_content_hash', table_name='jobs')
    op.drop_column('jobs', 'source_article_id')
    op.drop_column('jobs', 'content_hash')
