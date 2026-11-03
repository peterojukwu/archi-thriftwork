// Item listing, selling, my-items, and admin moderation routes.
const { app, upload, requireLogin, requireAdmin, store, cfg, flash, asyncHandler, uploadImage, deleteImage } = require('./app');
const mailer = require('./mailer');

// ---- Seller: list a new item ----
app.get('/sell', requireLogin, (req, res) => {
  res.render('sell', { form: {} });
});

app.post('/sell', requireLogin, upload.single('image'), asyncHandler(async (req, res) => {
  const user = res.locals.currentUser;
  const { title, description, price, category, condition, location } = req.body;
  const form = { title, description, price, category, condition, location };
  if (!title || !price || !category || !location) {
    flash(req, 'error', 'Title, price, category and location are required.');
    return res.render('sell', { form });
  }
  const isAdmin = user.role === 'admin';
  const image = await uploadImage(req.file);
  let item;
  try {
    item = await store.addItem({
      title: title.trim(),
      description: (description || '').trim(),
      price: Number(price) || 0,
      category,
      condition: condition || 'Used – good',
      location: location.trim(),
      image,
      sellerId: user.id,
      sellerName: user.name,
      status: isAdmin ? 'approved' : 'pending',
      reviewedAt: isAdmin ? Date.now() : null,
      rejectReason: null,
    });
  } catch (error) {
    await deleteImage(image);
    throw error;
  }
  if (isAdmin) {
    flash(req, 'success', 'Item posted and published to the dashboard.');
    return res.redirect('/item/' + item.id);
  }
  await mailer.notifyStatusChange(store, item, 'submitted', { sellerName: user.name });
  flash(req, 'success', 'Item submitted! It will appear once an admin approves it.');
  res.redirect('/my-items');
}));

// ---- Seller: my listings with statuses + history ----
app.get('/my-items', requireLogin, asyncHandler(async (req, res) => {
  const items = await store.listItems({ sellerId: req.session.userId });
  res.render('my-items', { items });
}));

// ---- Seller/Admin: mark an approved item as sold ----
app.post('/item/:id/sold', requireLogin, asyncHandler(async (req, res) => {
  const user = res.locals.currentUser;
  const item = await store.findItemById(req.params.id);
  if (!item) { flash(req, 'error', 'Item not found.'); return res.redirect('/my-items'); }
  if (item.sellerId !== user.id && user.role !== 'admin') {
    flash(req, 'error', 'You cannot change that item.'); return res.redirect('/my-items');
  }
  if (item.status !== 'approved') {
    flash(req, 'error', 'Only live (approved) items can be marked as sold.');
    return res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
  }
  const updated = await store.updateItem(item.id, { status: 'sold', soldAt: Date.now() });
  await store.pushHistory(item.id, 'sold', 'Marked as sold');
  await mailer.notifyStatusChange(store, updated, 'sold');
  flash(req, 'success', `“${item.title}” marked as sold.`);
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
}));

// ---- Seller/Admin: relist a sold item (back to live) ----
app.post('/item/:id/relist', requireLogin, asyncHandler(async (req, res) => {
  const user = res.locals.currentUser;
  const item = await store.findItemById(req.params.id);
  if (!item) { flash(req, 'error', 'Item not found.'); return res.redirect('/my-items'); }
  if (item.sellerId !== user.id && user.role !== 'admin') {
    flash(req, 'error', 'You cannot change that item.'); return res.redirect('/my-items');
  }
  if (item.status !== 'sold') { return res.redirect('/my-items'); }
  const updated = await store.updateItem(item.id, { status: 'approved', soldAt: null });
  await store.pushHistory(item.id, 'approved', 'Relisted as available');
  await mailer.notifyStatusChange(store, updated, 'relisted');
  flash(req, 'success', `“${item.title}” is live again.`);
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
}));

// ---- Seller: delete own item ----
app.post('/item/:id/delete', requireLogin, asyncHandler(async (req, res) => {
  const user = res.locals.currentUser;
  const item = await store.findItemById(req.params.id);
  if (!item) { flash(req, 'error', 'Item not found.'); return res.redirect('/my-items'); }
  if (item.sellerId !== user.id && user.role !== 'admin') {
    flash(req, 'error', 'You cannot delete that item.'); return res.redirect('/my-items');
  }
  await store.removeItem(item.id);
  await deleteImage(item.image);
  flash(req, 'success', 'Item deleted.');
  res.redirect(user.role === 'admin' ? '/admin' : '/my-items');
}));

// ================= ADMIN MODERATION =================

app.get('/admin', requireAdmin, asyncHandler(async (req, res) => {
  const [pending, approved, rejected, sold, users] = await Promise.all([
    store.listItems({ status: 'pending' }),
    store.listItems({ status: 'approved' }),
    store.listItems({ status: 'rejected' }),
    store.listItems({ status: 'sold' }),
    store.listUsers(),
  ]);
  res.render('admin', { pending, approved, rejected, sold, users });
}));

app.post('/admin/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const item = await store.updateItem(req.params.id, { status: 'approved', reviewedAt: Date.now(), rejectReason: null });
  if (item) await store.pushHistory(item.id, 'approved', 'Approved by admin');
  if (item) await mailer.notifyStatusChange(store, item, 'approved');
  flash(req, item ? 'success' : 'error', item ? `Approved “${item.title}” — now live on the dashboard.` : 'Item not found.');
  res.redirect('/admin');
}));

app.post('/admin/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const reason = (req.body.reason || '').trim();
  const item = await store.updateItem(req.params.id, { status: 'rejected', reviewedAt: Date.now(), rejectReason: reason || 'No reason provided.' });
  if (item) await store.pushHistory(item.id, 'rejected', reason ? ('Rejected: ' + reason) : 'Rejected by admin');
  if (item) await mailer.notifyStatusChange(store, item, 'rejected', { reason: reason || 'No reason provided.' });
  flash(req, item ? 'success' : 'error', item ? `Rejected “${item.title}”. The seller can see your reason.` : 'Item not found.');
  res.redirect('/admin');
}));
