"""Application configuration via environment variables."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, RedisDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the Axion backend.

    Loaded from env or .env. All secrets are wrapped in SecretStr.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Application ───────────────────────────────────────────────
    env: Literal["dev", "staging", "production"] = "dev"
    debug: bool = False
    api_prefix: str = "/v1"
    project_name: str = "Axion"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    region: str = "eu-west-3"

    # ─── Auth & security ───────────────────────────────────────────
    jwt_secret: SecretStr = SecretStr("change-me-in-production-use-secrets-manager")
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 60
    jwt_refresh_ttl_days: int = 30
    bcrypt_rounds: int = 12

    # ─── Database ──────────────────────────────────────────────────
    database_url: PostgresDsn = Field(
        default="postgresql+asyncpg://axion:axion@localhost:5432/axion"
    )
    database_pool_size: int = 20
    database_max_overflow: int = 40

    # ─── Redis & Celery ────────────────────────────────────────────
    redis_url: RedisDsn = Field(default="redis://localhost:6379/0")
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ─── LLM providers ─────────────────────────────────────────────
    anthropic_api_key: SecretStr = SecretStr("")
    openai_api_key: SecretStr = SecretStr("")
    mistral_api_key: SecretStr = SecretStr("")
    default_model: str = "claude-opus-4-7"
    fallback_model: str = "gpt-4o"

    # ─── Object storage (audit replay store) ───────────────────────
    s3_bucket_audit: str = "axion-audit"
    s3_endpoint: str | None = None
    aws_access_key_id: SecretStr = SecretStr("")
    aws_secret_access_key: SecretStr = SecretStr("")

    # ─── Billing ───────────────────────────────────────────────────
    stripe_secret_key: SecretStr = SecretStr("")
    stripe_webhook_secret: SecretStr = SecretStr("")

    # ─── Limits & guardrails ───────────────────────────────────────
    default_org_task_quota: int = 25_000
    default_org_voice_minutes: int = 1_000
    default_org_budget_eur: int = 5_000
    max_workflow_depth: int = 32
    max_concurrent_agents: int = 64

    # ─── Tracing ───────────────────────────────────────────────────
    otel_endpoint: str | None = None
    otel_service_name: str = "axion-api"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton accessor — read once, cache forever."""
    return Settings()
