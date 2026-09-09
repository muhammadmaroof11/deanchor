# Modern GitHub Webhook Dispatcher Implementation

I'll create a clean, modern architecture for the GitHub webhook dispatcher with improved structure, error handling, and maintainability.

```javascript
// app.js
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { webhookHandler, listRoutesHandler, openapiHandler } from './handlers/webhookHandlers.js';
import { healthCheckHandler } from './handlers/healthHandlers.js';

/**
 * Main application entry point for GitHub webhook dispatcher
 */
class WebhookDispatcher {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configure middleware for the Express app
   */
  setupMiddleware() {
    // Security headers
    this.app.use(helmet());
    
    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      type: ['application/json', 'application/vnd.api+json']
    }));
    
    // Rate limiting for API endpoints (excluding health checks)
    const apiLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // limit each IP to 60 requests per windowMs
      message: {
        error: 'Too many requests from this IP',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    // Apply rate limiting to API routes (except health)
    this.app.use('/api', apiLimiter);
  }

  /**
   * Define all application routes
   */
  setupRoutes() {
    // Main webhook endpoint
    this.app.post('/', webhookHandler);
    
    // Route listing endpoint
    this.app.get('/routes', listRoutesHandler);
    
    // OpenAPI specification endpoint with rate limiting
    const openapiLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // limit each IP to 30 requests per windowMs for spec
      message: {
        error: 'Too many requests for OpenAPI specification',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    this.app.get('/openapi.json', openapiLimiter, openapiHandler);
    
    // Health check endpoints
    this.app.post('/health', healthCheckHandler);
    this.app.get('/health', healthCheckHandler);
    
    // Dummy endpoints for testing (removed in production)
    if (config.debug) {
      this.app.post('/dummy1', (_, res) => {
        res.status(200).send('dummy1');
      });
      
      this.app.post('/dummy2', (_, res) => {
        res.status(200).send('dummy2');
      });
    }
  }

  /**
   * Configure error handling middleware
   */
  setupErrorHandling() {
    // Handle 404 errors
    this.app.use((req, res) => {
      logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        error: 'Not Found',
        message: `The requested endpoint '${req.originalUrl}' was not found`,
        code: 'ROUTE_NOT_FOUND'
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error(`Unhandled error in ${req.method} ${req.originalUrl}:`, error);
      
      if (res.headersSent) {
        return next(error);
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: config.debug ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      });
    });
  }

  /**
   * Start the server
   */
  start() {
    const port = config.port;
    
    this.app.listen(port, () => {
      logger.info(`GitHub webhook dispatcher listening on port ${port}`);
      logger.info(`Debug mode: ${config.debug ? 'enabled' : 'disabled'}`);
    });
  }
}

// Initialize and start the application
const app = new WebhookDispatcher();
app.start();

export default app;
```

```javascript
// config/index.js
/**
 * Configuration module for GitHub webhook dispatcher
 */
export const config = {
  port: process.env.PORT || 3000,
  debug: process.env.DEBUG === 'true' || false,
  github: {
    secret: process.env.GITHUB_WEBHOOK_SECRET || '',
    events: [
      'push',
      'pull_request',
      'issues',
      'issue_comment'
    ]
  },
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,
    message: {
      error: 'Too many requests from this IP',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  security: {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  }
};
```

```javascript
// handlers/webhookHandlers.js
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

/**
 * Main webhook handler for GitHub events
 */
export const webhookHandler = async (req, res) => {
  try {
    // Validate request headers
    if (!req.headers['x-github-event']) {
      return res.status(400).json({
        error: 'Missing GitHub event header',
        code: 'MISSING_GITHUB_EVENT_HEADER'
      });
    }

    const eventType = req.headers['x-github-event'];
    logger.info(`Received webhook event: ${eventType}`);
    
    // In a real implementation, you would:
    // 1. Verify the signature using the secret
    // 2. Parse and validate the payload
    // 3. Route to appropriate service based on event type
    
    res.status(200).json({
      message: 'Webhook received successfully',
      eventType,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error processing webhook:', error);
    return res.status(500).json({
      error: 'Failed to process webhook',
      code: 'WEBHOOK_PROCESSING_ERROR'
    });
  }
};

/**
 * Handler for listing configured routes
 */
export const listRoutesHandler = async (req, res) => {
  try {
    // In a real implementation, this would return the actual route configuration
    const routes = [
      { method: 'POST', path: '/', description: 'Main webhook endpoint' },
      { method: 'GET', path: '/routes', description: 'List all configured routes' },
      { method: 'GET', path: '/openapi.json', description: 'OpenAPI specification' },
      { method: 'POST', path: '/health', description: 'Health check endpoint' }
    ];
    
    if (config.debug) {
      routes.push(
        { method: 'POST', path: '/dummy1', description: 'Dummy test endpoint 1' },
        { method: 'POST', path: '/dummy2', description: 'Dummy test endpoint 2' }
      );
    }
    
    res.status(200).json({
      routes,
      count: routes.length
    });
    
  } catch (error) {
    logger.error('Error listing routes:', error);
    return res.status(500).json({
      error: 'Failed to list routes',
      code: 'ROUTES_LISTING_ERROR'
    });
  }
};

/**
 * Handler for serving OpenAPI specification
 */
export const openapiHandler = async (req, res) => {
  try {
    // In a real implementation, this would return the actual OpenAPI spec
    const openapiSpec = {
      openapi: '3.0.3',
      info: {
        title: 'GitHub Webhook Dispatcher API',
        version: '1.0.0',
        description: 'API for handling GitHub webhooks'
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Local development server'
        }
      ],
      paths: {
        '/': {
          post: {
            summary: 'Receive GitHub webhook events',
            responses: {
              200: {
                description: 'Webhook processed successfully'
              }
            }
          }
        },
        '/routes': {
          get: {
            summary: 'List all configured routes',
            responses: {
              200: {
                description: 'Routes list returned successfully'
              }
            }
          }
        },
        '/openapi.json': {
          get: {
            summary: 'Get OpenAPI specification',
            responses: {
              200: {
                description: 'OpenAPI spec returned successfully'
              }
            }
          }
        }
      }
    };
    
    res.status(200).json(openapiSpec);
    
  } catch (error) {
    logger.error('Error serving OpenAPI spec:', error);
    return res.status(500).json({
      error: 'Failed to serve OpenAPI specification',
      code: 'OPENAPI_SERVING_ERROR'
    });
  }
};
```

```javascript
// handlers/healthHandlers.js
import { logger } from '../utils/logger.js';

/**
 * Health check handler for the application
 */
export const healthCheck