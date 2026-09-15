import os
import hmac
import hashlib
import logging
import uvicorn
from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, Field, ValidationError
from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# For rate limiting
from redis.asyncio import Redis
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

# Load environment variables from .env file for configuration
load_dotenv()

# --- Configuration ---
class ServiceConfiguration(BaseModel):
    """
    Represents the configuration settings for the service.
    Values are loaded from environment variables or default to specified values.
    """
    port: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    debug_mode: bool = Field(default_factory=lambda: os.getenv("DEBUG_MODE", "false").lower() == "true")
    github_webhook_secret: Optional[str] = Field(
        default_factory=lambda: os.getenv("GITHUB_WEBHOOK_SECRET")
    )
    redis_url: str = Field(
        default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379/0")
    )

# Instantiate configuration
config = ServiceConfiguration()

# --- Logging Setup ---
logging.basicConfig(level=logging.DEBUG if config.debug_mode else logging.INFO)
logger = logging.getLogger(__name__)

# --- Domain Entities (Pydantic Models) ---

class HttpRequest(BaseModel):
    """
    Represents an incoming HTTP request.
    """
    method: str = Field(..., description="HTTP method (e.g., GET, POST)")
    path: str = Field(..., description="Request path (e.g., /)")
    headers: Dict[str, str] = Field(..., description="Request headers as key-value pairs")
    body: Any = Field(..., description="Request body, can be any type (e.g., dict, string)")

class HttpResponse(BaseModel):
    """
    Represents an outgoing HTTP response.
    """
    statusCode: int = Field(..., description="HTTP status code (e.g., 200, 400)")
    body: Optional[Union[str, Dict[str, Any]]] = Field(
        None, description="Response body, can be a string or a JSON object"
    )

class GitHubWebhookEvent(BaseModel):
    """
    Represents a parsed GitHub webhook event.
    """
    payload: Dict[str, Any] = Field(..., description="The specific GitHub event data (e.g., push, pull_request)")
    headers: Dict[str, str] = Field(..., description="GitHub-specific headers (e.g., X-GitHub-Event, X-Hub-Signature)")

class APIRoute(BaseModel):
    """
    Describes an API endpoint.
    """
    method: str = Field(..., description="HTTP method of the route")
    path: str = Field(..., description="URL path of the route")
    description: str = Field(..., description="A brief description of the route's purpose")

class RateLimitingPolicy(BaseModel):
    """
    Defines a policy for rate limiting requests.
    """
    windowDurationMs: int = Field(..., description="Duration of the rate limiting window in milliseconds")
    maxRequestsPerWindow: int = Field(..., description="Maximum number of requests allowed within the window")

# Example policy for the webhook endpoint, derived from the schema's existence.
# In a production system, this might be dynamically loaded or configured per endpoint.
webhook_rate_limit_policy = RateLimitingPolicy(
    windowDurationMs=60000, # 1 minute
    maxRequestsPerWindow=100 # 100 requests per minute
)

class OpenAPISpecificationDocument(BaseModel):
    """
    Represents an OpenAPI specification document.
    FastAPI automatically generates this based on defined routes and models.
    """
    spec: Dict[str, Any] = Field(..., description="The OpenAPI specification in JSON format")

# --- Helper Functions ---

def verify_github_signature(
    request_body: bytes, signature_header: Optional[str], secret: str
) -> bool:
    """
    Verifies the GitHub webhook signature using HMAC-SHA256.
    Refer to: https://docs.github.com/webhooks/securing/#validating-payloads-from-github
    """
    if not signature_header:
        logger.warning("Missing X-Hub-Signature-256 header.")
        return False

    try:
        # Expected format: "sha256=..."
        sha_name, signature = signature_header.split("=", 1)
        if sha_name != "sha256":
            logger.warning(f"Unsupported signature algorithm: {sha_name}")
            return False
    except ValueError:
        logger.warning(f"Invalid X-Hub-Signature-256 format: {signature_header}")
        return False

    mac = hmac.new(secret.encode("utf-8"), msg=request_body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)

