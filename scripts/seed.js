const { pool, ensureSeeded } = require('../db');

async function seed() {
  try {
    await ensureSeeded();
  } finally {
    await pool.end();
  }
}

seed().catch(error => {
  console.error('Seeding failed:', error.message);
  process.exitCode = 1;
});