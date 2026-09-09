# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Local Development

```bash
./dev.sh          # starts both services in parallel
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

## Branching Strategy

- **`main`** — production branch, deployed to Railway. Must always be green.
- **`develop`** — integration branch. All feature work merges here first.
- **Feature branches** — branch off `develop` with descriptive names (e.g., `feature/add-events-api`, `fix/login-redirect`). Open PRs against `develop`.
- When `develop` is stable and tested, merge to `main` for production deploy.

### Merge and Push After Completing Work

After finishing a significant unit of work (feature, bugfix, or set of related changes):

1. **Run all tests** — backend (`poetry run pytest -q`) and frontend (`npm run build`) must pass.
2. **Merge to `develop`** — switch to `develop`, merge the feature branch, and resolve any conflicts.
3. **Push `develop`** — `git push origin develop` so the remote stays current and CI runs.
4. **Verify the Railway deploy** — Railway auto-deploys `develop` to the `development` environment. After every push to `develop`, confirm the new deployment succeeded before declaring the work done. See "Verifying Railway deploys" below.
5. **Clean up** — delete the merged feature branch locally and remotely (`git branch -d <branch>`, `git push origin --delete <branch>`).

Do not leave completed work sitting on unpushed feature branches. The `develop` branch should always reflect the latest integrated state of the project.

### Verifying Railway deploys

After every push to `develop` (or `main`), wait for Railway to finish building and deploying, then confirm the new deployment succeeded. Local tests don't catch Postgres-specific issues (e.g. asyncpg type strictness vs. SQLite) or container/runtime problems.

```bash
cd /Users/ian/Projects/AiSalon/aisalon-platform
railway status --json | python3 -c "
import json, sys
d = json.load(sys.stdin)
for env in d['environments']['edges']:
    e = env['node']
    for s in e['serviceInstances']['edges']:
        n = s['node']
        ld = n['latestDeployment']
        if not ld: continue
        commit = (ld.get('meta') or {}).get('commitHash', '')[:8]
        print(f\"{e['name']:12} {n['serviceName']:10} {ld['status']:10} {ld['createdAt']}  {commit}\")
"
```

Look for the most recent backend deployment matching your commit and confirm `status` is `SUCCESS`. If `FAILED`:

```bash
# Build logs (compile / image push errors)
railway logs --build <deployment-id> | tail -120

# Runtime logs (startup, healthcheck, alembic, app crashes)
railway logs --deployment <deployment-id> | head -120
```

Common failure modes:
- **Healthcheck failure** — the container started but `/health` never returned 200. Inspect runtime logs for an unhandled exception during startup or migrations.
- **Migration crashes on Postgres but not SQLite** — asyncpg is strict about types (e.g. it rejects ISO timestamp strings for `timestamptz` columns; SQLite accepts them). Pass actual `datetime` instances, not `.isoformat()` strings, in raw-SQL migrations.
- **Missing env var** — Railway env vars differ from local `.env`. Check the service's variables in the Railway dashboard if a `KeyError`/`ValidationError` shows up at startup.

Fix the issue, push again, and re-verify. Don't move on until the latest deployment is `SUCCESS`.

## Testing and TDD

Follow **red-green** testing:
1. **Red** — Write a failing test that describes the desired behavior.
2. **Green** — Write the minimum code to make the test pass.
3. **Refactor** — Clean up while keeping tests green.

Run tests before and after every change:
- Backend: `cd backend && poetry run pytest -q`
- Frontend: `cd frontend && npm run build`

## Backend (FastAPI, Python 3.11, Poetry)

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload    # dev server
poetry run ruff check app/                  # lint
poetry run pytest -q                        # all tests
poetry run pytest tests/test_auth.py -q     # single test file
```

Ruff: `target-version = py311`, `line-length = 88`. Pytest: `asyncio_mode = "auto"`.

Local dev uses SQLite (`dev.db`). Set `DATABASE_URL` for PostgreSQL.

### Alembic Migrations

```bash
cd backend
poetry run alembic revision --autogenerate -m "description"
poetry run alembic upgrade head
```

`alembic/env.py` auto-imports all models for migration discovery.

## Frontend (Next.js 15, Tailwind v4)

```bash
cd frontend
npm install
npm run dev     # dev server
npm run build   # production build
npm run lint    # ESLint (next/core-web-vitals)
```

## Architecture

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app with CORS middleware; mounts 7 routers
- **`core/config.py`** — `Settings` (pydantic-settings); key vars: `FRONTEND_URL`, `DATABASE_URL`, `SECRET_KEY`, `UPLOAD_DIR`, `ADMIN_PASSWORD`, `BASE_PASSWORD`
- **`core/database.py`** — async SQLAlchemy engine + session factory
- **`core/deps.py`** — JWT bearer auth, `get_current_user` dependency
- **`core/security.py`** — password hashing, JWT create/decode (HS256, 30-day TTL, matches NextAuth session maxAge)
- **`core/encryption.py`** — Fernet encryption for stored API keys (SHA256 of `SECRET_KEY`)
- **`models/`** — SQLAlchemy ORM models; all use UUID PKs and `TimestampMixin` (created_at, updated_at)
- **`schemas/`** — Pydantic request/response schemas
- **`api/admin.py`** — all protected endpoints; uses `_require_admin()`, `_require_lead_or_above()`, and `_chapter_filter()` helpers for RBAC
- **`services/processor.py`** — `SocraticProcessor` (implements `BaseProcessor` ABC); runs SocraticAI pipeline via `ThreadPoolExecutor`

### Data Model

```
User (superadmin | chapter_lead | host) → chapter_id FK; profile fields (name, title, photo, is_founder, display_order, hide_from_team) drive the public Team page
Chapter (code: unique slug) ← Users, Jobs, Articles
Article (draft | published) → chapter_id, job_id
  └── SocialPost → platform, status (pending|posted|failed)
Job (pending | processing | completed | failed) → user_id, chapter_id
UserAPIKey (assemblyai | google) → user_id, Fernet-encrypted value
Invite → chapter_id, created_by, token, max_uses, use_count, expires_at
SystemSetting → key (unique), encrypted_value
UserLoginEvent → user_id, logged_in_at  (login activity tracking)
HostingInterest → name, email, city, interest_type (start_chapter | host_existing)
```

### Authentication & Registration Flow

1. `POST /auth/login` → JWT access token + records `UserLoginEvent`
2. NextAuth `CredentialsProvider` forwards creds to backend, stores token in 30-day session cookie
3. New members register via invite: `GET /auth/invite/{token}` validates token → `POST /auth/register` creates user, increments `invite.use_count`
4. Admin pages call `auth()` server-side; redirect to `/profile/complete` if the account has no name yet, to `/login` if unauthenticated
5. API calls include `Authorization: Bearer <token>` header
6. Password reset by email: `POST /auth/forgot-password` (always 202; 503 when Resend is unconfigured) emails a single-use 24h link to `/reset-password?token=…` → `POST /auth/reset-password`. Superadmins trigger the same link for any account via `POST /admin/users/{id}/password-reset-link` or by creating a user with `send_password_link: true` and no password (`services/password_reset.py`).

### Users vs. Team vs. My Profile

- **Users page** (`/users`, superadmin only) = **accounts**: who can log in and what they are. Create and edit everything — name, email, username, password (or emailed set-password link), role, chapter, founder flag, active. `POST/PATCH /admin/users`.
- **Team page** (`/people`, superadmins + chapter leads) = **presentation** of the public team: photo, title, order, public toggle. Leads manage hosts and co-leads in their own chapter; superadmins manage everyone and can **view as** any chapter's lead (client-side preview of that lead's scope and controls). `PATCH /admin/people/{id}` accepts presentation fields only.
- **My Profile** (`/profile`) = self-service for one's own name, photo, bio, LinkedIn, email change, password.

