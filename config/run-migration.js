import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './database.js';

const migrationPath = process.argv[2];
const migrationName = migrationPath ? path.basename(migrationPath) : null;
const verifications = {
  '003_add_session_label.sql': async () => {
    const [rows] = await pool.execute(
      `SELECT COLUMN_TYPE, IS_NULLABLE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'label'`,
    );
    if (rows.length !== 1 || rows[0].COLUMN_TYPE.toLowerCase() !== 'varchar(100)' || rows[0].IS_NULLABLE !== 'YES') {
      throw new Error('sessions.label must be VARCHAR(100) NULL');
    }
  },
  '004_add_expired_session_status.sql': async () => {
    const [rows] = await pool.execute(
      `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'status'`,
    );
    if (rows.length !== 1 || !rows[0].COLUMN_TYPE.toLowerCase().includes("'expired'")) {
      throw new Error('sessions.status must support expired');
    }
  },
};

if (!migrationPath) {
  console.error('Usage: node config/run-migration.js <migration.sql>');
  process.exitCode = 1;
} else {
  try {
    const sql = await readFile(path.resolve(migrationPath), 'utf8');
    if (migrationName === '003_add_session_label.sql') {
      const [columns] = await pool.execute(
        `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'label'`,
      );
      if (columns.length === 0) {
        await pool.query(sql);
      }
    } else {
      await pool.query(sql);
    }
    await verifications[migrationName]?.();
    console.log(`Applied or verified ${migrationPath}`);
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}