Here is a complete, production-ready rewrite using **TypeScript (ESM)**, **Fastify** (superior performance, native async support, schema validation), **Zod** (config/schema validation), **Pino** (structured logging), and a **Modular Clean Architecture** (Domain-Driven Design layers).

### Architecture Highlights
1.  **Framework**: Fastify v4+ (vs Express) for native `async/await`, JSON Schema validation, and 2x throughput.
2.  **Configuration**: `Zod`-validated environment variables (12-Factor App compliant).
3.  **Logging**: `Pino` structured JSON logging with redaction, child loggers per request.
4.  **Security**: `helmet` equivalent via `@fastify/helmet`, Rate Limiting via `@fastify/rate-limit`.
5.  **API Contract**: Code-first OpenAPI 3.1 generation via `@fastify/swagger` + Scalar UI.
6.  **Error Handling**: Centralized, typed error hierarchy with RFC 7807 (Problem Details) responses.
7.  **Graceful Shutdown**: Signal handling, connection draining, resource cleanup.
8.  **Dependency Injection**: Lightweight manual DI container (no reflection magic) for testability.

---

### 1. Project Configuration

#### `package.json`
```json
{
  "name": "github-webhook-dispatcher",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "lint": "eslint src --ext .ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/helmet": "^11.1.1",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/swagger": "^8.14.0",
    "@fastify/swagger-ui": "^4.0.1",
    "@scalar/fastify-api-reference": "^1.25.0",
    "fastify": "^4.28.1",
    "fastify-type-provider-zod": "^1.1.9",
    "pino": "^9.3.2",
    "pino-pretty": "^11.2.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
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
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### 2. Core Infrastructure (`src/shared`)

#### `src/shared/config/index.ts` — **Validated Configuration**
```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  WEBHOOK_SECRET: z.string().min(1).optional(), // For GitHub signature verification
});

export type EnvConfig = z.infer<typeof EnvSchema>;

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;
  
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid Environment Configuration:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
  
  cachedConfig = result.data;
  return cachedConfig;
}
```

#### `src/shared/logger/index.ts` — **Structured Logging (Pino)**
```typescript
import pino, { Logger, LoggerOptions } from 'pino';
import { getConfig } from '../config';

let loggerInstance: Logger | null = null;

export function getLogger(options?: LoggerOptions): Logger {
  if (loggerInstance) return loggerInstance;

  const config = getConfig();
  const isDev = config.N