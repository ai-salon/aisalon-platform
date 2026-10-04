"""nyc chapter luma tag: nyc -> ny

Revision ID: a7c3e9f1b2d4
Revises: e5f6a7b8c9d0
Create Date: 2026-10-04 12:00:00.000000

The New York chapter's Luma URLs used ``tag=nyc``, but the Luma tag is "NY".
Luma matches tags ignoring case, not by alias, so ``nyc`` matched no events.
Rewrites only an exact ``tag=nyc`` query value on the ``nyc`` chapter.
"""
from typing import Sequence, Union
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7c3e9f1b2d4"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _swap_tag(url: str, old: str, new: str) -> str:
    parts = urlparse(url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    if not any(k == "tag" and v.lower() == old for k, v in query):
        return url
    query = [(k, new if k == "tag" and v.lower() == old else v) for k, v in query]
    return urlunparse(parts._replace(query=urlencode(query)))


def _rewrite(old: str, new: str) -> None:
    conn = op.get_bind()
    row = conn.execute(
        sa.text("SELECT id, event_link, calendar_embed FROM chapters WHERE code = 'nyc'")
    ).first()
    if row is None:
        return
    event_link = _swap_tag(row.event_link, old, new)
    calendar_embed = _swap_tag(row.calendar_embed, old, new)
    if (event_link, calendar_embed) != (row.event_link, row.calendar_embed):
        conn.execute(
            sa.text(
                "UPDATE chapters SET event_link = :e, calendar_embed = :c WHERE id = :id"
            ),
            {"e": event_link, "c": calendar_embed, "id": row.id},
        )


def upgrade() -> None:
    _rewrite("nyc", "ny")


def downgrade() -> None:
    _rewrite("ny", "nyc")
