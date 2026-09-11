import pino from 'pino';
import { env } from '../config/env.js';
import { createTelegramBot } from './telegramBot.js';

const logger = pino();

export async function startTelegramBot() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn('Telegram bot disabled because TELEGRAM_BOT_TOKEN is not configured');
    return null;
  }

  const bot = createTelegramBot({ logger });
  const polling = bot.startPolling();
  polling.catch((error) => {
    logger.error({ error }, 'Telegram polling stopped unexpectedly');
  });
  logger.info('Telegram admin bot polling started');
  return bot;
}

export async function stopTelegramBot(bot) {
  if (bot?.isRunning()) {
    bot.stop();
    logger.info('Telegram admin bot polling stopped');
  }
}