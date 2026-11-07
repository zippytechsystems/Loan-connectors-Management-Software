import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const SALT_ROUNDS = 12;

/**
 * Hash plaintext password using bcrypt
 */
export async function hashPassword(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Compare plaintext password with hashed password
 */
export async function comparePassword(plaintext, hashed) {
  if (!plaintext || !hashed) return false;
  return bcrypt.compare(plaintext, hashed);
}

/**
 * Sign JWT session token
 */
export function signToken(payload, rememberMe = false) {
  const expiresIn = rememberMe ? `${env.COOKIE_MAX_AGE_DAYS}d` : '24h';
  return jwt.sign(payload, env.SESSION_SECRET, { expiresIn });
}

/**
 * Verify JWT session token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, env.SESSION_SECRET);
  } catch (err) {
    return null;
  }
}
