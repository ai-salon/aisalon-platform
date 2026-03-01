# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Local Development

```bash
./dev.sh          # starts both services in parallel
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000

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

- **`main.py`** — FastAPI app with CORS middleware; mounts 6 routers
- **`core/config.py`** — `Settings` (pydantic-settings); key vars: `FRONTEND_URL`, `DATABASE_URL`, `SECRET_KEY`, `UPLOAD_DIR`
- **`core/database.py`** — async SQLAlchemy engine + session factory
- **`core/deps.py`** — JWT bearer auth, `get_current_user` dependency
- **`core/security.py`** — password hashing, JWT create/decode
- **`core/encryption.py`** — Fernet encryption for stored API keys (SHA256 of `SECRET_KEY`)
- **`models/`** — SQLAlchemy ORM models; all use UUID PKs and `TimestampMixin` (created_at, updated_at)
- **`schemas/`** — Pydantic request/response schemas
- **`api/admin.py`** — all protected endpoints; uses `_require_admin()` and `_chapter_filter()` helpers for RBAC
- **`services/processor.py`** — `BaseProcessor` ABC with `StubProcessor`; swap for real AI processor later

### Data Model

```
User (superadmin | chapter_lead) → chapter_id FK
Chapter (code: unique slug) ← Users, TeamMembers, Jobs, Articles
TeamMember → chapter_id, display_order, is_cofounder
Article (draft | published) → chapter_id, job_id
Job (pending | processing | completed | failed) → user_id, chapter_id
UserAPIKey (assemblyai | anthropic | google) → user_id, Fernet-encrypted value
```

### Authentication Flow

1. `POST /auth/login` (FastAPI) → JWT access token
2. NextAuth `CredentialsProvider` (`frontend/src/lib/auth.ts`) forwards creds to backend, stores token in session
3. Admin pages call `auth()` server-side; redirect to `/login` if unauthenticated
4. API calls include `Authorization: Bearer <token>` header

### Frontend (`frontend/src/`)

- **`app/layout.tsx`** — global sticky nav with brand colors, Open Sans, FontAwesome 4.7.0
- **`app/globals.css`** — Tailwind v4 `@theme` tokens + component classes (`.btn`, `.btn-primary`, `.section-title`, `.flip-card`, etc.)
- **`app/providers.tsx`** — wraps app in NextAuth `SessionProvider`
- **`app/(public)/`** — public routes, no auth required
- **`app/(admin)/`** — protected routes; `(admin)/layout.tsx` has sidebar nav
- **`app/api/auth/[...nextauth]/route.ts`** — NextAuth route handler
- **`lib/api.ts`** — `apiFetch<T>(path, init?)` wrapper; base URL from `NEXT_PUBLIC_API_URL`
- **`lib/auth.ts`** — NextAuth config (Credentials provider)

### Route Map

| Path | File | Auth |
|------|------|------|
| `/` | `(public)/page.tsx` | No |
| `/chapters/[code]` | `(public)/chapters/[code]/page.tsx` | No |
| `/insights` | `(public)/insights/page.tsx` | No |
| `/insights/[id]` | `(public)/insights/[id]/page.tsx` | No |
| `/login` | `(admin)/login/page.tsx` | No |
| `/dashboard` | `(admin)/dashboard/page.tsx` | Yes |
| `/upload` | `(admin)/upload/page.tsx` | Yes |
| `/jobs` | `(admin)/jobs/page.tsx` | Yes |
| `/articles` | `(admin)/articles/page.tsx` | Yes |
| `/chapters` | `(admin)/chapters/page.tsx` | Yes (superadmin) |
| `/team` | `(admin)/team/page.tsx` | Yes |
| `/users` | `(admin)/users/page.tsx` | Yes (superadmin) |
| `/settings` | `(admin)/settings/page.tsx` | Yes |

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

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_API_URL` — backend API URL (default: `http://localhost:8000`)
- `AUTH_SECRET` — NextAuth session encryption secret

## Testing

Backend tests use an in-memory SQLite DB (never hits `dev.db`). Key fixtures in `tests/conftest.py`:
- `client` — `AsyncClient` with ASGI transport
- `superadmin`, `admin_token`, `admin_headers` — authenticated superadmin
- `sf_chapter`, `chapter_lead`, `lead_token`, `lead_headers` — scoped chapter lead

## Deployment

Railway monorepo:
- **Backend + PostgreSQL** → `api.aisalon.xyz` (`backend/Dockerfile` + `backend/railway.toml`)
- **Frontend** → `admin.aisalon.xyz`

CI (GitHub Actions) runs ruff + pytest for backend, ESLint + build for frontend.
