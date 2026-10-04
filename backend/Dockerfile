FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
# App dependencies live in their own venv (/app/.venv) so `poetry install` never
# upgrades packages Poetry itself is running on (a shared site-packages broke the
# build mid-install when Poetry 2.5 updated attrs/certifi under itself).
RUN pip install poetry && poetry config virtualenvs.in-project true
ENV PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml poetry.lock* ./
RUN poetry install --only main --no-interaction

COPY . .

RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# --forwarded-allow-ips '*': Railway's ingress proxy is the only path to this
# container, so trust its X-Forwarded-For unconditionally; without this,
# get_remote_address() (used for per-IP rate limiting) sees the proxy IP for
# every visitor and rate limits collapse into one global cap.
CMD ["sh", "-c", "echo '=== Starting on port '${PORT:-8000}' ===' && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --forwarded-allow-ips '*'"]
