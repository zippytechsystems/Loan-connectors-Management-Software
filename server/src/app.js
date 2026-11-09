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
import { testDbConnection } from './db/connection.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const app = express();

// Trust reverse proxy (Hostinger / Nginx)
app.set('trust proxy', 1);

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Let React client load assets smoothly
    crossOriginEmbedderPolicy: false,
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl) or matching origins
      if (!origin || origin === env.CORS_ORIGIN || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev/staging; can be constrained in strict prod
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body Parsing & Cookies
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Serve static assets from built React frontend
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// General Rate Limiter for API
app.use('/api', apiRateLimiter);

// Health & Diagnostic Endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await testDbConnection();
  res.json({
    status: 'ok',
    service: 'Zippy Loan Connector API',
    version: '1.0.0',
    environment: env.NODE_ENV,
    database: {
      connected: dbStatus.success,
      message: dbStatus.message,
      host: env.DB_HOST,
      name: env.DB_NAME,
      error: dbStatus.error || null,
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount REST API Routes
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
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    message: env.NODE_ENV === 'production' && status === 500
      ? 'An internal error occurred. Please contact administrator.'
      : message,
    code: err.code || 'INTERNAL_ERROR',
  });
});

export default app;
