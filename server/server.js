import http from 'http';
import app from './src/app.js';
import { env } from './src/config/env.js';
import { testDbConnection } from './src/db/connection.js';
import { initializeDatabase } from './src/db/init.js';

const rawPort = process.env.PORT;
const primaryPort = rawPort && isNaN(Number(rawPort)) ? rawPort : parseInt(rawPort || '5000', 10);

async function startServer() {
  console.log('====================================================');
  console.log('  ZIPPY LOAN CONNECTOR — BACKEND SERVER (PHASE 2)   ');
  console.log('  Owner: M. Lingaswamy                              ');
  console.log(`  Startup PORT env: ${rawPort || '(not set, default 5000)'}`);
  console.log(`  Active Node: ${process.version}`);
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

  // Create primary HTTP server
  const server = http.createServer(app);

  if (typeof primaryPort === 'number') {
    server.listen(primaryPort, '0.0.0.0', () => {
      console.log(`[SERVER] 🚀 Primary server listening on http://0.0.0.0:${primaryPort}`);
      console.log(`[SERVER] Health check: http://localhost:${primaryPort}/api/health`);
    });

    // Also bind fallback port (3000 if primary is 5000, or 5000 if primary is 3000)
    const secondaryPort = primaryPort === 5000 ? 3000 : 5000;
    try {
      const fallbackServer = http.createServer(app);
      fallbackServer.on('error', (err) => {
        console.log(`[SERVER] Secondary port ${secondaryPort} not bound: ${err.message}`);
      });
      fallbackServer.listen(secondaryPort, '0.0.0.0', () => {
        console.log(`[SERVER] 🚀 Secondary server also listening on http://0.0.0.0:${secondaryPort}`);
      });
    } catch {
      // ignore
    }
  } else {
    // Unix domain socket or named pipe
    server.listen(primaryPort, () => {
      console.log(`[SERVER] 🚀 Server listening on socket ${primaryPort}`);
    });
  }
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
