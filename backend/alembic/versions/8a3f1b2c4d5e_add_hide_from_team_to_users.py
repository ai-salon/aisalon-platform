"""add_hide_from_team_to_users

Revision ID: 8a3f1b2c4d5e
Revises: 273ca096786e
Create Date: 2026-04-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "8a3f1b2c4d5e"
down_revision = "273ca096786e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("hide_from_team", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("hide_from_team", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "hide_from_team")
