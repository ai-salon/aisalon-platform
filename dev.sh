#!/usr/bin/env bash
# Run backend and frontend together for local development
# Usage: ./dev.sh

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill 0
}
trap cleanup EXIT INT TERM

echo "Starting AI Salon dev environment..."
echo "  Backend → http://localhost:8000"
echo "  Frontend → http://localhost:3000"
echo ""

# Backend
(cd "$ROOT/backend" && poetry run uvicorn app.main:app --reload --port 8000) &

# Frontend
(cd "$ROOT/frontend" && npm run dev) &

wait
