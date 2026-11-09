import app from './src/app.js';
import { env } from './src/config/env.js';
import { testDbConnection, closePool } from './src/db/connection.js';
import { initializeDatabase } from './src/db/init.js';

const rawPort = process.env.PORT;
const isSocket = rawPort && isNaN(Number(rawPort));
const primaryPort = isSocket ? rawPort : parseInt(rawPort || String(env.PORT) || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

let serverInstance = null;

async function startServer() {
  console.log('====================================================');
  console.log('  ZIPPY LOAN CONNECTOR — BACKEND SERVER             ');
  console.log('  Owner: M. Lingaswamy                              ');
  console.log(`  Active Node.js: ${process.version}`);
  console.log(`  Environment: ${env.NODE_ENV}`);
  console.log(`  Startup PORT config: ${rawPort || `Default (${primaryPort})`}`);
  console.log('====================================================');

  // Test Hostinger MySQL connectivity
  console.log(`[DB] Checking MySQL connection to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}...`);
  try {
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
  } catch (dbErr) {
    console.warn(`[DB] ⚠️ Database check error: ${dbErr.message}`);
    console.warn('[DB] Continuing server startup for diagnostic health access.');
  }

  // Bind to Hostinger port or Passenger socket pipe
  if (isSocket) {
    // Under Phusion Passenger / CloudLinux socket mode, listen on the socket directly without host
    serverInstance = app.listen(primaryPort, () => {
      console.log(`[SERVER] 🚀 Server running on Passenger socket: ${primaryPort}`);
    });
  } else {
    // Normal TCP port binding
    serverInstance = app.listen(primaryPort, host, () => {
      console.log(`[SERVER] 🚀 Server running on http://${host}:${primaryPort}`);
      console.log(`[SERVER] Health check: http://localhost:${primaryPort}/api/health`);
      console.log(`[SERVER] Database health: http://localhost:${primaryPort}/api/health/database`);
    });
  }
}

// Graceful Shutdown Handler
async function gracefulShutdown(signal) {
  console.log(`\n[SERVER] Received ${signal}. Starting graceful shutdown...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      console.log('[SERVER] HTTP server closed.');
      await closePool();
      console.log('[SERVER] Graceful shutdown complete.');
      process.exit(0);
    });
    // Force shutdown if taking longer than 10s
    setTimeout(() => {
      console.error('[SERVER] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Promise Rejection at:', promise);
  console.error('Reason:', reason);
});

startServer().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
