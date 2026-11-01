const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const config = require('../src/config');

function createBackup() {
  const sourceDb = config.DB_FILE;
  if (!fs.existsSync(sourceDb)) {
    console.error(`Error: Source database file not found at ${sourceDb}`);
    process.exit(1);
  }

  const backupDir = path.join(config.ROOT_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `connector_network_backup_${timestamp}.sqlite`;
  const backupPath = path.join(backupDir, backupFileName);

  console.log(`Creating consistent SQLite WAL database backup...`);
  console.log(`Source: ${sourceDb}`);
  console.log(`Target: ${backupPath}`);

  try {
    // Open source DB and checkpoint WAL frames to ensure full snapshot consistency
    const dbSource = new DatabaseSync(sourceDb);
    try {
      dbSource.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      // Use VACUUM INTO to produce a clean, self-contained atomic backup snapshot
      const escapedPath = backupPath.replace(/'/g, "''");
      dbSource.exec(`VACUUM INTO '${escapedPath}';`);
    } catch (vacErr) {
      // Fallback: Copy file if vacuum into encounters file conflict
      dbSource.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      fs.copyFileSync(sourceDb, backupPath);
    } finally {
      dbSource.close();
    }

    // Verify backup integrity
    const verifyDb = new DatabaseSync(backupPath);
    const check = verifyDb.prepare('PRAGMA integrity_check;').get();
    verifyDb.close();

    if (check.integrity_check !== 'ok') {
      throw new Error(`Backup failed integrity verification: ${check.integrity_check}`);
    }

    // Compute cryptographic SHA-256 checksum
    const buffer = fs.readFileSync(backupPath);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const checksumPath = `${backupPath}.sha256`;
    fs.writeFileSync(checksumPath, `${sha256}  ${backupFileName}\n`);

    console.log(`✅ Backup successfully created and verified!`);
    console.log(`Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`SHA-256 Checksum: ${sha256}`);
    return { backupPath, sha256 };
  } catch (err) {
    console.error(`❌ Backup creation failed:`, err.message);
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    process.exit(1);
  }
}

if (require.main === module) {
  createBackup();
}

module.exports = {
  createBackup
};
