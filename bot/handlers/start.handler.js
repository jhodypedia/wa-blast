import { handleCommand } from './commandUtils.js';

export const MAIN_MENU_REPLY_OPTIONS = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '✅ Generate Key', callback_data: 'menu_generate' }],
      [{ text: '📋 List Keys', callback_data: 'menu_list' }],
      [{ text: '🔴 Revoke Key', callback_data: 'menu_revoke' }],
      [{ text: '⚙️ Set Rate Limit', callback_data: 'menu_setlimit' }],
    ],
  },
};

export const MAIN_MENU_BUTTON_OPTIONS = {
  reply_markup: {
    inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'menu_main' }]],
  },
};

const MAIN_MENU_MESSAGE = 'API key administration:';

export function registerStartHandler(bot, context) {
  bot.command('start', async (telegramContext) => {
    await handleCommand({
      context: telegramContext,
      ...context,
      action: () => {
        context.conversationStates.delete(String(telegramContext.chatId));
        return telegramContext.reply(MAIN_MENU_MESSAGE, MAIN_MENU_REPLY_OPTIONS);
      },
    });
  });
}