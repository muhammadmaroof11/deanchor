### Architectural Critique: Draft vs. Source Reality

**Critical Finding:** The "Source Code" provided in the prompt consists **exclusively of a header comment** (`// Benchmark Source Code...`). There is **zero executable logic, zero class definitions, zero control flow, and zero data structures** to preserve, refactor, or critique.

**Consequence:**
1.  **No Legacy Patterns Retained:** Impossible, as no legacy code exists.
2.  **No Domain Functions Preserved:** Impossible, as no domain functions were defined.
3.  **Previous Output Status:** The previous response was not a "refactor" but a **Greenfield Architecture Specification (ADRs, Folder Structure, Domain Models)**.

**Directive:** The request asks for a "fully revised, unanchored greenfield implementation." Since the previous step was architectural design, this step requires **production-grade code implementation** of that architecture.

---

### Greenfield Implementation: `gateway` (FastAPI Reverse Proxy Gateway)

This implementation targets **Python 3.12+**, **FastAPI 0.110+**, **Pydantic v2**, **httpx 0.27+**, **OpenTelemetry 1.24+**, and **Structlog 24+**. It assumes a `pyproject.toml` managed by `uv` or `poetry`.

#### 1. Configuration & Settings (`src/gateway/config/`)

**`src/gateway/config/settings.py`**
```python
# src/gateway/config/settings.py
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import Field, PostgresDsn, RedisDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_core import MultiHostUrl


class _BaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        env_nested_delimiter="__",
    )


class TLSConfig(_BaseSettings):
    enabled: bool = False
    cert_file: Path | None = None
    key_file: Path | None = None
    ca_file: Path | None = None  # For mTLS client verification


class ObservabilityConfig(_BaseSettings):
    service_name: str = "gateway"
    environment: str = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "console"] = "json"
    
    otel_endpoint: str | None = None  # e.g., "http://jaeger:4317"
    otel_insecure: bool = True
    metrics_port: int = 9090
    traces_sample_rate: float = 0.1


class UpstreamConfig(_BaseSettings):
    # Defaults for the dynamic client pool
    max_connections: int = 100
    max_keepalive_connections: int = 20
    keepalive_expiry: float = 30.0
    connect_timeout: float = 5.0
    read_timeout: float = 30.0
    write_timeout: float = 30.0
    pool_timeout: float = 5.0
    http2: bool = True
    retries: int = 3
    backoff_factor: float = 0.5


class SecurityConfig(_BaseSettings):
    # OPA / AuthZ
    opa_url: str | None = None  # e.g., "http://opa:8181/v1/data/gateway/authz"
    opa_timeout: float = 0.150  # 150ms hard budget for authz
    
    # JWT / OIDC
    jwks_url: str | None = None
    jwt_audience: str | None = None
    jwt_issuer: str | None = None
    
    # Rate Limiting (Token Bucket via Redis)
    rate_limit_enabled: bool = True
    rate_limit_default_rps: int = 100
    rate_limit_burst: int = 200


class WebhookConfig(_BaseSettings):
    # Ingestion -> Queue
    queue_backend: Literal["kafka", "redis-streams", "memory"] = "redis-streams"
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic: str = "gateway.webhooks.ingress"
    redis_streams_key: str = "gateway:webhooks:ingress"
    
    # Signature Verification (Generic HMAC-SHA256 Header)
    signature_header: str = "X-Signature-Sha256"
    signature_secret: str | None = None  # In production, load from Vault/Secrets Manager
    
    # Idempotency
    idempotency_header: str = "Idempotency-Key"
    idempotency_ttl_seconds: int = 86400  # 24h
    
    # Worker Pool
    worker_concurrency: int = 10
    max_retries: int = 5
    base_backoff_seconds: float = 2.0
    dead_letter_topic: str = "gateway.webhooks.dlq"


class Settings(_BaseSettings):
    # App Meta
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1  # Managed by Gunicorn/Uvicorn in prod
    
    # Sub-configs
    tls: TLSConfig = Field(default_factory=TLSConfig)
    observability: ObservabilityConfig = Field(default_factory=ObservabilityConfig)
    upstream: UpstreamConfig = Field(default_factory=UpstreamConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    webhook: WebhookConfig = Field(default_factory=WebhookConfig)
    
    # Dynamic Config Source
    config_source: Literal["file", "etcd", "consul", "memory"] = "file"
    config_file_path: Path = Path("config/routes.yaml")
    config_watch_interval: int = 5  # seconds

    @computed_field
    @property
    def redis_dsn(self) -> RedisDsn | None:
        # Constructed from env REDIS_URL or components
        return None  # Placeholder for actual DSN building logic

    @computed_field
    @property
    def postgres_dsn(self) -> PostgresDsn | None:
        return None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
```

**`src/gateway/config/models.py` (Dynamic Routing Config)**
```python
# src/gateway/config/models.py
from __future__ import annotations

import re
from enum import Enum
from typing import Annotated, Any, Literal
from pydantic import BaseModel, Field, HttpUrl, field_validator
from pydantic.types import StringConstraints


# Constrained Strings
NonEmptyStr = Annotated[str, StringConstraints(min_length=1, strip_whitespace=True)]
PathPattern = Annotated[str, StringConstraints(pattern=r"^/.*")]


class LoadBalancerStrategy(str, Enum):
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    RANDOM = "random"
    IP_HASH = "ip_hash"


class CircuitBreakerConfig(BaseModel):
    enabled: bool = True
    failure_threshold