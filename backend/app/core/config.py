from pydantic import model_validator
from pydantic_settings import BaseSettings

_INSECURE_DEFAULTS = {
    "SECRET_KEY": "dev-secret-key-change-in-production",
    "ADMIN_PASSWORD": "changeme123",
    "BASE_PASSWORD": "impact",
}


class Settings(BaseSettings):
    APP_NAME: str = "AI Salon API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    DATABASE_URL: str = ""

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url or "sqlite+aiosqlite:///./dev.db"

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120  # 2 hours
    UPLOAD_DIR: str = "uploads"

    ADMIN_PASSWORD: str = "changeme123"
    BASE_PASSWORD: str = "impact"

    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @model_validator(mode="after")
    def reject_insecure_defaults_in_production(self):
        if self.ENVIRONMENT == "production":
            for field, default in _INSECURE_DEFAULTS.items():
                if getattr(self, field) == default:
                    raise ValueError(
                        f"{field} still has its insecure default value. "
                        f"Set a strong {field} via environment variables "
                        f"before running in production."
                    )
        return self


settings = Settings()
