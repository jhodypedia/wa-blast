import { Router } from 'express';
import {
  deleteSession,
  readSessionStatus,
  startSession,
} from '../controllers/session.controller.js';

const router = Router();

router.post('/start', startSession);
router.get('/:sessionId/status', readSessionStatus);
router.delete('/:sessionId', deleteSession);

export default router;