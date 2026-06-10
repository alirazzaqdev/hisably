from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Hisably API"
    environment: str = "development"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://hisably:hisably@localhost:5432/hisably"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 30

    cors_origins: list[str] = ["http://localhost:3000"]

    storage_backend: str = "local"  # local | s3
    storage_local_path: str = "./storage"

    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
