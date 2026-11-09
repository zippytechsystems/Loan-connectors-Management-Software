import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { testDbConnection, verifyDatabaseQuery } from './db/connection.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const rootDistPath = path.resolve(__dirname, '../../');

const app = express();

// Trust reverse proxy (Hostinger / LiteSpeed / Nginx / Apache)
app.set('trust proxy', 1);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows React SPA assets to load smoothly
    crossOriginEmbedderPolicy: false,
  })
);

// Cross-Origin Resource Sharing (CORS)
const allowedOrigins = [
  env.CORS_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Check if origin matches allowed list or matches host domain
      const isAllowed = allowedOrigins.some((ao) => origin === ao || origin.startsWith(ao));
      if (isAllowed || env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// Body Parsing & Cookies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Serve static assets from built React frontend (client/dist or root)
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}
if (fs.existsSync(path.join(rootDistPath, 'assets'))) {
  app.use(express.static(rootDistPath));
}

// General Rate Limiter for API
app.use('/api', apiRateLimiter);

// -----------------------------------------------------------------------------
// Health Probes (Requirement 4)
// -----------------------------------------------------------------------------

/**
 * GET /api/health
 * Returns status of API and verifies actual MySQL connection.
 * If MySQL is disconnected, returns HTTP 503.
 */
app.get('/api/health', async (req, res) => {
  const dbStatus = await testDbConnection();

  if (dbStatus.success) {
    return res.status(200).json({
      success: true,
      service: 'Zippy Loan Connector API',
      status: 'running',
      database: 'connected',
    });
  }

  return res.status(503).json({
    success: false,
    service: 'Zippy Loan Connector API',
    status: 'degraded',
    database: 'disconnected',
    message: 'Database connection check failed',
  });
});

/**
 * GET /api/health/database
 * Executes an actual database query check without exposing credentials.
 */
app.get('/api/health/database', async (req, res) => {
  const result = await verifyDatabaseQuery();

  if (result.success) {
    return res.status(200).json({
      success: true,
      service: 'Zippy Loan Connector API',
      status: 'connected',
      message: 'Database query verification passed',
    });
  }

  return res.status(503).json({
    success: false,
    service: 'Zippy Loan Connector API',
    status: 'disconnected',
    message: 'Database query verification failed',
  });
});

// -----------------------------------------------------------------------------
// REST API Routes
// -----------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/business-profile', profileRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 Handler for undefined API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// SPA Fallback for client-side routing (serves React's index.html)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const clientIndex = path.join(clientDistPath, 'index.html');
  const rootIndex = path.join(rootDistPath, 'index.html');
  if (fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex);
  }
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  next();
});

// Centralized Error Handling Middleware (Masks internal details in production)
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message || err);
  const status = err.status || 500;

  res.status(status).json({
    success: false,
    message:
      env.NODE_ENV === 'production' && status === 500
        ? 'An internal server error occurred. Please contact the administrator.'
        : err.message || 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

export default app;
