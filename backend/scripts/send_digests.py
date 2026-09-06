"""Send weekly notification digests. Run by Railway cron (Mon 09:30 UTC).

Usage: poetry run python scripts/send_digests.py [--window-days N] [--force] [--only-email X]
"""
import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")  # run from backend/

from sqlalchemy import select  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.digest_run import DigestRun  # noqa: E402
from app.services.digest import previous_week_window, run_digest  # noqa: E402


async def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--window-days", type=int, default=None)
    p.add_argument("--force", action="store_true")
    p.add_argument("--only-email", default=None)
    args = p.parse_args()

    if not settings.RESEND_API_KEY:
        # Fail loud, before touching the DB: a silent "sent 0" here would let
        # a misconfigured cron run mark the week as sent (or, on a real
        # window, waste the DigestRun claim) with no email ever going out.
        print("RESEND_API_KEY is not configured; refusing to send digests")
        return 1

    now = datetime.now(timezone.utc)
    if args.window_days:
        start, end = now - timedelta(days=args.window_days), now
    else:
        start, end = previous_week_window(now)

    async with AsyncSessionLocal() as db:
        run = None
        if not args.window_days:  # guard only applies to real weekly runs
            existing = (
                await db.execute(
                    select(DigestRun).where(DigestRun.period_start == start.date())
                )
            ).scalar_one_or_none()
            if existing and not args.force:
                print(f"digest for week {start.date()} already sent; use --force")
                return 0
            if not args.only_email:
                # Claim-first: insert (or, on --force, re-claim the existing
                # row) and commit BEFORE sending a single email. period_start
                # is unique, so this commit is the atomic guard — if the
                # process crashes mid-send below, the row is already in
                # place and a retried run is correctly refused above instead
                # of resending. recipients_count is filled in after the loop.
                if existing:
                    # --force on an already-sent week: update the row in
                    # place, don't insert a duplicate (period_start unique).
                    existing.period_end = end.date()
                    db.add(existing)
                    run = existing
                else:
                    run = DigestRun(
                        period_start=start.date(), period_end=end.date(),
                        recipients_count=0,
                    )
                    db.add(run)
                await db.commit()
        sent = await run_digest(db, start, end, only_email=args.only_email)
        if run is not None:
            run.recipients_count = sent
            db.add(run)
            await db.commit()
        print(f"sent {sent} digest(s) for {start.date()}..{end.date()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
