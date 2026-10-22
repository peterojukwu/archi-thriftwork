// Tiny JSON-file data store (no native dependencies).
// Good enough for a demo / small deployment. For production, swap for a real DB.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { users: [], items: [], seq: { user: 0, item: 0 } };
  }
}

function save(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const db = load();
function persist() { save(db); }

function nextId(kind) { db.seq[kind] = (db.seq[kind] || 0) + 1; return db.seq[kind]; }

// ---- Users ----
function findUserByEmail(email) {
  return db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
}
function findUserById(id) { return db.users.find(u => u.id === Number(id)); }
function addUser(user) {
  const u = { id: nextId('user'), createdAt: Date.now(), ...user };
  db.users.push(u); persist(); return u;
}

// ---- Items ----
function addItem(item) {
  const now = Date.now();
  const it = { id: nextId('item'), createdAt: now, status: 'pending', history: [], ...item };
  if (!it.history || it.history.length === 0) {
    it.history = [{ status: it.status, at: now, note: it.status === 'approved' ? 'Published by admin' : 'Submitted for review' }];
  }
  db.items.push(it); persist(); return it;
}
// Record a status change on an item's timeline.
function pushHistory(id, status, note) {
  const it = findItemById(id);
  if (!it) return null;
  if (!Array.isArray(it.history)) it.history = [];
  it.history.push({ status, at: Date.now(), note: note || '' });
  persist(); return it;
}
function findItemById(id) { return db.items.find(i => i.id === Number(id)); }
function updateItem(id, patch) {
  const it = findItemById(id);
  if (!it) return null;
  Object.assign(it, patch); persist(); return it;
}
function removeItem(id) {
  const idx = db.items.findIndex(i => i.id === Number(id));
  if (idx >= 0) { const [it] = db.items.splice(idx, 1); persist(); return it; }
  return null;
}
function listItems(filter = {}) {
  let list = db.items.slice();
  if (filter.status) list = list.filter(i => i.status === filter.status);
  if (filter.statuses) list = list.filter(i => filter.statuses.includes(i.status));
  if (filter.sellerId) list = list.filter(i => i.sellerId === Number(filter.sellerId));
  if (filter.category && filter.category !== 'all') list = list.filter(i => i.category === filter.category);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    list = list.filter(i => (i.title + ' ' + i.description).toLowerCase().includes(q));
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  db, persist,
  findUserByEmail, findUserById, addUser,
  addItem, pushHistory, findItemById, updateItem, removeItem, listItems,
};
