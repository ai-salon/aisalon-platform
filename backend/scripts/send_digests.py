"""Send weekly notification digests. Run by Railway cron (Mon 09:30 UTC).

Usage: poetry run python scripts/send_digests.py [--window-days N] [--force] [--only-email X]
"""
import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")  # run from backend/

from sqlalchemy import select  # noqa: E402

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.digest_run import DigestRun  # noqa: E402
from app.services.digest import previous_week_window, run_digest  # noqa: E402


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--window-days", type=int, default=None)
    p.add_argument("--force", action="store_true")
    p.add_argument("--only-email", default=None)
    args = p.parse_args()

    now = datetime.now(timezone.utc)
    if args.window_days:
        start, end = now - timedelta(days=args.window_days), now
    else:
        start, end = previous_week_window(now)

    async with AsyncSessionLocal() as db:
        existing = None
        if not args.window_days:  # guard only applies to real weekly runs
            existing = (
                await db.execute(
                    select(DigestRun).where(DigestRun.period_start == start.date())
                )
            ).scalar_one_or_none()
            if existing and not args.force:
                print(f"digest for week {start.date()} already sent; use --force")
                return 0
        sent = await run_digest(db, start, end, only_email=args.only_email)
        if not args.window_days and not args.only_email:
            if existing:
                # --force on an already-sent week: update the row in place,
                # don't insert a duplicate (period_start is unique).
                existing.period_end = end.date()
                existing.recipients_count = sent
                db.add(existing)
            else:
                db.add(
                    DigestRun(
                        period_start=start.date(), period_end=end.date(),
                        recipients_count=sent,
                    )
                )
            await db.commit()
        print(f"sent {sent} digest(s) for {start.date()}..{end.date()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
