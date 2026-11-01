const config = require('../config');

// In-memory sliding window rate limiter
const rateLimits = new Map();

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "script-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'"
  ].join('; '));
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  let record = rateLimits.get(ip);

  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
    rateLimits.set(ip, record);
    return true;
  }

  record.count += 1;
  if (record.count > config.RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

module.exports = {
  applySecurityHeaders,
  checkRateLimit
};
