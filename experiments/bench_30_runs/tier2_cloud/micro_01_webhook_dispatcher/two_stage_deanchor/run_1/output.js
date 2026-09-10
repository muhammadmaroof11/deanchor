### Architecture & File Organization

We will build a production-grade, highly scalable asynchronous API Gateway service using **TypeScript**, **Fastify** (for extreme performance, strict schema validation, and native JSON handling), and an **Actor-inspired Finite State Machine (FSM)** pattern to handle state contracts precisely as dictated by the domain schema.

#### Directory Structure
```
.
├── package.json
├── tsconfig.json
├── .env.example
└── src
    ├── core
    │   ├── errors.ts
    │   └── logger.ts
    ├── domain
    │   ├── entities.ts
    │   └── state-machine.ts
    ├── infrastructure
    │   ├── config.ts
    │   └── plugins
    │       ├── helmet.ts
    │       └── rate-limit.ts
    ├── interfaces
    │   └── http
    │       ├── controllers.ts
    │       └── routes.ts
    └── server.ts
```

---

### Configuration & Dependencies

#### `package.json`
```json
{
  "name": "enterprise-webhook-gateway",
  "version": "1.0.0",
  "description": "Production-grade decoupled semantic YAML schema implementation",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts"
  },
  "dependencies": {
    "@fastify/helmet": "^11.1.1",
    "@fastify/rate-limit": "^9.1.0",
    "dotenv": "^16.4.5",
    "fastify": "^4.26.2",
    "pino": "^8.19.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
```

#### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

### Core Infrastructure & Logging

#### `src/core/logger.ts`
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
});
```

#### `src/infrastructure/config.ts`
```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
};
```

---

### Domain Entities & State Contracts

#### `src/domain/entities.ts`
```typescript
export interface WebhookEvent {
  payload: Record<string, unknown>;
  headers: Record<string, string>;
}

export interface RouteConfiguration {
  path: string;
  target_service: string;
}

export interface OpenApiSpecification {
  spec_definition: Record<string, unknown>;
}

export interface HealthStatus {
  status: string;
  code: number;
}
```

#### `src/domain/state-machine.ts`
```typescript
import { logger } from '../core/logger.js';

export type SystemState = 
  | 'Idle' 
  | 'WebhookProcessed' 
  | 'RoutesListed' 
  | 'OpenApiServed' 
  | 'HealthChecked';

export type SystemEvent = 
  | 'ReceiveWebhookPost' 
  | 'RequestRouteListing' 
  | 'RequestOpenApiSpec' 
  | 'RequestHealthCheck';

const VALID_TRANSITIONS: Record<SystemState, Partial<Record<SystemEvent, SystemState>>> = {
  Idle: {
    ReceiveWebhookPost: 'WebhookProcessed',
    RequestRouteListing: 'RoutesListed',
    RequestOpenApiSpec: 'OpenApiServed',
    RequestHealthCheck: 'HealthChecked',
  },
  WebhookProcessed: {},
  RoutesListed: {},
  OpenApiServed: {},
  HealthChecked: {},
};

export class DomainStateEngine {
  private currentState: SystemState = 'Idle';

  public transition(event: SystemEvent): SystemState {
    const nextState = VALID_TRANSITIONS[this.currentState]?.[event];
    
    if (!nextState) {
      logger.warn({ currentState: this.currentState, event }, 'Invalid state transition attempted; resetting or maintaining state boundary.');
      // For resilient gateways, we acknowledge the event pattern while maintaining atomic state tracking
      return this.currentState;
    }

    logger.debug({ from: this.currentState, to: nextState, event }, 'State transition executed successfully.');
    this.currentState = nextState;
    
    // Reset state back to Idle immediately after event processing to satisfy continuous polling/stateless contracts
    const materializedState = this.currentState;
    this.currentState = 'Idle';
    
    return materializedState;
  }
}
```

---

### Infrastructure Security & Rate Limiting Plugins

#### `src/infrastructure/plugins/helmet.ts`
```typescript
import fp from 'fastify-plugin';
import fastifyHelmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

export const helmetPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyHelmet, {
    global: true,
  });
});
```

#### `src/infrastructure/plugins/rate-limit.ts`
```typescript
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

export const rateLimitPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(fastifyRateLimit, {
    max: 60,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Requests are subject to a rate limit of 60 requests per 1-minute window per IP.',
    }),
  });
});
```

---

### Interfaces & HTTP Controllers

#### `src/interfaces/http/controllers.ts`
```typescript
import { FastifyReply, FastifyRequest } from 'fastify';
import { 
  WebhookEvent, 
  RouteConfiguration, 
  OpenApiSpecification, 
  HealthStatus 
} from '../../domain/entities.js';
import { DomainStateEngine } from '../../domain/state-machine.js';

export class GatewayController {
  private stateEngine = new DomainStateEngine();

  public async processWebhook(
    request: FastifyRequest<{ Body: Record<string, unknown> }>, 
    reply: FastifyReply
  ) {
    // Invariant: Payload must be successfully parsed as JSON (handled natively via Fastify JSON parsing)
    const event: WebhookEvent = {
      payload: request.body,
      headers: request.headers as Record<string, string>,
    };

    this.stateEngine.transition('ReceiveWebhookPost');

    return reply.code(200).send({
      status: 'success',
      received: true,
      processedPayload: event.payload,
    });
  }

  public async listRoutes(
    _request: FastifyRequest, 
    reply: FastifyReply
  ) {
    // Invariant: Must return all active downstream route mappings.
    this.stateEngine.transition('RequestRouteListing');

    const routes: RouteConfiguration[] = [
      { path: '/api/v1/services/*', target_service: 'upstream-core-service' },
      { path: '/webhooks/*', target_service: 'upstream-webhook-processor' }
    ];

    return reply.code(200).send({ routes });
  }

  public async getOpenApiSpec(
    _request: FastifyRequest, 
    reply: FastifyReply
  ) {
    this.stateEngine.transition('RequestOpenApiSpec');

    const spec: OpenApiSpecification = {
      spec_definition: {
        openapi: '3.0