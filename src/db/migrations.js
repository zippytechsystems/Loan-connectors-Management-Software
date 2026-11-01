const { SCHEMA_SQL } = require('./schema');

/**
 * Migration runner with version tracking and safe reversible schema progression
 */
function runMigrations(db) {
  // Ensure migration tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      version TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM _schema_migrations').all();
  const applied = new Set(appliedRows.map(r => r.version));

  // Migration 001: Baseline Schema
  if (!applied.has('001_initial_schema')) {
    db.exec(SCHEMA_SQL);
    db.prepare('INSERT INTO _schema_migrations (version, description, applied_at) VALUES (?, ?, ?)')
      .run('001_initial_schema', 'Initial relational tables and foreign keys', new Date().toISOString());
  }

  // Migration 002: Security, Idempotency, and Append-only Ledger Links
  if (!applied.has('002_security_and_idempotency')) {
    db.exec(`
      -- 1. Idempotency store for non-duplicating mutation retries
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL,
        scope TEXT NOT NULL,
        response_code INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        UNIQUE(scope, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_keys(scope, idempotency_key);

      -- 2. Customer retention / purge tracking (auditable Right to be Forgotten)
      CREATE TABLE IF NOT EXISTS customer_retention_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('Purged', 'Anonymized', 'Archived')),
        reason TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        executed_at TEXT NOT NULL
      );

      -- 3. Additional performance and lookup indexes
      CREATE INDEX IF NOT EXISTS idx_leads_customer ON leads(customer_id);
      CREATE INDEX IF NOT EXISTS idx_leads_offer_expiry ON leads(status, offer_expires_at);
      CREATE INDEX IF NOT EXISTS idx_assignments_lead_status ON lead_assignments(lead_id, status);
      CREATE INDEX IF NOT EXISTS idx_comm_lead_trigger ON commission_ledger(lead_id, trigger_event, status);
      CREATE INDEX IF NOT EXISTS idx_consent_cust ON consent_receipts(customer_id, status);
    `);

    // Safely add original_ledger_id to commission_ledger if missing
    try {
      db.exec('ALTER TABLE commission_ledger ADD COLUMN original_ledger_id INTEGER REFERENCES commission_ledger(id);');
    } catch (e) {
      // Column may already exist
    }

    // Safely add is_encrypted and auth_tag to kyc_documents if missing
    try {
      db.exec("ALTER TABLE kyc_documents ADD COLUMN is_encrypted INTEGER DEFAULT 1;");
      db.exec("ALTER TABLE kyc_documents ADD COLUMN encryption_version TEXT DEFAULT 'v1';");
    } catch (e) {
      // Columns may already exist
    }

    db.prepare('INSERT INTO _schema_migrations (version, description, applied_at) VALUES (?, ?, ?)')
      .run('002_security_and_idempotency', 'Add idempotency tables, retention records, and ledger linkage', new Date().toISOString());
  }

  // Migration 003: Partner-Lender Assignments and Lead Reminders / Tasks
  if (!applied.has('003_partner_lender_and_reminders')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS partner_lender_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partner_id INTEGER NOT NULL,
        lender_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Paused', 'Revoked')),
        assigned_at TEXT NOT NULL,
        FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE,
        FOREIGN KEY (lender_id) REFERENCES lenders(id) ON DELETE CASCADE,
        UNIQUE(partner_id, lender_id)
      );
      CREATE INDEX IF NOT EXISTS idx_partner_lender_partner ON partner_lender_assignments(partner_id);
      CREATE INDEX IF NOT EXISTS idx_partner_lender_lender ON partner_lender_assignments(lender_id);

      CREATE TABLE IF NOT EXISTS lead_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL,
        assigned_to TEXT NOT NULL,
        title TEXT NOT NULL,
        reminder_type TEXT NOT NULL DEFAULT 'Follow Up' CHECK(reminder_type IN ('Follow Up', 'Document Collection', 'Lender Review', 'Disbursement Check', 'General')),
        due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Completed', 'Cancelled')),
        notes TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_lead ON lead_reminders(lead_id);
      CREATE INDEX IF NOT EXISTS idx_reminders_assigned_status ON lead_reminders(assigned_to, status);
    `);

    db.prepare('INSERT INTO _schema_migrations (version, description, applied_at) VALUES (?, ?, ?)')
      .run('003_partner_lender_and_reminders', 'Add partner lender assignments and lead follow-up reminders', new Date().toISOString());
  }
}

module.exports = {
  runMigrations
};
