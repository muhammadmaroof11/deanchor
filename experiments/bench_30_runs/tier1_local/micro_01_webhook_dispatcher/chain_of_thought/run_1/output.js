# Modern GitHub Webhook Dispatcher Architecture

I'll completely refactor this code with a modern, clean architecture that addresses the architectural flaws and implements best practices.

## Analysis of Current Issues:
1. **Tight coupling** - All logic is in one file with no separation of concerns
2. **Poor dependency management** - Direct requires without proper module structure
3. **No error handling or validation**
4. **Inconsistent route patterns** - Mix of hardcoded routes and dynamic handlers
5. **Missing security practices** - No input sanitization, limited logging
6. **Lack of testability** - Hard to unit test due to global state

## Modern Architecture Approach:
- Clean separation of concerns using modules
- Dependency injection for better testability
- Comprehensive error handling with proper HTTP status codes
- Input validation and security best practices
- Modular configuration management
- Proper logging and monitoring support

Here's the complete modernized implementation:

```javascript
// src/index.js
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createLogger } from './utils/logger.js';
import config from './config/index.js';
import webhookRouter from './routes/webhook.routes.js';
import healthRouter from './routes/health.routes.js';
import openapiRouter from './routes/openapi.routes.js';
import routesRouter from './routes/routes.routes.js';

// Initialize logger
const logger = createLogger();

/**
 * Main application factory function
 * @returns {express.Application} Configured Express app instance
 */
export const createApp = () => {
  const app = express();
  
  // Security middleware
  app.use(helmet());
  
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Rate limiting for API endpoints (except health checks)
  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      error: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Apply rate limiting to API routes (except health)
  app.use('/webhook', apiLimiter);
  app.use('/routes', apiLimiter);
  app.use('/openapi.json', apiLimiter);
  
  // Register routers
  app.use('/webhook', webhookRouter);
  app.use('/health', healthRouter);
  app.use('/routes', routesRouter);
  app.use('/openapi.json', openapiRouter);
  
  // Health check endpoint (no rate limiting)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });
  
  // Handle 404 for undefined routes
  app.use('*', (req, res) => {
    logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      error: 'Not Found',
      message: `The requested route ${req.originalUrl} was not found`
    });
  });
  
  // Global error handler
  app.use((error, req, res, next) => {
    logger.error(`Unhandled error in request ${req.id}:`, error);
    
    if (res.headersSent) {
      return next(error);
    }
    
    const status = error.status || error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    
    res.status(status).json({
      error: true,
      code: error.code || 'INTERNAL_ERROR',
      message
    });
  });
  
  return app;
};

/**
 * Start the application server
 */
export const startServer = async () => {
  try {
    const app = createApp();
    
    // Create HTTP server with graceful shutdown handling
    const server = app.listen(config.port, () => {
      logger.info(`GitHub webhook dispatcher listening on port ${config.port}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Debug mode: ${config.debug}`);
    });
    
    // Graceful shutdown handling
    const shutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
      
      setTimeout(() => {
        logger.error('Shutdown timeout, forcing exit');
        process.exit(1);
      }, 5000);
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    throw error;
  }
};

// Export for direct execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  startServer().catch(error => {
    console.error('Fatal error starting application:', error);
    process.exit(1);
  });
}
```

```javascript
// src/config/index.js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables (if using dotenv)
try {
  import('dotenv').then(() => {
    // Dotenv loaded, proceed with configuration
  }).catch(() => {
    // dotenv not available, continue without it
  });
} catch (e) {
  // Handle case where dotenv is not installed or fails
}

const config = {
  port: process.env.PORT || 3000,
  debug: process.env.DEBUG === 'true' || false,
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX) || 60 // limit each IP to 60 requests per windowMs
  },
  github: {
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
    allowedEvents: [
      'push',
      'pull_request',
      'issues',
      'issue_comment'
    ]
  }
};

// Validate required configuration
if (!config.github.webhookSecret) {
  console.warn('Warning: GITHUB_WEBHOOK_SECRET not set in environment variables');
}

export default config;
```

```javascript
// src/utils/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'github-webhook-dispatcher' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log' 
  }));
}

export const createLogger = () => {
  return logger;
};
```

```javascript
// src/middleware/validation.middleware.js
import { validationResult } from 'express-validator';

/**
 * Validation error handler middleware
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: true,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: errors.array()
    });
  }
  
  next();
};
```

```javascript
// src/services/webhook.service.js
import config from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

/**
 * Service for handling GitHub webhook events
 */
export class WebhookService {
  constructor() {
    this.handlers = new Map();
    this.registerDefaultHandlers();
  }
  
  /**
   * Register a handler for a specific event type
   * @param {string} eventType - The GitHub event type (e.g., 'push', 'pull_request')
   * @param {Function} handler - Handler function to process the event
   */
  registerHandler(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    
    this.handlers.set(eventType, handler);
    logger.info(`Registered webhook handler for: ${eventType}`);
  }
  
  /**
   * Process incoming webhook event
   * @param {Object} payload - The GitHub webhook payload
   * @param {string} eventType - The type of GitHub event
   * @returns {Promise<Object>} Result of processing the event
   */
  async processEvent(payload, eventType) {
    const handler = this.handlers.get(eventType);
    
    if (!handler) {
      logger.warn(`No handler registered for event type: ${eventType}`);
      return { status: 'skipped', message: `No handler for ${eventType}` };
    }
    
    try {
      logger.info(`Processing webhook event: ${eventType}`);
      const result = await handler(payload);
      
      logger.info(`Successfully processed event: ${eventType}`);
      return { 
        status: 'success',
        eventType,
        data: result
      };
    } catch (error) {
      logger.error(`Error processing webhook