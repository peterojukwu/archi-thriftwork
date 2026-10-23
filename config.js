// Central configuration. Override any of these with environment variables.
module.exports = {
  PORT: process.env.PORT || 3000,
  SESSION_SECRET: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),

  // The admin's WhatsApp number in INTERNATIONAL format, digits only (no +, spaces or dashes).
  // Example: UK 7700 900123 -> '447700900123'. Change this to the real store number.
  ADMIN_WHATSAPP: (process.env.ADMIN_WHATSAPP || '+234 8108860060').replace(/\D/g, ''),

  // Seed admin account (created on first run if no admin exists).
  ADMIN_NAME: process.env.ADMIN_NAME || 'Archi Thrift Admin',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@archithrift.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

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

  // ---- Email notifications (optional) ----
  // Sellers get an email when their listing changes status (approved / rejected /
  // sold / relisted); the admin gets one when a new item is submitted for review.
  // Leave SMTP_HOST empty to run in "log-only" mode: the app still works and
  // prints each notification to the console instead of sending real email.
  EMAIL: {
    // Master switch. Set EMAIL_ENABLED=false to turn all notifications off.
    ENABLED: process.env.EMAIL_ENABLED !== 'false',
    // "From" header shown to recipients.
    FROM: process.env.EMAIL_FROM || 'Archi Thrift <no-reply@archithrift.com>',
    // Where "new item submitted" alerts go (defaults to the admin email).
    ADMIN_TO: process.env.EMAIL_ADMIN_TO || process.env.ADMIN_EMAIL || 'admin@archithrift.com',
    // Base URL used to build links inside emails (no trailing slash).
    BASE_URL: process.env.BASE_URL || 'http://127.0.0.1:' + (process.env.PORT || 3000),
    // SMTP transport. Fill these in to actually send mail (e.g. your provider's SMTP).
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: Number(process.env.SMTP_PORT || 587),
    SMTP_SECURE: process.env.SMTP_SECURE === 'true', // true for port 465
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
  },
};
