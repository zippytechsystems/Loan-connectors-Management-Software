#!/usr/bin/env node
/**
 * Hostinger MySQL Consistent Point-in-Time Backup Utility
 * Generates portable SQL backup with SHA-256 integrity checksum
 * Usage:
 *   node scripts/mysql_backup.js
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../src/config');
const { getPool, closePool } = require('../src/db/mysqlClient');

async function createMySQLBackup() {
  console.log('=======================================================');
  console.log('  Veridian Connector OS — Hostinger MySQL Backup      ');
  console.log('=======================================================');

  if (!config.MYSQL_DATABASE || !config.MYSQL_USER) {
    console.error('❌ Error: MYSQL_DATABASE and MYSQL_USER must be set in environment variables.');
    process.exit(1);
  }

  const backupDir = path.join(config.ROOT_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `veridian_mysql_backup_${timestamp}.sql`;
  const backupPath = path.join(backupDir, backupFileName);

  const pool = getPool().promise();
  const writeStream = fs.createWriteStream(backupPath, { encoding: 'utf8' });

  writeStream.write(`-- Veridian Connector OS MySQL Backup\n`);
  writeStream.write(`-- Created At: ${new Date().toISOString()}\n`);
  writeStream.write(`-- Database: ${config.MYSQL_DATABASE}\n\n`);
  writeStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);

  // 1. Get all tables
  const [tables] = await pool.query('SHOW FULL TABLES WHERE Table_Type = "BASE TABLE"');
  for (const row of tables) {
    const tableName = Object.values(row)[0];
    
    // Dump CREATE TABLE
    const [createResult] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = createResult[0]['Create Table'];
    writeStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
    writeStream.write(`${createSql};\n\n`);

    // Dump Data Rows
    const [dataRows] = await pool.query(`SELECT * FROM \`${tableName}\``);
    if (dataRows.length > 0) {
      writeStream.write(`-- Dumping data for table \`${tableName}\` (${dataRows.length} rows)\n`);
      for (const d of dataRows) {
        const cols = Object.keys(d).map(c => `\`${c}\``).join(', ');
        const vals = Object.values(d).map(v => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "\\'")}'`;
          return `'${String(v).replace(/'/g, "\\'")}'`;
        }).join(', ');
        writeStream.write(`INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});\n`);
      }
      writeStream.write(`\n`);
    }
  }

  writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
  writeStream.end();

  await new Promise(resolve => writeStream.on('finish', resolve));

  // 2. Generate SHA-256 Checksum
  const fileBuffer = fs.readFileSync(backupPath);
  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const checksumPath = `${backupPath}.sha256`;
  fs.writeFileSync(checksumPath, `${sha256}  ${backupFileName}\n`, 'utf8');

  console.log('✅ Backup successfully created and verified!');
  console.log(`Target:   ${backupPath}`);
  console.log(`Checksum: ${sha256}`);
  console.log(`Size:     ${(fileBuffer.length / 1024).toFixed(2)} KB`);

  await closePool();
  return { backupPath, checksumPath, sha256 };
}

if (require.main === module) {
  createMySQLBackup().catch(err => {
    console.error('Backup Error:', err);
    process.exit(1);
  });
}

module.exports = { createMySQLBackup };
