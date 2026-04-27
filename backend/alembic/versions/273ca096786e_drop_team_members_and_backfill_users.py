"""drop_team_members_and_backfill_users

Revision ID: 273ca096786e
Revises: 43f019619e97
Create Date: 2026-04-26 17:59:39.610327

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone
import re
import secrets


revision = "273ca096786e"
down_revision = "43f019619e97"
branch_labels = None
depends_on = None


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or f"user-{secrets.token_hex(4)}"


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(timezone.utc)

    # Ensure 'host' is a valid UserRole value on Postgres.
    # The initial migration created the enum with only ('superadmin', 'chapter_lead');
    # the model added 'host' later but no migration backfilled the enum value.
    # SQLite stores enums as plain strings, so this is a Postgres-only fix.
    if bind.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            bind.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'host'"))

    insp = sa.inspect(bind)
    if "team_members" not in insp.get_table_names():
        return

    members = bind.execute(sa.text("""
        SELECT tm.id, tm.chapter_id, tm.name, tm.role, tm.description,
               tm.profile_image_url, tm.linkedin, tm.is_cofounder, tm.display_order,
               c.code AS chapter_code
        FROM team_members tm
        LEFT JOIN chapters c ON c.id = tm.chapter_id
    """)).fetchall()

    existing_usernames = {
        row[0] for row in bind.execute(sa.text("SELECT username FROM users WHERE username IS NOT NULL"))
    }

    used_chapter_lead_users: set[str] = set()

    for m in members:
        role_text = (m.role or "").lower()
        is_founder = bool(m.is_cofounder)
        is_chapter_lead = "chapter lead" in role_text and not is_founder

        if not is_founder and not is_chapter_lead:
            continue  # skip hosts; not migrated

        target_user_id = None

        if is_chapter_lead and m.chapter_code:
            row = bind.execute(sa.text(
                "SELECT id FROM users WHERE username = :u"
            ), {"u": m.chapter_code}).fetchone()
            if row and row[0] not in used_chapter_lead_users:
                target_user_id = row[0]
                used_chapter_lead_users.add(target_user_id)

        if is_founder:
            row = bind.execute(sa.text(
                "SELECT id FROM users WHERE name = :n OR username = :n"
            ), {"n": m.name}).fetchone()
            if row:
                target_user_id = row[0]
            if target_user_id is None and (m.name or "").startswith("Ian"):
                row = bind.execute(sa.text(
                    "SELECT id FROM users WHERE username = 'admin'"
                )).fetchone()
                if row:
                    target_user_id = row[0]

        if target_user_id is None:
            base_slug = _slugify(m.name or "person")
            slug = base_slug
            i = 1
            while slug in existing_usernames:
                i += 1
                slug = f"{base_slug}-{i}"
            existing_usernames.add(slug)
            new_id = secrets.token_hex(16)
            role_value = "chapter_lead" if is_chapter_lead else "host"
            bind.execute(sa.text("""
                INSERT INTO users (id, email, username, hashed_password, role, chapter_id,
                                   is_active, name, profile_image_url, linkedin, description,
                                   title, is_founder, display_order, profile_completed_at,
                                   created_at, updated_at)
                VALUES (:id, :email, :username, :pw, :role, :chapter_id,
                        :is_active, :name, :pic, :linkedin, :desc,
                        :title, :is_founder, :display_order, :completed,
                        :now, :now)
            """), {
                "id": new_id,
                "email": f"{slug}@aisalon.placeholder",
                "username": slug,
                "pw": "!disabled",
                "role": role_value,
                "chapter_id": m.chapter_id,
                "is_active": False,
                "name": m.name,
                "pic": m.profile_image_url,
                "linkedin": m.linkedin or None,
                "desc": m.description or None,
                "title": m.role,
                "is_founder": is_founder,
                "display_order": m.display_order or 0,
                "completed": now,
                "now": now,
            })
        else:
            bind.execute(sa.text("""
                UPDATE users SET
                    name = :name,
                    profile_image_url = :pic,
                    linkedin = :linkedin,
                    description = :desc,
                    title = :title,
                    is_founder = :is_founder,
                    display_order = :display_order,
                    profile_completed_at = :completed
                WHERE id = :id
            """), {
                "id": target_user_id,
                "name": m.name,
                "pic": m.profile_image_url,
                "linkedin": m.linkedin or None,
                "desc": m.description or None,
                "title": m.role,
                "is_founder": is_founder,
                "display_order": m.display_order or 0,
                "completed": now,
            })

    op.drop_table("team_members")


def downgrade() -> None:
    op.create_table(
        "team_members",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("chapter_id", sa.String(length=36), sa.ForeignKey("chapters.id"), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("profile_image_url", sa.String(length=512), nullable=False),
        sa.Column("linkedin", sa.String(length=512), nullable=True),
        sa.Column("is_cofounder", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
