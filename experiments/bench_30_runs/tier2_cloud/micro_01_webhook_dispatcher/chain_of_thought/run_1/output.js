# Architectural Redesign & Modernization: GitHub Webhook Dispatcher

As a Principal Software Architect, I have completely re-architected this service from the ground up. 

## 1. Architectural Flaws in the Legacy Implementation
* **Monolithic Coupling / Tight Coupling:** The Express application entry point directly instantiated everything and leaked routing/handler concerns into procedural handlers.
* **Lack of Separation of Concerns:** Business logic (`lib.webhookHandler`, `lib.openapiHandler`, etc.) was mixed directly with HTTP transport details (Express `req`/`res`), making unit testing and protocol migration nearly impossible.
* **Insecure Signature Verification (Implicit):** GitHub webhooks require cryptographic HMAC SHA-256 signature verification (`X-Hub-Signature-256`) to ensure authenticity and prevent spoofing. The legacy code completely lacked this invariant.
* **Anti-Pattern Health Checks:** The health check endpoint was defined as a `POST` request (`/health`) returning plain text instead of a standard `GET` returning structured health status (suitable for Kubernetes liveness/readiness probes).
* **Outdated Middleware Configuration:** Using legacy `body-parser` directly instead of modern Express built-in parsers, and disorganized middleware sequencing (e.g., rate limiter placement).
* **No Observability or Structured Logging:** Console logs lacked contextual metadata (correlation IDs, structured JSON format for log aggregators).

---

## 2. Fundamental Domain Invariants
1. **Cryptographic Integrity:** Every incoming GitHub webhook request **must** be cryptographically authenticated via HMAC validation against a shared secret.
2. **Deterministic Routing:** Webhook payloads must be routed downstream based on the GitHub event type (`X-GitHub-Event`) and payload parameters.
3. **Graceful Lifecycle Management:** The server must handle SIGTERM/SIGINT signals cleanly to drain active connections before shutting down.
4. **Idempotency & Resilience:** Downstream dispatches should be isolated so that network failures do not crash the dispatcher pipeline.

---

## 3. Modernized Greenfield Implementation

We will use a clean, modular, layered architecture:
```
├── package.json
├── src/
│   ├── config/          # Environment validation & configuration
│   ├── loaders/         # Express & middleware bootstrapping
│   ├── middleware/      # Security, Signature verification, Rate limiting
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic, signature check, downstream dispatch
│   └── server.js        # Application entry point
```

### Dependency Manifest (`package.json`)
```json
{
  "name": "github-webhook-dispatcher",
  "version": "2.0.0",
  "description": "Enterprise-grade, secure GitHub webhook dispatcher",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "helmet": "^7.1.0",
    "pino": "^8.20.0",
    "pino-http": "^9.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

---

### Configuration & Validation Layer (`src/config/index.js`)
Using `zod` to guarantee runtime configuration safety.

```javascript
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform(val => parseInt(val, 10)).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GITHUB_WEBHOOK_SECRET: z.string().min(1, "GitHub Webhook Secret is required for signature verification"),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info')
});

const parseConfig = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:', JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }
  return result.data;
};

module.exports = parseConfig();
```

---

### Logger Setup (`src/loaders/logger.js`)
```javascript
const pino = require('pino');
const config = require('./config');

const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined
});

module.exports = logger;
```

---

### Security Middleware: GitHub Signature Verification (`src/middleware/verifySignature.js`)
```javascript
const crypto = require('crypto');
const config = require('../config');

/**
 * Validates the HMAC hex digest signature sent by GitHub in `X-Hub-Signature-256`.
 * Invariant: Requests without valid cryptographic signatures are rejected immediately (401).
 */
const verifyGitHubSignature = (req, res, buf, encoding) => {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    throw new Error('Missing X-Hub-Signature-256 header.');
  }

  const hmac = crypto.createHmac('sha256', config.GITHUB_WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(buf, encoding).digest('hex')}`;

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const digestBuffer = Buffer.from(digest, 'utf8');

  if (signatureBuffer.length !== digestBuffer.length || !crypto.timingSafeEqual(signatureBuffer, digestBuffer)) {
    throw new Error('Invalid webhook signature.');
  }
};

const handleSignatureVerificationError = (err, req, res, next) => {
  if (err && (err.message.includes('signature') || err.message.includes('X-Hub-Signature-256'))) {
    req.log.warn({ err: err.message }, 'Webhook signature verification failed');
    return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
  }
  next(err);
};

module.exports = {
  verifyGitHubSignature,
  handleSignatureVerificationError
};
```

---

### Webhook Dispatcher Service (`src/services/dispatcher.service.js`)
```javascript
const logger = require('../loaders/logger');

class DispatcherService {
  constructor() {
    // In-memory registry of dynamic downstream routes/subscribers
    this.routes = new Map();
  }

  registerRoute(event, targetUrl) {
    if (!this.routes.has(event)) {
      this.routes.set(event, []);
    }
    this.routes.get(event).push(targetUrl);
    logger.info({ event, targetUrl }, 'Registered downstream route');
  }

  getRoutes() {
    return Object.fromEntries(this.routes);
  }

  async dispatch(event, payload, reqId) {
    const targets = this.routes.get(event) || [];
    logger.info({ event, reqId, targetCount: targets.length }, 'Dispatched webhook event');
    
    // In a real microservices architecture, this would publish to an event bus (e.g., Kafka, RabbitMQ)
    // or execute HTTP dispatch to downstream microservices asynchronously.
    return {
      success: true,
      event,
      dispatchedTo: targets
    };
  }
}

module.exports = new DispatcherService();
```

---

### Controllers / Route Handlers (`src/routes/webhook.routes.js`)
```javascript
const { Router } = require('express');
const dispatcherService = require('../services/dispatcher.service');
const openApiSpec = require('../config/openapi.json'); // Assumed spec file

const createRouter = () => {
  const router = Router();

  // Health check (Standardized GET endpoint)
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Main Webhook Receiver
  router.post('/', async (req, res, next) => {
    try {
      const event = req.headers['x-github-event'];
      const deliveryId = req.headers['x-github-delivery'];

      if (!event) {
        return res.status(400).json({ error: 'Missing X-GitHub-Event header' });
      }

      req