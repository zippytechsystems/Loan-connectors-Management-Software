import app from './src/app.js';
import { env } from './src/config/env.js';
import { testDbConnection } from './src/db/connection.js';
import { initializeDatabase } from './src/db/init.js';

const PORT = env.PORT || 5000;

async function startServer() {
  console.log('====================================================');
  console.log('  ZIPPY LOAN CONNECTOR — BACKEND SERVER (PHASE 1)   ');
  console.log('  Owner: M. Lingaswamy                              ');
  console.log('====================================================');

  // Test Hostinger MySQL connectivity
  console.log(`[DB] Checking MySQL connection to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`);
  const dbStatus = await testDbConnection();

  if (dbStatus.success) {
    console.log(`[DB] ✅ Hostinger MySQL connected successfully at ${dbStatus.serverTime}`);
    // Run schema initialization and admin bootstrap
    await initializeDatabase();
  } else {
    console.warn(`[DB] ⚠️ MySQL not yet connected: ${dbStatus.message}`);
    if (dbStatus.error) {
      console.warn(`[DB] Detail: ${dbStatus.error}`);
    }
    console.warn('[DB] Server will still start so API and health probes remain accessible.');
  }

  app.listen(PORT, () => {
    console.log(`[SERVER] 🚀 Server running on http://localhost:${PORT}`);
    console.log(`[SERVER] Environment: ${env.NODE_ENV}`);
    console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
    console.log('====================================================');
  });
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
