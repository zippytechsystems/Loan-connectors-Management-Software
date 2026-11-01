const path = require('node:path');
const fs = require('node:fs');

// Attempt to load .env if present without requiring external dotenv package
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.replace(/(^['"]|['"]$)/g, '').trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  } catch (err) {
    console.warn('Could not parse .env file:', err.message);
  }
}

const ROOT_DIR = path.resolve(__dirname, '..');

const NODE_ENV = process.env.NODE_ENV || 'development';
const PRODUCTION_HARDENED = process.env.PRODUCTION_HARDENED === 'true';

const DEFAULT_DEV_SESSION_SECRET = 'dev_session_secret_change_in_production_89417265934';
const DEFAULT_DEV_ENC_SECRET = 'dev_enc_key_change_in_prod_6872364817263548';

const SESSION_SECRET = process.env.SESSION_SECRET || DEFAULT_DEV_SESSION_SECRET;
const ENCRYPTION_KEY_SECRET = process.env.ENCRYPTION_KEY_SECRET || DEFAULT_DEV_ENC_SECRET;

// Fail safely in production if default development secrets remain configured
if ((NODE_ENV === 'production' || PRODUCTION_HARDENED) && 
    (SESSION_SECRET === DEFAULT_DEV_SESSION_SECRET || ENCRYPTION_KEY_SECRET === DEFAULT_DEV_ENC_SECRET)) {
  const errMsg = 'FATAL SECURITY CONFIGURATION: Production environment detected with default development secrets. Configure unique SESSION_SECRET and ENCRYPTION_KEY_SECRET in environment variables before starting.';
  console.error(errMsg);
  throw new Error(errMsg);
}

const DB_CLIENT = process.env.DB_CLIENT || (process.env.MYSQL_DATABASE ? 'mysql' : 'sqlite');
const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = Number(process.env.MYSQL_PORT || 3306);
const MYSQL_USER = process.env.MYSQL_USER || '';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || '';
const MYSQL_SSL = process.env.MYSQL_SSL === 'true';

// Validate production Hostinger MySQL configuration when DB_CLIENT is mysql
if ((NODE_ENV === 'production' || PRODUCTION_HARDENED) && DB_CLIENT === 'mysql') {
  if (!MYSQL_DATABASE || !MYSQL_USER) {
    const errMsg = 'FATAL DATABASE CONFIGURATION: Production environment requires Hostinger MySQL credentials. Set MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD environment variables.';
    console.error(errMsg);
    throw new Error(errMsg);
  }
}

module.exports = {
  ROOT_DIR,
  PORT: Number(process.env.PORT || 4180),
  HOST: process.env.HOST || '127.0.0.1',
  NODE_ENV,
  DB_CLIENT,
  DB_FILE: process.env.CONNECTOR_DB 
    ? path.resolve(ROOT_DIR, process.env.CONNECTOR_DB) 
    : path.join(ROOT_DIR, 'data', 'connector_network.sqlite'),
  MYSQL_HOST,
  MYSQL_PORT,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE,
  MYSQL_SSL,
  MYSQL_CONNECTION_LIMIT: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  SESSION_SECRET,
  ENCRYPTION_KEY_SECRET,
  COOKIE_NAME: process.env.COOKIE_NAME || 'veridian_connector_sess',
  STORAGE_DIR: process.env.DOCUMENT_STORAGE_DIR
    ? path.resolve(ROOT_DIR, process.env.DOCUMENT_STORAGE_DIR)
    : path.join(ROOT_DIR, 'storage', 'kyc_vault'),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX_PER_MINUTE || 200),
  MFA_ENFORCED: process.env.MFA_ENFORCED_FOR_ADMINS === 'true',
  PRODUCTION_HARDENED,
  JURISDICTION: process.env.JURISDICTION_COMPLIANCE_MODE || 'IN_DPDP_ACT_2023',
  MAX_DOC_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB limit for KYC documents
  PUBLIC_DOMAIN: (process.env.PUBLIC_DOMAIN || 'https://veridianconnector.com').replace(/\/+$/, ''),
  GSC_VERIFICATION_TAG: process.env.GSC_VERIFICATION_TAG || '',
  LOCAL_FOCUS: {
    city: 'Hyderabad',
    state: 'Telangana',
    locality: 'Nacharam',
    industrialArea: 'Nacharam Industrial Development Area (IDA)',
    pincode: '500076'
  },
  // Third-party service integration points (Configurable by account owner)
  GOOGLE_OAUTH: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://veridianconnector.com/api/v1/auth/google/callback',
    isConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  },
  SMTP: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'no-reply@veridianconnector.com',
    secure: process.env.SMTP_SECURE === 'true',
    isConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
  },
  PAYOUT: {
    provider: process.env.PAYOUT_PROVIDER || 'manual_neft', // 'manual_neft' | 'razorpayx' | 'cashfree'
    keyId: process.env.PAYOUT_KEY_ID || '',
    keySecret: process.env.PAYOUT_KEY_SECRET || '',
    webhookSecret: process.env.PAYOUT_WEBHOOK_SECRET || '',
    isConfigured: Boolean(process.env.PAYOUT_KEY_ID && process.env.PAYOUT_KEY_SECRET)
  }
};

