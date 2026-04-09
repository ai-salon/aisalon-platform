# Monitoring & Logging

The platform uses **Sentry** for error tracking and **structlog** for structured logging.

## Architecture

```
Backend (FastAPI)                Frontend (Next.js)
├── structlog → JSON stdout      ├── @sentry/nextjs
│   └── Railway captures logs    │   ├── Client-side error capture
├── sentry-sdk[fastapi]          │   ├── Server-side error capture
│   └── Automatic error capture  │   └── global-error.tsx boundary
└── Request logging middleware   └── instrumentation.ts hooks
```

## Backend: Structured Logging (structlog)

All backend modules use structlog for structured logging:

```python
from app.core.logging import get_logger

logger = get_logger(__name__)
logger.info("job_created", job_id=job.id, chapter_id=chapter_id)
logger.warning("login_failed", identifier=body.identifier)
logger.exception("job_failed", error=str(exc))
```

**Output format:**
- Development: colored console output (human-readable)
- Production: JSON lines on stdout (machine-parseable, captured by Railway)

**Key logged events:**
| Event | Level | Module |
|-------|-------|--------|
| `request` | INFO | main.py (middleware) |
| `login_success` | INFO | auth.py |
| `login_failed` | WARNING | auth.py |
| `user_registered` | INFO | auth.py |
| `job_created` | INFO | admin.py |
| `job_processing` | INFO | admin.py |
| `job_completed` | INFO | admin.py |
| `job_failed` | ERROR | admin.py |
| `job_not_found` | ERROR | admin.py |
| `unhandled_error` | ERROR | main.py |
| Seed operations | INFO | seed.py |

**Request logging middleware** automatically logs every request (except `/health`) with:
- `request_id`: unique per-request identifier
- `method`, `path`, `status`, `duration_ms`

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `LOG_LEVEL` | `INFO` | Python log level (DEBUG, INFO, WARNING, ERROR) |

## Sentry: Error Tracking

Sentry captures unhandled exceptions automatically in both backend and frontend.

### Configuration

| Env Var | Service | Description |
|---------|---------|-------------|
| `SENTRY_DSN` | Backend | Sentry project DSN for Python SDK |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend | Sentry project DSN for Next.js SDK |

When DSN is not set, Sentry operates as a no-op (no errors, no overhead).

### Setup (one-time)

1. Create a free Sentry account at https://sentry.io
2. Create a Sentry organization (e.g., `aisalon`)
3. Create two projects:
   - `aisalon-backend` (platform: Python/FastAPI)
   - `aisalon-frontend` (platform: Next.js)
4. Copy each project's DSN into the respective env vars on Railway

### Querying Sentry (API)

Sentry's REST API allows programmatic access to errors and events. This is how AI agents can query production issues.

**Authentication:** Create an API token at https://sentry.io/settings/account/api/auth-tokens/ with `event:read`, `project:read`, `org:read` scopes.

**Common queries:**

```bash
# List unresolved issues (most recent first)
curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/aisalon/aisalon-backend/issues/?query=is:unresolved&sort=date"

# Get events for a specific issue
curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/issues/{issue_id}/events/"

# Search events by tag
curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/aisalon/aisalon-backend/events/?query=transaction:/auth/login"

# Get issue details
curl -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/issues/{issue_id}/"
```

**Full API docs:** https://docs.sentry.io/api/

### Querying Railway Logs

Railway captures all stdout/stderr. Backend logs are structured JSON in production.

```bash
# Via Railway CLI
railway logs --service backend

# Filter by event type (in terminal)
railway logs --service backend | grep '"event": "job_failed"'
```

## Adding Logging to New Code

When adding new endpoints or services:

```python
from app.core.logging import get_logger

logger = get_logger(__name__)

# Use structured key-value pairs, not format strings
logger.info("descriptive_event_name", key1=value1, key2=value2)

# For operations with context, use bind()
op_logger = logger.bind(job_id=job_id)
op_logger.info("step_started")
op_logger.info("step_completed")
```

Guidelines:
- Use snake_case event names as the first argument
- Pass context as keyword arguments (not format strings)
- Log at appropriate levels: DEBUG (verbose), INFO (operations), WARNING (recoverable issues), ERROR (failures)
- Don't log sensitive data (passwords, tokens, API keys, PII)
