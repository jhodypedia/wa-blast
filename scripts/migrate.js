import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/database.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(scriptDirectory, '..', 'migrations');
const schemaMigrationsTableSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_schema_migrations_filename (filename)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

export function splitSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (lineComment) {
      if (character === '\n') {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === '\\') {
        index += 1;
      } else if (character === quote) {
        if (nextCharacter === quote) {
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === '#' || (character === '-' && nextCharacter === '-' && /\s/.test(sql[index + 2] ?? ''))) {
      lineComment = true;
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === ';') {
      const statement = sql.slice(start, index).trim();
      if (statement) {
        statements.push(statement);
      }
      start = index + 1;
    }
  }

  const statement = sql.slice(start).trim();
  if (statement) {
    statements.push(statement);
  }
  return statements;
}

async function readMigrationFiles() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

async function getExistingApplicationTables() {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN ('api_keys', 'sessions', 'broadcast_logs')`,
  );
  return new Set(rows.map((row) => row.TABLE_NAME));
}

async function hasCurrentApplicationSchema() {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND (
         (TABLE_NAME = 'api_keys' AND COLUMN_NAME = 'key')
         OR (TABLE_NAME = 'sessions' AND COLUMN_NAME IN (
           'connection_method',
           'label',
           'status',
           'last_disconnect_reason',
           'reconnect_attempts'
         ))
       )`,
  );
  const columns = new Map(rows.map((row) => [
    `${row.TABLE_NAME}.${row.COLUMN_NAME}`,
    row.COLUMN_TYPE.toLowerCase(),
  ]));
  const sessionStatus = columns.get('sessions.status') ?? '';

  return columns.get('api_keys.key') === 'varchar(128)'
    && columns.get('sessions.connection_method') === "enum('qr','pairing_code')"
    && columns.get('sessions.label') === 'varchar(100)'
    && columns.get('sessions.last_disconnect_reason') === 'varchar(100)'
    && columns.get('sessions.reconnect_attempts')?.startsWith('tinyint')
    && ['qr_pending', 'pairing_pending', 'connected', 'reconnecting', 'disconnected', 'logged_out', 'expired', 'terminated']
      .every((status) => sessionStatus.includes(`'${status}'`));
}

async function bootstrapExistingSchema(filenames) {
  const existingTables = await getExistingApplicationTables();
  if (existingTables.size === 0) {
    return false;
  }
  if (existingTables.size !== 3 || !(await hasCurrentApplicationSchema())) {
    throw new Error(
      'Existing application tables do not match the current schema; migrate this database to the current schema before enabling migration tracking',
    );
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const filename of filenames) {
      await connection.execute(
        'INSERT INTO schema_migrations (filename) VALUES (?)',
        [filename],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return true;
}

async function applyMigration(filename) {
  const migrationPath = path.join(migrationsDirectory, filename);
  const sql = await readFile(migrationPath, 'utf8');
  const statements = splitSqlStatements(sql);
  if (statements.length === 0) {
    throw new Error('Migration file contains no SQL statements');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const statement of statements) {
      await connection.query(statement);
    }
    await connection.execute(
      'INSERT INTO schema_migrations (filename) VALUES (?)',
      [filename],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function migrate() {
  const [trackingTableRows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations'
     LIMIT 1`,
  );
  await pool.query(schemaMigrationsTableSql);
  const filenames = await readMigrationFiles();
  if (trackingTableRows.length === 0 && await bootstrapExistingSchema(filenames)) {
    console.log('Recorded the existing current schema as the historical migration baseline');
  }

  const [appliedRows] = await pool.query('SELECT filename FROM schema_migrations');
  const appliedFilenames = new Set(appliedRows.map((row) => row.filename));

  for (const filename of filenames) {
    if (appliedFilenames.has(filename)) {
      console.log(`Skipping ${filename} (already applied)`);
      continue;
    }

    process.stdout.write(`Applying ${filename}... `);
    try {
      await applyMigration(filename);
      console.log('done');
    } catch (error) {
      console.log('failed');
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${filename} failed: ${message}`, { cause: error });
    }
  }
}

async function main() {
  try {
    await migrate();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}