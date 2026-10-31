from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./crm_dev.db"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 12
    cors_origins: str = "http://localhost:5173"
    app_timezone: str = "Asia/Kolkata"

    seed_owner_name: str = "Ravi Kumar"
    seed_owner_email: str = "owner@example.com"
    seed_owner_password: str = "change-me-now"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
