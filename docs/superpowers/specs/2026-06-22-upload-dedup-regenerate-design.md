# Upload dedup, regenerate-from-transcript, and configurable model

**Date:** 2026-06-22
**Bean:** AiSalon-3mcn
**Repos touched:** `aisalon-platform` (primary), `SocraticAI` (one-line config change)

## Motivation

Three related improvements to the audio → article upload/processing pipeline:

1. **Configurable model.** The article-generation model is hardcoded
   (`gemini-3-flash-preview`) in `services/processor.py`. We want it set once in
   backend `Settings`, env-overridable, so we can swap models on Railway without a
   deploy. Default becomes `gemini-3.1-flash-lite`.

2. **Duplicate-upload detection + regenerate-from-transcript.** Re-uploading the
   same file today silently re-runs the entire pipeline (transcription + article
   generation) and produces a second article, burning AssemblyAI + Gemini cost.
   Transcription is the expensive, deterministic step and is already captured as the
   article's `anonymized_transcript`. When a duplicate is detected we should point the
   user at the existing article and let them **regenerate a fresh article from the
   stored transcript** (skipping transcription entirely), or re-transcribe from scratch
   if the transcription itself was bad.

3. **Source filename on the article.** The original uploaded filename is recorded on
   the `Job` (`input_filename`) but not surfaced on the `Article`. We want it stored on
   the article and shown in the article header (`Source: june-salon-recording.m4a`).

## Key facts that shape the design (from current code)

- `services/processor.py:121` calls `generator.generate(input_paths=audio_path, anonymize=True)`.
- **`ArticleGenerator.generate()` already accepts a transcript instead of audio.**
  In `article_generator.py:203-221` (`_transcribe_single_input`), non-audio inputs are
  read as text and transcription + anonymization are skipped. So regenerating from a
  stored transcript is a first-class existing path — feed it the saved transcript text
  with `anonymize=False`, and only the Gemini generation steps run.
- **The uploaded audio is deleted after a job succeeds** (`api/admin.py:110-115`,
  `unlink(missing_ok=True)`). The stored `anonymized_transcript` is therefore the only
  durable artifact of a completed job. This is why regenerate reuses the transcript and
  re-transcribe genuinely requires the user to re-upload the file.
- The article header's date is parsed from the **filename** (`_get_header` →
  `_get_base_filename`, `article_generator.py:695-723`). When we regenerate from a
  transcript we must name the temp transcript file after the original source filename so
  the header date still resolves.
- Uploads go through `POST /admin/jobs` (`api/admin.py:341-380`); bytes are read fully
  into memory (`data = await file.read()`) before `save_upload`, so we can hash them
  in-memory before deciding to persist anything.
- Jobs/articles are chapter-scoped via `_chapter_filter()` (superadmin = no filter).

## Goals / non-goals

**Goals**
- Model name configurable via env-backed `Settings`.
- Content-hash (SHA-256) duplicate detection on upload, chapter-scoped.
- "Regenerate from transcript" path that skips transcription, reusing the stored
  anonymized transcript; produces a **new draft alongside** the existing article.
- "Re-transcribe from scratch" escape hatch (re-uploads the file, normal pipeline).
- Record the source filename on the article and show it in the header.
- A "Regenerate from transcript" action on **any** article detail page (same backend),
  serving the "newer models may produce better articles" motivation.

**Non-goals**
- No change to the transcription engine (AssemblyAI) or anonymization (spaCy).
- No change to graph ingestion behavior.
- No automatic re-generation; regeneration is always user-initiated.
- No content-addressed storage / file deduplication on disk (audio is deleted post-job
  anyway). Dedup is purely a UX/cost guard keyed off a stored hash.

## Data model changes (`aisalon-platform`, one Alembic migration)

**`jobs` table** (`models/job.py`)
- `content_hash: str | None` — `String(64)`, nullable, **indexed**. SHA-256 hex of the
  uploaded bytes. Set for audio jobs at upload; copied from the source article for
  regenerate jobs.
- `source_article_id: str | None` — `String(36)`, FK `articles.id`, nullable. Set only
  for regenerate jobs; identifies the article whose transcript to reuse. (Audio jobs
  leave this null and use `input_storage_key`.)

**`articles` table** (`models/article.py`)
- `content_hash: str | None` — `String(64)`, nullable, **indexed**. Inherited from the
  producing job at article creation. This is the column the dedup lookup queries.
