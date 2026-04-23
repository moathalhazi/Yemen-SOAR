"""
SOAR Pro — API Core Configuration
Central configuration management using environment variables.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DatabaseConfig:
    host: str = os.getenv("POSTGRES_HOST", "postgres")
    port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    name: str = os.getenv("POSTGRES_DB", "soar_db")
    user: str = os.getenv("POSTGRES_USER", "soar_user")
    password: str = os.getenv("POSTGRES_PASSWORD", "")

    @property
    def url(self) -> str:
        return f"postgresql+asyncpg://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"

    @property
    def sync_url(self) -> str:
        return f"postgresql://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


@dataclass
class RedisConfig:
    host: str = os.getenv("REDIS_HOST", "redis")
    port: int = int(os.getenv("REDIS_PORT", "6379"))
    password: str = os.getenv("REDIS_PASSWORD", "")
    db: int = int(os.getenv("REDIS_DB", "0"))

    @property
    def url(self) -> str:
        return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"


@dataclass
class ServiceConfig:
    ai_service_url: str = os.getenv("AI_SERVICE_URL", "http://ai-service:8003")
    forensic_service_url: str = os.getenv("FORENSIC_SERVICE_URL", "http://forensic-service:8005")
    integration_manager_url: str = os.getenv("INTEGRATION_MANAGER_URL", "http://integration-manager:8013")


@dataclass
class RiskConfig:
    """Risk scoring thresholds — configurable via env vars."""
    playbook_trigger_threshold: float = float(os.getenv("RISK_PLAYBOOK_THRESHOLD", "75"))
    forensic_trigger_threshold: float = float(os.getenv("RISK_FORENSIC_THRESHOLD", "80"))
    critical_threshold: float = float(os.getenv("RISK_CRITICAL_THRESHOLD", "90"))

    severity_weights: dict = field(default_factory=lambda: {
        "low": 1, "medium": 3, "high": 7, "critical": 10
    })
    default_asset_criticality: float = 5.0
    default_threat_confidence: float = 0.5


@dataclass
class Settings:
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    redis: RedisConfig = field(default_factory=RedisConfig)
    services: ServiceConfig = field(default_factory=ServiceConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)

    jwt_secret: str = os.getenv("JWT_SECRET_KEY", "change-me")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")


settings = Settings()
