import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { swaggerSpec } from '../config/swagger.js';

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('generates a ps-prefixed key while preserving the 32-character random portion', async () => {
  const source = await readSource('../services/apiKeyService.js');

  assert.match(source, /const API_KEY_LENGTH = 32;/);
  assert.match(source, /const API_KEY_PREFIX = 'ps-';/);
  assert.match(source, /`\$\{API_KEY_PREFIX\}\$\{nanoid\(API_KEY_LENGTH\)\}`/);
});

test('validates the complete supplied key without parsing its prefix', async () => {
  const source = await readSource('../services/apiKeyService.js');

  assert.match(source, /WHERE \\`key\\` = \? AND is_active = TRUE[\s\S]*\[rawKey\]/);
});

test('auth preserves legacy keys and short-circuits malformed prefixed keys', async () => {
  const source = await readSource('../middlewares/apiKeyAuth.js');

  assert.match(source, /LEGACY_API_KEY_PATTERN = \/\^\[A-Za-z0-9_-\]\{32\}\$\//);
  assert.match(source, /PREFIXED_API_KEY_PATTERN = \/\^ps-\[A-Za-z0-9_-\]\{32\}\$\//);
  assert.ok(source.indexOf('PREFIXED_API_KEY_PATTERN.test(rawKey)') < source.indexOf('validateApiKey(rawKey)'));
});

test('Telegram masking keeps the ps prefix visible and Swagger documents it', async () => {
  const source = await readSource('../bot/handlers/apiKey.handlers.js');
  const securityScheme = swaggerSpec.components.securitySchemes.ApiKeyAuth;

  assert.match(source, /key\.startsWith\('ps-'\) \? 7 : 4/);
  assert.match(securityScheme.description, /ps-V1StGXR8_Z5jdHi6B-myT/);
});

test('the API key database column holds the prefix and random portion', async () => {
  const createTableSource = await readSource('../migrations/20260101000001_create_api_keys_table.sql');
  const extensionSource = await readSource('../migrations/20260108000000_extend_api_key_length_for_prefix.sql');
  const initialLength = Number(createTableSource.match(/`key` VARCHAR\((\d+)\)/)?.[1]);
  const extendedLength = Number(extensionSource.match(/`key` VARCHAR\((\d+)\)/)?.[1]);

  assert.equal(initialLength, 64);
  assert.ok(extendedLength >= 35);
});