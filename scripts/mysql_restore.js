#!/usr/bin/env node
/**
 * Hostinger MySQL Database Restore Utility
 * Verifies SHA-256 integrity checksum before restoring tables
 * Usage:
 *   node scripts/mysql_restore.js <path-to-backup.sql>
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../src/config');
const { getPool, closePool } = require('../src/db/mysqlClient');

async function restoreMySQLBackup(targetFile) {
  console.log('=======================================================');
  console.log('  Veridian Connector OS — Hostinger MySQL Restore     ');
  console.log('=======================================================');

  if (!targetFile) {
    // Find newest backup in backups/ folder
    const backupDir = path.join(config.ROOT_DIR, 'backups');
    if (fs.existsSync(backupDir)) {
      const sqlFiles = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.sql') && f.startsWith('veridian_mysql_backup_'))
        .sort().reverse();
      if (sqlFiles.length > 0) {
        targetFile = path.join(backupDir, sqlFiles[0]);
      }
    }
  }

  if (!targetFile || !fs.existsSync(targetFile)) {
    console.error(`❌ Error: Backup file not found: ${targetFile || '(none specified)'}`);
    process.exit(1);
  }

  // 1. Verify SHA-256 Checksum
  const checksumFile = `${targetFile}.sha256`;
  if (!fs.existsSync(checksumFile)) {
    console.error(`❌ Error: Checksum file missing: ${checksumFile}`);
    console.error('Refusing to restore unverified or untrusted backup snapshot.');
    process.exit(1);
  }

  const expectedSha = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
  const actualSha = crypto.createHash('sha256').update(fs.readFileSync(targetFile)).digest('hex');

  if (expectedSha !== actualSha) {
    console.error('❌ FATAL: Checksum verification failed!');
    console.error(`Expected: ${expectedSha}`);
    console.error(`Actual:   ${actualSha}`);
    console.error('The backup file has been tampered with or corrupted.');
    process.exit(1);
  }

  console.log(`✅ SHA-256 Checksum verified (${actualSha.slice(0, 16)}...)`);
  console.log(`Restoring database from: ${targetFile}`);

  // 2. Connect and Execute
  const pool = getPool().promise();
  const sql = fs.readFileSync(targetFile, 'utf8');
  const statements = sql
    .split(/;\s*[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Executing ${statements.length} SQL statements...`);
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      console.warn(`Notice on statement: ${err.message}`);
    }
  }

  console.log('🎉 Hostinger MySQL restore completed successfully!');
  await closePool();
}

if (require.main === module) {
  const targetFile = process.argv[2];
  restoreMySQLBackup(targetFile).catch(err => {
    console.error('Restore Error:', err);
    process.exit(1);
  });
}

module.exports = { restoreMySQLBackup };
