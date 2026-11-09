import app from './src/app.js';
import { env } from './src/config/env.js';
import { testDbConnection } from './src/db/connection.js';
import { initializeDatabase } from './src/db/init.js';

const rawPort = process.env.PORT;
const primaryPort = rawPort && isNaN(Number(rawPort)) ? rawPort : parseInt(rawPort || '3000', 10);

async function startServer() {
  console.log('====================================================');
  console.log('  ZIPPY LOAN CONNECTOR — BACKEND SERVER (PHASE 2)   ');
  console.log('  Owner: M. Lingaswamy                              ');
  console.log(`  Active Node: ${process.version}`);
  console.log(`  Startup PORT env: ${rawPort || '(not set, defaulting to Hostinger 3000)'}`);
  console.log('====================================================');

  // Test Hostinger MySQL connectivity
  console.log(`[DB] Checking MySQL connection to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`);
  const dbStatus = await testDbConnection();

  if (dbStatus.success) {
    console.log(`[DB] ✅ Hostinger MySQL connected successfully at ${dbStatus.serverTime}`);
    await initializeDatabase();
  } else {
    console.warn(`[DB] ⚠️ MySQL not yet connected: ${dbStatus.message}`);
    if (dbStatus.error) {
      console.warn(`[DB] Detail: ${dbStatus.error}`);
    }
    console.warn('[DB] Server will still start so API and health probes remain accessible.');
  }

  // Bind to Hostinger port (3000 by default, or assigned process.env.PORT)
  app.listen(primaryPort, '0.0.0.0', () => {
    console.log(`[SERVER] 🚀 Server running on http://0.0.0.0:${primaryPort}`);
    console.log(`[SERVER] Health check: http://localhost:${primaryPort}/api/health`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
