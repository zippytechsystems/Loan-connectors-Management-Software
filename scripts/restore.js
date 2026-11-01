const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const config = require('../src/config');

function restoreDatabase(specifiedFile = null) {
  const backupDir = path.join(config.ROOT_DIR, 'backups');
  const targetDb = config.DB_FILE;

  if (!fs.existsSync(backupDir)) {
    console.error(`Error: Backups directory not found at ${backupDir}`);
    process.exit(1);
  }

  // Find backup file from argument or pick latest
  let backupFile = specifiedFile || process.argv[2];
  if (!backupFile) {
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.sqlite')).sort().reverse();
    if (files.length === 0) {
      console.error(`Error: No SQLite backup files found in ${backupDir}`);
      process.exit(1);
    }
    backupFile = path.join(backupDir, files[0]);
    console.log(`Using latest backup: ${files[0]}`);
  } else if (!path.isAbsolute(backupFile)) {
    backupFile = path.resolve(backupDir, backupFile);
  }

  // 1. Path Safety: Refuse unsafe paths outside repository root or backups directory
  const resolvedBackup = path.resolve(backupFile);
  const normalizedBackupDir = path.resolve(backupDir);
  const normalizedRoot = path.resolve(config.ROOT_DIR);

  if (!resolvedBackup.startsWith(normalizedBackupDir) && !resolvedBackup.startsWith(normalizedRoot)) {
    console.error(`❌ RESTORE REFUSED: Path traversal attempt or unsafe backup path detected: ${backupFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(resolvedBackup)) {
    console.error(`❌ Error: Specified backup file does not exist: ${resolvedBackup}`);
    process.exit(1);
  }

  // 2. Cryptographic Integrity Validation: Verify SHA-256 checksum
  const checksumFile = `${resolvedBackup}.sha256`;
  if (!fs.existsSync(checksumFile)) {
    console.error(`❌ RESTORE REFUSED: Required cryptographic checksum file (${checksumFile}) is missing. Cannot verify authenticity.`);
    process.exit(1);
  }

  const expectedSha = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
  const actualSha = crypto.createHash('sha256').update(fs.readFileSync(resolvedBackup)).digest('hex');

  if (expectedSha !== actualSha) {
    console.error(`❌ RESTORE ABORTED: Checksum verification failed! File is corrupt or tampered.`);
    console.error(`Expected SHA-256: ${expectedSha}`);
    console.error(`Actual SHA-256:   ${actualSha}`);
    process.exit(1);
  }
  console.log(`✅ SHA-256 checksum verified successfully.`);

  // 3. Verify Backup SQLite Structure
  try {
    const testDb = new DatabaseSync(resolvedBackup);
    const check = testDb.prepare('PRAGMA integrity_check;').get();
    testDb.close();
    if (check.integrity_check !== 'ok') {
      console.error(`❌ RESTORE ABORTED: Backup failed internal SQLite integrity check: ${check.integrity_check}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ RESTORE ABORTED: Could not read backup database:`, err.message);
    process.exit(1);
  }

  // 4. Concurrency Guard: Check if server is running and locking the target database
  if (fs.existsSync(targetDb)) {
    try {
      const lockCheck = new DatabaseSync(targetDb);
      lockCheck.exec('BEGIN EXCLUSIVE; COMMIT;');
      lockCheck.close();
    } catch (lockErr) {
      console.error(`❌ RESTORE REFUSED: Target database is currently locked by a running server process (${lockErr.message}).`);
      console.error(`CRITICAL: You MUST stop the server before restoring the database.`);
      process.exit(1);
    }
  }

  console.log(`Restoring database to ${targetDb}...`);
  fs.mkdirSync(path.dirname(targetDb), { recursive: true });

  // Clean stale WAL and SHM files for target DB
  const walFile = `${targetDb}-wal`;
  const shmFile = `${targetDb}-shm`;
  if (fs.existsSync(walFile)) {
    try { fs.unlinkSync(walFile); } catch (e) {}
  }
  if (fs.existsSync(shmFile)) {
    try { fs.unlinkSync(shmFile); } catch (e) {}
  }

  fs.copyFileSync(resolvedBackup, targetDb);

  // Final verification of restored database
  const finalCheck = new DatabaseSync(targetDb);
  const status = finalCheck.prepare('PRAGMA integrity_check;').get();
  finalCheck.close();

  if (status.integrity_check !== 'ok') {
    console.error(`❌ Post-restore verification failed:`, status.integrity_check);
    process.exit(1);
  }

  console.log(`✅ Database restoration successfully completed and verified!`);
  return true;
}

if (require.main === module) {
  restoreDatabase();
}

module.exports = {
  restoreDatabase
};
