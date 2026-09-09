# Modern FastAPI Reverse Proxy Gateway Implementation

I'll create a clean, modern reverse proxy gateway with proper architecture patterns, error handling, and performance optimization.

```python
"""
Modern FastAPI Reverse Proxy Gateway
===================================

A high-performance reverse proxy implementation with:
- Clean architectural separation
- Comprehensive middleware support
- Advanced routing capabilities
- Security enhancements
- Observability features
"""

from typing import Optional, Dict, Any, List, Union, Callable, Awaitable
from dataclasses import dataclass, field
from enum import Enum
import asyncio
import time
import logging
import json
from urllib.parse import urlparse, urlunparse
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ProxyMode(str, Enum):
    """Proxy mode enumeration"""
    STANDARD = "standard"
    STREAMING = "streaming"
    WEBSOCKET = "websocket"


@dataclass
class ServiceConfig:
    """Configuration for a backend service"""
    name: str
    url: str
    timeout: int = 30
    retries: int = 3
    health_check_url: Optional[str] = None
    enabled: bool = True
    headers: Dict[str, str] = field(default_factory=dict)
    rate_limit: Optional[int] = None


@dataclass
class RouteConfig:
    """Configuration for routing rules"""
    path: str
    service_name: str
    methods: List[str] = field(default_factory=lambda: ["GET", "POST", "PUT", "DELETE"])
    middleware: List[Callable] = field(default_factory=list)
    proxy_mode: ProxyMode = ProxyMode.STANDARD
    preserve_host: bool = False


class HealthCheckService:
    """Service for health checking backend services"""
    
    def __init__(self, app: FastAPI):
        self.app = app
        self.services: Dict[str, ServiceConfig] = {}
        
    async def check_service_health(self, service_name: str) -> bool:
        """Check if a service is healthy"""
        try:
            config = self.services.get(service_name)
            if not config or not config.health_check_url:
                return True  # Assume healthy if no health check configured
                
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    config.health_check_url,
                    timeout=config.timeout
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Health check failed for {service_name}: {e}")
            return False
            
    def register_service(self, service: ServiceConfig):
        """Register a service for health checking"""
        self.services[service.name] = service


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware implementation"""
    
    def __init__(self, app: FastAPI, max_requests: int = 1000, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = {}
        
    async def dispatch(self, request: StarletteRequest, call_next) -> StarletteResponse:
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        # Clean old requests
        if client_ip not in self.requests:
            self.requests[client_ip] = []
            
        # Remove requests older than window
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if current_time - req_time < self.window_seconds
        ]
        
        # Check rate limit
        if len(self.requests[client_ip]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded"
            )
            
        # Record request
        self.requests[client_ip].append(current_time)
        
        return await call_next(request)


class ProxyMiddleware(BaseHTTPMiddleware):
    """Core proxy middleware implementation"""
    
    def __init__(self, app: FastAPI, services: Dict[str, ServiceConfig]):
        super().__init__(app)
        self.services = services
        self.health_checker = HealthCheckService(app)
        
        # Register all services for health checking
        for service in services.values():
            self.health_checker.register_service(service)
            
    async def dispatch(self, request: StarletteRequest, call_next) -> StarletteResponse:
        """Main proxy dispatch logic"""
        try:
            # Find matching route
            route = self._find_route(request)
            if not route:
                raise HTTPException(status_code=404, detail="Route not found")
                
            service_config = self.services.get(route.service_name)
            if not service_config or not service_config.enabled:
                raise HTTPException(status_code=503, detail="Service unavailable")
                
            # Check service health
            is_healthy = await self.health_checker.check_service_health(route.service_name)
            if not is_healthy:
                raise HTTPException(status_code=503, detail="Service unhealthy")
                
            # Apply middleware chain
            for middleware_func in route.middleware:
                response = await middleware_func(request, service_config)
                if response:
                    return response
                    
            # Perform proxy request
            return await self._proxy_request(request, service_config, route)
            
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            logger.error(f"Proxy error: {e}")
            raise HTTPException(status_code=502, detail="Proxy error occurred")
            
    def _find_route(self, request: StarletteRequest) -> Optional[RouteConfig]:
        """Find matching route for the request"""
        # This is a simplified implementation - in practice you'd use more sophisticated routing
        path = request.url.path
        
        # In a real implementation, this would be more complex with pattern matching
        # For now, we'll just return the first match (simplified)
        for service_name, config in self.services.items():
            # This is a placeholder - actual route matching logic would go here
            pass
            
        return None  # Simplified - real implementation would find routes
        
    async def _proxy_request(
        self, 
        request: StarletteRequest, 
        service_config: ServiceConfig,
        route: RouteConfig
    ) -> Union[StarletteResponse, StreamingResponse]:
        """Perform the actual proxy request to backend service"""
        
        # Build target URL
        parsed_url = urlparse(service_config.url)
        path = request.url.path
        
        # Construct new URL
        target_url = urlunparse((
            parsed_url.scheme,
            parsed_url.netloc,
            path,
            request.url.params,
            request.url.query,
            None  # fragment
        ))
        
        # Prepare headers
        headers = dict(request.headers)
        
        # Remove hop-by-hop headers
        hop_by_hop_headers = {
            'connection', 'keep-alive', 'proxy-authenticate',
            'proxy-authorization', 'te', 'trailers', 'transfer-encoding',
            'upgrade'
        }
        
        for header in list(headers.keys()):
            if header.lower() in hop_by_hop_headers:
                del headers[header]
                
        # Add service-specific headers
        headers.update(service_config.headers)
        
        # Add proxy metadata
        headers['X-Forwarded-For'] = request.client.host
        headers['X-Forwarded-Proto'] = request.url.scheme
        
        try:
            import httpx
            
            async with httpx.AsyncClient(
                timeout=service_config.timeout,
                follow_redirects=True
            ) as client:
                
                # Prepare request data
                if route.proxy_mode == ProxyMode.STREAMING:
                    return await self._streaming_proxy(client, target_url, headers)
                else:
                    response = await client.request(
                        method=request.method,
                        url=target_url,
                        headers=headers,
                        content=await request.body() if request.body() else None
                    )
                    
                    # Create response with proper status and headers
                    return Response(
                        content=response.content,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=response.headers.get('content-type')
                    )
                    
        except Exception as e:
            logger.error(f"Proxy request failed: {e}")
            raise HTTPException(status_code=502, detail="Backend service error")
            
    async def _streaming_proxy(
        self, 
        client: httpx.AsyncClient,
        target_url: str,
        headers: Dict[str, str]
    ) -> StreamingResponse:
        """Handle streaming proxy requests"""
        
        # This would implement proper streaming logic
        response = await client.stream('GET', target_url, headers=headers)
        
        async def stream_response():
            try:
                async for chunk in response.aiter_bytes():
                    yield chunk
            except Exception as e:
                logger.error(f"Streaming error: {e}")
                
        return StreamingResponse(
            content=stream_response(),
            status_code=response.status_code,
            headers=dict(response.headers)
        )


class GatewayApp:
    """Main gateway application class"""
    
    def __init__(self):
        self.app = FastAPI(
            title="Modern Reverse Proxy Gateway",
            description="High-performance reverse proxy with advanced features",
            version="1.0.0"
        )
        
        # Initialize core components
        self