import { testDbConnection } from '../db/connection.js';
import { initializeDatabase } from '../db/init.js';

async function main() {
  console.log('Running Zippy Loan Connector Database Bootstrap...');
  const conn = await testDbConnection();
  if (!conn.success) {
    console.error('Cannot run bootstrap: Database connection failed.');
    console.error(conn.message);
    process.exit(1);
  }

  const ok = await initializeDatabase();
  if (ok) {
    console.log('✅ Tables initialized and initial admin verified successfully.');
    process.exit(0);
  } else {
    console.error('❌ Bootstrap encountered an error.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
