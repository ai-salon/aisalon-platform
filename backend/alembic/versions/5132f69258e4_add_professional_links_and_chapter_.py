"""add_professional_links_and_chapter_fields

Revision ID: 5132f69258e4
Revises: 7f8d819605d9
Create Date: 2026-04-18 11:02:43.859915

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5132f69258e4'
down_revision: Union[str, Sequence[str], None] = '7f8d819605d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('volunteer_application', sa.Column('resume_url', sa.String(length=512), nullable=True))
    op.add_column('volunteer_application', sa.Column('website_url', sa.String(length=512), nullable=True))
    op.add_column('hosting_interest', sa.Column('leadership_experience', sa.Text(), nullable=True))
    op.add_column('hosting_interest', sa.Column('support_network', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('volunteer_application', 'resume_url')
    op.drop_column('volunteer_application', 'website_url')
    op.drop_column('hosting_interest', 'leadership_experience')
    op.drop_column('hosting_interest', 'support_network')