**Complete = has a name.** No separate onboarding gate: the public `/team`, the admin-layout onboarding redirect, and the Team page's Profile column all key on `name`. `profile_completed_at` is an audit timestamp set whenever a name first lands (onboarding form, My Profile, or an admin on the Users page).

**System logins vs. people.** The seeded `admin@aisalon.xyz` and `<chapter>@aisalon.xyz` accounts are break-glass ghosts: nameless, `hide_from_team=True`, never given a person's profile (`core/seed.py`; migration `d4e8a1b2c3f5` moved the founder's profile off `admin`). Nobody is seeded as a person — founders and leads are accounts a superadmin creates on the Users page (typically with an emailed set-password link) or that register via invite. A superadmin may carry a `chapter_id` purely so they list under that chapter on the Team page; RBAC still treats them as global. The public `/team` orders founders by `display_order` alone, then chapter leads grouped by chapter.

### RBAC Pattern

Three helpers in `api/admin.py` used on every admin endpoint:
- `_require_admin(user)` — superadmin only, else 403
- `_require_lead_or_above(user)` — superadmin or chapter_lead, else 403
- `_chapter_filter(user)` — returns `user.chapter_id` for chapter leads/hosts, `None` for superadmins (used to scope all list queries)

### Background Job Pipeline

Upload → `POST /admin/jobs` creates Job (pending) + calls `BackgroundTasks.add_task(run_job, job_id)`:
1. Resolves AssemblyAI + Google keys via `system_settings.resolve_provider_key` (per-user `UserAPIKey` → admin `SystemSetting` → env var) and the model via `resolve_model`
2. Runs `SocraticProcessor.process()` in `ThreadPoolExecutor(max_workers=1)` to avoid blocking the async event loop
3. SocraticAI creates a temp directory, sets `sc_config.DATA_DIRECTORY`, calls `generator.generate(anonymize=True)`
4. On success: creates `Article` (draft) with title, content_md, anonymized_transcript; job → completed
5. On failure: job → failed with error_message

