from functools import lru_cache
from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

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

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None

    # Resend (preferred) — set RESEND_API_KEY to enable email delivery
    resend_api_key: str | None = None
    email_from: str = "Hisably <hi@hisably.com>"

    # Internal cron endpoint secret — set CRON_SECRET in Vercel env
    cron_secret: str | None = None

    @property
    def sqlalchemy_database_url(self) -> str:
        """Normalize the configured DATABASE_URL for the asyncpg driver.

        Hosted Postgres providers (e.g. Neon, via Vercel) hand out
        `postgresql://...?sslmode=require&channel_binding=require` URLs meant
        for psycopg2/libpq. asyncpg doesn't understand those query params, so
        the scheme is rewritten to `postgresql+asyncpg` and TLS is configured
        via connect_args (see `sqlalchemy_connect_args`) instead.
        """
        url = self.database_url
        parts = urlsplit(url)
        scheme = parts.scheme
        if scheme in ("postgres", "postgresql"):
            scheme = "postgresql+asyncpg"
        query = parse_qs(parts.query)
        query.pop("sslmode", None)
        query.pop("channel_binding", None)
        new_query = urlencode(query, doseq=True)
        return urlunsplit((scheme, parts.netloc, parts.path, new_query, parts.fragment))

    @property
    def sqlalchemy_connect_args(self) -> dict:
        url = self.database_url
        # statement_cache_size=0 disables asyncpg's prepared-statement cache.
        # Required after column-type migrations on Neon: Neon invalidates cached
        # plans on schema changes, but asyncpg re-uses them and gets
        # InvalidCachedStatementError on the next request.
        args: dict = {"statement_cache_size": 0}
        if "sslmode=require" in url or "sslmode=verify-full" in url:
            args["ssl"] = "require"
        return args


@lru_cache
def get_settings() -> Settings:
    return Settings()
