// Database Schema Definition for Loan Connector Management Software (Veridian Network OS)

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operations', 'connector', 'lender', 'auditor', 'reviewer', 'finance')),
  partner_id INTEGER,
  lender_id INTEGER,
  mfa_enabled INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
  FOREIGN KEY (lender_id) REFERENCES lenders(id) ON DELETE SET NULL
);

-- 2. Customer Identities (Isolated PII Store)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone_hash TEXT NOT NULL,
  phone_encrypted TEXT NOT NULL,
  email_encrypted TEXT NOT NULL,
  pan_hash TEXT NOT NULL,
  pan_encrypted TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  monthly_income INTEGER NOT NULL,
  residence_city TEXT NOT NULL,
  residence_state TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_phone_hash ON customers(phone_hash);
CREATE INDEX IF NOT EXISTS idx_customers_pan_hash ON customers(pan_hash);

-- 3. Consent Receipts (Verifiable customer consent records)
CREATE TABLE IF NOT EXISTS consent_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  consent_purpose TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  channel TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Revoked', 'Expired')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 4. Partner Organizations (Connectors, DSA networks, Aggregators)
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('Connector', 'DSA Partner', 'Fintech Aggregator')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Draft', 'Pending', 'Approved', 'Suspended', 'Terminated')),
  tier TEXT NOT NULL DEFAULT 'Tier 2 Gold' CHECK(tier IN ('Tier 1 Platinum', 'Tier 2 Gold', 'Tier 3 Silver')),
  territory TEXT NOT NULL,
  authorized_products TEXT NOT NULL,
  capacity_limit INTEGER NOT NULL DEFAULT 50,
  active_leads_count INTEGER NOT NULL DEFAULT 0,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  pan_or_gst TEXT,
  created_at TEXT NOT NULL
);

-- 5. Lenders (Partner Financial Institutions)
CREATE TABLE IF NOT EXISTS lenders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Paused', 'Inactive')),
  contact_email TEXT,
  sla_turnaround_hours INTEGER NOT NULL DEFAULT 48,
  created_at TEXT NOT NULL
);

-- 6. Loan Products (Catalog & Eligibility Rules)
CREATE TABLE IF NOT EXISTS loan_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lender_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Personal Loan', 'Home Loan', 'Business Loan', 'Loan Against Property', 'MSME Express')),
  product_name TEXT NOT NULL,
  min_amount INTEGER NOT NULL,
  max_amount INTEGER NOT NULL,
  min_cibil INTEGER NOT NULL DEFAULT 650,
  min_monthly_income INTEGER NOT NULL DEFAULT 25000,
  interest_rate_range TEXT NOT NULL,
  territories TEXT NOT NULL,
  document_checklist_json TEXT NOT NULL,
  sla_hours INTEGER NOT NULL DEFAULT 24,
  effective_from TEXT NOT NULL,
  effective_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive', 'Archived')),
  FOREIGN KEY (lender_id) REFERENCES lenders(id) ON DELETE CASCADE
);

-- 7. Operational Leads (Decoupled from Customer PII)
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_reference TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  requested_amount INTEGER NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('New', 'Eligible', 'Offered', 'Accepted', 'Contacted', 'Referred', 'Lender Review', 'Sanctioned', 'Disbursed', 'Declined', 'Withdrawn', 'Expired')),
  assigned_partner_id INTEGER,
  lender_id INTEGER,
  offer_sent_at TEXT,
  offer_expires_at TEXT,
  sanctioned_amount INTEGER DEFAULT 0,
  disbursed_amount INTEGER DEFAULT 0,
  estimated_commission INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES loan_products(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_partner_id) REFERENCES partners(id) ON DELETE SET NULL,
  FOREIGN KEY (lender_id) REFERENCES lenders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_partner ON leads(assigned_partner_id);
CREATE INDEX IF NOT EXISTS idx_leads_lender ON leads(lender_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- 8. Lead Assignments & Routing History
CREATE TABLE IF NOT EXISTS lead_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  partner_id INTEGER NOT NULL,
  rule_version_id TEXT NOT NULL,
  routing_method TEXT NOT NULL CHECK(routing_method IN ('Priority', 'Weighted Round-Robin', 'Manual Dispatch')),
  candidate_scores_json TEXT,
  assigned_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Offered', 'Accepted', 'Declined', 'Timed Out')),
  decline_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE CASCADE
);

-- 9. Lead Events (Append-Only Dated Timeline)
CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  actor_username TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  action_name TEXT NOT NULL,
  notes TEXT,
  reason_code TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id);

-- 10. Commission Plans (Versioned)
CREATE TABLE IF NOT EXISTS commission_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK(plan_type IN ('Fixed', 'Percentage', 'Tiered Slabs', 'Referral Split')),
  rules_config_json TEXT NOT NULL,
  trigger_event TEXT NOT NULL CHECK(trigger_event IN ('Accepted', 'Referred', 'Sanctioned', 'Disbursed')),
  holdback_percent INTEGER DEFAULT 0,
  cap_amount INTEGER DEFAULT 0,
  effective_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- 11. Commission Ledger (Immutable Financial Entries)
CREATE TABLE IF NOT EXISTS commission_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_code TEXT NOT NULL UNIQUE,
  lead_id INTEGER NOT NULL,
  partner_id INTEGER NOT NULL,
  trigger_event TEXT NOT NULL,
  gross_amount INTEGER NOT NULL,
  holdback_amount INTEGER NOT NULL DEFAULT 0,
  net_payable INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Accrued', 'Approved', 'In Payout', 'Paid', 'Reversed')),
  plan_version_applied TEXT NOT NULL,
  payout_reference TEXT,
  approved_by TEXT,
  reversal_reason TEXT,
  created_at TEXT NOT NULL,
  settled_at TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT,
  FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_comm_partner ON commission_ledger(partner_id);

-- 12. KYC Documents (Private Storage Metadata)
CREATE TABLE IF NOT EXISTS kyc_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  document_type TEXT NOT NULL,
  opaque_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  malware_status TEXT NOT NULL DEFAULT 'Clean' CHECK(malware_status IN ('Scanning', 'Clean', 'Quarantined')),
  sha256_checksum TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- 13. Audit Events (Append-Only System & Security Log)
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_username TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_ip TEXT NOT NULL,
  event_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  action_summary TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);

-- 14. Partner-Lender Assignments (Authorized Connector-Lender Relationships)
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

-- 15. Lead Follow-Up Reminders & Tasks
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
`;

module.exports = {
  SCHEMA_SQL
};
