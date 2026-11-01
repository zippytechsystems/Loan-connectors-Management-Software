const crypto = require('node:crypto');
const config = require('../config');

// Master Secret derivation
const MASTER_SECRET = config.ENCRYPTION_KEY_SECRET;

// Legacy key for backward compatibility with existing seeded rows
const LEGACY_ENC_KEY = crypto.scryptSync(MASTER_SECRET, 'veridian-salt-v1', 32);

// Derived separate keys using HKDF with distinct info/salt parameters
const ENC_KEY_V1 = crypto.hkdfSync('sha256', MASTER_SECRET, 'veridian-enc-salt-v1', 'aes-256-gcm-encryption', 32);
const HMAC_KEY_V1 = crypto.hkdfSync('sha256', MASTER_SECRET, 'veridian-hmac-salt-v1', 'hmac-sha256-deduplication', 32);
const SIGN_KEY_V1 = crypto.hkdfSync('sha256', MASTER_SECRET, 'veridian-sign-salt-v1', 'signed-token-authorization', 32);

// Active Key Registry for rotation support
const KEY_REGISTRY = {
  v1: { encKey: Buffer.from(ENC_KEY_V1), hmacKey: Buffer.from(HMAC_KEY_V1) },
  legacy: { encKey: Buffer.from(LEGACY_ENC_KEY), hmacKey: Buffer.from(LEGACY_ENC_KEY) }
};
const CURRENT_VERSION = 'v1';

/**
 * Deterministic hash for deduplication lookups using dedicated HMAC key
 */
function hashIdentifier(value) {
  if (!value) return '';
  const clean = String(value).trim().toUpperCase();
  return crypto.createHmac('sha256', KEY_REGISTRY.v1.hmacKey).update(clean).digest('hex');
}

/**
 * Legacy deterministic hash for checking seeded/historical customer records
 */
function legacyHashIdentifier(value) {
  if (!value) return '';
  const clean = String(value).trim().toUpperCase();
  return crypto.createHmac('sha256', KEY_REGISTRY.legacy.hmacKey).update(clean).digest('hex');
}

/**
 * Encrypt sensitive string using AES-256-GCM with authenticated key versioning
 * Output format: version:iv:authTag:ciphertext
 */
