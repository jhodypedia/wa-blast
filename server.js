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
import { failPendingBroadcasts } from './services/broadcastService.js';
import { restoreConnectedSessions, shutdownSessions } from './services/sessionManager.js';

const logger = pino();
const app = express();
const SHUTDOWN_TIMEOUT_MS = 15_000;
const root = path.dirname(fileURLToPath(import.meta.url));
const swaggerCustomCss = readFileSync(
  path.join(root, 'docs', 'swagger-custom.css'),
  'utf8',
);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: swaggerCustomCss,
  customSiteTitle: 'PansaGroup API Docs',
  customJsStr: `document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.pansagroup-contact-badge')) return;
    const badge = document.createElement('a');
    badge.className = 'pansagroup-contact-badge';
    badge.href = 'https://t.me/pansagr';
    badge.target = '_blank';
    badge.rel = 'noreferrer';
    badge.textContent = 'Contact @pansagr on Telegram';
    document.body.append(badge);
  });`,
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

let server = null;
let telegramBot = null;
let shutdownPromise = null;

async function start() {
  await checkDatabaseConnection();
  await failPendingBroadcasts();
  await restoreConnectedSessions();

  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'WhatsApp Gateway API listening');
  });

  try {
    telegramBot = await startTelegramBot();
  } catch (error) {
    logger.error({ error }, 'Telegram admin bot failed to start');
  }
}

function closeHttpServer() {
  if (!server) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function shutdown(signal) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    logger.info({ signal }, 'Shutting down');
    const timeout = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Graceful shutdown timed out');
      server?.closeAllConnections?.();
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timeout.unref();

    try {
      await closeHttpServer();
      await Promise.allSettled([
        shutdownSessions(),
        stopTelegramBot(telegramBot),
      ]);
      await pool.end();
    } finally {
      clearTimeout(timeout);
    }
  })();

  return shutdownPromise;
}

process.once('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    logger.error({ error }, 'Shutdown failed');
    process.exitCode = 1;
  });
});
process.once('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    logger.error({ error }, 'Shutdown failed');
    process.exitCode = 1;
  });
});

start().catch((error) => {
  logger.fatal({ error }, 'WhatsApp Gateway API failed to start');
  process.exitCode = 1;
  shutdown('startup-failure').catch((shutdownError) => {
    logger.error({ error: shutdownError }, 'Startup cleanup failed');
  });
});