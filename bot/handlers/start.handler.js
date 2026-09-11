import { handleCommand } from './commandUtils.js';

const HELP_MESSAGE = `Available commands:
/generatekey <label> - generate an API key
/listkeys - list API keys
/revokekey <keyId> - revoke an API key
/setlimit <keyId> <requestsPerMinute> - change a rate limit`;

export function registerStartHandler(bot, context) {
  bot.command('start', async (telegramContext) => {
    await handleCommand({
      context: telegramContext,
      ...context,
      action: () => telegramContext.reply(HELP_MESSAGE),
    });
  });
}