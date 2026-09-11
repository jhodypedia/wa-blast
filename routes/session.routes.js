import { Router } from 'express';
import {
  deleteSession,
  readSessionList,
  readSessionStatus,
  startPairingSession,
  startSession,
} from '../controllers/session.controller.js';
import { jsonBody, sessionLimitResponse, sessionOperation } from './openapi.js';

const router = Router();

/** @openapi
 * /session/start/qr:
 *   post:
 *     operationId: startQrSession
 *     x-operation: sessionStartQr
 */
router.post('/start/qr', startSession);
router.post('/start', startSession);

/** @openapi
 * /session/start/pairing:
 *   post:
 *     operationId: startPairingSession
 *     x-operation: sessionStartPairing
 */
router.post('/start/pairing', startPairingSession);

/** @openapi
 * /session/list:
 *   get:
 *     operationId: listSessions
 *     x-operation: sessionList
 */
router.get('/list', readSessionList);

/** @openapi
 * /session/{sessionId}/status:
 *   get:
 *     operationId: getSessionStatus
 *     x-operation: sessionStatus
 */
router.get('/:sessionId/status', readSessionStatus);

/** @openapi
 * /session/{sessionId}:
 *   delete:
 *     operationId: deleteSession
 *     x-operation: sessionDelete
 */
router.delete('/:sessionId', deleteSession);

export const openapiOperations = {
  sessionStartQr: sessionOperation('Start a session and return its QR code', {
    description: 'Creates a QR session when the API key has fewer than 5 active or pending sessions.',
    requestBody: jsonBody('SessionStart'),
    successStatus: 201,
    successExample: { sessionId: '42-V1StGXR8', status: 'qr_pending', qr: 'data:image/png;base64,...' },
    responses: { 400: sessionLimitResponse },
  }),
  sessionStartPairing: sessionOperation('Start a session and request a pairing code', {
    description: 'Creates a pairing-code session when the API key has fewer than 5 active or pending sessions.',
    requestBody: jsonBody('PairingStart'),
    successStatus: 201,
    successExample: { sessionId: '42-V1StGXR8', status: 'pairing_pending', pairingCode: 'ABCD1234' },
    responses: { 400: sessionLimitResponse },
  }),
  sessionList: sessionOperation('List sessions and quota usage for the current API key', {
    successSchema: 'SessionListResponse',
    successExample: {
      sessions: [{
        id: '42-V1StGXR8',
        label: 'Store support',
        connection_method: 'qr',
        status: 'connected',
        created_at: '2026-04-01T12:00:00.000Z',
      }],
      activeCount: 1,
      maxAllowed: 5,
    },
  }),
  sessionStatus: sessionOperation('Get session status', {
    parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { $ref: '#/components/schemas/SessionId' } }],
    successExample: { sessionId: '42-V1StGXR8', status: 'connected', connection_method: 'pairing_code', qr: null },
  }),
  sessionDelete: sessionOperation('Log out and delete a session', {
    parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' } }],
  }),
};

export default router;