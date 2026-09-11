import { access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@rexxhayanasi/elaina-baileys';
import { nanoid } from 'nanoid';
import pino from 'pino';
import QRCode from 'qrcode';
import { pool } from '../config/database.js';

const logger = pino().child({ service: 'session-manager' });
const sessions = new Map();
export const MAX_ACTIVE_SESSIONS = 5;
export const SESSION_AUTH_TIMEOUT_MS = 60000;
export const MAX_RECONNECT_ATTEMPTS = 10;
export const MAX_RECONNECT_DELAY_MS = 60000;
export const SESSION_LIMIT_MESSAGE = 'Maximum of 5 active sessions reached for this API key. Please log out or wait for an existing session to expire before creating a new one.';
const ACTIVE_SESSION_STATUSES = ['qr_pending', 'pairing_pending', 'connected', 'reconnecting'];
const RECOVERABLE_DISCONNECT_REASONS = new Set([
  DisconnectReason.connectionClosed,
  DisconnectReason.connectionLost,
  DisconnectReason.timedOut,
  DisconnectReason.restartRequired,
  DisconnectReason.unavailableService,
  1006,
]);
const TERMINAL_DISCONNECT_REASONS = new Set([
  DisconnectReason.loggedOut,
  DisconnectReason.badSession,
  DisconnectReason.connectionReplaced,
  DisconnectReason.multideviceMismatch,
  DisconnectReason.forbidden,
]);
const DISCONNECT_REASON_NAMES = new Map([
  [DisconnectReason.connectionClosed, 'connectionClosed'],
  [DisconnectReason.connectionLost, 'connectionLost/timedOut'],
  [DisconnectReason.connectionReplaced, 'connectionReplaced'],
  [DisconnectReason.loggedOut, 'loggedOut'],
  [DisconnectReason.badSession, 'badSession'],
  [DisconnectReason.restartRequired, 'restartRequired'],
  [DisconnectReason.multideviceMismatch, 'multideviceMismatch'],
  [DisconnectReason.forbidden, 'forbidden'],
  [DisconnectReason.unavailableService, 'unavailableService'],
  [1006, 'websocketAbnormalClosure'],
]);
const sessionsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'sessions',
);

export class SessionOwnershipError extends Error {
  constructor() {
    super('Session belongs to a different API key');
    this.name = 'SessionOwnershipError';
  }
}

export class SessionLimitError extends Error {
  constructor() {
    super(SESSION_LIMIT_MESSAGE);
    this.name = 'SessionLimitError';
  }
}

function validateSessionId(sessionId) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(sessionId)) {
    throw new Error('sessionId must contain only letters, numbers, underscores, or hyphens');
  }
}

export async function generateSessionId(apiKeyId, database = pool) {
  const ownerId = String(apiKeyId);

  while (true) {
    const sessionId = `${ownerId}-${nanoid(8)}`;
    const [rows] = await database.execute(
      'SELECT 1 FROM sessions WHERE session_name = ? LIMIT 1',
      [sessionId],
    );
    if (rows.length === 0) {
      return sessionId;
    }
  }
}

export function getSessionAuthPath(sessionId, apiKeyId) {
  validateSessionId(sessionId);
  const ownerId = String(apiKeyId);
  const prefix = `${ownerId}-`;
  const suffix = sessionId.startsWith(prefix) ? sessionId.slice(prefix.length) : sessionId;
  return path.join(sessionsRoot, ownerId, suffix);
}

export async function countActiveSessions(apiKeyId, database = pool) {
  const [rows] = await database.execute(
    `SELECT COUNT(*) AS active_count
     FROM sessions
     WHERE api_key_id = ? AND status IN (?, ?, ?)`,
    [String(apiKeyId), ...ACTIVE_SESSION_STATUSES],
  );
  return Number(rows[0]?.active_count ?? 0);
}

export function getDisconnectStatusCode(error) {
  return typeof error === 'number' ? error : error?.output?.statusCode ?? error?.statusCode;
}

