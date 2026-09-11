import express from 'express';
import pino from 'pino';
import { env } from './config/env.js';
import { checkDatabaseConnection, pool } from './config/database.js';
import broadcastRoutes from './routes/broadcast.routes.js';
import messageRoutes from './routes/message.routes.js';
import sessionRoutes from './routes/session.routes.js';

const logger = pino();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/broadcast', broadcastRoutes);
app.use('/message', messageRoutes);
app.use('/session', sessionRoutes);

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

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));