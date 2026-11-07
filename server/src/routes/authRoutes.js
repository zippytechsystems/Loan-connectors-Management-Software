import { Router } from 'express';
import { getAdminByUsername, logAuditEvent } from '../db/queries.js';
import { comparePassword, signToken } from '../utils/security.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody, loginSchema } from '../middleware/validation.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticates admin and sets HTTP-only session cookie
 */
router.post('/login', loginRateLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { username, password, rememberMe } = req.validatedBody;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const admin = await getAdminByUsername(username);

    if (!admin) {
      await logAuditEvent({
        adminUsername: username,
        action: 'LOGIN_FAILED_USER_NOT_FOUND',
        ipAddress: clientIp,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    if (!admin.is_active) {
      await logAuditEvent({
        adminUsername: username,
        action: 'LOGIN_BLOCKED_INACTIVE_ACCOUNT',
        ipAddress: clientIp,
      });
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact support.',
      });
    }

    const isMatch = await comparePassword(password, admin.password_hash);
    if (!isMatch) {
      await logAuditEvent({
        adminUsername: username,
        action: 'LOGIN_FAILED_INVALID_PASSWORD',
        ipAddress: clientIp,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Generate JWT token
    const token = signToken(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
      rememberMe
    );

    // Cookie expiration
    const maxAgeMs = rememberMe
      ? env.COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

    // Set secure HTTP-only cookie
    res.cookie(env.COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });

    await logAuditEvent({
      adminUsername: admin.username,
      action: 'LOGIN_SUCCESS',
      ipAddress: clientIp,
      details: { rememberMe: !!rememberMe },
    });

    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Clears the session cookie and invalidates session
 */
router.post('/logout', (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
  const username = req.user?.username || 'ANONYMOUS';

  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  logAuditEvent({
    adminUsername: username,
    action: 'LOGOUT_SUCCESS',
    ipAddress: clientIp,
  });

  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/auth/me
 * Retrieves authenticated admin session
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const admin = await getAdminByUsername(req.user.username);
    if (!admin || !admin.is_active) {
      res.clearCookie(env.COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return res.status(401).json({
        success: false,
        message: 'Account no longer active',
      });
    }

    return res.json({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        createdAt: admin.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
