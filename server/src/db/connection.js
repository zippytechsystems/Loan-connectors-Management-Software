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
        connectTimeout: env.DB_CONNECT_TIMEOUT || 10000,
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
 * Test connectivity to Hostinger MySQL database using SELECT 1
 */
export async function testDbConnection() {
  if (process.env.USE_TEST_DB === 'true') {
    isConnected = true;
    return {
      success: true,
      message: 'Test in-memory database connected',
      serverTime: new Date(),
    };
  }

  try {
    const currentPool = getPool();
    if (!currentPool) {
      isConnected = false;
      return {
        success: false,
        message: 'MySQL pool is not initialized. Please verify configuration.',
        error: lastConnectionError?.message || 'Pool unavailable',
      };
    }
    const [rows] = await currentPool.query('SELECT 1 + 1 AS result, NOW() AS server_time');
    isConnected = true;
    lastConnectionError = null;
    return {
      success: true,
      message: 'Successfully connected to Hostinger MySQL database',
      serverTime: rows[0].server_time,
    };
  } catch (err) {
    isConnected = false;
    lastConnectionError = err;
    return {
      success: false,
      message: 'Failed to connect to MySQL database',
      error: err.message,
      code: err.code,
    };
  }
}

/**
 * Verify an actual query against MySQL for /api/health/database
 */
export async function verifyDatabaseQuery() {
  if (process.env.USE_TEST_DB === 'true') {
    return {
      success: true,
      result: 1,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const currentPool = getPool();
    if (!currentPool) {
      return {
        success: false,
        error: 'Database pool not initialized',
      };
    }
    const [rows] = await currentPool.query('SELECT 1 AS verification, NOW() AS current_time');
    return {
      success: true,
      result: rows[0].verification,
      timestamp: rows[0].current_time,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

export function isDbConnected() {
  return isConnected;
}

export function getLastDbError() {
  return lastConnectionError;
}

export async function closePool() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      isConnected = false;
      console.log('[DB] MySQL pool successfully closed.');
    } catch (err) {
      console.error('[DB] Error closing MySQL pool:', err.message);
    }
  }
}
