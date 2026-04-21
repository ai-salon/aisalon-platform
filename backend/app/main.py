import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import sentry_sdk
import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.health import router as health_router
from app.api.chapters import router as chapters_router
from app.api.team import router as team_router
from app.api.auth import limiter, router as auth_router
from app.api.admin import router as admin_router
from app.api.articles import router as articles_router
from app.api.hosting_interest import router as hosting_interest_router
from app.api.volunteer import router as volunteer_router
from app.api.topics import router as topics_router
from app.api.community import router as community_router
from app.api.graph import public_router as graph_public_router, admin_router as graph_admin_router
from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.seed import seed_superadmin, seed_chapters, seed_chapter_leads, seed_volunteer_roles, seed_topics

# Ensure models are imported so SQLAlchemy can discover them
import app.models.chapter  # noqa: F401
import app.models.team_member  # noqa: F401
import app.models.user  # noqa: F401
import app.models.api_key  # noqa: F401
import app.models.job  # noqa: F401
import app.models.article  # noqa: F401
import app.models.hosting_interest  # noqa: F401
import app.models.invite  # noqa: F401
import app.models.system_setting  # noqa: F401
import app.models.social_post  # noqa: F401
import app.models.volunteer  # noqa: F401
import app.models.topic  # noqa: F401
import app.models.community_upload  # noqa: F401
import app.models.graph  # noqa: F401

# Initialize structured logging
setup_logging()
logger = get_logger(__name__)

# Initialize Sentry (no-op if DSN is empty)
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2,
        send_default_pii=False,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_superadmin()
    await seed_chapters()
    await seed_chapter_leads()
    await seed_volunteer_roles()
    await seed_topics()
    yield


app = FastAPI(title=settings.APP_NAME, version=settings.VERSION, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000)

    if request.url.path != "/health":
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )

    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> PlainTextResponse:
    logger.exception(
        "unhandled_error",
        method=request.method,
        path=request.url.path,
        error=str(exc),
    )
    return PlainTextResponse("Internal Server Error", status_code=500)


app.include_router(health_router)
app.include_router(chapters_router)
app.include_router(team_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(articles_router)
app.include_router(hosting_interest_router)
app.include_router(volunteer_router)
app.include_router(topics_router)
app.include_router(community_router)
app.include_router(graph_public_router)
app.include_router(graph_admin_router)

upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")
