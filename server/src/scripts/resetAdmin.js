import { testDbConnection, getPool, closePool } from '../db/connection.js';
import { getAdminByUsername, createAdmin, updateAdminPassword } from '../db/queries.js';
import { hashPassword } from '../utils/security.js';
import { env } from '../config/env.js';

async function resetAdmin() {
  console.log('====================================================');
  console.log('  ZIPPY LOAN CONNECTOR — ADMIN CREDENTIALS UTILITY  ');
  console.log('  Owner: M. Lingaswamy                              ');
  console.log('====================================================');

  const conn = await testDbConnection();
  if (!conn.success) {
    console.error('❌ Cannot reset admin: Database connection failed.');
    console.error(`Message: ${conn.message}`);
    if (conn.error) console.error(`Error: ${conn.error}`);
    process.exit(1);
  }

  const targetAdmin = env.ADMIN_USERNAME || 'M.Lingaswamy@123';
  const targetPassword = env.ADMIN_INITIAL_PASSWORD || 'M.Linga@123';

  console.log(`[ADMIN] Synchronizing credentials for: ${targetAdmin}`);

  const existing = await getAdminByUsername(targetAdmin);
  const passwordHash = await hashPassword(targetPassword);

  if (!existing) {
    await createAdmin({
      username: targetAdmin,
      passwordHash,
      role: 'admin',
    });
    console.log(`✅ Admin account created successfully: ${targetAdmin}`);
  } else {
    await updateAdminPassword(targetAdmin, passwordHash);
    console.log(`✅ Admin password successfully updated for: ${targetAdmin}`);
  }

  console.log(`[INFO] Admin username: ${targetAdmin}`);
  console.log('[INFO] Admin password has been securely hashed and stored in MySQL.');

  await closePool();
  process.exit(0);
}

resetAdmin().catch(async (err) => {
  console.error('[FATAL] Failed to reset admin credentials:', err);
  await closePool();
  process.exit(1);
});