Frontend polls `GET /admin/jobs` every 5 seconds while any job is pending/processing.

### Notifications

**Summary endpoint:** `GET /admin/notifications/summary` (role-scoped) returns badge counts for sidebar (unhandled contact messages, hosting interest inquiries). Frontend polls every 60s.

**Handled state:** `ContactMessage` and `HostingInterest` have `status` (new | handled), `handled_by` (user FK), and `handled_at` (timestamp). PATCH endpoints mark as handled by current user.

**Weekly digest service:** `scripts/send_digests.py` builds and sends one email per chapter lead / superadmin (via Resend), covering contact messages, hosting interest, volunteer applications, and new members — all windowed on `created_at` regardless of handled/pending state — plus, for superadmins only, community uploads, failed jobs, and a standing draft-articles-awaiting-publish count. Flags: `--window-days` (default 7, uses a rolling window and skips the DigestRun guard entirely), `--force` (bypass the DigestRun guard for the real weekly run), `--only-email` (still really sends the email to that one address — it only skips the DigestRun write, it is not a dry run). The DigestRun row is claimed (inserted/re-claimed and committed) *before* any email is sent, so a crash mid-send still leaves the guard in place and a retried run is correctly refused instead of resending; `recipients_count` is filled in after the send loop completes.

**Test endpoint:** `POST /admin/digests/run-test` (superadmin) accepts `{window_days, only_me}` (only_me sends to current user instead of chapter leads; when only_me is true, the caller's own `digest_opt_out` is ignored — it's an explicit test request). Skips DigestRun guard.

**Profile toggle:** User model has `digest_opt_out` boolean; My Profile page (`/profile`) includes toggle.

**Synthesis script:** `poetry run python scripts/synthesize_test_events.py --api-url <backend-url> --chapter <code> --contact-email <you@x.co>` creates test contact messages and hosting interests. Requires env vars `SYNTH_ADMIN_EMAIL`, `SYNTH_ADMIN_PASSWORD` (must be superadmin).

