import { z } from 'zod';
import {
  createSession,
  getSessionStatus,
  logoutSession,
  waitForSessionReady,
} from '../services/sessionManager.js';

const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const startSchema = z.object({ sessionId: sessionIdSchema }).strict();
const apiKeyIdSchema = z.coerce.number().int().positive();

function getApiKeyId(request) {
  return apiKeyIdSchema.parse(request.apiKeyId ?? request.get('x-api-key-id'));
}

function sendError(response, error) {
  if (error instanceof z.ZodError) {
    return response.status(400).json({
      error: 'Invalid request. Provide sessionId and temporary x-api-key-id until API key authentication is added.',
      details: error.issues,
    });
  }
  if (error.message.includes('another API key')) {
    return response.status(409).json({ error: error.message });
  }
  if (error.message === 'Session not found') {
    return response.status(404).json({ error: error.message });
  }
  if (error.message.includes('Timed out')) {
    return response.status(504).json({ error: error.message });
  }
  return response.status(500).json({ error: 'Session operation failed' });
}

export async function startSession(request, response) {
  try {
    const { sessionId } = startSchema.parse(request.body);
    const apiKeyId = getApiKeyId(request);
    await createSession(sessionId, apiKeyId);
    const session = await waitForSessionReady(sessionId, apiKeyId);
    return response.status(201).json({ sessionId, status: session.status, qr: session.qrCode });
  } catch (error) {
    return sendError(response, error);
  }
}

export async function readSessionStatus(request, response) {
  try {
    const sessionId = sessionIdSchema.parse(request.params.sessionId);
    const apiKeyId = getApiKeyId(request);
    const session = await getSessionStatus(sessionId, apiKeyId);
    if (!session) {
      return response.status(404).json({ error: 'Session not found' });
    }
    return response.json({
      sessionId,
      status: session.status,
      qr: session.qrCode,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    return sendError(response, error);
  }
}

export async function deleteSession(request, response) {
  try {
    const sessionId = sessionIdSchema.parse(request.params.sessionId);
    const apiKeyId = getApiKeyId(request);
    const removed = await logoutSession(sessionId, apiKeyId);
    if (!removed) {
      return response.status(404).json({ error: 'Session not found' });
    }
    return response.json({ sessionId, status: 'logged_out' });
  } catch (error) {
    return sendError(response, error);
  }
}