export function getDisconnectReasonName(statusCode) {
  return DISCONNECT_REASON_NAMES.get(statusCode) ?? `unknown(${statusCode ?? 'none'})`;
}

export function getReconnectDelay(attempt) {
  return Math.min(1000 * (2 ** Math.max(0, attempt - 1)), MAX_RECONNECT_DELAY_MS);
}

export function isTerminalDisconnectReason(statusCode) {
  return TERMINAL_DISCONNECT_REASONS.has(statusCode);
}

async function updateStatus(sessionId, apiKeyId, status, details = {}) {
  const fields = ['status = ?'];
  const values = [status];
  if (details.lastDisconnectReason !== undefined) {
    fields.push('last_disconnect_reason = ?');
    values.push(details.lastDisconnectReason);
  }
  if (details.reconnectAttempts !== undefined) {
    fields.push('reconnect_attempts = ?');
    values.push(details.reconnectAttempts);
  }
  await pool.execute(
    `UPDATE sessions SET ${fields.join(', ')} WHERE session_name = ? AND api_key_id = ?`,
    [...values, sessionId, apiKeyId],
  );
}

function sessionState(record) {
  return {
    status: record.status,
    qrCode: record.qrCode,
    pairingCode: record.pairingCode,
  };
}

function notifyReady(record, error = null) {
  for (const waiter of record.readyWaiters) {
    clearTimeout(waiter.timer);
    if (error) {
      waiter.reject(error);
    } else {
      waiter.resolve(sessionState(record));
    }
  }
  record.readyWaiters.clear();
}

async function connect(record) {
  const authPath = getSessionAuthPath(record.sessionId, record.apiKeyId);
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
      if (qr && record.connectionMethod === 'qr') {
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
        clearTimeout(record.expireTimer);
        record.expireTimer = null;
        record.status = 'connected';
        record.wasConnected = true;
        record.qrCode = null;
        record.pairingCode = null;
        record.reconnectAttempts = 0;
        await updateStatus(record.sessionId, record.apiKeyId, record.status, { reconnectAttempts: 0 });
        notifyReady(record);
      }

      if (connection === 'close') {
        record.socket = null;
        const statusCode = getDisconnectStatusCode(lastDisconnect?.error);
        const reason = getDisconnectReasonName(statusCode);

        if (record.manualLogout || isTerminalDisconnectReason(statusCode)) {
          const terminalStatus = record.manualLogout || statusCode === DisconnectReason.loggedOut
            ? 'logged_out'
            : 'terminated';
          if (statusCode === DisconnectReason.connectionReplaced) {
            logger.warn({ sessionId: record.sessionId, reason }, 'WhatsApp session was replaced by another connection');
          }
          await terminateSession(record, terminalStatus, reason);
          return;
        }

        if (!record.wasConnected) {
          return;
        }

        record.lastDisconnectReason = reason;
        record.status = 'reconnecting';
        await updateStatus(record.sessionId, record.apiKeyId, record.status, {
          lastDisconnectReason: reason,
          reconnectAttempts: record.reconnectAttempts,
        });
        if (RECOVERABLE_DISCONNECT_REASONS.has(statusCode)) {
          scheduleReconnect(record);
        } else {
          logger.warn({ sessionId: record.sessionId, statusCode, reason }, 'Unknown disconnect reason; retrying session');
          scheduleReconnect(record);
        }
      }
    } catch (error) {
      logger.error({ error, sessionId: record.sessionId }, 'Connection update failed');
    }
  });

  return socket;
}

