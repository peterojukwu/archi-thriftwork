const path = require('path');
const express = require('express');

const app = express();
const demoData = require('../seed-data');
const cfg = {
	ADMIN_WHATSAPP: (process.env.ADMIN_WHATSAPP || '').replace(/\D/g, ''),
	CURRENCY: process.env.CURRENCY || '₦',
	CATEGORIES: [
		'Drafting tools', 'Model-making', 'Cutting tools', 'Paper & media',
		'Adhesives & finishing', 'Books & references', 'Software & licenses', 'Other',
	],
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
	const requestedPath = req.query.__path;
	if (typeof requestedPath === 'string' && requestedPath.startsWith('/')) {
		const query = new URLSearchParams(req.query);
		query.delete('__path');
		req.url = requestedPath + (query.size ? `?${query}` : '');
	}
	next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res, next) => {
	res.locals.currentUser = null;
	res.locals.isAdmin = false;
	res.locals.cfg = cfg;
	res.locals.currency = cfg.CURRENCY;
	res.locals.flash = null;
	next();
});

const categoryIcons = {
	'Drafting tools': '<path d="M22 46l10-28 10 28" /><path d="M26 36h12" />',
	'Model-making': '<rect x="16" y="20" width="32" height="24" rx="2"/><path d="M16 28h32"/>',
	'Cutting tools': '<path d="M18 44l22-22 6 6-22 22z"/><path d="M18 44l-2 6 6-2"/>',
	'Paper & media': '<rect x="20" y="14" width="24" height="34" rx="2"/><path d="M26 24h12M26 30h12M26 36h8"/>',
	'Adhesives & finishing': '<path d="M27 16h10v8H27z"/><path d="M25 24h14v22a3 3 0 0 1-3 3H28a3 3 0 0 1-3-3z"/>',
	'Books & references': '<path d="M16 18h14a4 4 0 0 1 4 4v24a4 4 0 0 0-4-4H16z"/><path d="M48 18H34a4 4 0 0 0-4 4v24a4 4 0 0 1 4-4h14z"/>',
	'Software & licenses': '<rect x="16" y="18" width="32" height="22" rx="2"/><path d="M24 46h16M32 40v6"/>',
	'Other': '<circle cx="32" cy="32" r="14"/><path d="M32 24v16M24 32h16"/>',
};

app.locals.catIcon = category => {
	const inner = categoryIcons[category] || categoryIcons.Other;
	return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
};
app.locals.fmtDate = ts => ts ? new Date(ts).toLocaleString('en-GB', {
	day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '';
app.locals.waLink = item => {
	if (!cfg.ADMIN_WHATSAPP) return null;
	const message = `Hello Archi Thrift! I'm interested in "${item.title}" (${cfg.CURRENCY}${item.price}) in ${item.location || 'your listings'}. Is it still available?`;
	return `https://wa.me/${cfg.ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
};

const items = demoData.map((item, index) => {
	const status = item.status || 'approved';
	const now = Date.now() - index * 60000;
	return {
		...item,
		id: index + 1,
		sellerId: 1,
		sellerName: item.seller,
		createdAt: now,
		reviewedAt: now,
		soldAt: status === 'sold' ? now : null,
		rejectReason: null,
		history: [{ status: 'approved', at: now, note: 'Published by admin' }].concat(
			status === 'sold' ? [{ status: 'sold', at: now, note: 'Marked as sold' }] : [],
		),
	};
});

function showAuthPreview(req, res, view, form = {}) {
	res.locals.flash = {
		type: 'error',
		msg: 'Account access is not connected yet. You can browse listings while the backend is being prepared.',
	};
	res.render(view, { form });
}

app.get('/', (req, res) => {
	const { q = '', category = 'all' } = req.query;
	const query = String(q).trim().toLowerCase();
	const visibleItems = items.filter(item => {
		const publicStatus = item.status === 'approved' || item.status === 'sold';
		const matchesCategory = category === 'all' || item.category === category;
		const matchesQuery = !query || `${item.title} ${item.description}`.toLowerCase().includes(query);
		return publicStatus && matchesCategory && matchesQuery;
	}).sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold') || b.createdAt - a.createdAt);
	res.render('index', { items: visibleItems, q: String(q), category: String(category) });
});

app.get('/item/:id', (req, res) => {
	const item = items.find(entry => entry.id === Number(req.params.id));
	if (!item || !['approved', 'sold'].includes(item.status)) return res.redirect('/');
	res.render('item', { item });
});

app.get('/login', (req, res) => res.render('login', { form: {} }));
app.get('/register', (req, res) => res.render('register', { form: {} }));
app.post('/login', (req, res) => showAuthPreview(req, res, 'login', { email: req.body.email }));
app.post('/register', (req, res) => showAuthPreview(req, res, 'register', req.body));
app.post('/logout', (req, res) => res.redirect('/'));

app.get(['/sell', '/my-items', '/admin'], (req, res) => res.redirect('/login'));
app.post(['/sell', '/item/:id/sold', '/item/:id/relist', '/item/:id/delete'], (req, res) => res.redirect('/login'));

module.exports = app;