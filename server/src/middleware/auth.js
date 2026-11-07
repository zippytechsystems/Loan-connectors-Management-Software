import { verifyToken } from '../utils/security.js';
import { env } from '../config/env.js';

export function requireAuth(req, res, next) {
  // Check HTTP-only cookie first
  let token = req.cookies?.[env.COOKIE_NAME];

  // Fallback to Authorization header if provided (e.g. for API clients)
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    // Clear invalid or expired cookie
    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid token. Please log in again.',
    });
  }

  req.user = decoded;
  next();
}
