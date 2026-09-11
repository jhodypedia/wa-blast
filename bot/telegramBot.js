import { Bot } from 'node-telegram-bot-api';
import pino from 'pino';
import { env } from '../config/env.js';
import { registerApiKeyHandlers } from './handlers/apiKey.handlers.js';
import { parseAdminIds } from './handlers/commandUtils.js';
import { registerStartHandler } from './handlers/start.handler.js';

export function createTelegramBot({
  token = env.TELEGRAM_BOT_TOKEN,
  adminIds = parseAdminIds(env.TELEGRAM_ADMIN_IDS),
  logger = pino(),
} = {}) {
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required to start the Telegram bot');
  }
  if (adminIds.size === 0) {
    throw new Error('TELEGRAM_ADMIN_IDS must contain at least one Telegram ID');
  }

  const bot = new Bot(token);
  const context = { adminIds, logger };
  registerStartHandler(bot, context);
  registerApiKeyHandlers(bot, context);
  bot.catch((error, context) => {
    logger.error({ error, telegramUserId: context.from?.id }, 'Unhandled Telegram bot error');
  });

  return bot;
}