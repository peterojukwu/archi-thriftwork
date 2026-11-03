const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const demoData = require('../seed-data');

const root = path.join(__dirname, '..');
const views = path.join(root, 'views');
const publicDirectory = path.join(root, 'public');
const categories = [
  'Drafting tools', 'Model-making', 'Cutting tools', 'Paper & media',
  'Adhesives & finishing', 'Books & references', 'Software & licenses', 'Other',
];
const cfg = {
  ADMIN_WHATSAPP: (process.env.ADMIN_WHATSAPP || '').replace(/\D/g, ''),
  CURRENCY: process.env.CURRENCY || '₦',
  CATEGORIES: categories,
};

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

const locals = {
  currentUser: null,
  isAdmin: false,
  cfg,
  currency: cfg.CURRENCY,
  flash: null,
  catIcon: category => {
    const inner = categoryIcons[category] || categoryIcons.Other;
    return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  },
  fmtDate: ts => ts ? new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : '',
  waLink: item => {
    if (!cfg.ADMIN_WHATSAPP) return null;
    const message = `Hello Archi Thrift! I'm interested in "${item.title}" (${cfg.CURRENCY}${item.price}) in ${item.location || 'your listings'}. Is it still available?`;
    return `https://wa.me/${cfg.ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
  },
};

const items = demoData.map((item, index) => {
  const status = item.status || 'approved';
  const timestamp = Date.now() - index * 60000;
  return {
    ...item,
    id: index + 1,
    sellerId: 1,
    sellerName: item.seller,
    createdAt: timestamp,
    reviewedAt: timestamp,
    soldAt: status === 'sold' ? timestamp : null,
    rejectReason: null,
    history: [{ status: 'approved', at: timestamp, note: 'Published by admin' }].concat(
      status === 'sold' ? [{ status: 'sold', at: timestamp, note: 'Marked as sold' }] : [],
    ),
  };
});

function render(view, data) {
  const filename = path.join(views, `${view}.ejs`);
  return ejs.render(fs.readFileSync(filename, 'utf8'), { ...locals, ...data }, { filename });
}

function writePage(relativePath, html) {
  const filename = path.join(publicDirectory, relativePath);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, html);
}

const publicItems = items.filter(item => ['approved', 'sold'].includes(item.status));
const customHome = path.join(publicDirectory, 'index.html');
if (!fs.existsSync(customHome)) writePage('index.html', render('index', { items: publicItems, q: '', category: 'all' }));
const browserItems = publicItems.map(item => ({
  id: item.id,
  title: item.title,
  description: item.description || '',
  price: item.price,
  category: item.category,
  condition: item.condition || 'Used - good',
  location: item.location || 'Location N/A',
  seller: item.sellerName,
  status: item.status,
}));
writePage('js/marketplace-data.js', `window.ARCHI_CURRENCY = ${JSON.stringify(cfg.CURRENCY)};\nwindow.ARCHI_LISTINGS = ${JSON.stringify(browserItems)};\n`);
writePage('login.html', render('login', { form: {} }));
writePage('register.html', render('register', { form: {} }));
for (const item of publicItems) writePage(`item/${item.id}.html`, render('item', { item }));

console.log(`Generated the marketplace catalog, ${publicItems.length} item pages, and auth pages.`);