async function expirePendingSession(record) {
  record.expireTimer = null;
  if (sessions.get(record.sessionId) !== record || record.manualLogout || record.status === 'connected') {
    return;
  }

  record.manualLogout = true;
  record.status = 'expired';
  clearTimeout(record.reconnectTimer);
  sessions.delete(record.sessionId);
  notifyReady(record, new Error('Session authentication expired'));
  record.socket?.cancelPairingCode?.();
  await record.socket?.end(new Error('Session authentication expired')).catch(() => {});
  await rm(getSessionAuthPath(record.sessionId, record.apiKeyId), { recursive: true, force: true });
  await updateStatus(record.sessionId, record.apiKeyId, 'expired');
}

async function terminateSession(record, status, reason) {
  record.manualLogout = true;
  record.status = status;
  record.lastDisconnectReason = reason;
  clearTimeout(record.reconnectTimer);
  clearTimeout(record.expireTimer);
  record.reconnectTimer = null;
  record.expireTimer = null;
  sessions.delete(record.sessionId);
  notifyReady(record, new Error(`WhatsApp session terminated: ${reason}`));
  await record.socket?.end(new Error(`WhatsApp session terminated: ${reason}`)).catch(() => {});
  await rm(getSessionAuthPath(record.sessionId, record.apiKeyId), { recursive: true, force: true });
  await updateStatus(record.sessionId, record.apiKeyId, status, {
    lastDisconnectReason: reason,
    reconnectAttempts: 0,
  });
}

function scheduleExpiration(record) {
  record.expireTimer = setTimeout(() => {
    expirePendingSession(record).catch((error) => {
      logger.error({ error, sessionId: record.sessionId }, 'Session expiration failed');
    });
  }, SESSION_AUTH_TIMEOUT_MS);
}

async function waitForSocketOpen(record, timeoutMs = 15000) {
  if (record.socket?.ws?.isOpen) {
    return;
  }
  await record.socket.waitForConnectionUpdate(
    ({ connection }) => connection === 'connecting' || connection === 'open',
    timeoutMs,
  );
  await record.socket.waitForSocketOpen();
}

