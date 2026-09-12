import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { swaggerSpec } from '../config/swagger.js';

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('generates a lowercase ps-prefixed key from 24 cryptographically random bytes', async () => {
  const source = await readSource('../services/apiKeyService.js');

  assert.match(source, /import \{ randomBytes, randomUUID \} from 'node:crypto';/);
  assert.match(source, /const API_KEY_RANDOM_BYTES = 24;/);
  assert.match(source, /const API_KEY_PREFIX = 'ps-';/);
  assert.match(source, /const keyId = randomUUID\(\);/);
  assert.match(source, /INSERT INTO api_keys \(id, \\`key\\`, label, owner_telegram_id, is_active\)/);
  assert.match(source, /`\$\{API_KEY_PREFIX\}\$\{randomBytes\(API_KEY_RANDOM_BYTES\)\.toString\('hex'\)\}`/);
});

test('migrates API key and session ownership IDs to UUID columns', async () => {
  const source = await readSource('../migrations/20260911000001_convert_api_key_ids_to_uuid.sql');

  assert.match(source, /ADD COLUMN uuid CHAR\(36\)/);
  assert.match(source, /SET uuid = UUID\(\)/);
  assert.match(source, /ADD COLUMN api_key_uuid CHAR\(36\)/);
  assert.match(source, /CHANGE COLUMN api_key_uuid api_key_id CHAR\(36\)/);
  assert.match(source, /FOREIGN KEY \(api_key_id\) REFERENCES api_keys \(id\)/);
});

test('Telegram API key controls accept UUID identifiers', async () => {
  const source = await readSource('../bot/handlers/apiKey.handlers.js');

  assert.match(source, /const API_KEY_ID_PATTERN = '\[0-9a-f\]\{8\}/);
  assert.match(source, /function parseApiKeyId\(value, name\)/);
  assert.match(source, /confirm_revoke_\(\$\{API_KEY_ID_PATTERN\}\)/);
});

test('validates the complete supplied key without parsing its prefix', async () => {
  const source = await readSource('../services/apiKeyService.js');

  assert.match(source, /WHERE \\`key\\` = \? AND is_active = TRUE[\s\S]*\[rawKey\]/);
});

test('auth accepts new lowercase keys while preserving legacy formats', async () => {
  const source = await readSource('../middlewares/apiKeyAuth.js');

  assert.match(source, /LEGACY_API_KEY_PATTERN = \/\^\[A-Za-z0-9_-\]\{32\}\$\//);
  assert.match(source, /PREFIXED_API_KEY_PATTERN = \/\^ps-\(\?:\[A-Za-z0-9_-\]\{32\}\|\[a-f0-9\]\{48\}\)\$\//);
  assert.ok(source.indexOf('PREFIXED_API_KEY_PATTERN.test(rawKey)') < source.indexOf('validateApiKey(rawKey)'));
});

test('Telegram masking and Swagger document the lowercase key format', async () => {
  const source = await readSource('../bot/handlers/apiKey.handlers.js');
  const securityScheme = swaggerSpec.components.securitySchemes.ApiKeyAuth;

  assert.match(source, /key\.startsWith\('ps-'\) \? 7 : 4/);
  assert.match(securityScheme.description, /ps-7f3a9c2e1b8d4f60a5c3e9b21d84f6a0c7e3b5f912d84a6c/);
});

test('the API key database column holds the prefix and random portion', async () => {
  const createTableSource = await readSource('../migrations/20260101000001_create_api_keys_table.sql');
  const extensionSource = await readSource('../migrations/20260108000000_extend_api_key_length_for_prefix.sql');
  const lowercaseHexExtensionSource = await readSource('../migrations/20260911000000_extend_api_key_length_for_lowercase_hex.sql');
  const initialLength = Number(createTableSource.match(/`key` VARCHAR\((\d+)\)/)?.[1]);
  const extendedLength = Number(extensionSource.match(/`key` VARCHAR\((\d+)\)/)?.[1]);
  const lowercaseHexLength = Number(lowercaseHexExtensionSource.match(/`key` VARCHAR\((\d+)\)/)?.[1]);

  assert.equal(initialLength, 64);
  assert.ok(extendedLength >= 35);
  assert.ok(lowercaseHexLength >= 51);
});