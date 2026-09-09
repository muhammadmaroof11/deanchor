### Architectural Critique of Previous Draft

1.  **Invariant Violation: Rate Limiting Scope**  
    The original code applies rate limiting **exclusively** to `/openapi.json` via `app.use('/openapi.json', limiter)`. The draft applied it globally (`@fastify/rate-limit` plugin registration), altering the security posture and availability contract of the webhook endpoint (`POST /`) and health checks.

2.  **Invariant Violation: HTTP Method Semantics**  
    Original health/dummy endpoints use `POST` (`app.post('/health')`, `app.post('/dummy1')`). The draft likely defaulted to `GET` (standard REST), breaking compatibility with existing infrastructure probes expecting `POST`.

3.  **Missing Endpoints (Functional Regression)**  
    The draft omitted `/dummy1` and `/dummy2` endpoints. While seemingly trivial, "complete preservation" mandates their existence as they may serve as smoke-test targets for deployment pipelines.

4.  **Leaky Abstraction: `lib` Module Integration**  
    The original delegates all business logic to `require('./lib')` (`webhookHandler`, `listRouteHandler`, `openapiHandler`). The draft re-implemented controllers from scratch, discarding the existing business logic boundary. A redesign must **wrap/adapt** the existing `lib` module, not replace it.

5.  **Configuration Drift**  
    The original `config` exposes `port` and `debug`. The draft invented a complex Zod schema (`RATE_LIMIT_MAX`, `GITHUB_WEBHOOK_SECRET`, etc.) not present in the source. Configuration must strictly reflect the source contract.

6.  **Legacy Presentation Pattern: `console.log` in Bootstrap**  
    The draft retained `console.log` for startup messages instead of using the injected structured logger (Pino), creating split observability streams.

7.  **Obsolete Control Flow: Immediate Listen**  
    The original starts listening immediately in the module scope. The draft moved this to `main.ts` but lacked graceful shutdown signal handling (`SIGTERM`/`SIGINT`), critical for containerized deployments.

---

### Revised Greenfield Implementation

**Stack:** Fastify 4.x, TypeScript 5.x (ESM), Zod (Config Validation), Pino (Logging), `fastify-plugin` (Encapsulation).  
**Architecture:** Modular Monolith (Feature-based), Composition Root, Dependency Injection via Decoration.

#### 1. Project Structure
```text
src/
├── main.ts                 # Composition Root / Entry Point
├── server.ts               # Server Lifecycle (Factory, Graceful Shutdown)
├── config/
│   └── index.ts            # Config Loader (Zod validated, matches original shape)
├── plugins/
│   ├── logger.ts           # Pino Instance + Fastify Decoration
│   ├── security.ts         # Helmet (Global)
│   ├── rateLimit.ts        # Scoped Rate Limiter (OpenAPI only)
│   └── openapi.ts          # Swagger Spec Generation / Serving
├── modules/
│   ├── webhook/
│   │   ├── webhook.routes.ts
│   │   └── webhook.adapter.ts   # Adapts lib.webhookHandler
│   ├── routes/
│   │   ├── routes.routes.ts
│   │   └── routes.adapter.ts    # Adapts lib.listRouteHandler
│   ├── openapi/
│   │   ├── openapi.routes.ts
│   │   └── openapi.adapter.ts   # Adapts lib.openapiHandler
│   └── system/
│       ├── system.routes.ts     # Health, Dummy1, Dummy2
│       └── system.controller.ts
├── lib/
│   └── index.ts            # Type-safe Wrapper for legacy './lib' (JS/TS interop)
├── shared/
│   ├── types/
│   │   └── fastify.d.ts    # Module Augmentation
│   └── errors/
│       └── index.ts        # Standard Error Classes
└── app.ts                  # Fastify Instance Factory (DI Container)
```

---

#### 2. Configuration (`src/config/index.ts`)
Strictly matches original `config` shape (`port`, `debug`).

```typescript
// src/config/index.ts
import { z } from 'zod';

// 1. Schema mirrors original config.js output exactly
const ConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  debug: z.boolean().default(false),
  // Allow passthrough for any other keys lib might expect
}).passthrough(); 

export type AppConfig = z.infer<typeof ConfigSchema>;

// 2. Loader: Synchronously require original config for parity, then validate
// This preserves the original config resolution logic (e.g. nconf, dotenv, etc inside config.js)
let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if