# backend/config.py

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://clickhouse_user:clickhouse_pass@localhost:5432/clickhouse_db"
    secret_key: str = "dev_secret_key_change_in_production_min_32_chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    admin_email: str = "well96well@gmail.com"
    admin_password: str = "admin123change"

    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    kie_api_key: str = ""

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""
    r2_public_url: str = ""

    environment: str = "development"

    # Stored as plain string to avoid pydantic-settings JSON-parsing issues.
    # Accepts: "https://a.com" or "https://a.com,https://b.com"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def get_cors_origins(self) -> list[str]:
        v = self.cors_origins.strip()
        return [o.strip() for o in v.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str:
        return self.database_url.replace(
            "postgresql://", "postgresql+asyncpg://"
        ).replace(
            "postgres://", "postgresql+asyncpg://"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
