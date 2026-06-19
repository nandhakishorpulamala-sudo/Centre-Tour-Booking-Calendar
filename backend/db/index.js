const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'password'}@${process.env.POSTGRES_HOST || 'db'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'centredb'}`
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log('Running migration', file);
    await pool.query(sql);
  }
}

async function init() {
  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration error', err);
    throw err;
  }
}

module.exports = { pool, init };
