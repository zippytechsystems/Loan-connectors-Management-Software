import { testDbConnection } from '../db/connection.js';
import { env } from '../config/env.js';

async function main() {
  console.log('Testing Hostinger MySQL Database Connectivity...');
  console.log(`Host: ${env.DB_HOST}:${env.DB_PORT}`);
  console.log(`Database: ${env.DB_NAME}`);
  console.log(`User: ${env.DB_USER}`);

  const result = await testDbConnection();
  if (result.success) {
    console.log('\n✅ CONNECTION SUCCESSFUL!');
    console.log(`Server Time: ${result.serverTime}`);
    console.log('Database is accessible and responding to queries.');
    process.exit(0);
  } else {
    console.error('\n❌ CONNECTION FAILED!');
    console.error(`Error: ${result.message}`);
    if (result.error) console.error(`Detail: ${result.error}`);
    console.error('\nTroubleshooting Checklist:');
    console.error('1. Verify DB_PASSWORD in your .env file matches Hostinger hPanel.');
    console.error('2. If connecting from local dev, ensure "Remote MySQL" allows your IP or "%" in hPanel.');
    console.error('3. Check that DB_HOST is set to your remote MySQL server (e.g. srv1555.hstgr.io) when running locally.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
