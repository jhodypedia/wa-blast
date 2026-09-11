import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('/start exposes the four inline menu actions', async () => {
  const source = await readSource('../bot/handlers/start.handler.js');

  assert.match(source, /✅ Generate Key[\s\S]*callback_data: 'menu_generate'/);
  assert.match(source, /📋 List Keys[\s\S]*callback_data: 'menu_list'/);
  assert.match(source, /🔴 Revoke Key[\s\S]*callback_data: 'menu_revoke'/);
  assert.match(source, /⚙️ Set Rate Limit[\s\S]*callback_data: 'menu_setlimit'/);
});

test('callback actions are acknowledged before authorization and async work', async () => {
  const source = await readSource('../bot/handlers/apiKey.handlers.js');
  const callbackHandler = source.slice(source.indexOf("bot.on('callback_query'"));

  assert.ok(callbackHandler.indexOf('answerCallbackQuery()') < callbackHandler.indexOf('isAdmin('));
  assert.ok(callbackHandler.indexOf('isAdmin(') < callbackHandler.indexOf('handleCallbackAction('));
});

test('multi-step menu actions use per-chat state and clear it at the main menu', async () => {
  const handlers = await readSource('../bot/handlers/apiKey.handlers.js');
  const bot = await readSource('../bot/telegramBot.js');

  assert.match(bot, /conversationStates: new Map\(\)/);
  assert.match(handlers, /conversationStates\.set\(chatId, \{ step: 'waiting_label' \}\)/);
  assert.match(handlers, /conversationStates\.set\(chatId, \{ step: 'waiting_limit', keyId \}\)/);
  assert.match(handlers, /conversationStates\.delete\(String\(context\.chatId\)\)/);
});

test('revocation requires confirmation and lists direct revoke buttons', async () => {
  const source = await readSource('../bot/handlers/apiKey.handlers.js');

  assert.match(source, /callback_data: `revoke_\$\{apiKey\.id\}`/);
  assert.match(source, /callback_data: `confirm_revoke_\$\{keyId\}`/);
  assert.match(source, /⬅️ Cancel[\s\S]*callback_data: 'menu_list'/);
  assert.match(source, /confirm_revoke_[\s\S]*await revokeApiKey\(keyId\)/);
});

test('typed API key commands remain registered as fallbacks', async () => {
  const source = await readSource('../bot/handlers/apiKey.handlers.js');

  for (const command of ['generatekey', 'listkeys', 'revokekey', 'setlimit']) {
    assert.match(source, new RegExp(`bot\\.command\\('${command}'`));
  }
});