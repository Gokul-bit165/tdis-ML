const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'data_import', '.env') });
require('dotenv').config(); // Fallback to root .env

const config = {
  host: process.env.HOST || 'localhost',
  port: parseInt(process.env.PORT || '5434', 10),
  user: process.env.USER || 'postgres',
  password: process.env.PASSWORD || 'postgres',
  database: process.env.DATABASE || 'tdis_portal_db',
};

async function ensureDatabaseExists() {
  const rootClient = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });

  await rootClient.connect();
  try {
    const res = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [config.database]
    );
    if (res.rowCount === 0) {
      console.log(`Database "${config.database}" does not exist. Creating...`);
      await rootClient.query(`CREATE DATABASE "${config.database}"`);
      console.log(`Database "${config.database}" created.`);
    } else {
      console.log(`Database "${config.database}" already exists.`);
    }
  } finally {
    await rootClient.end();
  }
}

async function ensureRolesExist(client) {
  for (const role of ['ed_app_admin', 'ed_app_user']) {
    try {
      const res = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [role]);
      if (res.rowCount === 0) {
        await client.query(`CREATE ROLE ${role}`);
        console.log(`Role "${role}" created.`);
      }
    } catch (err) {
      console.warn(`Warning checking/creating role ${role}:`, err.message);
    }
  }
}

async function runMigrations() {
  console.log(`Connecting to PostgreSQL at ${config.host}:${config.port}...`);
  await ensureDatabaseExists();

  const client = new Client(config);
  await client.connect();
  console.log(`Connected to database "${config.database}".`);

  try {
    await ensureRolesExist(client);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const { rows: appliedRows } = await client.query(`SELECT name FROM _migrations`);
    const applied = new Set(appliedRows.map(r => r.name));

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).sort((a, b) => {
      // Natural sort by leading numbers
      const numA = parseInt(a.split('_')[0], 10) || 0;
      const numB = parseInt(b.split('_')[0], 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    console.log(`Found ${files.length} migration files in ${migrationsDir}`);

    for (const file of files) {
      // If 028_cities_table_seed_data.sql is present, skip the split chunks (01, 02, 03) to avoid duplicate heavy seed
      if (file === '028_cities_table_seed_data_01.sql' || 
          file === '028_cities_table_seed_data_02.sql' || 
          file === '028_cities_table_seed_data_03.sql') {
        if (applied.has('028_cities_table_seed_data.sql') || files.includes('028_cities_table_seed_data.sql')) {
          continue;
        }
      }

      if (applied.has(file)) {
        console.log(`⏩ [Skipping] ${file} (already applied)`);
        continue;
      }

      console.log(`▶️ [Applying] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      const startTime = Date.now();
      try {
        await client.query(sql);
        await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
        console.log(`✅ [Applied] ${file} in ${(Date.now() - startTime) / 1000}s`);
      } catch (err) {
        console.error(`❌ [Error in migration ${file}]:`, err.message);
        throw err;
      }
    }

    console.log(`\n🎉 All migrations executed successfully!`);
  } finally {
    await client.end();
  }
}

runMigrations().catch(err => {
  console.error(`Migration failed:`, err);
  process.exit(1);
});
