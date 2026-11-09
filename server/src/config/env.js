import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Search and load .env in hierarchical order:
// 1. Project root .env (3 levels up from src/config)
// 2. Server folder .env (2 levels up from src/config)
// 3. Current working directory .env
const rootEnvPath = path.resolve(__dirname, '../../../.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
}
if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath });
}
dotenv.config(); // Fallback

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // MySQL Hostinger Configuration
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_NAME: process.env.DB_NAME || 'u914601002_Zippyloansdata',
  DB_USER: process.env.DB_USER || 'u914601002_zippyicicloan',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  DB_CONNECT_TIMEOUT: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),

  // Security Secrets
  SESSION_SECRET: process.env.SESSION_SECRET || 'zippy_loan_connector_dev_secret_key_849204859345',
  COOKIE_NAME: process.env.COOKIE_NAME || 'zippy_auth_token',
  COOKIE_MAX_AGE_DAYS: parseInt(process.env.COOKIE_MAX_AGE_DAYS || '7', 10),

  // Admin Credentials (Fixed per specification)
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'M.Lingaswamy@123',
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD || 'M.Linga@123',
};
