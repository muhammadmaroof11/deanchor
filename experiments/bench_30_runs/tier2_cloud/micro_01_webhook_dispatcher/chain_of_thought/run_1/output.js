This rewrite transitions the application from a monolithic Express script to a **modular, type-safe, domain-driven Fastify application** using **TypeScript**, **Zod** for configuration/contract validation, **Pino** for structured logging, and **Manual Dependency Injection** for testability and decoupling.

### Architectural Decisions & Rationale

| Concern | Legacy (`app.js`) | Modern Rewrite | Rationale |
| :--- | :--- | :--- | :--- |
| **Framework** | Express 4 | **Fastify v4+** | Native async/await, schema-based validation (JSON Schema), encapsulation via plugins, superior performance, built-in OpenAPI support. |
| **Language** | CommonJS JS | **TypeScript (Strict)** | Compile-time safety, self-documenting code, refactoring confidence. |
| **Configuration** | `require('./config')` | **Zod Schema + `dotenv`** | Fail-fast startup validation, type inference, 12-factor compliance. |
| **Architecture** | Monolithic `app.js` | **Modular Monolith (Domain-Driven)** | Separation of concerns: `modules/{domain}/{routes,controller,service,schemas}`. |
| **Dependencies** | Global `require` / Singletons | **Composition Root / Manual DI** | Explicit dependency graph, trivial unit testing with mocks, no global state. |
| **Logging** | `console.log` | **Pino (Structured JSON)** | Production-ready observability, log levels, redaction, child loggers. |
| **Validation** | None (implicit) | **Zod -> JSON Schema (Fastify)** | Contract-first development; validates input *before* controller executes. |
| **Error Handling** | None (crashes) | **Global Error Hook + Problem Details (RFC 7807)** | Consistent error shape, security (no stack traces to client), mapping domain errors to HTTP codes. |
| **Lifecycle** | `app.listen` | **Graceful Shutdown (SIGTERM/SIGINT)** | Kubernetes/Cloud Run compatible; drains connections. |
| **Rate Limiting** | `express-rate-limit` (Global middleware) | **`@fastify/rate-limit` (Plugin/Route Scoped)** | Encapsulated configuration, Redis-ready for clustering. |

---

### Project Structure
```text
src/
├── main.ts                 # Composition Root / Entry Point
├── config/
│   └── index.ts            # Zod-validated Configuration
├── shared/
│   ├── kernel/
│   │   ├── di-container.ts # Simple DI Container
│   │   ├── errors.ts       # Domain Error Classes (AppError, ValidationError, etc.)
│   │   └── types.ts        # Shared Branded Types / Interfaces
│   ├── plugins/
│   │   ├── helmet.ts       # Security Headers
│   │   ├── rate-limit.ts   # Rate Limiting Config
│   │   ├── sensible.ts     # Fastify Sensible (error handling helpers)
│   │   └── swagger.ts      # OpenAPI / Swagger UI Setup
│   └── utils/
│       └── logger.ts       # Pino Logger Instance
├── modules/
│   ├── webhook/
│   │   ├── schemas.ts      # Zod Schemas -> Fastify JSON Schemas
│   │   ├── service.ts      # Business Logic (Pure TS, no Fastify deps)
│   │   ├── controller.ts   # Request/Reply Mapping
│   │   └── routes.ts       # Route Definitions (Plugin)
│   ├── health/
│   │   └── routes.ts       # Health/Dummy Routes
│   └── openapi/
│       └── routes.ts       # OpenAPI Spec Serving
└── types/
    └── fastify.d.ts        # Module Augmentation for Fastify Instance
```

---

### Source Code

#### 1. `package.json` (Key Dependencies)
```json
{
  "name": "github-webhook-dispatcher",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/helmet": "^11.1.1",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/sensible": "^5.5.0",
    "@fastify/swagger": "^8.14.0",
    "@fastify/swagger-ui": "^4.0.0",
    "fastify": "^4.26.0",
    "fastify-type-provider-zod": "^1.1.9",
    "pino": "^8.19.0",
    "pino-pretty": "^10.3.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

#### 2. `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext