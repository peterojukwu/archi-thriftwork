const path = require('path');
const { randomBytes, randomUUID } = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { put, del } = require('@vercel/blob');

const cfg = require('./config');
const store = require('./db');
const { verifyNeonToken } = require('./neon-auth');

const app = express();
if (cfg.NODE_ENV === 'production') app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '20kb' }));

app.use(cookieSession({
  name: 'archi-thrift-session',
  keys: [cfg.SESSION_SECRET],
  maxAge: 1000 * 60 * 60 * 24 * 7,
  httpOnly: true,
  sameSite: 'lax',
  secure: cfg.NODE_ENV === 'production',
}));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.use(asyncHandler(async (req, res, next) => {
  await store.ensureSeeded();
  next();
}));

app.use(asyncHandler(async (req, res, next) => {
  let user = req.session && req.session.userId ? await store.findUserById(req.session.userId) : null;
  if (req.session?.neonExpiresAt && Date.now() >= req.session.neonExpiresAt) {
    req.session = null;
    user = null;
  }
  const authorization = req.get('authorization') || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearer) {
    let identity;
    try {
      identity = await verifyNeonToken(bearer[1]);
    } catch (error) {
      if (!error.statusCode) {
        error.statusCode = 401;
        error.expose = true;
        error.message = 'Your Neon Auth session is invalid or expired. Please sign in again.';
      }
      throw error;
    }
    if (!Number.isFinite(identity.exp)) {
      const error = new Error('Neon Auth token is missing an expiration time.');
      error.statusCode = 401;
      error.expose = true;
      throw error;
    }
    const email = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '';
    if (!email) {
      const error = new Error('Neon Auth did not provide a verified email address.');
      error.statusCode = 401;
      error.expose = true;
      throw error;
    }
    user = await store.findUserByEmail(email);
    const emailVerified = identity.email_verified === true || identity.emailVerified === true;
    if (user && user.role === 'admin' && !emailVerified) {
      const error = new Error('Verify your email before using this admin account.');
      error.statusCode = 403;
      error.expose = true;
      throw error;
    }
    if (!user) {
      const phone = typeof req.body?.phone === 'string'
        ? req.body.phone.replace(/[\s().-]/g, '')
        : '';
      if (phone && !/^\+?\d{7,15}$/.test(phone)) {
        const error = new Error('Enter a valid phone number with 7 to 15 digits.');
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }
      const name = typeof identity.name === 'string' && identity.name.trim()
        ? identity.name.trim()
        : email.split('@')[0];
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      try {
        user = await store.addUser({ name, email, phone: phone || null, passwordHash, role: 'user' });
      } catch (error) {
        if (error.code !== '23505') throw error;
        user = await store.findUserByEmail(email);
      }
    }
    req.session = req.session || {};
    req.session.userId = user.id;
    req.session.neonExpiresAt = identity.exp * 1000;
  }
  res.locals.currentUser = user;
  res.locals.isAdmin = !!(user && user.role === 'admin');
  res.locals.cfg = cfg;
  res.locals.flash = req.session && req.session.flash || null;
  if (req.session) delete req.session.flash;
  res.locals.currency = cfg.CURRENCY;
  next();
}));

function flash(req, type, msg) {
  req.session = req.session || {};
  req.session.flash = { type, msg };
  if (req.res) req.res.locals.flash = { type, msg };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

// Blob auth: either an explicit read-write token, or a connected store (BLOB_STORE_ID) where the
// SDK authenticates through Vercel OIDC and needs no secret.
function blobConfigured() {
  return Boolean(cfg.BLOB_READ_WRITE_TOKEN || cfg.BLOB_STORE_ID);
}

function blobAuth() {
  return cfg.BLOB_READ_WRITE_TOKEN ? { token: cfg.BLOB_READ_WRITE_TOKEN } : {};
}

async function uploadImage(file) {
  if (!file) return null;
  if (!blobConfigured()) {
    const error = new Error('Image uploads are not configured. Connect a Vercel Blob store (or set BLOB_READ_WRITE_TOKEN) and try again.');
    error.statusCode = 503;
    error.expose = true;
    throw error;
  }
  const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
  try {
    const blob = await put(`items/${Date.now()}-${randomUUID()}${extension}`, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
      ...blobAuth(),
    });
    return blob.url;
  } catch (error) {
    console.error('[blob] upload failed:', error && error.message);
    const uploadError = new Error('Image upload failed. Please try again.');
    uploadError.statusCode = 502;
    uploadError.expose = true;
    throw uploadError;
  }
}

async function deleteImage(imageUrl) {
  if (!imageUrl || !blobConfigured()) return;
  try {
    await del(imageUrl, blobAuth());
  } catch (error) {
    console.error('[blob] image deletion failed:', error && error.message);
  }
}

function requireLogin(req, res, next) {
  if (!res.locals.currentUser) {
    req.session = null;
    flash(req, 'error', 'Please log in to continue.');
    return res.redirect('/login');
  }
  next();
}

const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!res.locals.currentUser || res.locals.currentUser.role !== 'admin') {
    flash(req, 'error', 'Admins only.');
    return res.redirect('/');
  }
  next();
});

function waLink(item) {
  if (!cfg.ADMIN_WHATSAPP) return null;
  const msg = `Hello Archi Thrift! I'm interested in "${item.title}" (${cfg.CURRENCY}${item.price}) in ${item.location || 'your listings'}. Is it still available?`;
  return `https://wa.me/${cfg.ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

app.locals.waLink = waLink;
app.locals.fmtDate = (ts) => {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch (error) { return ''; }
};

const CAT_ICONS = {
  'Drafting tools': '<path d="M22 46l10-28 10 28" /><path d="M26 36h12" />',
  'Model-making': '<rect x="16" y="20" width="32" height="24" rx="2"/><path d="M16 28h32"/>',
  'Cutting tools': '<path d="M18 44l22-22 6 6-22 22z"/><path d="M18 44l-2 6 6-2"/>',
  'Paper & media': '<rect x="20" y="14" width="24" height="34" rx="2"/><path d="M26 24h12M26 30h12M26 36h8"/>',
  'Adhesives & finishing': '<path d="M27 16h10v8H27z"/><path d="M25 24h14v22a3 3 0 0 1-3 3H28a3 3 0 0 1-3-3z"/>',
  'Books & references': '<path d="M16 18h14a4 4 0 0 1 4 4v24a4 4 0 0 0-4-4H16z"/><path d="M48 18H34a4 4 0 0 0-4 4v24a4 4 0 0 1 4-4h14z"/>',
  'Software & licenses': '<rect x="16" y="18" width="32" height="22" rx="2"/><path d="M24 46h16M32 40v6"/>',
  'Other': '<circle cx="32" cy="32" r="14"/><path d="M32 24v16M24 32h16"/>',
};
app.locals.catIcon = (category) => {
  const inner = CAT_ICONS[category] || CAT_ICONS.Other;
  return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
};

app.get('/', asyncHandler(async (req, res) => {
  const { q, category } = req.query;
  let items = await store.listItems({ statuses: ['approved', 'sold'], q, category });
  items = items.sort((a, b) => {
    const rank = status => (status === 'sold' ? 1 : 0);
    return rank(a.status) - rank(b.status) || b.createdAt - a.createdAt;
  });
  res.render('index', { items, q: q || '', category: category || 'all' });
}));

app.get('/item/:id', asyncHandler(async (req, res) => {
  const item = await store.findItemById(req.params.id);
  const isPublic = item && (item.status === 'approved' || item.status === 'sold');
  if (!isPublic) {
    const user = res.locals.currentUser;
    const canPreview = item && user && (user.role === 'admin' || item.sellerId === user.id);
    if (!canPreview) {
      flash(req, 'error', 'Item not found.');
      return res.redirect('/');
    }
  }
  res.render('item', { item });
}));

app.get('/register', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.render('register', { form: {} });
});

app.post('/register', asyncHandler(async (req, res) => {
  const { name, email, phone, password, confirm } = req.body;
  const form = { name, email, phone };
  if (!name || !email || !password) { flash(req, 'error', 'All fields are required.'); return res.render('register', { form }); }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = (phone || '').replace(/[\s().-]/g, '');
  if (!/^\+?\d{7,15}$/.test(normalizedPhone)) {
    flash(req, 'error', 'Enter a valid phone number with 7 to 15 digits.');
    return res.render('register', { form });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    flash(req, 'error', 'Enter a valid email address.');
    return res.render('register', { form });
  }
  if (password.length < 6) { flash(req, 'error', 'Password must be at least 6 characters.'); return res.render('register', { form }); }
  if (password !== confirm) { flash(req, 'error', 'Passwords do not match.'); return res.render('register', { form }); }
  if (await store.findUserByEmail(normalizedEmail)) {
    flash(req, 'error', 'An account with that email already exists.');
    return res.render('register', { form });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await store.addUser({ name: name.trim(), email: normalizedEmail, phone: normalizedPhone, passwordHash, role: 'user' });
  req.session.userId = user.id;
  flash(req, 'success', `Welcome, ${user.name}! You can now list items for sale.`);
  res.redirect('/my-items');
}));

app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.render('login', { form: {} });
});

app.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await store.findUserByEmail(email || '');
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    flash(req, 'error', 'Invalid email or password.');
    return res.render('login', { form: { email } });
  }
  req.session.userId = user.id;
  flash(req, 'success', `Welcome back, ${user.name}.`);
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
}));

app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

module.exports = { app, upload, requireLogin, requireAdmin, store, cfg, flash, bcrypt, asyncHandler, uploadImage, deleteImage };
require('./routes-items');
require('./routes-api');

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('[request] failed:', error && error.message);
  const isTooLarge = error.code === 'LIMIT_FILE_SIZE';
  const isBadImage = error.message === 'Only image files are allowed';
  const status = isTooLarge ? 413 : isBadImage ? 400 : error.statusCode || 500;
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store');
    return res.status(status).json({
      error: error.expose ? error.message : 'Internal server error.',
    });
  }
  const message = isTooLarge
    ? 'Image must be 4MB or smaller.'
    : isBadImage
      ? 'Only image files are allowed.'
      : error.expose ? error.message : 'Something went wrong. Please try again.';
  if (req.method === 'POST' && req.path === '/sell') {
    flash(req, 'error', message);
    return res.status(status).render('sell', { form: req.body || {} });
  }
  res.status(status).send(message);
});
