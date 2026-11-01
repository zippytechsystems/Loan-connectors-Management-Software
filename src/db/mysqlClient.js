const mysql = require('mysql2');
const config = require('../config');

let pool = null;

/**
 * Initialize or get MySQL connection pool for Hostinger environment
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.MYSQL_HOST,
      port: config.MYSQL_PORT,
      user: config.MYSQL_USER,
      password: config.MYSQL_PASSWORD,
      database: config.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: config.MYSQL_CONNECTION_LIMIT,
      queueLimit: 0,
      charset: 'utf8mb4',
      ssl: config.MYSQL_SSL ? { rejectUnauthorized: false } : undefined,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
  }
  return pool;
}

/**
 * Execute a query with promises
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<any>}
 */
async function query(sql, params = []) {
  const p = getPool().promise();
  const [rows] = await p.query(sql, params);
  return rows;
}

/**
 * Execute an update/insert mutation with promises
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<{ insertId: number, affectedRows: number }>}
 */
async function execute(sql, params = []) {
  const p = getPool().promise();
  const [result] = await p.execute(sql, params);
  return {
    insertId: result.insertId,
    affectedRows: result.affectedRows
  };
}

/**
 * Health check ping to verify Hostinger MySQL connectivity
 * @returns {Promise<{ ok: boolean, latencyMs: number }>}
 */
async function ping() {
  const start = Date.now();
  try {
    const p = getPool().promise();
    await p.query('SELECT 1 as ping');
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message, latencyMs: Date.now() - start };
  }
}

/**
 * Execute an ACID transaction on Hostinger MySQL
 * @param {Function} callback - async function(conn)
 */
async function transactionMySQL(callback) {
  const p = getPool().promise();
  const connection = await p.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Close connection pool cleanly during graceful shutdown
 */
async function closePool() {
  if (pool) {
    await pool.promise().end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  execute,
  ping,
  transactionMySQL,
  closePool
};
