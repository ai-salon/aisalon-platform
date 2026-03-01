from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.chapters import router as chapters_router
from app.api.team import router as team_router
from app.api.auth import router as auth_router
from app.core.config import settings

# Ensure models are imported so SQLAlchemy can discover them
import app.models.chapter  # noqa: F401
import app.models.team_member  # noqa: F401
import app.models.user  # noqa: F401

app = FastAPI(title=settings.APP_NAME, version=settings.VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(chapters_router)
app.include_router(team_router)
app.include_router(auth_router)