function scheduleReconnect(record) {
  if (record.reconnectTimer || record.manualLogout) {
    return;
  }

  if (record.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    record.status = 'disconnected';
    updateStatus(record.sessionId, record.apiKeyId, record.status, {
      reconnectAttempts: record.reconnectAttempts,
    }).catch((error) => {
      logger.error({ error, sessionId: record.sessionId }, 'Reconnect exhaustion status update failed');
    });
    logger.warn({ sessionId: record.sessionId, attempts: record.reconnectAttempts }, 'Session reconnect attempts exhausted');
    return;
  }

  record.reconnectAttempts += 1;
  const delay = getReconnectDelay(record.reconnectAttempts);
  record.status = 'reconnecting';
  updateStatus(record.sessionId, record.apiKeyId, record.status, {
    reconnectAttempts: record.reconnectAttempts,
  }).catch((error) => {
    logger.error({ error, sessionId: record.sessionId }, 'Reconnect attempt status update failed');
  });
  logger.info({ sessionId: record.sessionId, attempt: record.reconnectAttempts, delay }, 'Scheduling session reconnect');
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

async function createSessionRecord(sessionId, apiKeyId, connectionMethod, label = null) {
  validateSessionId(sessionId);
  const ownerId = String(apiKeyId);
  let existing = sessions.get(sessionId);

  if (existing) {
    if (existing.apiKeyId !== ownerId) {
      throw new SessionOwnershipError();
    }
    if (existing.status === 'disconnected' || existing.status === 'logged_out') {
      existing.manualLogout = true;
      clearTimeout(existing.reconnectTimer);
      clearTimeout(existing.expireTimer);
      await existing.socket?.end(new Error('Session authentication restarted'));
      sessions.delete(sessionId);
      existing = null;
    }
  }
  if (existing) {
    if (existing.connectionMethod !== connectionMethod) {
      throw new Error(`Session already uses ${existing.connectionMethod}`);
    }
    return existing;
  }

  const initialStatus = connectionMethod === 'qr' ? 'qr_pending' : 'pairing_pending';
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('SELECT id FROM api_keys WHERE id = ? FOR UPDATE', [ownerId]);
    const [owners] = await connection.execute(
      'SELECT api_key_id FROM sessions WHERE session_name = ? LIMIT 1',
      [sessionId],
    );
    if (owners.length > 0 && String(owners[0].api_key_id) !== ownerId) {
      throw new SessionOwnershipError();
    }
    if (owners.length === 0 && await countActiveSessions(ownerId, connection) >= MAX_ACTIVE_SESSIONS) {
      throw new SessionLimitError();
    }

    await connection.execute(
      `INSERT INTO sessions (session_name, api_key_id, label, connection_method, status)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE connection_method = VALUES(connection_method),
         label = VALUES(label), status = VALUES(status), updated_at = CURRENT_TIMESTAMP`,
      [sessionId, ownerId, label, connectionMethod, initialStatus],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const record = {
    sessionId,
    apiKeyId: ownerId,
    socket: null,
    connectionMethod,
    status: initialStatus,
    qrCode: null,
    pairingCode: null,
    manualLogout: false,
    wasConnected: false,
    lastDisconnectReason: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
    expireTimer: null,
    readyWaiters: new Set(),
  };
  sessions.set(sessionId, record);
  scheduleExpiration(record);

  try {
    await connect(record);
    return record;
  } catch (error) {
    clearTimeout(record.expireTimer);
    sessions.delete(sessionId);
    await updateStatus(sessionId, ownerId, 'disconnected');
    throw error;
  }
}

export async function createSession(sessionId, apiKeyId, label) {
  const record = await createSessionRecord(sessionId, apiKeyId, 'qr', label);
  return record.socket;
}

export async function createSessionWithPairingCode(
  sessionId,
  apiKeyId,
  phoneNumber,
  label,
) {
  const record = await createSessionRecord(sessionId, apiKeyId, 'pairing_code', label);
  try {
    await waitForSocketOpen(record);
    const pairingCode = await record.socket.requestPairingCode(
      phoneNumber.replace(/\D/g, ''),
    );
    record.pairingCode = pairingCode;
    record.status = 'pairing_pending';
    await updateStatus(record.sessionId, record.apiKeyId, record.status);
    notifyReady(record);
    return pairingCode;
  } catch (error) {
    record.manualLogout = true;
    clearTimeout(record.reconnectTimer);
    clearTimeout(record.expireTimer);
    record.socket?.cancelPairingCode?.();
    await record.socket?.end(error).catch(() => {});
    sessions.delete(sessionId);
    await rm(getSessionAuthPath(sessionId, apiKeyId), { recursive: true, force: true });
    await updateStatus(sessionId, apiKeyId, 'disconnected').catch((statusError) => {
      logger.warn({ error: statusError, sessionId }, 'Pairing failure status update failed');
    });
    throw error;
  }
}

export async function getSession(sessionId, apiKeyId) {
  validateSessionId(sessionId);
  const ownerId = String(apiKeyId);
  const [rows] = await pool.execute(
    'SELECT api_key_id FROM sessions WHERE session_name = ? LIMIT 1',
    [sessionId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (String(rows[0].api_key_id) !== ownerId) {
    throw new SessionOwnershipError();
  }

  const record = sessions.get(sessionId);
  return record?.apiKeyId === ownerId ? record.socket : null;
}

export async function waitForSessionReady(sessionId, apiKeyId, timeoutMs = 60000) {
  const record = sessions.get(sessionId);
  if (record && record.apiKeyId !== String(apiKeyId)) {
    throw new SessionOwnershipError();
  }
  if (!record) {
    throw new Error('Session not found');
  }
  if (record.qrCode || record.pairingCode || record.status === 'connected') {
    return sessionState(record);
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        record.readyWaiters.delete(waiter);
        reject(new Error('Timed out waiting for session authentication'));
      }, timeoutMs),
    };
    record.readyWaiters.add(waiter);
  });
}

