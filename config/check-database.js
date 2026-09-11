import { checkDatabaseConnection, pool } from './database.js';

try {
  await checkDatabaseConnection();
  console.log('MySQL connection successful.');
} catch (error) {
  console.error(`MySQL connection failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}