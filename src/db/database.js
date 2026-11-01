const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');
const { runMigrations } = require('./migrations');
const mysqlClient = require('./mysqlClient');

// Ensure database directory exists for SQLite
fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });

// Ensure document vault storage directory exists
fs.mkdirSync(config.STORAGE_DIR, { recursive: true });

const isMySQL = config.DB_CLIENT === 'mysql';

// Initialize SQLite connection (active for development, testing, and offline modes)
const db = new DatabaseSync(config.DB_FILE);

// Set robust SQLite WAL PRAGMAs
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA synchronous = NORMAL;');

// Execute versioned SQLite migrations
runMigrations(db);

if (isMySQL) {
  console.log(`[Database] Hostinger MySQL mode configured: Target ${config.MYSQL_HOST}:${config.MYSQL_PORT} / DB: ${config.MYSQL_DATABASE}`);
}

/**
 * Execute a transaction safely with BEGIN IMMEDIATE and COMMIT/ROLLBACK
 * @param {Function} callback - Function that executes statements
 * @returns {*} Result of the callback
 */
function transaction(callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = {
  db,
  transaction,
  isMySQL,
  mysqlClient
};
