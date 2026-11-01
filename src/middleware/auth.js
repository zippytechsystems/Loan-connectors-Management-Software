const crypto = require('node:crypto');
const config = require('../config');

// In-memory active sessions (mapped by token)
const sessions = new Map();

/**
 * Create a new secure session token with CSRF token and 12-hour expiry
 */
function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const sessionData = {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    partnerId: user.partner_id || null,
    lenderId: user.lender_id || null,
    mfaVerified: user.mfa_enabled ? false : true,
    csrfToken,
    createdAt: now,
    expiresAt: now + (12 * 60 * 60 * 1000) // 12 hours
  };
  sessions.set(token, sessionData);
  return { token, csrfToken, session: sessionData };
}

/**
 * Retrieve session from Request headers or cookies
 */
function getSession(req) {
  let token = null;
  let authMethod = 'bearer';

  // 1. Check Authorization header
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
    authMethod = 'bearer';
  }

  // 2. Check Cookie header fallback
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const c of cookies) {
      const [name, val] = c.trim().split('=');
      if (name === config.COOKIE_NAME) {
        token = decodeURIComponent(val || '');
        authMethod = 'cookie';
        break;
      }
    }
  }

  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  // Check expiration
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return { token, user: session, authMethod };
}

/**
 * Validate CSRF token for cookie-authenticated mutating requests
 */
function validateCsrf(req, sessionAuth) {
  if (!sessionAuth) return false;
  // Requests authenticated purely via Bearer token in header are not vulnerable to browser CSRF
  if (sessionAuth.authMethod === 'bearer') {
    return true;
  }

  // Mutating requests using cookie session require matching X-CSRF-Token header
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return true;
  }

  const clientCsrf = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
  if (!clientCsrf || typeof clientCsrf !== 'string') {
    return false;
  }

  const expectedCsrf = sessionAuth.user.csrfToken;
  if (!expectedCsrf) return false;

  const bufA = Buffer.from(clientCsrf);
  const bufB = Buffer.from(expectedCsrf);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Destroy active session
 */
function destroySession(token) {
  if (token) {
    sessions.delete(token);
  }
}

/**
 * Set secure HttpOnly session cookie
 */
function setSessionCookie(res, token) {
  const isProd = config.NODE_ENV === 'production' || config.PRODUCTION_HARDENED;
  const cookie = `${config.COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

/**
 * Clear session cookie
 */
function clearSessionCookie(res) {
  const isProd = config.NODE_ENV === 'production' || config.PRODUCTION_HARDENED;
  const cookie = `${config.COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

/**
 * Enforce role access control
 */
function hasRole(user, allowedRoles) {
  if (!user || !user.role) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Check if the user is tenant-authorized to view or act upon a specific lead
 */
function isTenantAuthorizedForLead(user, lead) {
  if (!user || !lead) return false;
  if (['admin', 'operations', 'auditor', 'finance'].includes(user.role)) {
    return true;
  }
  if (user.role === 'connector') {
    return Number(lead.assigned_partner_id) === Number(user.partnerId);
  }
  if (['lender', 'reviewer'].includes(user.role)) {
    return !user.lenderId || Number(lead.lender_id) === Number(user.lenderId);
  }
  return false;
}

/**
 * Check if the user is tenant-authorized to view or act upon a partner organization
 */
function isTenantAuthorizedForPartner(user, partnerId) {
  if (!user || !partnerId) return false;
  if (['admin', 'operations', 'auditor', 'finance', 'reviewer'].includes(user.role)) {
    return true;
  }
  if (user.role === 'connector') {
    return Number(user.partnerId) === Number(partnerId);
  }
  return false;
}

/**
 * Check if user is tenant-authorized to view a commission ledger entry
 */
function isTenantAuthorizedForCommission(user, entry) {
  if (!user || !entry) return false;
  if (['admin', 'operations', 'finance', 'auditor'].includes(user.role)) {
    return true;
  }
  if (user.role === 'connector') {
    return Number(user.partnerId) === Number(entry.partner_id);
  }
  return false;
}

module.exports = {
  createSession,
  getSession,
  validateCsrf,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  hasRole,
  isTenantAuthorizedForLead,
  isTenantAuthorizedForPartner,
  isTenantAuthorizedForCommission,
  sessions
};
