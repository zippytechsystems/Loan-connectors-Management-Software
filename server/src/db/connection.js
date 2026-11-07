import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { mockPool } from './testAdapter.js';

let pool = null;
let isConnected = false;
let lastConnectionError = null;

export function getPool() {
  if (process.env.USE_TEST_DB === 'true') {
    return mockPool;
  }

  if (!pool) {
    try {
      pool = mysql.createPool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        waitForConnections: true,
        connectionLimit: env.DB_CONNECTION_LIMIT,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        charset: 'utf8mb4',
      });
    } catch (err) {
      lastConnectionError = err;
      console.error('[DB] Failed to create MySQL pool:', err.message);
    }
  }
  return pool;
}

/**
 * Test connectivity to Hostinger MySQL database
 */
export async function testDbConnection() {
  if (process.env.USE_TEST_DB === 'true') {
    isConnected = true;
    return {
      success: true,
      message: 'Test in-memory database connected',
      serverTime: new Date(),
      host: 'test-memory',
      database: 'test_db',
    };
  }

  try {
    const currentPool = getPool();
    if (!currentPool) {
      return {
        success: false,
        message: 'MySQL pool is not initialized. Please verify configuration.',
        error: lastConnectionError?.message,
      };
    }
    const [rows] = await currentPool.query('SELECT 1 + 1 AS result, NOW() AS server_time');
    isConnected = true;
    lastConnectionError = null;
    return {
      success: true,
      message: 'Successfully connected to Hostinger MySQL database',
      serverTime: rows[0].server_time,
      host: env.DB_HOST,
      database: env.DB_NAME,
    };
  } catch (err) {
    isConnected = false;
    lastConnectionError = err;
    return {
      success: false,
      message: `Failed to connect to MySQL database at ${env.DB_HOST}:${env.DB_PORT} [${env.DB_NAME}]`,
      error: err.message,
      code: err.code,
    };
  }
}

export function isDbConnected() {
  return isConnected;
}

export function getLastDbError() {
  return lastConnectionError;
}
