const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { put, del } = require('@vercel/blob');
const cfg = require('../config');
const { pool } = require('../db');

function legacyImagePath(image) {
  if (typeof image !== 'string' || !/^\/uploads\/[^/\\]+$/.test(image)) return null;
  return path.join(__dirname, '..', 'public', image.replace(/^\//, ''));
}

function contentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' })[extension] || 'application/octet-stream';
}

async function importLegacyData() {
  const legacyFile = path.join(__dirname, '..', 'data', 'db.json');
  if (!fs.existsSync(legacyFile)) return;
  const data = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
  if (!Array.isArray(data.users) || !Array.isArray(data.items)) return;

  const client = await pool.connect();
  const uploadedImages = [];
  try {
    await client.query('BEGIN');
    const counts = await client.query(
      'SELECT (SELECT count(*)::int FROM users) AS users, (SELECT count(*)::int FROM items) AS items',
    );
    if (counts.rows[0].users || counts.rows[0].items) {
      await client.query('ROLLBACK');
      console.log('Skipped legacy JSON import because the Postgres database already has records.');
      return;
    }

    for (const user of data.users) {
      await client.query(
        `INSERT INTO users (id, name, email, phone, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, user.name, String(user.email).trim().toLowerCase(), user.phone || null, user.passwordHash, user.role || 'user', new Date(user.createdAt || Date.now())],
      );
    }

    for (const item of data.items) {
      let image = item.image || null;
      const localImage = legacyImagePath(image);
      if (localImage && fs.existsSync(localImage) && cfg.BLOB_READ_WRITE_TOKEN) {
        const extension = path.extname(localImage).toLowerCase();
        const blob = await put(`items/legacy-${item.id}-${randomUUID()}${extension}`, fs.readFileSync(localImage), {
          access: 'public',
          token: cfg.BLOB_READ_WRITE_TOKEN,
          contentType: contentType(localImage),
        });
        image = blob.url;
        uploadedImages.push(image);
      }
      await client.query(
        `INSERT INTO items
         (id, title, description, price, category, condition, location, image, seller_id, seller_name, status, created_at, reviewed_at, sold_at, reject_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          item.id, item.title, item.description || '', Number(item.price) || 0, item.category,
          item.condition || 'Used – good', item.location || null, image, item.sellerId, item.sellerName,
          item.status || 'pending', new Date(item.createdAt || Date.now()),
          item.reviewedAt == null ? null : new Date(item.reviewedAt),
          item.soldAt == null ? null : new Date(item.soldAt), item.rejectReason || null,
        ],
      );
      const history = Array.isArray(item.history) && item.history.length
        ? item.history
        : [{ status: item.status || 'pending', at: item.createdAt || Date.now(), note: 'Imported from the legacy store' }];
      for (const entry of history) {
        await client.query(
          'INSERT INTO item_history (item_id, status, at, note) VALUES ($1, $2, $3, $4)',
          [item.id, entry.status || item.status || 'pending', new Date(entry.at || item.createdAt || Date.now()), entry.note || ''],
        );
      }
    }

    await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM users");
    await client.query("SELECT setval(pg_get_serial_sequence('items', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM items");
    await client.query('COMMIT');
    console.log(`Imported ${data.users.length} legacy users and ${data.items.length} legacy items.`);
  } catch (error) {
    await client.query('ROLLBACK');
    for (const image of uploadedImages) {
      try { await del(image, { token: cfg.BLOB_READ_WRITE_TOKEN }); } catch (deleteError) {}
    }
    throw error;
  } finally {
    client.release();
  }
}

async function migrate() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema is up to date.');
    await importLegacyData();
  } finally {
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
});