import assert from 'node:assert/strict';
import test from 'node:test';
import { swaggerSpec } from '../config/swagger.js';
import { generateSessionId, listSessions } from '../services/sessionManager.js';

test('generates collision-safe IDs prefixed by the API key ID', async () => {
  const checkedIds = [];
  const database = {
    async execute(_query, [sessionId]) {
      checkedIds.push(sessionId);
      return [checkedIds.length === 1 ? [{}] : []];
    },
  };

  const sessionId = await generateSessionId(42, database);

  assert.equal(checkedIds.length, 2);
  assert.match(sessionId, /^42-[A-Za-z0-9_-]{8}$/);
  assert.notEqual(checkedIds[0], sessionId);
});

test('lists sessions using only the authenticated API key ID', async () => {
  const expectedRows = [{ id: '42-V1StGXR8', label: 'Store support' }];
  const calls = [];
  const database = {
    async execute(query, parameters) {
      calls.push({ query, parameters });
      return [expectedRows];
    },
  };

  const rows = await listSessions(42, database);

  assert.deepEqual(rows, expectedRows);
  assert.match(calls[0].query, /WHERE api_key_id = \?/);
  assert.deepEqual(calls[0].parameters, ['42']);
});

test('session routes generate IDs and register listing before parameter routes', async () => {
  const controllerSource = await import('node:fs/promises')
    .then(({ readFile }) => readFile(new URL('../controllers/session.controller.js', import.meta.url), 'utf8'));
  const routeSource = await import('node:fs/promises')
    .then(({ readFile }) => readFile(new URL('../routes/session.routes.js', import.meta.url), 'utf8'));

  assert.match(controllerSource, /generateSessionId\(request\.apiKey\.id\)/);
  assert.doesNotMatch(controllerSource, /startSchema[\s\S]*sessionId:\s*sessionIdSchema/);
  assert.ok(routeSource.indexOf("router.get('/list'") < routeSource.indexOf("router.get('/:sessionId/status'"));
});

test('OpenAPI removes client-provided IDs and documents labels and tenant listing', () => {
  const { schemas } = swaggerSpec.components;

  assert.deepEqual(schemas.SessionStart.required, []);
  assert.equal(Object.hasOwn(schemas.SessionStart.properties, 'sessionId'), false);
  assert.equal(schemas.SessionStart.properties.label.maxLength, 100);
  assert.deepEqual(schemas.PairingStart.required, ['phoneNumber']);
  assert.equal(Object.hasOwn(schemas.PairingStart.properties, 'sessionId'), false);
  assert.equal(schemas.SessionListItem.properties.id.example, '42-V1StGXR8');
  assert.equal(
    swaggerSpec.paths['/session/list'].get.responses[200]
      .content['application/json'].schema.$ref,
    '#/components/schemas/SessionListResponse',
  );
});