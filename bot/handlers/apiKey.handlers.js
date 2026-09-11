import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  setRateLimit,
} from '../../services/apiKeyService.js';
import { handleCommand } from './commandUtils.js';

const TELEGRAM_MESSAGE_LIMIT = 3900;

function maskKey(key) {
  return `${key.slice(0, 4)}${'*'.repeat(Math.max(0, key.length - 8))}${key.slice(-4)}`;
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
    await context.reply('No API keys found.');
    return;
  }

  let message = 'API keys:\n\n';
  for (const apiKey of apiKeys) {
    const block = `${formatApiKey(apiKey)}\n\n`;
    if (message.length + block.length > TELEGRAM_MESSAGE_LIMIT) {
      await context.reply(message.trimEnd());
      message = '';
    }
    message += block;
  }

  if (message) {
    await context.reply(message.trimEnd());
  }
}

function parsePositiveInteger(value, name) {
  if (!/^\d+$/.test(value ?? '') || BigInt(value) < 1n) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
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
        const keyId = parsePositiveInteger(telegramContext.match?.trim(), 'keyId');
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
        const keyId = parsePositiveInteger(rawKeyId, 'keyId');
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
}