import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { swaggerSpec } from '../config/swagger.js';
import { sessionOperation } from '../routes/openapi.js';

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('custom pairing code requests are explicitly rejected', async () => {
  const { startPairingSession } = await import('../controllers/session.controller.js');
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await startPairingSession({ body: { phoneNumber: '+15551234567', customCode: 'SALE2026' } }, response);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Custom pairing code is not supported - a code will be auto-generated');
});

test('socket close code 1006 is reported as a retryable connection failure', async () => {
  const source = await readSource('../controllers/session.controller.js');

  assert.match(source, /typeof error === 'number'/);
  assert.match(source, /upstreamStatus === 1006/);
  assert.match(source, /WhatsApp connection unavailable\. Retry the session request\./);
});

test('session connections refresh the WhatsApp Web version and retain upstream failures', async () => {
  const source = await readSource('../services/sessionManager.js');

  assert.match(source, /fetchLatestWaWebVersion/);
  assert.match(source, /const versionResult = await fetchLatestWaWebVersion\(\)/);
  assert.match(source, /if \(!versionResult\.isLatest\)/);
  assert.match(source, /UPSTREAM_FAILURE_REASON/);
  assert.match(source, /error\?\.data\?\.reason/);
});

test('Swagger documents only auto-generated pairing codes', () => {
  const pairingStart = swaggerSpec.components.schemas.PairingStart;
  const operation = swaggerSpec.paths['/session/start/pairing'].post;

  assert.equal(pairingStart.properties.customCode, undefined);
  assert.match(operation.description, /generated automatically/);
});

test('Swagger documents the retryable WhatsApp connection failure', () => {
  const operation = sessionOperation('Test session operation');
  const response = operation.responses[503];

  assert.equal(response.description, 'WhatsApp connection closed before the request completed; retry the request.');
  assert.equal(response.content['application/json'].example.error, 'WhatsApp connection unavailable. Retry the session request.');
});

test('session reconnect policy distinguishes terminal and retryable disconnects', async () => {
  const source = await readSource('../services/sessionManager.js');

  assert.match(source, /MAX_RECONNECT_ATTEMPTS = 10/);
  assert.match(source, /MAX_RECONNECT_DELAY_MS = 60000/);
  assert.match(source, /DisconnectReason\.connectionReplaced/);
  assert.match(source, /DisconnectReason\.restartRequired/);
  assert.match(source, /DisconnectReason\.unavailableService/);
  assert.match(source, /WHERE status IN \('connected', 'reconnecting'\)/);
});

test('only classified recoverable disconnects use the reconnect policy', async () => {
  const source = await readSource('../services/sessionManager.js');

  assert.match(
    source,
    /if \(!RECOVERABLE_DISCONNECT_REASONS\.has\(statusCode\)\) \{[\s\S]*?await abandonSession\(record, reason\);[\s\S]*?return;[\s\S]*?scheduleReconnect\(record\);/,
  );
});

test('Swagger documents session reconnect diagnostics', () => {
  const response = swaggerSpec.paths['/session/{sessionId}/status'].get.responses[200];
  const schema = swaggerSpec.components.schemas.SessionStatusResponse;

  assert.equal(response.content['application/json'].schema.$ref, '#/components/schemas/SessionStatusResponse');
  assert.ok(schema.properties.status.enum.includes('disconnected'));
  assert.ok(schema.properties.status.enum.includes('terminated'));
  assert.equal(schema.properties.lastDisconnectReason.nullable, true);
  assert.equal(schema.properties.reconnectAttempts.maximum, 10);
});

test('pairing requests use the package auto-generation signature', async () => {
  const source = await readSource('../services/sessionManager.js');

  assert.match(source, /createSessionWithPairingCode\(\s*sessionId,\s*apiKeyId,\s*phoneNumber,\s*label,\s*\)/);
  assert.match(source, /async function requestPairingCode\(record, phoneNumber\)/);
  assert.match(source, /const normalizedNumber = phoneNumber\.replace\(\/\\D\/g, ''\)/);
  assert.match(source, /socket\.requestPairingCode\(normalizedNumber\)/);
  assert.doesNotMatch(source, /customCode/);
});

test('pairing-code requests retry recoverable socket failures', async () => {
  const source = await readSource('../services/sessionManager.js');

  assert.match(source, /const classification = classifyPairingError\(error\)/);
  assert.match(source, /classification\.retry === 'none'/);
  assert.match(source, /classification\.retry === 'cancel-and-retry'/);
  assert.match(source, /const deadline = Date\.now\(\) \+ SESSION_AUTH_TIMEOUT_MS;/);
});

test('pairing requests the code directly after transport readiness', async () => {
  const source = await readSource('../services/sessionManager.js');
  const requestPairingCodeSource = source.slice(
    source.indexOf('async function requestPairingCode'),
    source.indexOf('function scheduleReconnect'),
  );

  assert.match(
    requestPairingCodeSource,
    /await waitForSocketOpen[\s\S]*?return await socket\.requestPairingCode/,
  );
  assert.doesNotMatch(requestPairingCodeSource, /waitForConnectionUpdate/);
});

test('successful pairing survives the expected post-registration socket restart', async () => {
  const source = await readSource('../services/sessionManager.js');

  assert.match(source, /if \(isNewLogin\) \{\s*clearTimeout\(record\.expireTimer\);\s*record\.expireTimer = null;/);
});

test('pairing waits for the transport socket without requiring authentication', async () => {
  const source = await readSource('../services/sessionManager.js');
  const waitForSocketOpenSource = source.slice(
    source.indexOf('async function waitForSocketOpen'),
    source.indexOf('async function requestPairingCode'),
  );

  assert.match(waitForSocketOpenSource, /await socket\.waitForSocketOpen\(\);/);
  assert.doesNotMatch(waitForSocketOpenSource, /socket\.waitForConnectionUpdate/);
  assert.match(source, /getDisconnectStatusCode\(error\) !== undefined \|\| record\.socket !== socket/);
  assert.match(source, /const socketError = createSocketConnectionError\(record, error\);/);
  assert.match(source, /if \(!RECOVERABLE_DISCONNECT_REASONS\.has\(socketError\.statusCode\)\) \{\s*throw socketError;/);
  assert.match(source, /if \(error\.isSocketConnectionError\) \{\s*throw error;/);
});

test('the local pairing client waits longer than the server authentication deadline', async () => {
  const source = await readSource('../test-curl.js');

  assert.match(source, /timeout: 70_000/);
});

test('confirmed WhatsApp connection failures are reported as upstream rejections', async () => {
  const source = await readSource('../controllers/session.controller.js');

  assert.match(source, /upstreamStatus === 401 \|\| upstreamStatus === 500/);
  assert.doesNotMatch(source, /message\.includes\('Timed out'\) \|\| upstreamStatus === 408/);
});