import { Router } from 'express';
import { readBroadcastStatus } from '../controllers/broadcast.controller.js';

const router = Router();

router.get('/:broadcast_id/status', readBroadcastStatus);

export default router;