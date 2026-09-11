import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pino from 'pino';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { checkDatabaseConnection, pool } from './config/database.js';
import { swaggerSpec } from './config/swagger.js';
import broadcastRoutes from './routes/broadcast.routes.js';
import messageRoutes from './routes/message.routes.js';
import sessionRoutes from './routes/session.routes.js';
import { startTelegramBot, stopTelegramBot } from './bot/index.js';
import { apiKeyAuth } from './middlewares/apiKeyAuth.js';
import { apiKeyRateLimiter } from './middlewares/rateLimiter.js';

const logger = pino();
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const swaggerCustomCss = readFileSync(
  path.join(root, 'docs', 'swagger-custom.css'),
  'utf8',
);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: swaggerCustomCss,
  customSiteTitle: 'Pansa Store API Docs',
  swaggerOptions: { persistAuthorization: true },
}));
app.use('/broadcast', apiKeyAuth, apiKeyRateLimiter, broadcastRoutes);
app.use('/message', apiKeyAuth, apiKeyRateLimiter, messageRoutes);
app.use('/session', apiKeyAuth, apiKeyRateLimiter, sessionRoutes);

app.get('/health', async (_request, response) => {
  try {
    await checkDatabaseConnection();
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    response.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'WhatsApp Gateway API listening');
});

let telegramBot = null;
startTelegramBot()
  .then((bot) => {
    telegramBot = bot;
  })
  .catch((error) => {
    logger.error({ error }, 'Telegram admin bot failed to start');
  });

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await stopTelegramBot(telegramBot);
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));