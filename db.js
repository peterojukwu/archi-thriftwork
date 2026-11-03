const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cfg = require('./config');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure a Postgres connection string before starting the app.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

function timestamp(value) {
  return value == null ? null : new Date(value).getTime();
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: timestamp(row.created_at),
  };
}

function mapItem(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    condition: row.condition,
    location: row.location,
    image: row.image,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    status: row.status,
    createdAt: timestamp(row.created_at),
    reviewedAt: timestamp(row.reviewed_at),
    soldAt: timestamp(row.sold_at),
    rejectReason: row.reject_reason,
    history: [],
  };
}

async function attachHistory(items) {
  if (!items.length) return items;
  const ids = items.map(item => item.id);
  const result = await pool.query(
    'SELECT item_id, status, at, note FROM item_history WHERE item_id = ANY($1::int[]) ORDER BY id',
    [ids],
  );
  const histories = new Map(items.map(item => [item.id, []]));
  for (const row of result.rows) {
    histories.get(row.item_id).push({ status: row.status, at: timestamp(row.at), note: row.note });
  }
  for (const item of items) item.history = histories.get(item.id);
  return items;
}

async function findUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1', [String(email || '')]);
  return mapUser(result.rows[0]);
}

async function findUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [Number(id)]);
  return mapUser(result.rows[0]);
}

async function addUser(user) {
  const result = await pool.query(
    `INSERT INTO users (name, email, phone, password_hash, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [user.name, String(user.email).trim().toLowerCase(), user.phone || null, user.passwordHash, user.role || 'user'],
  );
  return mapUser(result.rows[0]);
}

async function listUsers() {
  const result = await pool.query('SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC');
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: timestamp(row.created_at),
  }));
}

async function addItem(item) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO items
       (title, description, price, category, condition, location, image, seller_id, seller_name, status, reviewed_at, reject_reason, sold_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        item.title, item.description || '', Number(item.price) || 0, item.category, item.condition || 'Used – good',
        item.location || null, item.image || null, item.sellerId, item.sellerName, item.status || 'pending',
        item.reviewedAt == null ? null : new Date(item.reviewedAt), item.rejectReason || null,
        item.soldAt == null ? null : new Date(item.soldAt),
      ],
    );
    const row = result.rows[0];
    const note = row.status === 'approved' ? 'Published by admin' : 'Submitted for review';
    await client.query('INSERT INTO item_history (item_id, status, note) VALUES ($1, $2, $3)', [row.id, row.status, note]);
    await client.query('COMMIT');
    return await findItemById(row.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function pushHistory(id, status, note) {
  const result = await pool.query(
    `INSERT INTO item_history (item_id, status, note)
     SELECT id, $2, $3 FROM items WHERE id = $1 RETURNING item_id`,
    [Number(id), status, note || ''],
  );
  return result.rowCount ? findItemById(id) : null;
}

async function findItemById(id) {
  const result = await pool.query('SELECT * FROM items WHERE id = $1', [Number(id)]);
  if (!result.rows[0]) return null;
  const [item] = await attachHistory([mapItem(result.rows[0])]);
  return item;
}

async function updateItem(id, patch) {
  const columns = {
    title: 'title', description: 'description', price: 'price', category: 'category', condition: 'condition',
    location: 'location', image: 'image', sellerId: 'seller_id', sellerName: 'seller_name', status: 'status',
    reviewedAt: 'reviewed_at', soldAt: 'sold_at', rejectReason: 'reject_reason',
  };
  const updates = Object.entries(patch).filter(([key]) => columns[key]);
  if (!updates.length) return findItemById(id);
  const values = [Number(id)];
  const assignments = updates.map(([key, value]) => {
    values.push(key === 'reviewedAt' || key === 'soldAt' ? (value == null ? null : new Date(value)) : value);
    return `${columns[key]} = $${values.length}`;
  });
  const result = await pool.query(`UPDATE items SET ${assignments.join(', ')} WHERE id = $1 RETURNING id`, values);
  return result.rowCount ? findItemById(id) : null;
}

async function removeItem(id) {
  const item = await findItemById(id);
  if (!item) return null;
  const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [Number(id)]);
  return result.rowCount ? item : null;
}

async function listItems(filter = {}) {
  const conditions = [];
  const values = [];
  const addCondition = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace('?', `$${values.length}`));
  };
  if (filter.status) addCondition('status = ?', filter.status);
  if (filter.statuses) addCondition('status = ANY(?::text[])', filter.statuses);
  if (filter.sellerId) addCondition('seller_id = ?', Number(filter.sellerId));
  if (filter.category && filter.category !== 'all') addCondition('category = ?', filter.category);
  if (filter.q) {
    values.push(`%${filter.q}%`);
    conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`SELECT * FROM items ${where} ORDER BY created_at DESC`, values);
  return attachHistory(result.rows.map(mapItem));
}

let seedPromise;
async function seedInitialData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [73419261]);
    let adminResult = await client.query("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    let admin = mapUser(adminResult.rows[0]);
    if (!admin) {
      if (!cfg.ADMIN_PASSWORD) {
        throw new Error('ADMIN_PASSWORD is required to create the first admin account. Set it in the environment and retry.');
      }
      const passwordHash = await bcrypt.hash(cfg.ADMIN_PASSWORD, 10);
      adminResult = await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin') RETURNING *`,
        [cfg.ADMIN_NAME, cfg.ADMIN_EMAIL.trim().toLowerCase(), passwordHash],
      );
      admin = mapUser(adminResult.rows[0]);
      console.log('Seeded admin account.');
    }

    const countResult = await client.query('SELECT count(*)::int AS count FROM items');
    if (countResult.rows[0].count === 0) {
      const products = require('./seed-data');
      await client.query(
        `WITH products AS (
           SELECT * FROM jsonb_to_recordset($1::jsonb) AS p(
             title text, description text, price numeric, category text, condition text,
             location text, seller_name text, seed_status text
           )
         ), inserted AS (
           INSERT INTO items
           (title, description, price, category, condition, location, seller_id, seller_name, status, reviewed_at, sold_at)
           SELECT title, COALESCE(description, ''), price, category, COALESCE(condition, 'Used – good'), location,
             $2, COALESCE(seller_name, $3),
             CASE WHEN seed_status = 'sold' THEN 'sold' ELSE 'approved' END,
             now(), CASE WHEN seed_status = 'sold' THEN now() ELSE NULL END
           FROM products
           RETURNING id, status
         )
         INSERT INTO item_history (item_id, status, note)
         SELECT id, 'approved', 'Published by admin' FROM inserted
         UNION ALL
         SELECT id, 'sold', 'Marked as sold' FROM inserted WHERE status = 'sold'`,
        [JSON.stringify(products.map(product => ({
          title: product.title,
          description: product.description || '',
          price: product.price,
          category: product.category,
          condition: product.condition || 'Used – good',
          location: product.location,
          seller_name: product.seller || admin.name,
          seed_status: product.status,
        }))), admin.id, admin.name],
      );
      console.log(`Seeded ${products.length} demo products.`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedInitialData().catch(error => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

module.exports = {
  pool,
  ensureSeeded,
  findUserByEmail,
  findUserById,
  addUser,
  listUsers,
  addItem,
  pushHistory,
  findItemById,
  updateItem,
  removeItem,
  listItems,
};
