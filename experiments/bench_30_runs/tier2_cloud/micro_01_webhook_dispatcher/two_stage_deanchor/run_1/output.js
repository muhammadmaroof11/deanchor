I'll create a production-grade TypeScript implementation of the GitHub Webhook Dispatcher based on the domain schema. Let me design a clean, modular architecture.

## Architecture Overview

```
src/
├── config/
│   ├── index.ts           # Configuration loading & validation
│   └── schema.ts          # Zod schemas for config validation
├── domain/
│   ├── entities.ts        # Core domain types (from schema)
│   ├── events.ts          # Domain events (state contracts)
│   └── errors.ts          # Domain-specific errors
├── services/
│   ├── route-registry.ts  # Route management
│   ├── dispatcher.ts      # Webhook dispatch logic
│   ├── signature.ts       # HMAC verification
│   ├── idempotency.ts     # Duplicate delivery detection
│   ├── rate-limiter.ts    # Rate limiting for OpenAPI
│   └── openapi.ts         # OpenAPI spec generation/serving
├── middleware/
│   ├── security.ts        # Helmet, headers, body parsing
│   ├── rate-limit.ts      # Express rate limit middleware
│   ├── validation.ts      # Webhook validation middleware
│   └── logging.ts         # Request logging
├── routes/
│   ├── webhook.ts         # POST / webhook handler
│   ├── routes.ts          # GET /routes handler
│   ├── openapi.ts         # GET /openapi.json handler
│   └── health.ts          # GET /health handler
├── server/
│   ├── http-server.ts     # Server lifecycle management
│   └── graceful-shutdown.ts
├── observability/
│   ├── logger.ts          # Structured logging (pino)
│   └── metrics.ts         # Prometheus metrics
└── main.ts                # Application entry point
```

## Implementation

### 1. Domain Entities & Types

```typescript
// src/domain/entities.ts
export interface RateLimitPolicy {
  windowMs: number;
  maxRequests: number;
}

export interface Route {
  pattern: string;
  target: string;
  secret?: string;
}

export interface RouteRegistry {
  routes: Route[];
}

export interface WebhookDispatcherConfig {
  port: number;
  debug: boolean;
  rateLimitPolicy: RateLimitPolicy;
}

export interface WebhookEvent {
  headers: Record<string, string>;
  payload: object;
  deliveryId: string;
}

export interface OpenAPISpec {
  spec: object;
}

export interface DispatchResult {
  deliveryId: string;
  targetsNotified: number;
  durationMs: number;
  errors: DispatchError[];
}

export interface DispatchError {
  target: string;
  error: string;
  retryable: boolean;
}

export type HealthStatus = 'alive';
```

```typescript
// src/domain/events.ts
export type ServerState = 'Stopped' | 'Running' | 'Processing';

export interface DomainEvent {
  type: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface ServerStartedEvent extends DomainEvent {
  type: 'ServerStarted';
  payload: { port: number };
}

export interface WebhookReceivedEvent extends DomainEvent {
  type: 'WebhookReceived';
  payload: { deliveryId: string; eventType: string; sourceIp: string };
}

export interface WebhookDispatchedEvent extends DomainEvent {
  type: 'WebhookDispatched';
  payload: { deliveryId: string; targetsNotified: number; durationMs: number };
}

export interface WebhookFailedEvent extends DomainEvent {
  type: 'WebhookFailed';
  payload: {
    deliveryId: string;
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
  };
}

export interface RateLimitExceededEvent extends DomainEvent {
  type: 'RateLimitExceeded';
  payload: { sourceIp: string; endpoint: string; limit: number; windowMs: number };
}

export interface ServerStoppedEvent extends DomainEvent {
  type: 'ServerStopped';
  payload: Record<string, never>;
}

export type AnyDomainEvent =
  | ServerStartedEvent
  | WebhookReceivedEvent
  | WebhookDispatchedEvent
  | WebhookFailedEvent
  | RateLimitExceededEvent
  | ServerStoppedEvent;

export type EventHandler = (event: AnyDomainEvent) => void | Promise<void>;
```

```typescript
// src/domain/errors.ts
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class SignatureVerificationError extends DomainError {
  constructor(message: string) {
    super(message, 'SIGNATURE_VERIFICATION_FAILED', false, 401);
    this.name = 'SignatureVerificationError';
  }
}

export class RateLimitExceededError extends DomainError {
  constructor(windowMs: number, maxRequests: number) {
    super(
      `Rate limit exceeded: ${maxRequests} requests per ${windowMs}ms`,
      'RATE_LIMIT_EXCEEDED',
      true,
      429
    );
    this.name = 'RateLimitExceededError';
  }
}

export class PayloadTooLargeError extends DomainError {
  constructor() {
    super('Payload too large', 'PAYLOAD_TOO_LARGE', false, 413);
    this.name = 'PayloadTooLargeError';
  }
}

export class DuplicateDeliveryError extends DomainError {
  constructor(deliveryId: string) {
    super(`Duplicate delivery: ${deliveryId}`, 'DUPLICATE_DELIVERY', false, 200);
    this.name = 'DuplicateDeliveryError';
  }
}

export class RouteNotFoundError extends DomainError {
  constructor(eventType: string) {
    super(`No routes matched for event type: ${eventType}`, 'ROUTE_NOT_FOUND', false, 404);
    this.name = 'RouteNotFoundError';
  }
}

export class DownstreamError extends DomainError {
  constructor(
    public readonly target: string,
    message: string,
    public readonly retryable: boolean = true
  ) {
    super(message, 'DOWNSTREAM_ERROR', retryable, 502);
    this.name = 'DownstreamError';
  }
}
```

### 2. Configuration

```typescript
// src/config/schema.ts
import { z } from 'zod';

export const rateLimitPolicySchema = z.object({
  windowMs: z.number().int().positive(),
  maxRequests: z.number().int().positive(),
});

export const routeSchema = z.object({
  pattern: z.string().min(1),
  target: z.string().url(),
  secret: z.string().optional(),
});

export const routeRegistrySchema = z.object({
  routes: z.array(routeSchema),
});

export const webhookDispatcherConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  debug: z.boolean().default(false),
  rateLimitPolicy: rateLimitPolicySchema.default({
    windowMs: 60000,
    maxRequests: 60,
  }),
});

export type RateLimitPolicyConfig = z.infer<typeof rateLimitPolicySchema>;
export type RouteConfig = z.infer<typeof routeSchema>;
export type RouteRegistryConfig = z.infer<typeof routeRegistrySchema>;
export type WebhookDispatcherConfig = z.infer<typeof webhookDispatcherConfigSchema>;
```

```typescript
// src/config/index.ts
import { readFileSync