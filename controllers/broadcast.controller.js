import { z } from 'zod';
import {
  broadcastIdSchema,
  broadcastMessageSchema,
} from '../middlewares/validators/broadcast.validator.js';
import {
  createBroadcast,
  getBroadcastStatus,
  processBroadcast,
  validateBroadcastContent,
} from '../services/broadcastService.js';
import { getSession } from '../services/sessionManager.js';

function failure(response, status, message, details) {
  return response.status(status).json({
    success: false,
    data: null,
    error: details ? { message, details } : { message },
  });
}

export async function postBroadcast(request, response) {
  try {
    const payload = broadcastMessageSchema.parse(request.body);
    validateBroadcastContent(payload);

    const socket = getSession(payload.sessionId);
    if (!socket) {
      return failure(response, 404, 'Session is not active');
    }

    const broadcast = await createBroadcast(payload);
    if (!broadcast) {
      return failure(response, 404, 'Session was not found in the database');
    }

    const processingPayload = { ...payload, broadcastId: broadcast.broadcastId };
    setImmediate(() => {
      processBroadcast(socket, processingPayload, broadcast.rows).catch((error) => {
        console.error('Broadcast processing stopped unexpectedly', error);
      });
    });

    return response.status(202).json({
      success: true,
      data: { broadcastId: broadcast.broadcastId },
      error: null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(response, 400, 'Invalid broadcast payload', error.issues);
    }
    return failure(response, 500, 'Could not create broadcast');
  }
}

export async function readBroadcastStatus(request, response) {
  try {
    const broadcastId = broadcastIdSchema.parse(request.params.broadcast_id);
    const status = await getBroadcastStatus(broadcastId);
    if (!status) {
      return failure(response, 404, 'Broadcast was not found');
    }
    return response.json({ success: true, data: status, error: null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(response, 400, 'Invalid broadcast ID', error.issues);
    }
    return failure(response, 500, 'Could not read broadcast status');
  }
}