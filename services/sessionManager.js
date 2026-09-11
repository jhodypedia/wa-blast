import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@rexxhayanasi/elaina-baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { pool } from '../config/database.js';

const logger = pino().child({ service: 'session-manager' });
const sessions = new Map();
const sessionsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'sessions',
);

function validateSessionId(sessionId) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) {
    throw new Error('sessionId must contain only letters, numbers, underscores, or hyphens');
  }
}

function getDisconnectStatusCode(error) {
  return error?.output?.statusCode ?? error?.statusCode;
}

async function updateStatus(sessionId, apiKeyId, status) {
  await pool.execute(
    'UPDATE sessions SET status = ? WHERE session_name = ? AND api_key_id = ?',
    [status, sessionId, apiKeyId],
  );
}

function notifyReady(record, error = null) {
  for (const waiter of record.readyWaiters) {
    clearTimeout(waiter.timer);
    if (error) {
      waiter.reject(error);
    } else {
      waiter.resolve({ status: record.status, qrCode: record.qrCode });
    }
  }
  record.readyWaiters.clear();
}

async function connect(record) {
  const authPath = path.join(sessionsRoot, record.sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const socket = makeWASocket({
    auth: state,
    logger: logger.child({ sessionId: record.sessionId }),
    printQRInTerminal: false,
  });

  record.socket = socket;
  socket.ev.on('creds.update', saveCreds);
  socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (sessions.get(record.sessionId) !== record || record.socket !== socket) {
      return;
    }

    try {
      if (qr) {
        const qrCode = await QRCode.toDataURL(qr);
        if (record.socket !== socket) {
          return;
        }
        record.qrCode = qrCode;
        record.status = 'qr_pending';
        await updateStatus(record.sessionId, record.apiKeyId, record.status);
        notifyReady(record);
      }

      if (connection === 'open') {
        record.status = 'connected';
        record.qrCode = null;
        record.reconnectAttempts = 0;
        await updateStatus(record.sessionId, record.apiKeyId, record.status);
        notifyReady(record);
      }

      if (connection === 'close') {
        record.socket = null;
        const statusCode = getDisconnectStatusCode(lastDisconnect?.error);
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (record.manualLogout || loggedOut) {
          record.status = 'logged_out';
          await updateStatus(record.sessionId, record.apiKeyId, record.status);
          notifyReady(record, new Error('WhatsApp session was logged out'));
          return;
        }

        record.status = 'disconnected';
        await updateStatus(record.sessionId, record.apiKeyId, record.status);
        scheduleReconnect(record);
      }
    } catch (error) {
      logger.error({ error, sessionId: record.sessionId }, 'Connection update failed');
    }
  });

  return socket;
}

function scheduleReconnect(record) {
  if (record.reconnectTimer || record.manualLogout) {
    return;
  }

  const delay = Math.min(1000 * (2 ** record.reconnectAttempts), 30000);
  record.reconnectAttempts += 1;
  record.reconnectTimer = setTimeout(async () => {
    record.reconnectTimer = null;
    if (sessions.get(record.sessionId) !== record || record.manualLogout) {
      return;
    }

    try {
      await connect(record);
    } catch (error) {
      logger.error({ error, sessionId: record.sessionId }, 'Session reconnect failed');
      scheduleReconnect(record);
    }
  }, delay);
}

export async function createSession(sessionId, apiKeyId) {
  validateSessionId(sessionId);
  const ownerId = String(apiKeyId);
  const existing = sessions.get(sessionId);

  if (existing) {
    if (existing.apiKeyId !== ownerId) {
      throw new Error('Session ID is already owned by another API key');
    }
    return existing.socket;
  }

  const [owners] = await pool.execute(
    'SELECT api_key_id FROM sessions WHERE session_name = ? LIMIT 1',
    [sessionId],
  );
  if (owners.length > 0 && String(owners[0].api_key_id) !== ownerId) {
    throw new Error('Session ID is already owned by another API key');
  }

  await pool.execute(
    `INSERT INTO sessions (session_name, api_key_id, status)
     VALUES (?, ?, 'qr_pending')
     ON DUPLICATE KEY UPDATE status = 'qr_pending', updated_at = CURRENT_TIMESTAMP`,
    [sessionId, ownerId],
  );

  const record = {
    sessionId,
    apiKeyId: ownerId,
    socket: null,
    status: 'qr_pending',
    qrCode: null,
    manualLogout: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
    readyWaiters: new Set(),
  };
  sessions.set(sessionId, record);

  try {
    return await connect(record);
  } catch (error) {
    sessions.delete(sessionId);
    await updateStatus(sessionId, ownerId, 'disconnected');
    throw error;
  }
}

export function getSession(sessionId) {
  return sessions.get(sessionId)?.socket ?? null;
}

export async function waitForSessionReady(sessionId, apiKeyId, timeoutMs = 60000) {
  const record = sessions.get(sessionId);
  if (!record || record.apiKeyId !== String(apiKeyId)) {
    throw new Error('Session not found');
  }
  if (record.qrCode || record.status === 'connected') {
    return { status: record.status, qrCode: record.qrCode };
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        record.readyWaiters.delete(waiter);
        reject(new Error('Timed out waiting for a QR code'));
      }, timeoutMs),
    };
    record.readyWaiters.add(waiter);
  });
}

export async function getSessionStatus(sessionId, apiKeyId) {
  validateSessionId(sessionId);
  const ownerId = String(apiKeyId);
  const [rows] = await pool.execute(
    'SELECT status, updated_at FROM sessions WHERE session_name = ? AND api_key_id = ? LIMIT 1',
    [sessionId, ownerId],
  );
  if (rows.length === 0) {
    return null;
  }

  const record = sessions.get(sessionId);
  return {
    status: record?.apiKeyId === ownerId ? record.status : rows[0].status,
    qrCode: record?.apiKeyId === ownerId ? record.qrCode : null,
    updatedAt: rows[0].updated_at,
  };
}

export async function logoutSession(sessionId, apiKeyId) {
  validateSessionId(sessionId);
  const ownerId = String(apiKeyId);
  const current = await getSessionStatus(sessionId, ownerId);
  if (!current) {
    return false;
  }

  const record = sessions.get(sessionId);
  let logoutError = null;
  if (record?.apiKeyId === ownerId) {
    record.manualLogout = true;
    clearTimeout(record.reconnectTimer);
    try {
      await record.socket?.logout('API-requested logout');
    } catch (error) {
      logoutError = error;
      logger.warn({ error, sessionId }, 'WhatsApp logout request failed');
    }
    notifyReady(record, new Error('WhatsApp session was logged out'));
    sessions.delete(sessionId);
  }

  await rm(path.join(sessionsRoot, sessionId), { recursive: true, force: true });
  await updateStatus(sessionId, ownerId, 'logged_out');

  if (logoutError) {
    throw logoutError;
  }
  return true;
}