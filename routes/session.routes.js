import { Router } from 'express';
import {
  deleteSession,
  readSessionStatus,
  startPairingSession,
  startSession,
} from '../controllers/session.controller.js';
import { jsonBody, sessionOperation } from './openapi.js';

const router = Router();

/** @openapi
 * /session/start:
 *   post:
 *     operationId: startQrSession
 *     x-operation: sessionStartQr
 */
router.post('/start', startSession);

/** @openapi
 * /session/pairing:
 *   post:
 *     operationId: startPairingSession
 *     x-operation: sessionStartPairing
 */
router.post('/pairing', startPairingSession);

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
    requestBody: jsonBody('SessionStart'),
    successStatus: 201,
    successExample: { sessionId: 'sales', status: 'qr_pending', qr: 'data:image/png;base64,...' },
  }),
  sessionStartPairing: sessionOperation('Start a session and request a pairing code', {
    requestBody: jsonBody('PairingStart'),
    successStatus: 201,
    successExample: { sessionId: 'sales', status: 'pairing_pending', pairingCode: 'ABCD1234' },
  }),
  sessionStatus: sessionOperation('Get session status', {
    parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { $ref: '#/components/schemas/SessionStart/properties/sessionId' } }],
  }),
  sessionDelete: sessionOperation('Log out and delete a session', {
    parameters: [{ name: 'sessionId', in: 'path', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$' } }],
  }),
};

export default router;