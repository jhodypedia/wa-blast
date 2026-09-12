import mysql from 'mysql2/promise';
import { env } from './env.js';

const DATABASE_CONNECTION_LIMIT = 10;
const DATABASE_QUEUE_LIMIT = 100;
const DATABASE_CONNECT_TIMEOUT_MS = 10_000;

export const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: DATABASE_CONNECTION_LIMIT,
  queueLimit: DATABASE_QUEUE_LIMIT,
  connectTimeout: DATABASE_CONNECT_TIMEOUT_MS,
  enableKeepAlive: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
});

export async function checkDatabaseConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
}