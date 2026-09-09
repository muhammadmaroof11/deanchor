```python
"""
FastAPI Reverse Proxy Gateway - Greenfield Modern Implementation
Domain: Microservices & Webhooks
Architecture: Clean Architecture (Ports & Adapters) + Hexagonal Plugin System
Concurrency: AsyncIO Native (uvloop ready) | Zero-copy streaming where possible
Observability: OpenTelemetry Native | Structured JSON Logging | Prometheus Metrics
Security: mTLS, JWT/OIDC, HMAC Webhook Verification, Rate Limiting (Token Bucket/Sliding Window)
Config: Pydantic Settings (Env/Files/Secrets) | Hot-Reload via SIGHUP/Watchdog
"""

# =============================================================================
# 1. DOMAIN MODEL & INVARIANTS (Core Kernel - Zero Dependencies)
# =============================================================================

from __future__ import annotations
import abc
import asyncio
import contextvars
import dataclasses
import enum
import hashlib
import hmac
import ipaddress
import json
import logging
import re
import time
import uuid
from collections import deque
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping, MutableMapping, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from functools import lru_cache, wraps
from pathlib import Path
from typing import (
    Any, ClassVar, Final, Generic, Literal, NewType, Optional, Protocol, TypeVar, Union, overload,
    runtime_checkable,
)

import httpx
import orjson
import yaml
from pydantic import (
    BaseModel, Field, HttpUrl, SecretStr, field_validator, model_validator, computed_field,
    BeforeValidator, AfterValidator, WithJsonSchema,
)
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated, Self, TypedDict

# --- Type System & Branded Types ---
ServiceName = NewType('ServiceName', str)
RouteId = NewType('RouteId', str)
RequestId = NewType('RequestId', str)
UpstreamHost = NewType('UpstreamHost', str)
ClientIP = NewType('ClientIP', str)

T = TypeVar('T')
R = TypeVar('R')

# --- Core Domain Enums ---
class LoadBalancerStrategy(str, enum.Enum):
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    CONSISTENT_HASH = "consistent_hash" # Session affinity
    RANDOM = "random"

class CircuitState(str, enum.Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class AuthType(str, enum.Enum):
    NONE = "none"
    JWT_BEARER = "jwt_bearer"
    API_KEY = "api_key"
    HMAC_SIGNATURE = "hmac_signature" # Webhook specific
    MUTUAL_TLS = "mutual_tls"

# --- Domain Entities & Value Objects ---

@dataclass(frozen=True, slots=True)
class UpstreamNode:
    """Immutable representation of a single upstream instance."""
    id: str
    host: UpstreamHost
    port: int
    weight: int = 1
    metadata: Mapping[str, str] = field(default_factory=dict)
    healthy: bool = True
    
    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"
    
    @property
    def https_base_url(self) -> str:
        return f"https://{self.host}:{self.port}"

@dataclass(frozen=True, slots=True)
class RouteMatch:
    """Result of a successful route match."""
    route_id: RouteId
    service_name: ServiceName
    path_params: Mapping[str, str]
    upstream_nodes: Sequence[UpstreamNode]
    config: 'RouteConfig' # Forward ref resolved later

@dataclass(frozen=True, slots=True)
class ProxyContext:
    """Immutable context passed through the middleware pipeline."""
    request_id: RequestId
    client_ip: ClientIP
    route_match: RouteMatch
    start_time: float = field(default_factory=time.perf_counter)
    user_identity: Optional['UserIdentity'] = None
    idempotency_key: Optional[str] = None
    trace_context: Mapping[str, str] = field(default_factory=dict)
    # Mutable state bag for plugins (use with caution)
    state: MutableMapping[str, Any] = field(default_factory=dict)

@dataclass(frozen=True, slots=True)
class UserIdentity:
    subject: str
    roles: frozenset[str] = field(default_factory=frozenset)
    claims: Mapping[str, Any] = field(default_factory=dict)
    auth_type: AuthType = AuthType.NONE

# --- Configuration Models (Pydantic V2 - Strict, Validated) ---

class TLSConfig(BaseModel):
    model_config = SettingsConfigDict(extra='forbid', frozen=True)
    enabled: bool = False
    cert_path: Optional[Path] = None
    key_path: Optional[Path] = None
    ca_path: Optional[Path] = None # For mTLS verification
    verify_upstream: bool = True

class CircuitBreakerConfig(BaseModel):
    model_config = SettingsConfigDict(extra='forbid', frozen=True)
    enabled: bool = True
    failure_threshold: int = 5
    success_threshold: int = 2 # For half-open -> closed
    timeout: timedelta = Field(default=timedelta(seconds=30), validation_alias='timeout_seconds')
    excluded_exceptions: tuple[type[BaseException], ...] = (httpx.TimeoutException, httpx.ConnectError)

class RetryPolicyConfig(BaseModel):
    model_config = SettingsConfigDict(extra='forbid', frozen=True)
    max_attempts: int = 3
    base_delay: timedelta = Field(default=timedelta(milliseconds=100), validation_alias='base_delay_ms')
    max_delay: timedelta = Field(default=timedelta(seconds=10), validation_alias='max_delay_ms')
    jitter: float = 0.1
    retry_on_status: tuple[int, ...] = (500, 502, 503, 504)
    retry_on_methods: tuple[str, ...] = ("GET", "HEAD", "OPTIONS", "PUT", "DELETE") # Idempotent by default

class RateLimitConfig(BaseModel):
    model_config = SettingsConfigDict(extra='forbid', frozen=True)
    enabled: bool = True
    requests_per_window: int = 1000
    window: timedelta = Field(default=timedelta(minutes=1), validation_alias='window_seconds')
    strategy: Literal["token_bucket", "sliding_window", "fixed_window"] = "sliding_window"
    key_func: Literal["ip", "user", "route", "custom"] = "ip"
    # Redis backend config would go here for distributed rate limiting

class AuthConfig(BaseModel):
    model