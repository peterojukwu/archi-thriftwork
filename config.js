const path = require('path');
const dotenv = require('dotenv');

// Load local overrides first, then fill any missing values from .env. Values
// already supplied by the runtime (for example Vercel) keep highest priority.
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set when NODE_ENV=production.');
}

const port = process.env.PORT || 3000;
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

module.exports = {
  PORT: port,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SESSION_SECRET: process.env.SESSION_SECRET || 'archi-thrift-local-development-secret-change-me',
  ADMIN_WHATSAPP: (process.env.ADMIN_WHATSAPP || '').replace(/\D/g, ''),
  ADMIN_NAME: process.env.ADMIN_NAME || 'Archi Thrift Admin',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@archithrift.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || (isProduction ? '' : 'Admin123'),
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || '',
  // Set automatically when a Vercel Blob store is connected; the SDK then authenticates via Vercel OIDC.
  BLOB_STORE_ID: process.env.BLOB_STORE_ID || '',
  NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL || '',
  NEON_AUTH_JWKS_URL: process.env.NEON_AUTH_JWKS_URL || '',
  CATEGORIES: [
    'Drafting tools',
    'Model-making',
    'Cutting tools',
    'Paper & media',
    'Adhesives & finishing',
    'Books & references',
    'Software & licenses',
    'Other',
  ],
  CURRENCY: process.env.CURRENCY || '₦',
  EMAIL: {
    ENABLED: process.env.EMAIL_ENABLED !== 'false',
    FROM: process.env.EMAIL_FROM || 'Archi Thrift <no-reply@archithrift.com>',
    ADMIN_TO: process.env.EMAIL_ADMIN_TO || process.env.ADMIN_EMAIL || 'admin@archithrift.com',
    BASE_URL: process.env.BASE_URL || vercelUrl || `http://localhost:${port}`,
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: Number(process.env.SMTP_PORT || 587),
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
  },
};
