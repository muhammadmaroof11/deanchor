// index.js
// Main entry point for the application. Orchestrates server startup.
import { config } from './src/config/index.js';
import { logger } from './src/utils/logger.js';
import { createApp } from './src/app.js';
import { startServer } from './src/server.js';

async function bootstrap() {
  try {
    logger.info('Starting GitHub webhook dispatcher...');
    logger.info(`Debug mode: ${config.debug}`);

    const app = createApp(config, logger);
    await startServer(app, config.port, logger);

    logger.info(`GitHub webhook dispatcher listening on port ${config.port}!`);
  } catch (error) {
    logger.fatal({ error }, 'Failed to start application.');
    process.exit(1);
  }
}

bootstrap();