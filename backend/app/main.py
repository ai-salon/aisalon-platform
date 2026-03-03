import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app.api.health import router as health_router
from app.api.chapters import router as chapters_router
from app.api.team import router as team_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.articles import router as articles_router
from app.api.hosting_interest import router as hosting_interest_router
from app.core.config import settings
from app.core.seed import seed_superadmin, seed_chapters, seed_chapter_leads

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

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_superadmin()
    await seed_chapters()
    await seed_chapter_leads()
    yield


app = FastAPI(title=settings.APP_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> PlainTextResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return PlainTextResponse("Internal Server Error", status_code=500)


app.include_router(health_router)
app.include_router(chapters_router)
app.include_router(team_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(articles_router)
app.include_router(hosting_interest_router)

upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")
