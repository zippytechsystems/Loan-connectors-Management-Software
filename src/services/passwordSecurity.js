const crypto = require('node:crypto');

const SCRYPT_OPTIONS = {
  N: 16384, // CPU/memory cost
  r: 8,     // Block size
  p: 1      // Parallelization
};
const KEY_LENGTH = 32;
const LEGACY_SALT = 'veridian-connector-salt-demo-2026';

/**
 * Safely compare two hex strings in constant time without throwing on length mismatch
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');

  // If length differs, timingSafeEqual throws, so allocate dummy buffer of same length to prevent timing leakage
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash password with a unique per-user random salt using scrypt
 * Returns format: salt:hash
 */
function hashPassword(password, customSalt = null) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verify password against stored hash (supporting both new salted format and legacy demo hash)
 * @param {string} password - Submitted plain password
 * @param {string} storedHash - Stored hash from database
 * @returns {{ valid: boolean, needsUpgrade: boolean }}
 */
function verifyPassword(password, storedHash) {
  if (!password || !storedHash) {
    return { valid: false, needsUpgrade: false };
  }

  // New salted format: salt:hash
  if (storedHash.includes(':')) {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return { valid: false, needsUpgrade: false };
    const [salt, expectedHash] = parts;
    const computed = crypto.scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
    const valid = constantTimeCompare(computed, expectedHash);
    return { valid, needsUpgrade: false };
  }

  // Legacy single-salt hash format
  const legacyComputed = crypto.scryptSync(password, LEGACY_SALT, KEY_LENGTH).toString('hex');
  const legacyValid = constantTimeCompare(legacyComputed, storedHash);
  return { valid: legacyValid, needsUpgrade: legacyValid };
}

module.exports = {
  hashPassword,
  verifyPassword,
  constantTimeCompare
};
