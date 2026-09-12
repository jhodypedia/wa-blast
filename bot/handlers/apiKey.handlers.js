import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  setRateLimit,
} from '../../services/apiKeyService.js';
import { handleCommand, isAdmin } from './commandUtils.js';
import { MAIN_MENU_BUTTON_OPTIONS, MAIN_MENU_REPLY_OPTIONS } from './start.handler.js';

const API_KEY_ID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function maskKey(key) {
  const visibleStartLength = key.startsWith('ps-') ? 7 : 4;
  return `${key.slice(0, visibleStartLength)}${'*'.repeat(Math.max(0, key.length - visibleStartLength - 4))}${key.slice(-4)}`;
}

function formatCreatedAt(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function formatApiKey(apiKey) {
  return [
    `ID: ${apiKey.id}`,
    `Label: ${apiKey.label}`,
    `Key: ${maskKey(apiKey.key)}`,
    `Status: ${apiKey.isActive ? 'active' : 'revoked'}`,
    `Created: ${formatCreatedAt(apiKey.createdAt)}`,
  ].join('\n');
}

async function sendKeyList(context, apiKeys) {
  if (apiKeys.length === 0) {
    await context.reply('No API keys found.', MAIN_MENU_BUTTON_OPTIONS);
    return;
  }

  for (const apiKey of apiKeys) {
    const replyOptions = apiKey.isActive
      ? {
          reply_markup: {
            inline_keyboard: [[{
              text: '🔴 Revoke',
              callback_data: `revoke_${apiKey.id}`,
            }]],
          },
        }
      : undefined;
    await context.reply(formatApiKey(apiKey), replyOptions);
  }
  await context.reply('Choose another action:', MAIN_MENU_BUTTON_OPTIONS);
}

function keyButtonText(prefix, apiKey) {
  const label = apiKey.label.length > 40 ? `${apiKey.label.slice(0, 37)}...` : apiKey.label;
  return `${prefix} ${apiKey.id}: ${label}`;
}

async function sendKeyPicker(context, apiKeys, action) {
  const activeKeys = apiKeys.filter((apiKey) => apiKey.isActive);
  if (activeKeys.length === 0) {
    await context.reply('No active API keys found.', MAIN_MENU_BUTTON_OPTIONS);
    return;
  }

  const prefix = action === 'revoke' ? '🔴' : '⚙️';
  await context.reply(
    action === 'revoke' ? 'Select an API key to revoke:' : 'Select an API key to update:',
    {
      reply_markup: {
        inline_keyboard: [
          ...activeKeys.map((apiKey) => [{
            text: keyButtonText(prefix, apiKey),
            callback_data: `${action}_${apiKey.id}`,
          }]),
          [{ text: '🏠 Main Menu', callback_data: 'menu_main' }],
        ],
      },
    },
  );
}

async function showMainMenu(context, conversationStates) {
  conversationStates.delete(String(context.chatId));
  await context.reply('API key administration:', MAIN_MENU_REPLY_OPTIONS);
}

async function handleCallbackAction(telegramContext, conversationStates) {
  const data = telegramContext.callbackQuery?.data ?? '';
  const chatId = String(telegramContext.chatId);

  if (data === 'menu_main') {
    await showMainMenu(telegramContext, conversationStates);
    return;
  }
  if (data === 'menu_generate') {
    conversationStates.set(chatId, { step: 'waiting_label' });
    await telegramContext.reply('Reply with a label for the new API key.', {
      reply_markup: { force_reply: true },
    });
    return;
  }
  if (data === 'menu_list') {
    await sendKeyList(telegramContext, await listApiKeys());
    return;
  }
  if (data === 'menu_revoke') {
    await sendKeyPicker(telegramContext, await listApiKeys(), 'revoke');
    return;
  }
  if (data === 'menu_setlimit') {
    await sendKeyPicker(telegramContext, await listApiKeys(), 'setlimit');
    return;
  }

  const revokeMatch = new RegExp(`^revoke_(${API_KEY_ID_PATTERN})$`, 'i').exec(data);
  if (revokeMatch) {
    const keyId = parseApiKeyId(revokeMatch[1], 'keyId');
    await telegramContext.reply(`Revoke API key ${keyId}?`, {
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Confirm', callback_data: `confirm_revoke_${keyId}` },
          { text: '⬅️ Cancel', callback_data: 'menu_list' },
        ]],
      },
    });
    return;
  }

  const confirmMatch = new RegExp(`^confirm_revoke_(${API_KEY_ID_PATTERN})$`, 'i').exec(data);
  if (confirmMatch) {
    const keyId = parseApiKeyId(confirmMatch[1], 'keyId');
    const revoked = await revokeApiKey(keyId);
    if (!revoked) {
      throw new TypeError(`API key ${keyId} was not found or was already revoked`);
    }
    conversationStates.delete(chatId);
    await telegramContext.reply(`API key ${keyId} revoked.`, MAIN_MENU_BUTTON_OPTIONS);
    return;
  }

  const setLimitMatch = new RegExp(`^setlimit_(${API_KEY_ID_PATTERN})$`, 'i').exec(data);
  if (setLimitMatch) {
    const keyId = parseApiKeyId(setLimitMatch[1], 'keyId');
    conversationStates.set(chatId, { step: 'waiting_limit', keyId });
    await telegramContext.reply(`Reply with the new requests-per-minute limit for API key ${keyId}.`, {
      reply_markup: { force_reply: true },
    });
  }
}