**Railway cron setup (manual):** In Railway dashboard:
1. New Service → select same repo + Dockerfile
2. Cron Schedule: `30 9 * * 1` (9:30 AM, Mondays)
3. Start Command: `poetry run python scripts/send_digests.py` (Dockerfile WORKDIR is already `backend`)
4. Environment: attach same vars as backend service (DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, SECRET_KEY, FRONTEND_URL)
5. Set Restart Policy to **NEVER** for the cron service — the claim-first DigestRun guard makes retries safe either way, but NEVER avoids pointless re-runs
6. Repeat for each environment (development, staging, production)

### Frontend (`frontend/src/`)

- **`app/layout.tsx`** — global sticky nav with brand colors, Open Sans, FontAwesome 4.7.0
- **`app/globals.css`** — Tailwind v4 `@theme` tokens + component classes (`.btn`, `.btn-primary`, `.section-title`, `.flip-card`, etc.)
- **`app/providers.tsx`** — wraps app in NextAuth `SessionProvider`
- **`app/(public)/`** — public routes, no auth required; `layout.tsx` adds shared footer
- **`app/(admin)/`** — protected routes; `layout.tsx` has sidebar nav
- **`app/api/auth/[...nextauth]/route.ts`** — NextAuth route handler
- **`lib/api.ts`** — `apiFetch<T>(path, init?)` wrapper; base URL from `NEXT_PUBLIC_API_URL`
- **`lib/auth.ts`** — NextAuth config (Credentials provider, 30-day maxAge)

### Route Map

| Path | File | Auth |
|------|------|------|
| `/` | `(public)/page.tsx` | No |
| `/chapters/[code]` | `(public)/chapters/[code]/page.tsx` | No |
| `/host` | `(public)/host/page.tsx` | No |
| `/host/[code]` | `(public)/host/[code]/page.tsx` | No |
| `/register` | `(public)/register/page.tsx` | No |
| `/verify-email` | `(public)/verify-email/page.tsx` | No |
| `/forgot-password` | `(public)/forgot-password/page.tsx` | No |
| `/reset-password` | `(public)/reset-password/page.tsx` | No |
| `/insights` | `(public)/insights/page.tsx` | No |
| `/login` | `(admin)/login/page.tsx` | No |
| `/profile` | `(admin)/profile/page.tsx` | Yes |
| `/dashboard` | `(admin)/dashboard/page.tsx` | Yes |
| `/upload` | `(admin)/upload/page.tsx` | Yes |
| `/jobs` | `(admin)/jobs/page.tsx` | Yes |
| `/articles` | `(admin)/articles/page.tsx` | Yes |
| `/articles/[id]` | `(admin)/articles/[id]/page.tsx` | Yes |
| `/chapters` | `(admin)/chapters/page.tsx` | Yes (superadmin) |
| `/chapters/edit/[code]` | `(admin)/chapters/edit/[code]/page.tsx` | Yes |
| `/contact-messages` | `(admin)/contact-messages/page.tsx` | Yes |
| `/people` | `(admin)/people/page.tsx` | Yes (Team page; leads see their chapter) |
| `/users` | `(admin)/users/page.tsx` | Yes (superadmin) |
| `/settings` | `(admin)/settings/page.tsx` | Yes |
| `/community` | `(admin)/community/page.tsx` | Yes |
| `/hosting-interest` | `(admin)/hosting-interest/page.tsx` | Yes (leads see their chapter) |
| `/social` | `(admin)/social/page.tsx` | Yes |

**Note:** Password change has been moved from Settings to My Profile (`/profile`).

### Styling

Tailwind v4 tokens (use these, not hex values directly):

| Token | Value |
|-------|-------|
| `salon-blue` | `#56a1d2` |
| `salon-blue-dark` | `#4a8bc2` |
| `salon-gold` | `#d2b356` |
| `salon-gold-light` | `#dad1b7` |
| `salon-cream` | `#f8f6ec` |
| `salon-text` | `#111111` |
| `salon-muted` | `#696969` |

