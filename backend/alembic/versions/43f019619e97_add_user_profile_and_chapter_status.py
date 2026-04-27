"""add_user_profile_and_chapter_status

Revision ID: 43f019619e97
Revises: 73ee5360a8a5
Create Date: 2026-04-26 17:21:58.911958

"""
from alembic import op
import sqlalchemy as sa


revision = "43f019619e97"
down_revision = "73ee5360a8a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("profile_image_url", sa.String(length=512), nullable=True))
    op.add_column("users", sa.Column("linkedin", sa.String(length=512), nullable=True))
    op.add_column("users", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("title", sa.String(length=160), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_founder", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("profile_completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("is_founder", server_default=None)
        batch_op.alter_column("display_order", server_default=None)

    with op.batch_alter_table("chapters") as batch_op:
        batch_op.create_check_constraint(
            "chapter_status_check",
            "status IN ('draft', 'active', 'archived')",
        )


def downgrade() -> None:
    with op.batch_alter_table("chapters") as batch_op:
        batch_op.drop_constraint("chapter_status_check", type_="check")
    op.drop_column("users", "profile_completed_at")
    op.drop_column("users", "display_order")
    op.drop_column("users", "is_founder")
    op.drop_column("users", "title")
    op.drop_column("users", "description")
    op.drop_column("users", "linkedin")
    op.drop_column("users", "profile_image_url")
    op.drop_column("users", "name")
