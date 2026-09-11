import { Router } from 'express';
import { readBroadcastStatus } from '../controllers/broadcast.controller.js';
import { broadcastOperation } from './openapi.js';

const router = Router();

/** @openapi
 * /broadcast/{broadcast_id}/status:
 *   get:
 *     operationId: getBroadcastStatus
 *     x-operation: broadcastStatus
 */
router.get('/:broadcast_id/status', readBroadcastStatus);

export const openapiOperations = {
	broadcastStatus: broadcastOperation('Get broadcast delivery progress', {
		parameters: [{ name: 'broadcast_id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 }, example: 42 }],
	}),
};

export default router;