// project-root/package.json
// {
//   "name": "github-webhook-dispatcher",
//   "version": "1.0.0",
//   "description": "GitHub webhook dispatcher",
//   "main": "src/server.js",
//   "type": "module", // Crucial for ES Modules
//   "scripts": {
//     "start": "node src/server.js",
//     "dev": "node --watch src/server.js"
//   },
//   "dependencies": {
//     "express": "^4.18.2",
//     "express-rate-limit": "^7.1.5",
//     "helmet": "^7.1.0",
//     "dotenv": "^16.3.1" // For environment variable management
//   },
//   "devDependencies": {
//     "nodemon": "^3.0.2" // If you prefer nodemon over node --watch
//   }
// }

// project-root/openapi.json
{
  "openapi": "3.0.0",
  "info": {
    "title": "GitHub Webhook Dispatcher API",
    "version": "1.0.0",
    "description": "API for consuming GitHub webhook events and dispatching them to downstream services."
  },
  "servers": [
    {
      "url": "/",
      "description": "Local development server"
    }
  ],
  "paths": {
    "/": {
      "post": {
        "summary": "Receive GitHub webhook events",
        "description": "This endpoint consumes GitHub webhook payloads. It verifies the signature and dispatches the event.",
        "requestBody": {
          "description": "GitHub webhook payload",
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "description": "Generic GitHub webhook payload structure"
              },
              "example": {
                "ref": "refs/heads/main",
                "before": "a1b2c3d4e5f6...",
                "after": "f6e5d4c3b2a1...",
                "repository": {
                  "id": 12345,
                  "node_id": "R_kgDOG_...",
                  "name": "my-repo",
                  "full_name": "octocat/my-repo",
                  "private": false,
                  "owner": {
                    "login": "octocat",
                    "id": 1
                  }
                },
                "pusher": {
                  "name": "octocat",
                  "email": "octocat@github.com"
                },
                "sender": {
                  "login": "octocat",
                  "id": 1
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Webhook received and processed successfully."
          },
          "400": {
            "description": "Bad Request (e.g., missing headers, invalid payload)."
          },
          "401": {
            "description": "Unauthorized (e.g., invalid signature)."
          },
          "500": {
            "description": "Internal Server Error."
          }
        }
      }
    },
    "/routes": {
      "get": {
        "summary": "List all configured API routes",
        "description": "Returns a list of all routes registered in the application.",
        "responses": {
          "200": {
            "description": "A list of routes.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "path": { "type": "string" },
                      "method": { "type": "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/openapi.json": {
      "get": {
        "summary": "Serve the OpenAPI specification",
        "description": "Returns the OpenAPI 3.0 specification for this API.",
        "responses": {
          "200": {
            "description": "OpenAPI JSON specification.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/OpenApiSpec"
                }
              }
            }
          }
        }
      }
    },
    "/health": {
      "post": {
        "summary": "Health check endpoint",
        "description": "Simple endpoint to check if the service is alive.",
        "responses": {
          "200": {
            "description": "Service is alive.",
            "content": {
              "text/plain": {
                "example": "alive"
              }
            }
          }
        }
      }
    },
    "/dummy1": {
      "post": {
        "summary": "Dummy endpoint 1",
        "description": "A placeholder endpoint for testing purposes.",
        "responses": {
          "200": {
            "description": "Dummy endpoint 1 response.",
            "content": {
              "text/plain": {
                "example": "dummy1"
              }
            }
          }
        }
      }
    },
    "/dummy2": {
      "post": {
        "summary": "Dummy endpoint 2",
        "description": "A placeholder endpoint for testing purposes.",
        "responses": {
          "200": {
            "description": "Dummy endpoint 2 response.",
            "content": {
              "text/plain": {
                "example": "dummy2"
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "OpenApiSpec": {
        "type": "object",
        "description": "The full OpenAPI specification object."
      }
    }
  }
}

// project-root/src/config/index.js
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  debug: process.env.DEBUG === 'true',
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'super-secret-default-key', // IMPORTANT: Use a strong, unique secret in production
  // Add other configuration variables here
};

export default config;

// project-root/src/utils/logger.js
import config from '../config/index.js';

const logger = {
  info: (...args) => {
    console.log('[INFO]', ...args);
  },
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
  debug: (...args) => {
    if (config.debug) {
      console.debug('[DEBUG]', ...args);
    }
  },
};

export default logger;

// project-root/src/middleware/errorHandler.js
import logger from '../utils/logger.js';

// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error(`Error: ${err.message}`, err.stack);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred.';

  res.status(statusCode).json({
    error: {
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }), // Only expose stack in dev
    },
  });
};

export default errorHandler;

// project-root/src/services/github.service.js
import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class GitHubService {
  /**
   * Verifies the GitHub webhook signature.
   * @param {string} signature The 'X-Hub-Signature-256' header value.
   * @param {string} payload The raw request body.
   * @returns {boolean} True if the signature is valid, false otherwise.
   */
  verifySignature(signature, payload) {
    if (!signature || !payload) {
      logger.warn('Missing signature or payload for webhook verification.');
      return false;
    }

    const hmac = crypto.createHmac('sha256', config.githubWebhookSecret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    // Compare the signature in a time-constant manner to prevent timing attacks
    const isValid = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));

    if (!isValid) {
      logger.warn('Invalid GitHub webhook signature.');
    } else {
      logger.debug('GitHub webhook signature verified successfully.');
    }

    return isValid;
  }

  /**
   * Processes the GitHub webhook payload.
   * This is where the core business logic for dispatching events would go.
   * @param {object} payload The parsed JSON payload.
   * @param {string} eventType The 'X-GitHub-Event' header value (e.g., 'push', 'pull_request').
   * @param {string} deliveryId The 'X-GitHub-Delivery' header value.
   */
  async processWebhook(payload, eventType, deliveryId) {
    logger.info(`Processing GitHub event: ${eventType} (Delivery ID: ${deliveryId})`);
    logger.debug('Webhook payload:', payload);

    // --- Placeholder for actual dispatching logic ---
    // In a real application, this would involve:
    // 1. Determining the target service based on eventType, repository, etc.
    // 2. Transforming the payload if necessary.
    // 3. Sending the payload to the downstream service (e.g., via HTTP, message queue).
    // 4. Handling potential errors from downstream services.

    switch (eventType) {
      case 'push':
        logger.info(`Push event received for repository: ${payload.repository?.full_name}`);
        // Example: Dispatch to a CI/CD pipeline service
        break;
      case 'pull_request':
        logger.info(`Pull request event received for repository: ${payload.repository?.full_name}, action: ${payload.action}`);
        // Example: Dispatch to a code review tool or notification service
        break;
      // Add more event types as needed
      default:
        logger.info(`Unhandled GitHub event type: ${eventType}`);
        break;
    }

    // Simulate asynchronous work
    await new Promise(resolve => setTimeout(resolve, 50));

    logger.info(`Finished processing event ${eventType} (Delivery ID: ${deliveryId}).`);
    // Return status or result of dispatch if applicable
    return { status: 'processed', eventType, deliveryId };
  }
}

export default new GitHubService();

// project-root/src/controllers/github.controller.js
import githubService from '../services/github.service.js';
import logger from '../utils/logger.js';

class GitHubController {
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-hub-signature-256'];
      const eventType = req.headers['x-github-event'];
      const deliveryId = req.headers['x-github-delivery'];
      const rawBody = req.rawBody; // rawBody is added by the raw body parser middleware

      if (!signature || !eventType || !deliveryId || !rawBody) {
        logger.warn('Missing required GitHub webhook headers or raw body.');
        return res.status(400).json({ message: 'Missing required headers (X-Hub-Signature-256, X-GitHub-Event, X-GitHub-Delivery) or raw body.' });
      }

      // Verify the signature
      if (!githubService.verifySignature(signature, rawBody)) {
        return res.status(401).json({ message: 'Invalid GitHub webhook signature.' });
      }

      // Parse the JSON payload after signature verification
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch (parseError) {
        logger.error('Failed to parse GitHub webhook payload:', parseError);
        return res.status(400).json({ message: 'Invalid JSON payload.' });
      }

      // Process the webhook
      await githubService.processWebhook(payload, eventType, deliveryId);

      res.status(200).json({ message: 'Webhook received and processed.' });
    } catch (error) {
      next(error); // Pass error to centralized error handler
    }
  }
}