### Environment Variables

**Backend** (`.env`):
- `FRONTEND_URL` — CORS allowlist origin (default: `http://localhost:3000`)
- `DATABASE_URL` — PostgreSQL URL (omit to use local SQLite)
- `SECRET_KEY` — JWT signing + Fernet encryption derivation key
- `ENVIRONMENT` — `development` | `staging` | `production`
- `UPLOAD_DIR` — file upload directory (default: `uploads`)
- `ADMIN_PASSWORD` — seeded superadmin password (default: `salonconvo`)
- `BASE_PASSWORD` — base for seeded chapter lead passwords (default: `impact`)
- `SENTRY_DSN` — Sentry project DSN for error tracking (optional, no-op when empty)
- `LOG_LEVEL` — structlog level: DEBUG, INFO, WARNING, ERROR (default: `INFO`)
- `ASSEMBLYAI_API_KEY` — optional env-var fallback. Resolution order (see `services/system_settings.resolve_provider_key`): per-user `UserAPIKey` → admin `SystemSetting` (`assemblyai_api_key`, set in **Settings ▸ AI Processing**, superadmin) → this env var.
- `GOOGLE_API_KEY` — optional env-var fallback. Same resolution order (`SystemSetting` key `google_api_key`).
- `ARTICLE_LLM_MODEL` — default LLM model for article generation (default: `gemini-3.1-flash-lite`). Admin-overridable at runtime via `SystemSetting` `article_llm_model` (**Settings ▸ AI Processing**, verified with a live test call before save). Resolution order (`resolve_model`): setting → this env var → SocraticAI default. Passed explicitly to SocraticAI's `ArticleGenerator`.
- `RESEND_API_KEY` — Resend API key for transactional email (verification links, contact-form forwarding). Empty ⇒ email features fail closed with a clear "not configured" message.
- `EMAIL_FROM` — From header for outbound email (default: `Ai Salon <noreply@aisalon.xyz>`).

Admin-managed keys + model are configured by a superadmin in **Settings ▸ AI Processing** (`GET /admin/processing-config`, `POST /admin/processing/test` to verify, then `POST /admin/system-settings` to persist). Hosts/chapter leads no longer set their own keys; `UserAPIKey` is retained (no UI) and still wins if present.

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_API_URL` — backend API URL (default: `http://localhost:8000`)
- `AUTH_SECRET` — NextAuth session encryption secret
- `NEXT_PUBLIC_SENTRY_DSN` — Sentry project DSN for frontend error tracking (optional)

## Testing

Backend tests use an in-memory SQLite DB (never hits `dev.db`). Key fixtures in `tests/conftest.py`:
- `client` — `AsyncClient` with ASGI transport
- `superadmin`, `admin_token`, `admin_headers` — authenticated superadmin
- `sf_chapter`, `chapter_lead`, `lead_token`, `lead_headers` — scoped chapter lead
- `host_user`, `host_token`, `host_headers` — host user for a chapter

## Monitoring & Logging

See `docs/monitoring.md` for full details.

- **Error tracking:** Sentry (free tier) — both backend and frontend. Configured via `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` env vars. No-op when DSN is not set.
- **Structured logging:** structlog on backend — JSON output in production, console in dev. Use `from app.core.logging import get_logger` for new modules.
- **Request logging:** Middleware in `main.py` logs method, path, status, duration for every request (except `/health`).
- **Sentry API:** Query errors programmatically — see `docs/monitoring.md` for curl examples.

## Deployment

Railway monorepo:
- **Backend + PostgreSQL** → `api.aisalon.xyz` (`backend/Dockerfile` + `backend/railway.toml`)
- **Frontend** → `admin.aisalon.xyz`

CI (GitHub Actions) runs ruff + pytest for backend, ESLint + build for frontend.
