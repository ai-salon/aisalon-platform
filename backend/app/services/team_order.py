"""One ordering for the roster.

Shared by the public ``GET /team`` and the admin Team page (``GET /admin/people``)
so that arranging the roster in the admin shows exactly what the site shows:
founders first, ordered purely by ``display_order``; everyone else grouped by
chapter, then ``display_order``, then name.
"""
from app.models.user import User


def roster_sort_key(u: User) -> tuple:
    founder_bucket = 0 if u.is_founder else 1
    chapter_name = "" if u.is_founder else (u.chapter.name if u.chapter else "")
    return (
        founder_bucket,
        chapter_name,
        u.display_order,
        (u.name or u.username or u.email or "").lower(),
        u.created_at,
    )
