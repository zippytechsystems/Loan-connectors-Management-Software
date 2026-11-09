import app from './src/app.js';
import { env } from './src/config/env.js';
import { testDbConnection } from './src/db/connection.js';
import { initializeDatabase } from './src/db/init.js';

async function startServer() {
  console.log('====================================================');
  console.log('  ZIPPY LOAN CONNECTOR — BACKEND SERVER (PHASE 2)   ');
  console.log('  Owner: M. Lingaswamy                              ');
  console.log(`  Active Node: ${process.version}`);
  console.log(`  Passenger Active: ${typeof PhusionPassenger !== 'undefined'}`);
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

  // Hook into Passenger if present, otherwise listen on PORT / 5000
  if (typeof PhusionPassenger !== 'undefined') {
    app.listen('passenger', () => {
      console.log('[SERVER] 🚀 Server running behind Phusion Passenger');
    });
  } else {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] 🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
    });
  }
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
