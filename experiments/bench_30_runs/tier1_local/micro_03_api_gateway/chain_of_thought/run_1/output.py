# Modern FastAPI Reverse Proxy Gateway Architecture

I'll create a clean, modern architecture for a reverse proxy gateway with proper separation of concerns and scalability.

```python
"""
Modern FastAPI Reverse Proxy Gateway
====================================

This implementation provides a scalable, secure, and maintainable reverse proxy
gateway that handles microservices communication with advanced features like:
- Load balancing
- Circuit breaking
- Rate limiting
- Request/response transformation
- Health monitoring
"""

from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import time
import logging
from datetime import datetime
from contextlib import asynccontextmanager
from functools import wraps

from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
from aioredis import Redis
import aioredis


# ========================
# DOMAIN MODELS & ENUMS
# ========================

class ServiceStatus(str, Enum):
    """Service health status enumeration"""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


class LoadBalancingStrategy(str, Enum):
    """Load balancing algorithm strategies"""
    ROUND_ROBIN = "round_robin"
    LEAST_CONNECTIONS = "least_connections"
    RANDOM = "random"


class ProxyError(Exception):
    """Custom exception for proxy-related errors"""
    def __init__(self, message: str, status_code: int = 502):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


# ========================
# CONFIGURATION & SETTINGS
# ========================

@dataclass
class ServiceConfig:
    """Configuration for a service in the gateway"""
    name: str
    url: str
    health_check_url: Optional[str] = None
    timeout: int = 30
    max_connections: int = 100
    load_balancing_strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout: int = 60


@dataclass
class GatewayConfig:
    """Main gateway configuration"""
    services: List[ServiceConfig] = field(default_factory=list)
    redis_url: str = "redis://localhost:6379"
    enable_circuit_breaker: bool = True
    enable_rate_limiting: bool = True
    enable_request_logging: bool = True
    max_concurrent_requests: int = 1000


# ========================
# CORE COMPONENTS
# ========================

class CircuitBreaker:
    """Circuit breaker pattern implementation"""
    
    def __init__(self, threshold: int = 5, timeout: int = 60):
        self.threshold = threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
    
    def is_call_permitted(self) -> bool:
        """Check if a call should be permitted based on circuit breaker state"""
        if self.state == "CLOSED":
            return True
        
        if self.state == "OPEN":
            if time.time() - (self.last_failure_time or 0) > self.timeout:
                self.state = "HALF_OPEN"
                return True
            return False
            
        if self.state == "HALF_OPEN":
            # Allow one request to test the service
            return True
        
        return True
    
    def record_success(self):
        """Record a successful call"""
        self.failure_count = 0
        self.state = "CLOSED"
    
    def record_failure(self):
        """Record a failed call"""
        if self.state == "HALF_OPEN":
            # If half-open and fails, stay open
            self.state = "OPEN"
            return
            
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.threshold:
            self.state = "OPEN"


class ServiceRegistry:
    """Manages service discovery and health monitoring"""
    
    def __init__(self, config: GatewayConfig):
        self.config = config
        self.services: Dict[str, ServiceConfig] = {}
        self.service_health: Dict[str, ServiceStatus] = {}
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        
        # Initialize services from configuration
        for service_config in config.services:
            self.add_service(service_config)
    
    def add_service(self, service_config: ServiceConfig):
        """Add a new service to the registry"""
        self.services[service_config.name] = service_config
        self.service_health[service_config.name] = ServiceStatus.HEALTHY
        if self.config.enable_circuit_breaker:
            self.circuit_breakers[service_config.name] = CircuitBreaker(
                threshold=service_config.circuit_breaker_threshold,
                timeout=service_config.circuit_breaker_timeout
            )
    
    def get_service(self, name: str) -> Optional[ServiceConfig]:
        """Get service configuration by name"""
        return self.services.get(name)
    
    def is_healthy(self, service_name: str) -> bool:
        """Check if a service is healthy"""
        return self.service_health.get(service_name) == ServiceStatus.HEALTHY
    
    def update_health_status(self, service_name: str, status: ServiceStatus):
        """Update the health status of a service"""
        self.service_health[service_name] = status


class LoadBalancer:
    """Load balancing implementation for services"""
    
    def __init__(self, registry: ServiceRegistry):
        self.registry = registry
        self._round_robin_counters: Dict[str, int] = {}
    
    def get_next_service_url(self, service_name: str) -> Optional[str]:
        """Get the next service URL based on load balancing strategy"""
        service_config = self.registry.get_service(service_name)
        if not service_config:
            return None
            
        # For now we'll implement round-robin as default
        # In a real implementation, this would be more sophisticated
        if service_config.load_balancing_strategy == LoadBalancingStrategy.ROUND_ROBIN:
            counter = self._round_robin_counters.get(service_name, 0)
            self._round_robin_counters[service_name] = (counter + 1) % len([service_config.url])
            return service_config.url
        else:
            # For simplicity, just return the first URL for other strategies
            return service_config.url


# ========================
# REQUEST HANDLING & TRANSFORMATION
# ========================

class RequestTransformer:
    """Handles request transformation and validation"""
    
    @staticmethod
    async def transform_request(request: Request) -> Dict[str, Any]:
        """Transform incoming request into proxy-ready format"""
        # Extract headers (excluding hop-by-hop headers)
        headers = {
            key: value for key, value in request.headers.items()
            if key.lower() not in ['connection', 'keep-alive', 'proxy-connection', 
                                  'transfer-encoding', 'upgrade']
        }
        
        # Add gateway-specific headers
        headers['x-forwarded-for'] = request.client.host
        headers['x-forwarded-proto'] = request.url.scheme
        
        return {
            'method': request.method,
            'url': str(request.url),
            'headers': headers,
            'query_params': dict(request.query_params),
            'body': await request.body() if request.body() else None
        }


class ResponseTransformer:
    """Handles response transformation and validation"""
    
    @staticmethod
    async def transform_response(response: httpx.Response) -> Response:
        """Transform proxy response into FastAPI response format"""
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.headers.get('content-type')
        )


# ========================
# MAIN GATEWAY CLASS
# ========================

class ProxyGateway:
    """Main gateway implementation with all core functionality"""
    
    def __init__(self, config: GatewayConfig):
        self.config = config
        self.registry = ServiceRegistry(config)
        self.load_balancer = LoadBalancer(self.registry)
        
        # Initialize HTTP client pool
        self.http_client = httpx.AsyncClient(
            timeout=config.services[0].timeout if config.services else 30,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
        )
        
        # Redis for caching and rate limiting (if enabled)
        self.redis: Optional[Redis] = None
        
        # Initialize logging
        self.logger = logging.getLogger("proxy_gateway")
    
    async def initialize(self):
        """Initialize the gateway components"""
        if self.config.enable_rate_limiting:
            try:
                self.redis = await aioredis.from_url(
                    self.config.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
            except Exception as e:
                self.logger.error(f"Failed to connect to Redis: {e}")
        
        # Start health monitoring tasks
        asyncio.create_task(self._health_monitoring_loop())
    
    async def _health_monitoring_loop(self):
        """Periodically check service health"""
        while True:
            try:
                for service_name, service_config in self.registry.services.items():
                    if service_config.health_check_url:
                        await self._check_service_health(service_name)
            except Exception as e:
                self.logger.error(f"Health monitoring error: {e}")
            
            # Check every 30 seconds
            await asyncio.sleep(30)
    
    async def _check_service_health(self, service_name: str):
        """Check