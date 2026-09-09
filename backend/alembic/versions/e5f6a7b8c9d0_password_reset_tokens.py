"""password reset tokens

Revision ID: e5f6a7b8c9d0
Revises: d4e8a1b2c3f5
Create Date: 2026-09-09 08:00:00.000000

Adds the hashed token + expiry used by the emailed password reset flow
(``POST /auth/forgot-password`` → link → ``POST /auth/reset-password``) and by
the superadmin "email them a set-password link" action on the Users page.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e8a1b2c3f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("password_reset_token_hash", sa.String(length=64), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token_hash")
