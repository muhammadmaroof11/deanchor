// src/config/index.js
// Centralized configuration management
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file in development

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'super-secret-dev-key', // IMPORTANT: Use a strong, unique secret in production!
  downstreamServices: JSON.parse(process.env.DOWNSTREAM_SERVICES || '[]'), // Array of { name, url, secret, events, repositories }
  // Example for DOWNSTREAM_SERVICES environment variable:
  // DOWNSTREAM_SERVICES='[{"name":"jira-integration","url":"http://localhost:8080/jira-webhook","secret":"jira-secret","events":["issues","issue_comment"],"repositories":["my-org/repo1","my-org/repo2"]},{"name":"slack-notifier","url":"http://localhost:8081/slack-webhook","secret":"slack-secret","events":["*"],"repositories":["*"]}]'
};

// Validate essential configuration
if (config.env === 'production' && !config.githubWebhookSecret) {
  throw new Error('GITHUB_WEBHOOK_SECRET is required in production environment.');