# --- FastAPI Application ---
app = FastAPI(
    title="GitHub Webhook Dispatcher Service",
    description="A service to receive, validate, and dispatch GitHub webhook events.",
    version="1.0.0",
    debug=config.debug_mode,
)

# --- Rate Limiter Initialization ---
@app.on_event("startup")
async def startup_event():
    """
    Initializes the FastAPI-Limiter with Redis on application startup.
    """
    if config.redis_url:
        try:
            redis_instance = Redis.from_url(config.redis_url, encoding="utf-8", decode_responses=True)
            await FastAPILimiter.init(redis_instance)
            logger.info(f"FastAPI-Limiter initialized with Redis at {config.redis_url}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis at {config.redis_url}: {e}. Rate limiting will be disabled.")
            FastAPILimiter.redis = None # Ensure limiter is not active if connection fails
    else:
        logger.warning("REDIS_URL not provided. Rate limiting will be disabled.")
        FastAPILimiter.redis = None # Explicitly disable

@app.on_event("shutdown")
async def shutdown_event():
    """
    Closes the Redis connection on application shutdown.
    """
    if FastAPILimiter.redis:
        await FastAPILimiter.redis.close()
        logger.info("FastAPI-Limiter Redis connection closed.")

# --- Functional Operations ---

@app.post(
    "/",
    summary="Dispatch GitHub Webhook Event",
    description="Receives and dispatches GitHub webhook events to appropriate downstream services.",
    response_model=HttpResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[
        Depends(RateLimiter(
            times=webhook_rate_limit_policy.maxRequestsPerWindow,
            seconds=webhook_rate_limit_policy.windowDurationMs / 1000
        )) if FastAPILimiter.redis else Depends(lambda: None) # Apply rate limit only if Redis is configured
    ]
)
async def dispatch_github_webhook(request: Request) -> HttpResponse:
    """
    Receives a GitHub webhook event, validates its signature, and dispatches it.
    """
    logger.info(f"Received {request.method} request to {request.url.path}")

    # 1. Construct HttpRequest from the incoming request
    method = request.method
    path = request.url.path
    headers = dict(request.headers)
    
    raw_body = await request.body()
    
    try:
        # Attempt to parse body as JSON if content-type indicates, otherwise keep as raw string
        if request.headers.get("content-type", "").startswith("application/json"):
            body_parsed = await request.json()
        else:
            body_parsed = raw_body.decode('utf-8', errors='ignore')
    except Exception as e:
        logger.warning(f"Could not parse request body as JSON or string: {e}")
        body_parsed = raw_body.decode('utf-8', errors='ignore') # Fallback to string

    http_request = HttpRequest(
        method=method,
        path=path,
        headers=headers,
        body=body_parsed
    )
    logger.debug(f"HttpRequest created: {http_request.dict()}")

    # 2. Validate GitHub Webhook Signature (if secret is provided)
    if not config.github_webhook_secret:
        logger.warning("GITHUB_WEBHOOK_SECRET not set. Skipping signature verification for webhook.")
    else:
        signature = headers.get("x-hub-signature-256")
        if not verify_github_signature(raw_body, signature, config.github_webhook_secret):
            logger.error("GitHub webhook signature verification failed.")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid GitHub webhook signature."
            )
        logger.info("GitHub webhook signature verified successfully.")

    # 3. Derive GitHubWebhookEvent from request body and headers
    # The schema states 'event: GitHubWebhookEvent (derived from request.body and request.headers)'
    # We extract relevant GitHub-specific headers and use the parsed body as the payload.
    github_event_headers = {
        k: v for k, v in headers.items()
        if k.lower().startswith('x-github-') or k.lower() == 'user-agent'
    }
    
    try:
        # If body_parsed is not a dict (e.g., raw string), wrap it to fit payload: Dict[str, Any]
        payload_for_event = body_parsed if isinstance(body_parsed, dict) else {"raw_body": body_parsed}
        github_webhook_event = GitHubWebhookEvent(
            payload=payload_for_event,
            headers=github_event_headers
        )
        event_type = github_webhook_event.headers.get('x-github-event', 'unknown')
        delivery_id = github_webhook_event.headers.get('