- `source_filename: str | None` — `String(512)`, nullable. The original uploaded
  filename, denormalized from `Job.input_filename` at article creation.

**Migration extras**
- Create indexes on `jobs.content_hash` and `articles.content_hash`.
- **Backfill** `articles.source_filename` from the producing job's `input_filename`
  (`UPDATE articles SET source_filename = jobs.input_filename FROM jobs WHERE
  articles.job_id = jobs.id`). Use real SQL/`op.execute`; mind asyncpg type strictness
  per the platform CLAUDE.md.
- `content_hash` cannot be backfilled for existing articles (audio is gone) — leave
  null. Those articles simply won't be dedup-matched, which is acceptable.

`content_hash` is **not unique** — re-transcribe and regenerate (keep-both) legitimately
produce multiple articles with the same hash.

## Configurable model (Phase 1)

- `core/config.py` `Settings`: add `ARTICLE_LLM_MODEL: str = "gemini-3.1-flash-lite"`.
- `services/processor.py`: replace the hardcoded `ArticleGenerator(model="gemini-3-flash-preview")`
  with `ArticleGenerator(model=settings.ARTICLE_LLM_MODEL)` in both the audio path and
  the new transcript path.
- `SocraticAI/socraticai/config.py:12`: `DEFAULT_LLM_MODEL = "gemini-3.1-flash-lite"`
  (standalone-CLI fallback; the platform always passes the model explicitly).
- Document `ARTICLE_LLM_MODEL` in the backend env-vars section of the platform CLAUDE.md.

## Dedup detection on upload (Phase 4)

`POST /admin/jobs` gains `force: bool = Form(False)`.

Flow when `force` is false:
1. Read bytes (already happens), compute `content_hash = sha256(data).hexdigest()`.
2. **Chapter-scoped** lookup (superadmin = no chapter filter):
   - **Completed article match** — a completed `Article` with this `content_hash` and a
     non-empty `anonymized_transcript`. If found (most recent by `created_at` if several),
     return `409` and persist nothing.
   - **In-flight job match** *(secondary)* — a `pending`/`processing` `Job` with this
     `content_hash`. If found, return `409` indicating it's already processing.
3. No match → proceed exactly as today: `save_upload`, create `Job` (now also storing
   `content_hash`), enqueue `run_job`.

When `force` is true: skip the dedup check entirely and run the normal audio path
(`content_hash` still stored on the job).

**409 response body** (FastAPI `HTTPException(detail=...)` dict):
```json
{
  "code": "duplicate_upload",          // or "duplicate_processing"
  "message": "This file has already been turned into an article.",
  "existing_article": { "id": "...", "title": "...", "status": "draft" }
}
```
The happy path still returns `201` with the `JobResponse`.

## Regenerate from transcript (Phase 5)

