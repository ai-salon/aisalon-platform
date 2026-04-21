#!/usr/bin/env python3
"""Backfill anonymized transcripts into articles from AiSalonContent/processed/.

Run from backend/ directory:
    poetry run python scripts/backfill/backfill_transcripts.py

For Railway:
    railway run poetry run python scripts/backfill/backfill_transcripts.py
"""

import os
from pathlib import Path

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{Path(__file__).parent.parent.parent / 'dev.db'}",
)
DATABASE_URL = (
    DATABASE_URL.replace("+aiosqlite", "")
    .replace("postgresql+asyncpg", "postgresql")
    .replace("postgres://", "postgresql://")
)

TRANSCRIPTS_DIR = (
    Path(__file__).parent.parent.parent.parent.parent / "AiSalonContent" / "processed"
)

# substack_url → list of transcript filenames (relative to TRANSCRIPTS_DIR)
# Multiple files are concatenated with a separator.
ARTICLE_TRANSCRIPTS: dict[str, list[str]] = {
    "https://aisalon.substack.com/p/confronting-consciousness-creativity": [
        "2026-02-19 AI Salon Zurich  - Pascale Speck_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/the-ai-paradox": [
        "2025-06-25 Ai salon nyc_ benefits and risks - Rupi Sureshkumar_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/the-algorithmic-mind": [
        "2025-06-22 AI Salon NYC critical thinking - Rupi Sureshkumar_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/personal-and-career-impact": [
        "2025-02-21 - personal impact and career evolution_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/the-last-shall-be-first-africas-path": [
        "2025-04-04-Africa_s Practical Path - Francis Sani_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/nigerias-ai-landscape-between-hopeful": [
        "2025-02-28- Where is Nigeria Today - Francis Sani_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/authenticity": [
        "2025-03-17 - Authenticity - Cecilia Callas_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/children": [
        "2025-02-18 - AI salon audio - Anirudh Iyer_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/humanx-ai-salon-ai2050": [
        "2025-03-12 - AI 2050 - Ross_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/humanx-ai-salon-governance-and-control": [
        "2025-03-11 - AI Salon HumanX #2 Governance & Control - Ross Matican_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/humanx-ai-salon-the-future-of-work": [
        "2025-03-10 - future of work - combined_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/029-storytelling": [
        "2025-02-22 - Storytelling - Sharat Satyanarayana_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/020-purpose-and-meaning": [
        "2024-09-08 - Purpose & meaning - Cecilia Callas_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/027-education": [
        "2023-07-30 - Salon_Education_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/026-augmentation": [
        "2024-05-05 ai salon - augmentation_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/025-beauty": [
        "2024-12-16 - beauty - Cecilia Callas_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/024-common-questions-uncommon-times": [
        "2024-10-08 - Ai salon Human Flourishing, Amina Vinson_transcript_anon.txt",
        "2024-10-08 - Ai salon Human Flourishing, Austin Fischer_transcript_anon.txt",
        "2024-10-08 - Ai salon Human Flourishing, Cecilia Callas_transcript_anon.txt",
        "2024-10-08 - Ai salon Human Flourishing, Lana Honcharuk_transcript_anon.txt",
        "2024-10-08 - Ai salon Human Flourishing, Ross Matican_transcript_anon.txt",
        "2024-10-08 ai salon - human flourishing, Ian_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/023-autonomous-scientific-discovery": [
        "2024-11-28 - Autonomous Scientific Discovery - Vancouver - Mikhail Klassen_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/021-trustworthy-ai-futures-2024-reflections": [
        "2024-11-17 - trustworthy ai futures #4_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/019-love-and-dating": [
        "2024-08-18 - Salon Love & Dating - Cecilia Callas_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/018-elections-and-democracy": [
        "2024-07-25 - election & democracy_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/017-trustworthy-ai-futures-situational": [
        "2024-06-23 - trustworthy ai futures #2-1_transcript_anon.txt",
        "2024-06-23 - trustworthy ai futures #2-2_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/016-guardrails": [
        "2023-07-12 - Salon_Guardrails_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/015-trustworthy-ai-futures-agents": [
        "2024-05-12 - trustworthy ai futures #1_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/013-science-fiction-futures": [
        "2024-04-14 Ai salon - science fiction_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/012-neurotechnology": [
        "2024-03-31 Ai salon - neurotech_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/009-religion": [
        "2023-10-22 - Salon_Religion_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/008-personhood": [
        "2024-01-21 - Ai salon - personhood_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/007-common-sense": [
        "2024-02-04 Ai salon - common sense_transcript_anon.txt",
    ],
    "https://aisalon.substack.com/p/006-mental-health": [
        "2024-03-10 Ai salon - mental health_transcript_anon.txt",
    ],
}


def main() -> None:
    from sqlalchemy import create_engine, text

    engine = create_engine(DATABASE_URL)

    updated = 0
    skipped = 0
    missing_files: list[str] = []

    with engine.connect() as conn:
        for url, filenames in ARTICLE_TRANSCRIPTS.items():
            parts: list[str] = []
            all_found = True
            for fname in filenames:
                fpath = TRANSCRIPTS_DIR / fname
                if not fpath.exists():
                    print(f"  MISSING: {fname}")
                    missing_files.append(fname)
                    all_found = False
                    continue
                parts.append(fpath.read_text(encoding="utf-8"))

            if not all_found:
                skipped += 1
                continue

            combined = "\n\n---\n\n".join(parts)
            result = conn.execute(
                text("UPDATE articles SET anonymized_transcript = :t WHERE substack_url = :u"),
                {"t": combined, "u": url},
            )
            if result.rowcount == 0:
                print(f"  NOT IN DB: {url}")
                skipped += 1
            else:
                print(f"  OK: {url.split('/')[-1]}")
                updated += 1

        conn.commit()

    print(f"\nDone: {updated} updated, {skipped} skipped")
    if missing_files:
        print(f"Missing files ({len(missing_files)}):")
        for f in missing_files:
            print(f"  {f}")


if __name__ == "__main__":
    main()
