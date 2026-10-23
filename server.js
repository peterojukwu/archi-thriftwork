const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');

const cfg = require('./config');
const store = require('./db');

const app = express();

// ---- View engine ----
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---- Static + body parsing ----
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// ---- Sessions ----
app.use(session({
  secret: cfg.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
}));

// ---- Locals available to every template ----
app.use((req, res, next) => {
  const user = req.session.userId ? store.findUserById(req.session.userId) : null;
  res.locals.currentUser = user || null;
  res.locals.isAdmin = !!(user && user.role === 'admin');
  res.locals.cfg = cfg;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.currency = cfg.CURRENCY;
  next();
});

function flash(req, type, msg) {
  req.session.flash = { type, msg };
  // Also expose immediately so same-request re-renders (e.g. form validation) show it.
  if (req.res) req.res.locals.flash = { type, msg };
}

// ---- Image uploads ----
const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, 'item-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp|gif)/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

// ---- Auth guards ----
function requireLogin(req, res, next) {
  if (!req.session.userId) { flash(req, 'error', 'Please log in to continue.'); return res.redirect('/login'); }
  next();
}
function requireAdmin(req, res, next) {
  const u = req.session.userId ? store.findUserById(req.session.userId) : null;
  if (!u || u.role !== 'admin') { flash(req, 'error', 'Admins only.'); return res.redirect('/'); }
  next();
}

// Build a WhatsApp enquiry link for an item.
function waLink(item) {
  if (!cfg.ADMIN_WHATSAPP) return null;
  const msg = `Hello Archi Thrift! I'm interested in \"${item.title}\" (${cfg.CURRENCY}${item.price}) in ${item.location || 'your listings'}. Is it still available?`;
  return `https://wa.me/${cfg.ADMIN_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
app.locals.waLink = waLink;

// Human-friendly date for status timelines.
app.locals.fmtDate = (ts) => {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return ''; }
};

// Inline SVG placeholder per category (used when an item has no photo).
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
  const inner = CAT_ICONS[category] || CAT_ICONS['Other'];
  return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
};

// ================= PUBLIC ROUTES =================

// Dashboard — approved (and sold) items, visible without logging in.
app.get('/', (req, res) => {
  const { q, category } = req.query;
  let items = store.listItems({ statuses: ['approved', 'sold'], q, category });
  // Available items first, sold ones after.
  items = items.sort((a, b) => {
    const rank = s => (s === 'sold' ? 1 : 0);
    return rank(a.status) - rank(b.status) || b.createdAt - a.createdAt;
  });
  res.render('index', { items, q: q || '', category: category || 'all' });
});

// Item detail — public (approved or sold). Enquire button goes to admin WhatsApp.
app.get('/item/:id', (req, res) => {
  const item = store.findItemById(req.params.id);
  const isPublic = item && (item.status === 'approved' || item.status === 'sold');
  if (!isPublic) {
    // allow owner/admin to preview their own non-public item
    const u = req.session.userId ? store.findUserById(req.session.userId) : null;
    const canPreview = item && u && (u.role === 'admin' || item.sellerId === u.id);
    if (!canPreview) { flash(req, 'error', 'Item not found.'); return res.redirect('/'); }
  }
  res.render('item', { item });
});

// ================= AUTH ROUTES =================

app.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { form: {} });
});

app.post('/register', async (req, res) => {
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
  if (store.findUserByEmail(normalizedEmail)) { flash(req, 'error', 'An account with that email already exists.'); return res.render('register', { form }); }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = store.addUser({ name: name.trim(), email: normalizedEmail, phone: normalizedPhone, passwordHash, role: 'user' });
  req.session.userId = user.id;
  flash(req, 'success', `Welcome, ${user.name}! You can now list items for sale.`);
  res.redirect('/my-items');
});

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { form: {} });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = store.findUserByEmail(email || '');
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    flash(req, 'error', 'Invalid email or password.');
    return res.render('login', { form: { email } });
  }
  req.session.userId = user.id;
  flash(req, 'success', `Welcome back, ${user.name}.`);
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = { app, upload, requireLogin, requireAdmin, store, cfg, flash, bcrypt };
require('./routes-items');

// ---- Seed the admin account on first run ----
async function seedAdmin() {
  const existing = store.db.users.find(u => u.role === 'admin');
  if (existing) return existing;
  if (!cfg.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD before starting for the first time.');
  const passwordHash = await bcrypt.hash(cfg.ADMIN_PASSWORD, 10);
  const admin = store.addUser({ name: cfg.ADMIN_NAME, email: cfg.ADMIN_EMAIL, passwordHash, role: 'admin' });
  console.log('Seeded default admin account.');
  return admin;
}

// ---- Seed a demo catalogue on first run (only when there are no items) ----
function seedProducts(admin) {
  if (store.db.items.length > 0) return;
  const data = require('./seed-data');
  data.forEach(p => {
    const item = store.addItem({
      title: p.title,
      description: p.description || '',
      price: p.price,
      category: p.category,
      condition: p.condition || 'Used – good',
      location: p.location,
      image: null,
      sellerId: admin.id,
      sellerName: p.seller || admin.name,
      status: 'approved',
      reviewedAt: Date.now(),
      rejectReason: null,
    });
    if (p.status === 'sold') {
      store.updateItem(item.id, { status: 'sold', soldAt: Date.now() });
      store.pushHistory(item.id, 'sold', 'Marked as sold');
    }
  });
  console.log(`Seeded ${data.length} demo products.`);
}

const PORT = cfg.PORT;
seedAdmin().then((admin) => {
  seedProducts(admin);
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`\nArchi Thrift running at http://127.0.0.1:${PORT}`);
    console.log(`Admin login email: ${cfg.ADMIN_EMAIL}`);
    const mailMode = !cfg.EMAIL.ENABLED ? 'off'
      : (cfg.EMAIL.SMTP_HOST ? `SMTP ${cfg.EMAIL.SMTP_HOST}:${cfg.EMAIL.SMTP_PORT}` : 'log-only (set SMTP_* to send real email)');
    console.log(`Email notifications: ${mailMode}\n`);
  });
}).catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exitCode = 1;
});