async function handleConversationReply(telegramContext, conversationStates) {
  const chatId = String(telegramContext.chatId);
  const state = conversationStates.get(chatId);
  const text = telegramContext.message?.text?.trim();
  if (!state || !text || text.startsWith('/')) {
    return;
  }

  if (state.step === 'waiting_label') {
    const apiKey = await generateApiKey({
      label: text,
      ownerTelegramId: String(telegramContext.from.id),
    });
    conversationStates.delete(chatId);
    await telegramContext.reply(`Generated API key for: ${apiKey.label}`);
    await telegramContext.reply(apiKey.key);
    await telegramContext.reply(
      'Store this key securely. It will not be shown again in full.',
      MAIN_MENU_BUTTON_OPTIONS,
    );
    return;
  }

  if (state.step === 'waiting_limit') {
    const requestsPerMinute = Number(parsePositiveInteger(text, 'requestsPerMinute'));
    const updated = await setRateLimit(state.keyId, requestsPerMinute);
    if (!updated) {
      throw new TypeError(`API key ${state.keyId} was not found`);
    }
    conversationStates.delete(chatId);
    await telegramContext.reply(
      `API key ${state.keyId} rate limit set to ${requestsPerMinute} requests per minute.`,
      MAIN_MENU_BUTTON_OPTIONS,
    );
  }
}

function parsePositiveInteger(value, name) {
  if (!/^\d+$/.test(value ?? '') || BigInt(value) < 1n) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function parseApiKeyId(value, name) {
  const id = String(value ?? '').trim().toLowerCase();
  if (!new RegExp(`^${API_KEY_ID_PATTERN}$`, 'i').test(id)) {
    throw new TypeError(`${name} must be a UUID`);
  }
  return id;
}

export function registerApiKeyHandlers(bot, context) {
  bot.command('generatekey', async (telegramContext) => {
    await handleCommand({
      context: telegramContext,
      ...context,
      action: async () => {
        const label = telegramContext.match?.trim();
        if (!label) {
          throw new TypeError('usage: /generatekey <label>');
        }

        const apiKey = await generateApiKey({
          label,
          ownerTelegramId: String(telegramContext.from.id),
        });
        await telegramContext.reply(`Generated API key for: ${apiKey.label}`);
        await telegramContext.reply(apiKey.key);
        await telegramContext.reply('Store this key securely. It will not be shown again in full.');
      },
    });
  });

  bot.command('listkeys', async (telegramContext) => {
    await handleCommand({
      context: telegramContext,
      ...context,
      action: async () => {
        const apiKeys = await listApiKeys();
        await sendKeyList(telegramContext, apiKeys);
      },
    });
  });

  bot.command('revokekey', async (telegramContext) => {
    await handleCommand({
      context: telegramContext,
      ...context,
      action: async () => {
        const keyId = parseApiKeyId(telegramContext.match?.trim(), 'keyId');
        const revoked = await revokeApiKey(keyId);
        if (!revoked) {
          throw new TypeError(`API key ${keyId} was not found`);
        }
        await telegramContext.reply(`API key ${keyId} revoked.`);
      },
    });
  });

  bot.command('setlimit', async (telegramContext) => {
    await handleCommand({
      context: telegramContext,
      ...context,
      action: async () => {
        const [rawKeyId, rawRequestsPerMinute] = telegramContext.match?.trim().split(/\s+/) ?? [];
        const keyId = parseApiKeyId(rawKeyId, 'keyId');
        const rawLimit = parsePositiveInteger(rawRequestsPerMinute, 'requestsPerMinute');
        const requestsPerMinute = Number(rawLimit);
        const updated = await setRateLimit(keyId, requestsPerMinute);
        if (!updated) {
          throw new TypeError(`API key ${keyId} was not found`);
        }
        await telegramContext.reply(
          `API key ${keyId} rate limit set to ${requestsPerMinute} requests per minute.`,
        );
      },
    });
  });

  bot.on('callback_query', async (telegramContext) => {
    await telegramContext.answerCallbackQuery().catch((error) => {
      context.logger.warn({ error }, 'Unable to answer Telegram callback query');
    });
    if (!isAdmin(telegramContext, context.adminIds)) {
      await telegramContext.reply('Unauthorized');
      return;
    }

    try {
      await handleCallbackAction(telegramContext, context.conversationStates);
    } catch (error) {
      context.logger.error(
        { error, telegramUserId: telegramContext.from?.id },
        'Telegram callback action failed',
      );
      const detail = error instanceof TypeError ? `: ${error.message}` : '';
      await telegramContext.reply(`Unable to complete the action${detail}`, MAIN_MENU_BUTTON_OPTIONS);
    }
  });

  bot.on('message', async (telegramContext) => {
    if (!isAdmin(telegramContext, context.adminIds)) {
      return;
    }
    if (telegramContext.message?.text?.startsWith('/')) {
      return;
    }

    try {
      await handleConversationReply(telegramContext, context.conversationStates);
    } catch (error) {
      context.logger.error(
        { error, telegramUserId: telegramContext.from?.id },
        'Telegram conversation step failed',
      );
      const detail = error instanceof TypeError ? `: ${error.message}` : '';
      await telegramContext.reply(`Unable to complete the action${detail}`);
    }
  });
}