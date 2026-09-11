import { nanoid } from 'nanoid';
import { pool } from '../config/database.js';

const API_KEY_LENGTH = 32;
const MAX_UNSIGNED_INT = 4294967295;

function requireId(value, name) {
  const id = String(value ?? '').trim();
  if (!/^\d+$/.test(id) || BigInt(id) < 1n) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return id;
}

function requireLabel(label) {
  if (typeof label !== 'string' || !label.trim()) {
    throw new TypeError('label is required');
  }
  const normalized = label.trim();
  if (normalized.length > 100) {
    throw new TypeError('label must not exceed 100 characters');
  }
  return normalized;
}

function mapApiKey(row) {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    ownerTelegramId: row.owner_telegram_id,
    isActive: Boolean(row.is_active),
    rateLimitPerMinute: Number(row.rate_limit_per_minute),
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

async function findApiKeyById(keyId) {
  const [rows] = await pool.execute(
    `SELECT id, \`key\`, label, owner_telegram_id, is_active,
            rate_limit_per_minute, created_at, revoked_at
     FROM api_keys
     WHERE id = ?
     LIMIT 1`,
    [keyId],
  );
  return rows.length > 0 ? mapApiKey(rows[0]) : null;
}

export async function generateApiKey({ label, ownerTelegramId }) {
  const normalizedLabel = requireLabel(label);
  const ownerId = requireId(ownerTelegramId, 'ownerTelegramId');
  const rawKey = nanoid(API_KEY_LENGTH);

  const [result] = await pool.execute(
    `INSERT INTO api_keys (\`key\`, label, owner_telegram_id, is_active)
     VALUES (?, ?, ?, TRUE)`,
    [rawKey, normalizedLabel, ownerId],
  );

  return findApiKeyById(result.insertId);
}

export async function listApiKeys({ ownerTelegramId } = {}) {
  const params = [];
  let whereClause = '';
  if (ownerTelegramId !== undefined) {
    whereClause = 'WHERE owner_telegram_id = ?';
    params.push(requireId(ownerTelegramId, 'ownerTelegramId'));
  }

  const [rows] = await pool.execute(
    `SELECT id, \`key\`, label, owner_telegram_id, is_active,
            rate_limit_per_minute, created_at, revoked_at
     FROM api_keys
     ${whereClause}
     ORDER BY created_at DESC, id DESC`,
    params,
  );
  return rows.map(mapApiKey);
}

export async function revokeApiKey(keyId) {
  const id = requireId(keyId, 'keyId');
  const [result] = await pool.execute(
    `UPDATE api_keys
     SET is_active = FALSE, revoked_at = NOW()
     WHERE id = ?`,
    [id],
  );
  return result.affectedRows > 0;
}

export async function validateApiKey(rawKey) {
  if (typeof rawKey !== 'string' || !rawKey) {
    return null;
  }

  const [rows] = await pool.execute(
    `SELECT id, \`key\`, label, owner_telegram_id, is_active,
            rate_limit_per_minute, created_at, revoked_at
     FROM api_keys
     WHERE \`key\` = ? AND is_active = TRUE
     LIMIT 1`,
    [rawKey],
  );
  return rows.length > 0 ? mapApiKey(rows[0]) : null;
}

export async function setRateLimit(keyId, requestsPerMinute) {
  const id = requireId(keyId, 'keyId');
  if (
    !Number.isInteger(requestsPerMinute)
    || requestsPerMinute < 1
    || requestsPerMinute > MAX_UNSIGNED_INT
  ) {
    throw new TypeError('requestsPerMinute must be a positive 32-bit integer');
  }

  const [result] = await pool.execute(
    `UPDATE api_keys
     SET rate_limit_per_minute = ?
     WHERE id = ?`,
    [requestsPerMinute, id],
  );
  return result.affectedRows > 0;
}