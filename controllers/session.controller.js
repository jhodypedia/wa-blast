import { z } from 'zod';
import pino from 'pino';
import {
  countActiveSessions,
  createSession,
  createSessionWithPairingCode,
  generateSessionId,
  getSessionStatus,
  listSessions,
  logoutSession,
  MAX_ACTIVE_SESSIONS,
  SessionLimitError,
  SessionOwnershipError,
  waitForSessionReady,
} from '../services/sessionManager.js';

const logger = pino().child({ service: 'session-controller' });

const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const labelSchema = z.string().trim().min(1).max(100).optional();
const startSchema = z.object({ label: labelSchema }).strict();
const pairingSchema = z.object({
  label: labelSchema,
  phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/),
}).strict();
const CUSTOM_PAIRING_CODE_MESSAGE = 'Custom pairing code is not supported - a code will be auto-generated';

function sendError(response, error) {
  if (error instanceof z.ZodError) {
    return response.status(400).json({
      error: 'Invalid request',
      details: error.issues,
    });
  }
  if (error instanceof SessionOwnershipError) {
    return response.status(403).json({ error: error.message });
  }
  if (error instanceof SessionLimitError) {
    return response.status(400).json({ success: false, error: error.message });
  }
  const message = typeof error?.message === 'string' ? error.message : '';
  if (message === 'Session not found') {
    return response.status(404).json({ error: message });
  }
  const upstreamStatus = typeof error === 'number'
    ? error
    : error?.output?.statusCode ?? error?.statusCode;
  if (message.includes('Timed out') || upstreamStatus === 408) {
    return response.status(504).json({ error: message || 'WhatsApp request timed out' });
  }
  if (upstreamStatus === 428 || upstreamStatus === 503 || upstreamStatus === 1006) {
    logger.warn({ error }, 'WhatsApp connection unavailable');
    return response.status(503).json({
      error: 'WhatsApp connection unavailable. Retry the session request.',
    });
  }
  logger.error({ error }, 'Session operation failed');
  return response.status(500).json({ error: 'Session operation failed' });
}

export async function startSession(request, response) {
  try {
    const { label } = startSchema.parse(request.body);
    const apiKeyId = request.apiKey.id;
    const sessionId = await generateSessionId(apiKeyId);
    await createSession(sessionId, apiKeyId, label);
    const session = await waitForSessionReady(sessionId, apiKeyId);
    return response.status(201).json({ sessionId, status: session.status, qr: session.qrCode });
  } catch (error) {
    return sendError(response, error);
  }
}

export async function startPairingSession(request, response) {
  try {
    if (Object.hasOwn(request.body ?? {}, 'customCode')) {
      return response.status(400).json({ error: CUSTOM_PAIRING_CODE_MESSAGE });
    }

    const { label, phoneNumber } = pairingSchema.parse(request.body);
    const sessionId = await generateSessionId(request.apiKey.id);
    const pairingCode = await createSessionWithPairingCode(
      sessionId,
      request.apiKey.id,
      phoneNumber,
      label,
    );
    return response.status(201).json({ sessionId, status: 'pairing_pending', pairingCode });
  } catch (error) {
    return sendError(response, error);
  }
}

export async function readSessionList(request, response) {
  try {
    const apiKeyId = request.apiKey.id;
    const [sessions, activeCount] = await Promise.all([
      listSessions(apiKeyId),
      countActiveSessions(apiKeyId),
    ]);
    return response.json({ sessions, activeCount, maxAllowed: MAX_ACTIVE_SESSIONS });
  } catch (error) {
    return sendError(response, error);
  }
}

export async function readSessionStatus(request, response) {
  try {
    const sessionId = sessionIdSchema.parse(request.params.sessionId);
    const apiKeyId = request.apiKey.id;
    const session = await getSessionStatus(sessionId, apiKeyId);
    if (!session) {
      return response.status(404).json({ error: 'Session not found' });
    }
    return response.json({
      sessionId,
      status: session.status,
      connection_method: session.connectionMethod,
      qr: session.qrCode,
      lastDisconnectReason: session.lastDisconnectReason,
      reconnectAttempts: session.reconnectAttempts,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    return sendError(response, error);
  }
}

export async function deleteSession(request, response) {
  try {
    const sessionId = sessionIdSchema.parse(request.params.sessionId);
    const apiKeyId = request.apiKey.id;
    const removed = await logoutSession(sessionId, apiKeyId);
    if (!removed) {
      return response.status(404).json({ error: 'Session not found' });
    }
    return response.json({ sessionId, status: 'logged_out' });
  } catch (error) {
    return sendError(response, error);
  }
}