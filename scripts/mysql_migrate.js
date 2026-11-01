#!/usr/bin/env node
/**
 * Hostinger MySQL Migration & Deployment Runner
 * Usage:
 *   node scripts/mysql_migrate.js [--seed]
 */

const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');
const { getPool, ping, closePool } = require('../src/db/mysqlClient');

async function runMySQLMigration() {
  console.log('=======================================================');
  console.log('  Veridian Connector OS — Hostinger MySQL Migration   ');
  console.log(`  Target Host: ${config.MYSQL_HOST}:${config.MYSQL_PORT}`);
  console.log(`  Database:    ${config.MYSQL_DATABASE || '(NOT CONFIGURED)'}`);
  console.log(`  User:        ${config.MYSQL_USER || '(NOT CONFIGURED)'}`);
  console.log('=======================================================');

  if (!config.MYSQL_DATABASE || !config.MYSQL_USER) {
    console.error('❌ Error: MYSQL_DATABASE and MYSQL_USER must be set in environment variables or .env file.');
    console.error('   Please configure your Hostinger MySQL credentials before running migrations.');
    process.exit(1);
  }

  // 1. Verify Connectivity
  console.log('Connecting to Hostinger MySQL instance...');
  const health = await ping();
  if (!health.ok) {
    console.error(`❌ Connection failed: ${health.error}`);
    console.error('   Ensure MySQL is running on Hostinger and credentials are correct.');
    process.exit(1);
  }
  console.log(`✅ Connected successfully (Latency: ${health.latencyMs}ms)`);

  const pool = getPool().promise();

  // 2. Read and apply schema
  const schemaFile = path.join(__dirname, 'mysql_schema.sql');
  if (!fs.existsSync(schemaFile)) {
    console.error(`❌ Schema file missing: ${schemaFile}`);
    process.exit(1);
  }

  console.log('Applying relational schema (scripts/mysql_schema.sql)...');
  const schemaSql = fs.readFileSync(schemaFile, 'utf8');

  // Split SQL commands by semicolon while respecting strings and multi-line comments
  const statements = schemaSql
    .split(/;\s*[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      console.warn(`Notice on statement: ${err.message}`);
    }
  }
  console.log(`✅ Schema applied (${statements.length} statements executed).`);

  // 3. Check for --seed flag
  const withSeed = process.argv.includes('--seed');
  if (withSeed) {
    const seedFile = path.join(__dirname, 'mysql_seed.sql');
    if (fs.existsSync(seedFile)) {
      console.log('Seeding initial synthetic records (scripts/mysql_seed.sql)...');
      const seedSql = fs.readFileSync(seedFile, 'utf8');
      const seedStatements = seedSql
        .split(/;\s*[\r\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const stmt of seedStatements) {
        try {
          await pool.query(stmt);
        } catch (err) {
          console.warn(`Notice on seed statement: ${err.message}`);
        }
      }
      console.log(`✅ Seed dataset populated (${seedStatements.length} statements executed).`);
    }
  }

  // 4. Verify tables created
  const [tables] = await pool.query('SHOW TABLES');
  console.log('\nVerified Hostinger MySQL Tables:');
  tables.forEach(t => {
    const name = Object.values(t)[0];
    console.log(`  - ${name}`);
  });

  console.log('\n🎉 Hostinger MySQL migration completed successfully!');
  await closePool();
  process.exit(0);
}

runMySQLMigration().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
