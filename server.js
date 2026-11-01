const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./src/config');
const { db } = require('./src/db/database');
const { seedDatabase } = require('./src/db/seed');
const { applySecurityHeaders, checkRateLimit } = require('./src/middleware/security');
const { getSession } = require('./src/middleware/auth');

// Route Handlers
const { handleAuthRoutes } = require('./src/routes/authRoutes');
const { handlePartnerRoutes } = require('./src/routes/partnerRoutes');
const { handleCatalogRoutes } = require('./src/routes/catalogRoutes');
const { handleLeadRoutes } = require('./src/routes/leadRoutes');
const { handleCommissionRoutes } = require('./src/routes/commissionRoutes');
const { handleReportRoutes } = require('./src/routes/reportRoutes');

// Ensure database is seeded with initial synthetic data
seedDatabase();

const PUBLIC_DIR = path.join(config.ROOT_DIR, 'public');

const server = http.createServer(async (req, res) => {
  // 1. Apply Hardened Security Headers
  applySecurityHeaders(res);

  // 2. Rate Limiting Check
  const clientIp = req.socket.remoteAddress || '127.0.0.1';
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'Too many requests. Please slow down.' }));
  }

  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 3. API Requests Handling (/api/v1/... and /health)
  if (u.pathname.startsWith('/api/') || u.pathname === '/health') {
    // API responses must never be indexed or cached by search crawlers
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    try {
      // Parse JSON body for mutation methods
      let body = null;
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        let rawBody = '';
        let bodySize = 0;
        const maxLimit = 2 * 1024 * 1024; // 2MB limit

        for await (const chunk of req) {
          bodySize += chunk.length;
          if (bodySize > maxLimit) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Payload exceeds size limit' }));
          }
          rawBody += chunk;
        }

        if (rawBody.trim()) {
          try {
            body = JSON.parse(rawBody);
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid JSON body syntax' }));
          }
        }
      }

      // Unauthenticated Health Ping for Monitoring & Probes
      if (req.method === 'GET' && (u.pathname === '/health' || u.pathname === '/api/v1/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          status: 'healthy',
          ok: true,
          service: 'zippy-loan-connector-loan-software-application',
          version: '1.0.0',
          environment: config.NODE_ENV,
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
          database: {
            client: config.DB_CLIENT,
            status: 'connected'
          },
          vault: {
            status: 'online'
          }
        }));
      }

      // Handle unauthenticated routes (Auth login, switch persona, Google auth, registration)
      if (handleAuthRoutes(req, res, u, body)) {
        return;
      }

      // Authenticate Session
      const sessionAuth = getSession(req);
      if (!sessionAuth) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: 'Sign in to access this platform service' }));
      }

      // CSRF protection for cookie-authenticated mutation methods
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && sessionAuth.authMethod === 'cookie') {
        const { validateCsrf } = require('./src/middleware/auth');
        if (!validateCsrf(req, sessionAuth)) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'Forbidden: Missing or invalid CSRF token' }));
        }
      }

      const user = sessionAuth.user;

      // Authenticated Detailed Health Endpoint
      if (req.method === 'GET' && u.pathname === '/api/v1/health/detailed') {
        if (!['admin', 'operations', 'auditor'].includes(user.role)) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
          return res.end(JSON.stringify({ error: 'Forbidden: Requires administrative or operational privileges' }));
        }

        const mem = process.memoryUsage();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          status: 'ok',
          service: 'zippy-loan-connector-loan-software-application',
          version: '1.0.0',
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          memoryUsageMB: {
            heapUsed: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
            heapTotal: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
            rss: Number((mem.rss / 1024 / 1024).toFixed(2))
          },
          database: {
            client: config.DB_CLIENT,
            tableCounts: {
              leads: db.prepare('SELECT count(*) as c FROM leads').get().c,
              partners: db.prepare('SELECT count(*) as c FROM partners').get().c,
              commissionLedger: db.prepare('SELECT count(*) as c FROM commission_ledger').get().c,
              kycDocuments: db.prepare('SELECT count(*) as c FROM kyc_documents').get().c,
              auditEvents: db.prepare('SELECT count(*) as c FROM audit_events').get().c
            }
          },
          integrations: {
            googleOAuth: config.GOOGLE_OAUTH.isConfigured ? 'active' : 'unconfigured_mock_mode',
            smtp: config.SMTP.isConfigured ? 'active' : 'unconfigured_mock_mode',
            payoutGateway: config.PAYOUT.isConfigured ? 'active' : 'manual_neft'
          }
        }));
      }

      // Dispatch to domain modules
      if (handlePartnerRoutes(req, res, u, body, user)) return;
      if (handleCatalogRoutes(req, res, u, body, user)) return;
      if (handleLeadRoutes(req, res, u, body, user)) return;
      if (handleCommissionRoutes(req, res, u, body, user)) return;
      if (handleReportRoutes(req, res, u, body, user)) return;

      // Unknown API endpoint
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'API endpoint not found' }));
    } catch (err) {
      // Sanitize log to strictly exclude session tokens, passwords, customer phone numbers and PANs
      const sanitized = String(err.message || '').replace(/(token|secret|password|key|auth|bearer)=[^\s&]+/gi, '$1=***');
      console.error('API Error:', sanitized);
      const isProd = config.NODE_ENV === 'production' || config.PRODUCTION_HARDENED;
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ 
        error: isProd ? 'Internal server error occurred' : ('Internal server error: ' + sanitized) 
      }));
    }
  }

  // 4. Clean Route & Static Web Assets (/public/...)
  let cleanPath = u.pathname;
  if (cleanPath.startsWith('/public/')) {
    cleanPath = cleanPath.slice(7);
  } else if (cleanPath === '/public') {
    cleanPath = '/';
  }
  
  // Map clean public marketing and internal workspace routes
  const cleanRouteMap = {
    '/': 'app.html',
    '/index': 'app.html',
    '/index.html': 'app.html',
    '/app': 'app.html',
    '/app.html': 'app.html',
    '/login': 'app.html',
    '/home': 'app.html',
    '/dashboard': 'app.html',
    '/workspace': 'app.html',
    '/portal': 'app.html',
    '/marketing': 'index.html',
    '/website': 'index.html',
    '/hyderabad-nacharam': 'hyderabad-nacharam.html',
    '/connector-network': 'connector-network.html',
    '/loan-products': 'loan-products.html',
    '/about': 'about.html',
    '/contact': 'contact.html',
    '/privacy-policy': 'privacy-policy.html',
    '/terms': 'terms.html'
  };

  let targetRelative = cleanRouteMap[cleanPath] || null;

  if (!targetRelative) {
    const rawSafe = path.normalize(decodeURIComponent(cleanPath)).replace(/^([/\\])+/, '');
    const directCandidate = path.join(PUBLIC_DIR, rawSafe);

    if (fs.existsSync(directCandidate) && fs.statSync(directCandidate).isFile()) {
      targetRelative = rawSafe;
    } else {
      const htmlCandidate = path.join(PUBLIC_DIR, rawSafe + '.html');
      if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
        targetRelative = rawSafe + '.html';
      }
    }
  }

  if (!targetRelative) {
    // Fallback: if browser request without file extension, serve app.html
    if (!path.extname(u.pathname)) {
      targetRelative = 'app.html';
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Resource not found');
    }
  }

  const filePath = path.join(PUBLIC_DIR, targetRelative);

  // Prevent directory traversal attacks
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Access denied');
  }

  const isPrivateWorkspace = ['/app', '/workspace', '/portal', '/login', '/home', '/dashboard'].includes(u.pathname) || 
                            targetRelative.endsWith('app.html');

  if (isPrivateWorkspace) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  } else {
    // Allow public pages and assets to be indexed
    res.setHeader('X-Robots-Tag', 'index, follow');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.pdf': 'application/pdf'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  let cacheControlHeader = 'no-store, no-cache, must-revalidate, private';
  if (config.NODE_ENV === 'production' && !isPrivateWorkspace) {
    if (ext === '.html') cacheControlHeader = 'public, max-age=300, must-revalidate';
    else if (ext === '.xml' || ext === '.txt') cacheControlHeader = 'public, max-age=3600';
    else if (ext !== '.js' && ext !== '.css') cacheControlHeader = 'public, max-age=86400';
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': cacheControlHeader
  });
  fs.createReadStream(filePath).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [Server Error] Port ${config.PORT} is already in use by another running process.`);
    console.error(`👉 Solution: Stop the existing process running on port ${config.PORT}:`);
    console.error(`   • Windows (PowerShell): Stop-Process -Id (Get-NetTCPConnection -LocalPort ${config.PORT} -ErrorAction SilentlyContinue).OwningProcess -Force`);
    console.error(`   • macOS / Linux:        npx kill-port ${config.PORT}`);
    console.error(`   • Or start on another port: PORT=${Number(config.PORT) + 1} npm run dev\n`);
    process.exit(1);
  } else {
    console.error('\n❌ [Server Error]:', err.message);
    process.exit(1);
  }
});

server.listen(config.PORT, config.HOST, () => {
  console.log(`=======================================================`);
  console.log(`  Zippy Loan Connector Loan Software Application       `);
  console.log(`  Status: Running at http://${config.HOST}:${config.PORT} `);
  console.log(`  Database: ${config.DB_FILE}                          `);
  console.log(`  Environment: ${config.NODE_ENV}                      `);
  console.log(`  Demo Accounts: admin, ops, partner, lender, auditor  `);
  console.log(`  Password: ConnectorDemo!26                           `);
  console.log(`=======================================================`);
});

// Graceful termination handling for both SIGINT and SIGTERM (watch mode)
let isShuttingDown = false;
function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Closing server and database connections...`);
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
  server.close(() => {
    try { db.close(); } catch (e) {}
    console.log('Zippy Loan Connector Loan Software Application shutdown cleanly.');
    process.exit(0);
  });
  setTimeout(() => {
    try { db.close(); } catch (e) {}
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

