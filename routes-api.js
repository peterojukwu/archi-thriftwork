const express = require('express');
const { app, store, cfg, bcrypt, asyncHandler } = require('./app');

const router = express.Router();
const dummyPasswordHash = bcrypt.hashSync('invalid-password-for-timing-check', 10);

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function requireApiLogin(req, res, next) {
  if (!res.locals.currentUser) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  next();
}

router.get('/session', (req, res) => {
  res.json({ user: publicUser(res.locals.currentUser) });
});

router.get('/config', (req, res) => {
  res.json({ authUrl: cfg.NEON_AUTH_BASE_URL || null });
});

router.post('/auth/session', requireApiLogin, (req, res) => {
  res.json({ user: publicUser(res.locals.currentUser) });
});

router.get('/listings', asyncHandler(async (req, res) => {
  const listings = await store.listItems({ statuses: ['approved', 'sold'] });
  listings.sort((first, second) =>
    Number(first.status === 'sold') - Number(second.status === 'sold') || second.createdAt - first.createdAt,
  );
  res.json({
    currency: cfg.CURRENCY,
    listings: listings.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      category: item.category,
      condition: item.condition,
      location: item.location,
      seller: item.sellerName,
      status: item.status,
      image: item.image,
    })),
  });
}));

router.get('/listings/:id/contact', requireApiLogin, asyncHandler(async (req, res) => {
  const item = await store.findItemById(req.params.id);
  if (!item || item.status !== 'approved') {
    return res.status(404).json({ error: 'Listing not found.' });
  }
  const url = app.locals.waLink(item);
  if (!url) return res.status(503).json({ error: 'Seller contact is not configured.' });
  res.json({ url });
}));

router.post('/auth/register', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.replace(/[\s().-]/g, '') : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const confirm = typeof body.confirm === 'string' ? body.confirm : '';

  if (!name || !email || !phone || !password || !confirm) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!/^\+?\d{7,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Enter a valid phone number with 7 to 15 digits.' });
  }
  if (password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be between 8 and 200 characters.' });
  }
  if (password !== confirm) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }
  if (await store.findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await store.addUser({ name, email, phone, passwordHash, role: 'user' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    throw error;
  }

  req.session = req.session || {};
  req.session.userId = user.id;
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/auth/login', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const user = await store.findUserByEmail(email);
  const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : dummyPasswordHash);

  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session = req.session || {};
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
}));

router.post('/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

router.use((error, req, res, next) => {
  const status = Number(error.statusCode) || 500;
  if (status >= 500) console.error('[api] request failed:', error && error.message);
  res.status(status).json({
    error: error.expose ? error.message : 'Internal server error.',
  });
});

app.use('/api', router);