export default new GitHubController();

// project-root/src/controllers/system.controller.js
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import logger from '../utils/logger.js';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SystemController {
  /**
   * Lists all registered routes in the Express application.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  listRoutes(req, res) {
    const routes = [];
    // Iterate over the Express app's router stack to find all routes
    req.app._router.stack.forEach(middleware => {
      if (middleware.route) { // Routes registered directly on the app
        routes.push({
          path: middleware.route.path,
          method: Object.keys(middleware.route.methods).join(', ').toUpperCase(),
        });
      } else if (middleware.name === 'router' && middleware.handle.stack) { // Routers mounted on the app
        middleware.handle.stack.forEach(handler => {
          if (handler.route) {
            routes.push({
              path: middleware.regexp.source.replace(/\\\//g, '/').replace(/^\/\^|\/\?\(\?\=\\\/\)\/\?$/g, '') + handler.route.path,
              method: Object.keys(handler.route.methods).join(', ').toUpperCase(),
            });
          }
        });
      }
    });
    res.status(200).json(routes);
  }

  /**
   * Serves the OpenAPI specification file.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  async getOpenApiSpec(req, res, next) {
    try {
      const openApiPath = path.resolve(__dirname, '../../openapi.json');
      const spec = await fs.readFile(openApiPath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(spec);
    } catch (error) {
      logger.error('Failed to serve OpenAPI spec:', error);
      next(error); // Pass error to centralized error handler
    }
  }

  /**
   * Health check endpoint.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  healthCheck(req, res) {
    res.status(200).send('alive');
  }

  /**
   * Generic handler for dummy routes.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  dummyHandler(req, res) {
    const routeName = req.path.replace('/', '');
    res.status(200).send(routeName);
  }
}

export default new SystemController();

// project-root/src/routes/github.routes.js
import { Router } from 'express';
import githubController from '../controllers/github.controller.js';

const router = Router();

// Main GitHub webhook endpoint
router.post('/', githubController.handleWebhook);

export default router;

// project-root/src/routes/system.routes.js
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import systemController from '../controllers/system.controller.js';

const router = Router();

// Configure rate limiter for OpenAPI spec
const openApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests per windowMs
  message: 'Too many requests from this IP, please try again after a minute.',
});

// Route to get a list of all the configured routes
router.get('/routes', systemController.listRoutes);

// Route to serve the openapi spec, with rate limiting
router.get('/openapi.json', openApiLimiter, systemController.getOpenApiSpec);

// Dummy routes for health checks and testing
router.post('/health', systemController.healthCheck);
router.post('/dummy1', systemController.dummyHandler);
router.post('/dummy2', systemController.dummyHandler);

export default router;

// project-root/src/routes/index.js
import { Router } from 'express';
import githubRoutes from './github.routes.js';
import systemRoutes from './system.routes.js';

const apiRouter = Router();

// Mount specific routers
apiRouter.use('/', githubRoutes); // GitHub webhook is at the root
apiRouter.use('/', systemRoutes); // System routes are also at the root

export default apiRouter;

// project-root/src/app.js
import express from 'express';
import helmet from 'helmet';
import apiRouter from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import logger from './utils/logger.js';

const app = express();

// Security middleware
app.disable('x-powered-by'); // Disable X-Powered-By header for security
app.use(helmet()); // Apply various security headers

// Middleware to parse raw body for GitHub signature verification
// This must come BEFORE express.json() if you need the raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    // Store the raw body buffer for signature verification later
    // This is crucial for GitHub webhooks
    req.rawBody = buf.toString();
  },
}));

// Mount the main API router
app.use('/', apiRouter);

// Centralized error handling middleware (must be last)
app.use(errorHandler);

export default app;

// project-root/src/server.js
import app from './app.js';
import config from './config/index.js';
import logger from './utils/logger.js';

// Start the server
app.listen(config.port, () => {
  logger.info(`GitHub webhook dispatcher listening on port ${config.port}!`);
  logger.info(`Debug mode: ${config.debug ? 'Enabled' : 'Disabled'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
  // For a robust application, consider graceful shutdown here
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // For a robust application, perform graceful shutdown and exit
  process.exit(1);
});