function encryptPII(plainText, version = CURRENT_VERSION) {
  if (!plainText && plainText !== 0) return '';
  const keyObj = KEY_REGISTRY[version] || KEY_REGISTRY.v1;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyObj.encKey, iv);
  let encrypted = cipher.update(String(plainText), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${version}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive string from AES-256-GCM, safely handling versioned and legacy ciphertext
 */
function decryptPII(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
    return cipherText || '';
  }

  try {
    const parts = cipherText.split(':');
    let version = 'legacy';
    let ivHex, authTagHex, encryptedText;

    if (parts.length === 4) {
      // Versioned format: version:iv:authTag:encrypted
      version = parts[0];
      ivHex = parts[1];
      authTagHex = parts[2];
      encryptedText = parts[3];
    } else if (parts.length === 3) {
      // Legacy format: iv:authTag:encrypted
      version = 'legacy';
      ivHex = parts[0];
      authTagHex = parts[1];
      encryptedText = parts[2];
    } else {
      return cipherText;
    }

    const keyObj = KEY_REGISTRY[version] || KEY_REGISTRY.legacy;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyObj.encKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption with version fails, attempt fallback with legacy key
    try {
      const parts = cipherText.split(':');
      const iv = Buffer.from(parts.length === 4 ? parts[1] : parts[0], 'hex');
      const authTag = Buffer.from(parts.length === 4 ? parts[2] : parts[1], 'hex');
      const encryptedText = parts.length === 4 ? parts[3] : parts[2];
      const decipher = crypto.createDecipheriv('aes-256-gcm', KEY_REGISTRY.legacy.encKey, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e2) {
      return '[Decryption Error]';
    }
  }
}

/**
 * Mask Phone Number: e.g. +91 98765 43210 -> +91 98*** **210
 */
function maskPhone(phone) {
  if (!phone) return '—';
  const clean = String(phone).trim();
  if (clean.length < 8) return '****';
  return clean.slice(0, 5) + '*****' + clean.slice(-3);
}

/**
 * Mask Email: e.g. aarav.mehta@gmail.com -> aa***@gmail.com
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return '—';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user.charAt(0)}***@${domain}`;
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * Mask PAN: e.g. ABCDE1234F -> ABCDE****F
 */
function maskPAN(pan) {
  if (!pan) return '—';
  const clean = String(pan).trim().toUpperCase();
  if (clean.length < 8) return '******';
  return clean.slice(0, 5) + '****' + clean.slice(-1);
}

/**
 * Mask Full Name for Auditor: e.g. Aarav Mehta -> A**** M****
 */
function maskName(name) {
  if (!name) return '—';
  return name.split(' ').map(w => w.charAt(0) + '****').join(' ');
}

/**
 * Apply selective masking to customer object based on actor role and lead context
 */
function maskCustomerRecord(customer, actorRole, leadStatus, isOwner) {
  if (!customer) return null;
  const rawPhone = decryptPII(customer.phone_encrypted);
  const rawEmail = decryptPII(customer.email_encrypted);
  const rawPAN = decryptPII(customer.pan_encrypted);

  // Auditors ALWAYS see masked PII
  if (actorRole === 'auditor') {
    return {
      id: customer.id,
      full_name: maskName(customer.full_name),
      phone: maskPhone(rawPhone),
      email: maskEmail(rawEmail),
      pan: maskPAN(rawPAN),
      employment_type: customer.employment_type,
      monthly_income: customer.monthly_income,
      residence_city: customer.residence_city,
      residence_state: customer.residence_state,
      is_masked: true
    };
  }

  // Connectors only see unmasked contact details if they own the lead AND it has been accepted
  if (actorRole === 'connector') {
    const unmaskedStatuses = ['Accepted', 'Contacted', 'Referred', 'Lender Review', 'Sanctioned', 'Disbursed'];
    const canSeeUnmasked = isOwner && unmaskedStatuses.includes(leadStatus);
    return {
      id: customer.id,
      full_name: customer.full_name,
      phone: canSeeUnmasked ? rawPhone : maskPhone(rawPhone),
      email: canSeeUnmasked ? rawEmail : maskEmail(rawEmail),
      pan: canSeeUnmasked ? rawPAN : maskPAN(rawPAN),
      employment_type: customer.employment_type,
      monthly_income: customer.monthly_income,
      residence_city: customer.residence_city,
      residence_state: customer.residence_state,
      is_masked: !canSeeUnmasked
    };
  }

  // Lenders see unmasked details only for leads referred to their institution in active underwriting/disbursal
  if (actorRole === 'lender') {
    const lenderStatuses = ['Lender Review', 'Sanctioned', 'Disbursed'];
    const canSee = isOwner && lenderStatuses.includes(leadStatus);
    return {
      id: customer.id,
      full_name: customer.full_name,
      phone: canSee ? rawPhone : maskPhone(rawPhone),
      email: canSee ? rawEmail : maskEmail(rawEmail),
      pan: canSee ? rawPAN : maskPAN(rawPAN),
      employment_type: customer.employment_type,
      monthly_income: customer.monthly_income,
      residence_city: customer.residence_city,
      residence_state: customer.residence_state,
      is_masked: !canSee
    };
  }

  // Operations and Admin can view unmasked for active operational duty
  return {
    id: customer.id,
    full_name: customer.full_name,
    phone: rawPhone,
    email: rawEmail,
    pan: rawPAN,
    employment_type: customer.employment_type,
    monthly_income: customer.monthly_income,
    residence_city: customer.residence_city,
    residence_state: customer.residence_state,
    is_masked: false
  };
}

module.exports = {
  hashIdentifier,
  legacyHashIdentifier,
  encryptPII,
  decryptPII,
  maskPhone,
  maskEmail,
  maskPAN,
  maskName,
  maskCustomerRecord,
  KEY_REGISTRY,
  SIGN_KEY: Buffer.from(SIGN_KEY_V1)
};
