from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "AI Salon API"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    DATABASE_URL: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
