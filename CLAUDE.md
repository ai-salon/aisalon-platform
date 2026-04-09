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
- **`core/security.py`** — password hashing, JWT create/decode (HS256, 7-day TTL)
- **`core/encryption.py`** — Fernet encryption for stored API keys (SHA256 of `SECRET_KEY`)
- **`models/`** — SQLAlchemy ORM models; all use UUID PKs and `TimestampMixin` (created_at, updated_at)
- **`schemas/`** — Pydantic request/response schemas
- **`api/admin.py`** — all protected endpoints; uses `_require_admin()`, `_require_lead_or_above()`, and `_chapter_filter()` helpers for RBAC
- **`services/processor.py`** — `SocraticProcessor` (implements `BaseProcessor` ABC); runs SocraticAI pipeline via `ThreadPoolExecutor`

### Data Model

```
User (superadmin | chapter_lead | host) → chapter_id FK
Chapter (code: unique slug) ← Users, TeamMembers, Jobs, Articles
TeamMember → chapter_id, display_order, is_cofounder
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
4. Admin pages call `auth()` server-side; redirect to `/login` if unauthenticated
5. API calls include `Authorization: Bearer <token>` header

### RBAC Pattern

Three helpers in `api/admin.py` used on every admin endpoint:
- `_require_admin(user)` — superadmin only, else 403
- `_require_lead_or_above(user)` — superadmin or chapter_lead, else 403
- `_chapter_filter(user)` — returns `user.chapter_id` for chapter leads/hosts, `None` for superadmins (used to scope all list queries)

### Background Job Pipeline

Upload → `POST /admin/jobs` creates Job (pending) + calls `BackgroundTasks.add_task(run_job, job_id)`:
1. Reads AssemblyAI + Google API keys from `UserAPIKey` table (decrypts at runtime)
2. Runs `SocraticProcessor.process()` in `ThreadPoolExecutor(max_workers=1)` to avoid blocking the async event loop
3. SocraticAI creates a temp directory, sets `sc_config.DATA_DIRECTORY`, calls `generator.generate(anonymize=True)`
4. On success: creates `Article` (draft) with title, content_md, anonymized_transcript; job → completed
5. On failure: job → failed with error_message

Frontend polls `GET /admin/jobs` every 5 seconds while any job is pending/processing.

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
| `/insights` | `(public)/insights/page.tsx` | No |
| `/insights/[id]` | `(public)/insights/[id]/page.tsx` | No |
| `/login` | `(admin)/login/page.tsx` | No |
| `/dashboard` | `(admin)/dashboard/page.tsx` | Yes |
| `/upload` | `(admin)/upload/page.tsx` | Yes |
| `/jobs` | `(admin)/jobs/page.tsx` | Yes |
| `/articles` | `(admin)/articles/page.tsx` | Yes |
| `/articles/[id]` | `(admin)/articles/[id]/page.tsx` | Yes |
| `/chapters` | `(admin)/chapters/page.tsx` | Yes (superadmin) |
| `/chapters/edit/[code]` | `(admin)/chapters/edit/[code]/page.tsx` | Yes |
| `/team` | `(admin)/team/page.tsx` | Yes |
| `/users` | `(admin)/users/page.tsx` | Yes (superadmin) |
| `/settings` | `(admin)/settings/page.tsx` | Yes |
| `/community` | `(admin)/community/page.tsx` | Yes |
| `/hosting-interest` | `(admin)/hosting-interest/page.tsx` | Yes (superadmin) |
| `/social` | `(admin)/social/page.tsx` | Yes |

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

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_API_URL` — backend API URL (default: `http://localhost:8000`)
- `AUTH_SECRET` — NextAuth session encryption secret

## Testing

Backend tests use an in-memory SQLite DB (never hits `dev.db`). Key fixtures in `tests/conftest.py`:
- `client` — `AsyncClient` with ASGI transport
- `superadmin`, `admin_token`, `admin_headers` — authenticated superadmin
- `sf_chapter`, `chapter_lead`, `lead_token`, `lead_headers` — scoped chapter lead
- `host_user`, `host_token`, `host_headers` — host user for a chapter

## Deployment

Railway monorepo:
- **Backend + PostgreSQL** → `api.aisalon.xyz` (`backend/Dockerfile` + `backend/railway.toml`)
- **Frontend** → `admin.aisalon.xyz`

CI (GitHub Actions) runs ruff + pytest for backend, ESLint + build for frontend.
