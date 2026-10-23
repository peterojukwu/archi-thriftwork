// Item listing, selling, my-items, and admin moderation routes.
const fs = require('fs');
const path = require('path');
const { app, upload, requireLogin, requireAdmin, store, cfg, flash } = require('./server');
const mailer = require('./mailer');

// ---- Seller: list a new item ----
app.get('/sell', requireLogin, (req, res) => {
  res.render('sell', { form: {} });
});

app.post('/sell', requireLogin, upload.single('image'), (req, res) => {
  const user = store.findUserById(req.session.userId);
  const { title, description, price, category, condition, location } = req.body;
  const form = { title, description, price, category, condition, location };
  if (!title || !price || !category || !location) {
    flash(req, 'error', 'Title, price, category and location are required.');
    return res.render('sell', { form });
  }
  const isAdmin = user.role === 'admin';
  const item = store.addItem({
    title: title.trim(),
    description: (description || '').trim(),
    price: Number(price) || 0,
    category,
    condition: condition || 'Used – good',
    location: location.trim(),
    image: req.file ? '/uploads/' + req.file.filename : null,
    sellerId: user.id,
    sellerName: user.name,
    // Admin posts are auto-approved; everyone else starts as pending.
    status: isAdmin ? 'approved' : 'pending',
    reviewedAt: isAdmin ? Date.now() : null,
    rejectReason: null,
  });
  if (isAdmin) {
    flash(req, 'success', 'Item posted and published to the dashboard.');
    return res.redirect('/item/' + item.id);
  }
  // Let the admin know a new item is waiting for review (best-effort, non-blocking).
  mailer.notifyStatusChange(store, item, 'submitted', { sellerName: user.name });
  flash(req, 'success', 'Item submitted! It will appear once an admin approves it.');
  res.redirect('/my-items');
});

// ---- Seller: my listings with statuses + history ----
app.get('/my-items', requireLogin, (req, res) => {
  const items = store.listItems({ sellerId: req.session.userId });
  res.render('my-items', { items });
});

// ---- Seller/Admin: mark an approved item as sold ----
app.post('/item/:id/sold', requireLogin, (req, res) => {
  const user = store.findUserById(req.session.userId);
  const item = store.findItemById(req.params.id);
  if (!item) { flash(req, 'error', 'Item not found.'); return res.redirect('/my-items'); }
  if (item.sellerId !== user.id && user.role !== 'admin') {
    flash(req, 'error', 'You cannot change that item.'); return res.redirect('/my-items');
  }
  if (item.status !== 'approved') {
    flash(req, 'error', 'Only live (approved) items can be marked as sold.');
    return res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
  }
  store.updateItem(item.id, { status: 'sold', soldAt: Date.now() });
  store.pushHistory(item.id, 'sold', 'Marked as sold');
  mailer.notifyStatusChange(store, item, 'sold');
  flash(req, 'success', `“${item.title}” marked as sold.`);
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
});

// ---- Seller/Admin: relist a sold item (back to live) ----
app.post('/item/:id/relist', requireLogin, (req, res) => {
  const user = store.findUserById(req.session.userId);
  const item = store.findItemById(req.params.id);
  if (!item) { flash(req, 'error', 'Item not found.'); return res.redirect('/my-items'); }
  if (item.sellerId !== user.id && user.role !== 'admin') {
    flash(req, 'error', 'You cannot change that item.'); return res.redirect('/my-items');
  }
  if (item.status !== 'sold') { return res.redirect('/my-items'); }
  store.updateItem(item.id, { status: 'approved', soldAt: null });
  store.pushHistory(item.id, 'approved', 'Relisted as available');
  mailer.notifyStatusChange(store, item, 'relisted');
  flash(req, 'success', `“${item.title}” is live again.`);
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
});

// ---- Seller: delete own item ----
app.post('/item/:id/delete', requireLogin, (req, res) => {
  const user = store.findUserById(req.session.userId);
  const item = store.findItemById(req.params.id);
  if (!item) { flash(req, 'error', 'Item not found.'); return res.redirect('/my-items'); }
  if (item.sellerId !== user.id && user.role !== 'admin') {
    flash(req, 'error', 'You cannot delete that item.'); return res.redirect('/my-items');
  }
  if (item.image) { try { fs.unlinkSync(path.join(__dirname, 'public', item.image)); } catch (e) {} }
  store.removeItem(item.id);
  flash(req, 'success', 'Item deleted.');
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
});

// ================= ADMIN MODERATION =================

app.get('/admin', requireAdmin, (req, res) => {
  const pending = store.listItems({ status: 'pending' });
  const approved = store.listItems({ status: 'approved' });
  const rejected = store.listItems({ status: 'rejected' });
  const sold = store.listItems({ status: 'sold' });
  const users = store.db.users.map(({ id, name, email, phone, createdAt, role }) => ({ id, name, email, phone, createdAt, role }));
  res.render('admin', { pending, approved, rejected, sold, users });
});

app.post('/admin/:id/approve', requireAdmin, (req, res) => {
  const item = store.updateItem(req.params.id, { status: 'approved', reviewedAt: Date.now(), rejectReason: null });
  if (item) store.pushHistory(item.id, 'approved', 'Approved by admin');
  if (item) mailer.notifyStatusChange(store, item, 'approved');
  flash(req, item ? 'success' : 'error', item ? `Approved “${item.title}” — now live on the dashboard.` : 'Item not found.');
  res.redirect('/admin');
});

app.post('/admin/:id/reject', requireAdmin, (req, res) => {
  const reason = (req.body.reason || '').trim();
  const item = store.updateItem(req.params.id, { status: 'rejected', reviewedAt: Date.now(), rejectReason: reason || 'No reason provided.' });
  if (item) store.pushHistory(item.id, 'rejected', reason ? ('Rejected: ' + reason) : 'Rejected by admin');
  if (item) mailer.notifyStatusChange(store, item, 'rejected', { reason: reason || 'No reason provided.' });
  flash(req, item ? 'success' : 'error', item ? `Rejected “${item.title}”. The seller can see your reason.` : 'Item not found.');
  res.redirect('/admin');
});