export async function getSessionStatus(sessionId, apiKeyId) {
  validateSessionId(sessionId);
  const ownerId = String(apiKeyId);
  const [rows] = await pool.execute(
    `SELECT api_key_id, connection_method, status, last_disconnect_reason, reconnect_attempts, updated_at
     FROM sessions WHERE session_name = ? LIMIT 1`,
    [sessionId],
  );
  if (rows.length === 0) {
    return null;
  }
  if (String(rows[0].api_key_id) !== ownerId) {
    throw new SessionOwnershipError();
  }

  const record = sessions.get(sessionId);
  return {
    status: record?.apiKeyId === ownerId ? record.status : rows[0].status,
    qrCode: record?.apiKeyId === ownerId ? record.qrCode : null,
    pairingCode: record?.apiKeyId === ownerId ? record.pairingCode : null,
    connectionMethod: rows[0].connection_method,
    lastDisconnectReason: record?.apiKeyId === ownerId
      ? record.lastDisconnectReason
      : rows[0].last_disconnect_reason,
    reconnectAttempts: record?.apiKeyId === ownerId
      ? record.reconnectAttempts
      : Number(rows[0].reconnect_attempts),
    updatedAt: rows[0].updated_at,
  };
}

export async function listSessions(apiKeyId, database = pool) {
  const [rows] = await database.execute(
    `SELECT session_name AS id, label, connection_method, status, created_at
     FROM sessions
     WHERE api_key_id = ?
     ORDER BY created_at DESC, id DESC`,
    [String(apiKeyId)],
  );
  return rows;
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
    clearTimeout(record.expireTimer);
    try {
      await record.socket?.logout('API-requested logout');
    } catch (error) {
      logoutError = error;
      logger.warn({ error, sessionId }, 'WhatsApp logout request failed');
    }
    notifyReady(record, new Error('WhatsApp session was logged out'));
    sessions.delete(sessionId);
  }

  await rm(getSessionAuthPath(sessionId, ownerId), { recursive: true, force: true });
  await updateStatus(sessionId, ownerId, 'logged_out', {
    lastDisconnectReason: 'manualLogout',
    reconnectAttempts: 0,
  });

  if (logoutError) {
    throw logoutError;
  }
  return true;
}

export async function restoreConnectedSessions() {
  const [rows] = await pool.execute(
    `SELECT session_name, api_key_id, connection_method
     FROM sessions
      WHERE status IN ('connected', 'reconnecting')`,
  );

  for (const row of rows) {
    const sessionId = row.session_name;
    const apiKeyId = String(row.api_key_id);
    try {
      if (sessions.has(sessionId)) {
        continue;
      }
      await access(path.join(getSessionAuthPath(sessionId, apiKeyId), 'creds.json'));
      const record = {
        sessionId,
        apiKeyId,
        socket: null,
        connectionMethod: row.connection_method,
        status: 'reconnecting',
        qrCode: null,
        pairingCode: null,
        manualLogout: false,
        wasConnected: true,
        lastDisconnectReason: null,
        reconnectAttempts: 0,
        reconnectTimer: null,
        expireTimer: null,
        readyWaiters: new Set(),
      };
      sessions.set(sessionId, record);
      await updateStatus(sessionId, apiKeyId, 'reconnecting', { reconnectAttempts: 0 });
      await connect(record);
      logger.info({ sessionId }, 'Restoring previously connected WhatsApp session');
    } catch (error) {
      sessions.delete(sessionId);
      const reason = `startupRestoreFailed: ${error?.message ?? error}`.slice(0, 100);
      await updateStatus(sessionId, apiKeyId, 'disconnected', {
        lastDisconnectReason: reason,
        reconnectAttempts: 0,
      }).catch((statusError) => {
        logger.error({ error: statusError, sessionId }, 'Startup restore failure status update failed');
      });
      logger.error({ error, sessionId }, 'Failed to restore previously connected WhatsApp session');
    }
  }
}