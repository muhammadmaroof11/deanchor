# FastAPI Reverse Proxy Gateway - Modern Greenfield Implementation

A production-grade, cloud-native reverse proxy gateway built with FastAPI, featuring service discovery, webhook management, circuit breaking, and comprehensive observability.

---

## Project Structure

```
gateway/
├── pyproject.toml
├── config/
│   ├── __init__.py
│   ├── settings.py
│   ├── routes.yaml
│   ├── services.yaml
│   └── webhooks.yaml
├── src/
│   ├── gateway/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── lifespan.py
│   │   ├── config/
│   │   │   ├── __init__.py
│   │   │   ├── loader.py
│   │   │   ├── models.py
│   │   │   └── watcher.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── proxy.py
│   │   │   ├── router.py
│   │   │   ├── circuit_breaker.py
│   │   │   ├── rate_limiter.py
│   │   │   ├── retry_policy.py
│   │   │   └── load_balancer.py
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   ├── logging.py
│   │   │   ├── tracing.py
│   │   │   ├── security.py
│   │   │   ├── compression.py
│   │   │   └── correlation.py
│   │   ├── webhooks/
│   │   │   ├── __init__.py
│   │   │   ├── manager.py
│   │   │   ├── verifier.py
│   │   │   ├── dispatcher.py
│   │   │   ├── models.py
│   │   │   └── registry.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── discovery.py
│   │   │   ├── registry.py
│   │   │   ├── health.py
│   │   │   └── client.py
│   │   ├── transforms/
│   │   │   ├── __init__.py
│   │   │   ├── request.py
│   │   │   ├── response.py
│   │   │   └── template.py
│   │   ├── observability/
│   │   │   ├── __init__.py
│   │   │   ├── metrics.py
│   │   │   ├── logging.py
│   │   │   └── tracing.py
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── routes.py
│   │       ├── admin.py
│   │       └── health.py
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       ├── unit/
│       ├── integration/
│       └── fixtures/
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.override.yml
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   └── hpa.yaml
└── scripts/
    ├── generate_certs.sh
    └── load_test.py
```

---

## Configuration Files

### `pyproject.toml`

```toml
[project]
name = "gateway"
version = "2.0.0"
description = "High-performance FastAPI Reverse Proxy Gateway"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "httpx>=0.26.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "pyyaml>=6.0.1",
    "python-json-logger>=2.0.7",
    "structlog>=24.1.0",
    "prometheus-client>=0.19.0",
    "opentelemetry-api>=1.22.0",
    "opentelemetry-sdk>=1.22.0",
    "opentelemetry-instrumentation-fastapi>=0.43b0",
    "opentelemetry-instrumentation-httpx>=0.43b0",
    "opentelemetry-exporter-otlp>=1.22.0",
    "redis>=5.0.1",
    "aioredis>=2.0.1",
    "tenacity>=8.2.3",
    "pybreaker>=0.8.1",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "cryptography>=41.0.0",
    "watchfiles>=0.21.0",
    "httptools>=0.6.1",
    "uvloop>=0.19.0",
    "orjson>=3.9.10",
    "email-validator>=2.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "pytest-mock>=3.12.0",
    "httpx>=0.26.0",
    "faker>=22.0.0",
    "ruff>=0.1.15",
    "mypy>=1.7.0",
    "pre-commit>=3.6.0",
]
load-test = ["locust>=2.17.0"]

[tool.ruff]
line-length = 100
target-version = "py312"
select = ["E", "F", "I", "UP", "B", "C4", "SIM", "T20", "W", "PL", "RUF", "PERF"]
ignore = ["S101", "PLR2004", "T201"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
no_implicit_optional = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["src/tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-v --tb=short --strict-markers"

[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"
```

---

### `config/settings.py`

```python
"""Application configuration with Pydantic Settings management."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class TLSConfig(BaseSettings):
    """TLS/SSL configuration."""

    model_config = SettingsConfigDict(env_prefix="GATEWAY_TLS_")

    enabled: bool = False
    cert_file: Path | None = None
    key_file: Path | None = None
    ca_file: Path | None = None
    verify_upstream: bool = True

    @field_validator("cert_file", "key_file", "ca_file", mode="before")
    @classmethod
    def expand_path(cls, v: str | Path | None) -> Path | None:
        if v is None:
            return None
        return Path(v).expanduser().resolve()


class ServerConfig(BaseSettings):
    """HTTP server configuration."""

    model_config = SettingsConfigDict(env_prefix="GATEWAY_SERVER_")

    host: str = "0.0.0.0"
    port: int = 8000
   