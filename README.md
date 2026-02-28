# AI Salon Platform

Full-stack web platform for the AI Salon community.

## Architecture

- **Backend**: FastAPI (Python 3.11) — deployed on Railway
- **Frontend**: Next.js 15 + Tailwind CSS — deployed on Railway
- **Database**: PostgreSQL on Railway

## Development

### Backend

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

Server runs on http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dev server runs on http://localhost:3000

### Environment Variables

**Backend** (`.env` in `backend/`):
- `FRONTEND_URL` — Frontend origin for CORS (default: `http://localhost:3000`)
- `DATABASE_URL` — PostgreSQL connection string
- `ENVIRONMENT` — `development` | `staging` | `production`

**Frontend** (`.env.local` in `frontend/`):
- `NEXT_PUBLIC_API_URL` — Backend API URL (default: `http://localhost:8000`)

## Deployment

All services deployed on Railway:
- Backend + PostgreSQL (`api.aisalon.xyz`)
- Frontend (`admin.aisalon.xyz`)
