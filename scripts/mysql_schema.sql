-- =============================================================================
-- Veridian Connector OS — Production MySQL Schema (Hostinger Deployment)
-- Target Engine: MySQL 8.0+ / MariaDB 10.5+ (InnoDB, UTF-8 MB4)
-- Hostinger MySQL Configuration: Connect via 127.0.0.1:3306 on Web Server
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 0. Schema Migrations Tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `_schema_migrations` (
  `version` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `applied_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 1. Partner Organizations (Connectors, DSAs, Aggregators)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `partners` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `type` ENUM('Connector', 'DSA Partner', 'Fintech Aggregator') NOT NULL DEFAULT 'Connector',
  `status` ENUM('Draft', 'Pending', 'Approved', 'Suspended', 'Terminated') NOT NULL DEFAULT 'Pending',
  `tier` ENUM('Tier 1 Platinum', 'Tier 2 Gold', 'Tier 3 Silver') NOT NULL DEFAULT 'Tier 2 Gold',
  `territory` VARCHAR(255) NOT NULL DEFAULT 'Telangana',
  `authorized_products` VARCHAR(500) NOT NULL DEFAULT 'Personal Loan, Business Loan',
  `capacity_limit` INT NOT NULL DEFAULT 50,
  `active_leads_count` INT NOT NULL DEFAULT 0,
  `contact_person` VARCHAR(255) NULL,
  `contact_email` VARCHAR(255) NULL,
  `contact_phone` VARCHAR(50) NULL,
  `pan_or_gst` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_partners_status` (`status`),
  INDEX `idx_partners_tier` (`tier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Partner Financial Institutions (Institutional Lenders)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lenders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(50) NOT NULL UNIQUE,
  `status` ENUM('Active', 'Paused', 'Inactive') NOT NULL DEFAULT 'Active',
  `contact_email` VARCHAR(255) NULL,
  `sla_turnaround_hours` INT NOT NULL DEFAULT 48,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_lenders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Users & Authentication
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'operations', 'connector', 'lender', 'auditor', 'reviewer', 'finance') NOT NULL,
  `partner_id` INT NULL,
  `lender_id` INT NULL,
  `mfa_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`lender_id`) REFERENCES `lenders`(`id`) ON DELETE SET NULL,
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Customer Identities (Isolated PII Vault with AES-256 & Blind HMAC Hashes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `phone_hash` VARCHAR(128) NOT NULL,
  `phone_encrypted` TEXT NOT NULL,
  `email_encrypted` TEXT NOT NULL,
  `pan_hash` VARCHAR(128) NOT NULL,
  `pan_encrypted` TEXT NOT NULL,
  `employment_type` VARCHAR(100) NOT NULL,
  `monthly_income` BIGINT NOT NULL,
  `residence_city` VARCHAR(100) NOT NULL,
  `residence_state` VARCHAR(100) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cust_phone_hash` (`phone_hash`),
  INDEX `idx_cust_pan_hash` (`pan_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Consent Receipts (DPDP Act 2023 Digital Receipts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `consent_receipts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `consent_purpose` VARCHAR(500) NOT NULL,
  `consent_version` VARCHAR(50) NOT NULL,
  `channel` VARCHAR(100) NOT NULL,
  `ip_hash` VARCHAR(64) NOT NULL,
  `granted_at` DATETIME NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `status` ENUM('Active', 'Revoked', 'Expired') NOT NULL DEFAULT 'Active',
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_consent_lookup` (`customer_id`, `status`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Loan Products (Catalog & Eligibility Rules)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `loan_products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lender_id` INT NOT NULL,
  `category` ENUM('Personal Loan', 'Home Loan', 'Business Loan', 'Loan Against Property', 'MSME Express') NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `min_amount` BIGINT NOT NULL,
  `max_amount` BIGINT NOT NULL,
  `min_cibil` INT NOT NULL DEFAULT 650,
  `min_monthly_income` BIGINT NOT NULL DEFAULT 25000,
  `interest_rate_range` VARCHAR(100) NOT NULL,
  `territories` VARCHAR(500) NOT NULL,
  `document_checklist_json` JSON NOT NULL,
  `sla_hours` INT NOT NULL DEFAULT 24,
  `effective_from` DATE NOT NULL,
  `effective_to` DATE NOT NULL,
  `status` ENUM('Active', 'Inactive', 'Archived') NOT NULL DEFAULT 'Active',
  FOREIGN KEY (`lender_id`) REFERENCES `lenders`(`id`) ON DELETE CASCADE,
  INDEX `idx_products_category` (`category`),
  INDEX `idx_products_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Operational Leads (Decoupled from Customer PII)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `leads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_reference` VARCHAR(100) NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `requested_amount` BIGINT NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `status` ENUM('New', 'Eligible', 'Offered', 'Accepted', 'Contacted', 'Referred', 'Lender Review', 'Sanctioned', 'Disbursed', 'Declined', 'Withdrawn', 'Expired') NOT NULL DEFAULT 'New',
  `assigned_partner_id` INT NULL,
  `lender_id` INT NULL,
  `offer_sent_at` DATETIME NULL,
  `offer_expires_at` DATETIME NULL,
  `sanctioned_amount` BIGINT DEFAULT 0,
  `disbursed_amount` BIGINT DEFAULT 0,
  `estimated_commission` BIGINT DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`product_id`) REFERENCES `loan_products`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`assigned_partner_id`) REFERENCES `partners`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`lender_id`) REFERENCES `lenders`(`id`) ON DELETE SET NULL,
  INDEX `idx_leads_partner` (`assigned_partner_id`),
  INDEX `idx_leads_lender` (`lender_id`),
  INDEX `idx_leads_status` (`status`),
  INDEX `idx_leads_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Lead Assignments & Dispatch History
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lead_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `partner_id` INT NOT NULL,
  `rule_version_id` VARCHAR(50) NOT NULL,
  `routing_method` ENUM('Priority', 'Weighted Round-Robin', 'Manual Dispatch') NOT NULL,
  `candidate_scores_json` JSON NULL,
  `assigned_by` VARCHAR(100) NOT NULL,
  `status` ENUM('Offered', 'Accepted', 'Declined', 'Timed Out') NOT NULL,
  `decline_reason` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE CASCADE,
  INDEX `idx_assignments_lead_status` (`lead_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Lead Events (Append-Only Audit Timeline)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lead_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `actor_username` VARCHAR(100) NOT NULL,
  `actor_role` VARCHAR(50) NOT NULL,
  `from_status` VARCHAR(50) NULL,
  `to_status` VARCHAR(50) NOT NULL,
  `action_name` VARCHAR(100) NOT NULL,
  `notes` TEXT NULL,
  `reason_code` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE,
  INDEX `idx_lead_events_lead` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. Partner-Lender Assignments (Authorized Connector-Lender Relationships)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `partner_lender_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `partner_id` INT NOT NULL,
  `lender_id` INT NOT NULL,
  `status` ENUM('Active', 'Paused', 'Revoked') NOT NULL DEFAULT 'Active',
  `assigned_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`lender_id`) REFERENCES `lenders`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_partner_lender` (`partner_id`, `lender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. Lead Follow-Up Reminders & Operational Tasks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lead_reminders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `assigned_to` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `reminder_type` ENUM('Follow Up', 'Document Collection', 'Lender Review', 'Disbursement Check', 'General') NOT NULL DEFAULT 'Follow Up',
  `due_date` DATETIME NOT NULL,
  `status` ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME NULL,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE,
  INDEX `idx_reminders_lead` (`lead_id`),
  INDEX `idx_reminders_assigned_status` (`assigned_to`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. Commission Plans (Versioned)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commission_plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `version` VARCHAR(50) NOT NULL,
  `plan_type` ENUM('Fixed', 'Percentage', 'Tiered Slabs', 'Referral Split') NOT NULL,
  `rules_config_json` JSON NOT NULL,
  `trigger_event` ENUM('Accepted', 'Referred', 'Sanctioned', 'Disbursed') NOT NULL,
  `holdback_percent` INT NOT NULL DEFAULT 0,
  `cap_amount` BIGINT NOT NULL DEFAULT 0,
  `effective_date` DATE NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. Commission Ledger (Immutable Financial Entries & Linked Clawbacks)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commission_ledger` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ledger_code` VARCHAR(100) NOT NULL UNIQUE,
  `lead_id` INT NOT NULL,
  `partner_id` INT NOT NULL,
  `trigger_event` VARCHAR(100) NOT NULL,
  `gross_amount` BIGINT NOT NULL,
  `holdback_amount` BIGINT NOT NULL DEFAULT 0,
  `net_payable` BIGINT NOT NULL,
  `status` ENUM('Accrued', 'Approved', 'In Payout', 'Paid', 'Reversed') NOT NULL,
  `plan_version_applied` VARCHAR(50) NOT NULL,
  `payout_reference` VARCHAR(100) NULL,
  `approved_by` VARCHAR(100) NULL,
  `reversal_reason` VARCHAR(500) NULL,
  `original_ledger_id` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `settled_at` DATETIME NULL,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`original_ledger_id`) REFERENCES `commission_ledger`(`id`) ON DELETE RESTRICT,
  INDEX `idx_comm_partner` (`partner_id`),
  INDEX `idx_comm_status` (`status`),
  INDEX `idx_comm_lead_trigger` (`lead_id`, `trigger_event`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. KYC Documents (Encrypted Private Vault Metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kyc_documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `document_type` VARCHAR(100) NOT NULL,
  `opaque_key` VARCHAR(100) NOT NULL UNIQUE,
  `original_name` VARCHAR(255) NOT NULL,
  `file_size` BIGINT NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `malware_status` ENUM('Scanning', 'Clean', 'Quarantined') NOT NULL DEFAULT 'Clean',
  `sha256_checksum` VARCHAR(64) NOT NULL,
  `is_encrypted` TINYINT(1) NOT NULL DEFAULT 1,
  `encryption_version` VARCHAR(20) NOT NULL DEFAULT 'v1',
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE,
  INDEX `idx_kyc_lead` (`lead_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. Audit Events (Append-Only System & Security Log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `actor_username` VARCHAR(100) NOT NULL,
  `actor_role` VARCHAR(50) NOT NULL,
  `actor_ip` VARCHAR(50) NOT NULL,
  `event_type` VARCHAR(100) NOT NULL,
  `resource_type` VARCHAR(100) NOT NULL,
  `resource_id` VARCHAR(100) NULL,
  `action_summary` VARCHAR(500) NOT NULL,
  `details_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 16. Idempotency Keys (Deduplication Store)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `idempotency_keys` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `idempotency_key` VARCHAR(255) NOT NULL,
  `scope` VARCHAR(100) NOT NULL,
  `response_code` INT NOT NULL,
  `response_body` MEDIUMTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` DATETIME NOT NULL,
  UNIQUE KEY `uk_idempotency_scope_key` (`scope`, `idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 17. Customer Retention & Purge Records (Right to be Forgotten)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_retention_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `action` ENUM('Purged', 'Anonymized', 'Archived') NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `actor_username` VARCHAR(100) NOT NULL,
  `actor_role` VARCHAR(50) NOT NULL,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Record Baseline Migration
INSERT INTO `_schema_migrations` (`version`, `description`, `applied_at`) 
VALUES ('001_initial_mysql_schema', 'Complete production schema with InnoDB, foreign keys, and indexes', NOW())
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