**New endpoint:** `POST /admin/articles/{article_id}/regenerate`
- Loads the article, applies the chapter-scope check (same pattern as `get_job`).
- `400` if `anonymized_transcript` is empty/null ("No stored transcript to regenerate
  from").
- Creates a `Job(user_id=current_user.id, chapter_id=article.chapter_id,
  status=pending, source_article_id=article.id, content_hash=article.content_hash,
  input_filename=article.source_filename, input_storage_key=None)` and enqueues
  `run_job`.
- Returns the new `JobResponse` (`201`). The new draft appears alongside the source
  article (keep-both).

This single endpoint serves **both** the duplicate-upload "Regenerate from transcript"
action (frontend already has the existing article id from the 409) **and** the
"Regenerate" button on any article detail page.

**`run_job` branch** (`api/admin.py`): if `job.source_article_id` is set, load the
source article and call a new `processor.process_from_transcript(...)` instead of
`processor.process(...)`. Skip the audio-deletion step (there is no audio). New article
inherits `content_hash` and `source_filename` from the job (which carried them from the
source article).

**New processor method:** `SocraticProcessor.process_from_transcript(transcript_text, source_filename, chapter_id, user_id, db, on_step=None) -> dict`
- Only needs the **Google** key (no AssemblyAI — no transcription). A user without an
  AssemblyAI key can still regenerate.
- In the executor thread: set up the same temp `DATA_DIRECTORY`, write `transcript_text`
  to `inputs/<stem>.txt` where `<stem>` derives from `source_filename` (falling back to a
  generic name) so `_get_header` date parsing works. Call
  `ArticleGenerator(model=settings.ARTICLE_LLM_MODEL).generate(input_paths=<txt>,
  anonymize=False)`.
- Returns the same dict shape as `process()`. `anonymized_transcript` is set to the
  input `transcript_text` directly (it is already anonymized; the text path produces no
  `_anon.txt`).

## API / schema changes

- `schemas/admin.py` `ArticleResponse`: add `source_filename: str | None = None`
  (and `content_hash: str | None = None` if useful to the frontend; optional).
- `schemas/admin.py` `JobResponse`: add `source_article_id: str | None = None` so the
  jobs panel can label regenerate jobs.
- New route `POST /admin/articles/{article_id}/regenerate`.
- `POST /admin/jobs`: new `force` form field; `409` duplicate responses.

## Frontend changes (`frontend/src`)

- **`/upload` page** (`app/(admin)/upload/page.tsx`): on `409` from `POST /admin/jobs`,
  read `err.detail`. For `duplicate_upload`, show an inline prompt:
  > "This file has already been turned into an article: **[title]**(link). "
  with two actions:
  - **Regenerate from transcript** *(primary)* → `POST /admin/articles/{id}/regenerate`,
    then surface the new job in the processing panel.
  - **Re-transcribe from scratch** *(secondary)* → re-submit the same `File` with
    `force=true` (the file object is still in memory from the user's selection).
  For `duplicate_processing`, show "This file is already being processed" and link to the
  jobs panel (no regenerate button).
- **Article detail page** (`app/(admin)/articles/[id]/page.tsx`): add a **"Regenerate
  from transcript"** button (disabled when there's no stored transcript) that calls the
  regenerate endpoint; show **`Source: <source_filename>`** as a small muted line in the
  header under the Draft badge / date (only when present).
- Processing-jobs panel: optionally label regenerate jobs (e.g. "regenerated") using
  `source_article_id`.

## Testing

Backend (pytest, in-memory SQLite):
- Upload a file, then upload identical bytes → `409 duplicate_upload` with the existing
  article; no second job created.
- Different bytes → normal `201`.
- `force=true` on a duplicate → normal `201` (new job created).
- Dedup is chapter-scoped: identical bytes in a different chapter (as a different
  chapter lead) → `201`, not a 409; superadmin matches across chapters.
- In-flight duplicate (pending job, same hash) → `409 duplicate_processing`.
- `POST /admin/articles/{id}/regenerate` creates a job with `source_article_id` set and
  no `input_storage_key`; `400` when the article has no transcript; chapter-scope 403.
- `process_from_transcript` returns the expected dict and sets `anonymized_transcript`
  to the input text (mock `ArticleGenerator.generate`).
- `source_filename` is populated on articles produced by both audio and regenerate jobs;
  `ArticleResponse` exposes it.
- Model: `processor` constructs `ArticleGenerator` with `settings.ARTICLE_LLM_MODEL`
  (assert via monkeypatched setting).

Frontend: `npm run build` must pass; manual check of the duplicate prompt and the
article-page regenerate button / source line.

## Implementation phases

1. **Configurable model** — `ARTICLE_LLM_MODEL` setting, processor wiring, SocraticAI
   default, docs. (Independent, shippable on its own.)
2. **Schema migration + model/schema fields** — `jobs.content_hash`,
   `jobs.source_article_id`, `articles.content_hash`, `articles.source_filename`,
   indexes, backfill of `source_filename`; expose `source_filename` (+ optional
   `content_hash`) on `ArticleResponse` and `source_article_id` on `JobResponse`.
3. **Source filename display** — header line on the article detail page.
4. **Dedup detection** — `content_hash` compute + `force` flag + `409` responses on
   `POST /admin/jobs`; frontend duplicate prompt.
5. **Regenerate from transcript** — `process_from_transcript`, `run_job` branch, the
   regenerate endpoint, frontend regenerate buttons (upload prompt + article page).

## Risks / notes

- **Model id validity** — `gemini-3.1-flash-lite` is the user-specified id; worth a
  quick confirmation against Google's current model list before merge, but it is
  configurable so a wrong guess is a settings change, not a deploy.
- **asyncpg type strictness** — the `source_filename` backfill and any raw SQL must use
  real types (no ISO strings for timestamps); verify the migration on the Railway
  Postgres `development` deploy, not just local SQLite.
- **Multiple articles per hash** — after re-transcribe/regenerate, several completed
  articles can share a `content_hash`; the dedup lookup points at the most recent.
- **Cross-repo coordination** — the only `SocraticAI` change is the one-line default;
  the platform pins the model explicitly, so the two repos can ship independently.
