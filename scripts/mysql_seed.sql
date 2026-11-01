-- =============================================================================
-- Veridian Connector OS — Production MySQL Synthetic Seed Data (Hostinger)
-- Synthetic demo dataset with zero real customer data or live lender connections
-- Password for all seed users: ConnectorDemo!26 (Pre-hashed with scrypt)
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Partners
INSERT INTO `partners` (`id`, `name`, `type`, `status`, `tier`, `territory`, `authorized_products`, `capacity_limit`, `active_leads_count`, `contact_person`, `contact_email`, `contact_phone`, `pan_or_gst`, `created_at`) VALUES
(1, 'Northstar Connect', 'Connector', 'Approved', 'Tier 1 Platinum', 'Telangana, Andhra Pradesh', 'Personal Loan, Business Loan, Home Loan', 50, 3, 'Kavitha Raman', 'kavitha@northstarconnect.in', '+91 98490 11223', 'AAACN1234F', '2026-10-01 10:00:00'),
(2, 'Apex Financial Advisors', 'Connector', 'Approved', 'Tier 2 Gold', 'Telangana, Karnataka, Maharashtra', 'Personal Loan, Loan Against Property', 35, 1, 'Manish Agarwal', 'manish@apexadvisors.in', '+91 97000 44556', 'ABAPA5678K', '2026-10-05 11:30:00'),
(3, 'BluePeak DSA Network', 'DSA Partner', 'Approved', 'Tier 2 Gold', 'Telangana, Tamil Nadu', 'Home Loan, Business Loan, MSME Express', 40, 2, 'Ramesh Babu', 'ramesh@bluepeakdsa.com', '+91 98840 99887', 'AACPB9012J', '2026-10-10 14:15:00'),
(4, 'Vanguard FinServe', 'Connector', 'Pending', 'Tier 3 Silver', 'Karnataka', 'Personal Loan', 20, 0, 'Suresh Kulkarni', 'suresh@vanguardfin.in', '+91 94480 33445', 'AAEFV3456P', '2026-10-25 09:00:00'),
(5, 'Zenith Credit Associates', 'Connector', 'Suspended', 'Tier 3 Silver', 'Maharashtra', 'Personal Loan, Business Loan', 20, 0, 'Alok Sharma', 'alok@zenithcredit.in', '+91 98200 88990', 'AAECZ7890Q', '2026-10-15 16:00:00')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 2. Lenders
INSERT INTO `lenders` (`id`, `name`, `code`, `status`, `contact_email`, `sla_turnaround_hours`, `created_at`) VALUES
(1, 'Riverbend Capital Ltd', 'RBCAP', 'Active', 'underwriting@riverbendcap.com', 24, '2026-10-01 08:00:00'),
(2, 'Apex Trust Housing Finance', 'ATHF', 'Active', 'liaison@apextrusthf.com', 48, '2026-10-01 08:00:00'),
(3, 'Zenith Commercial Bank', 'ZCB', 'Active', 'credit-desk@zenithbank.com', 36, '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. Users (Salted Scrypt Hash for 'ConnectorDemo!26')
INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `email`, `role`, `partner_id`, `lender_id`, `mfa_enabled`, `is_active`, `created_at`) VALUES
(1, 'admin', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Vikram Singhania', 'admin@veridianops.net', 'admin', NULL, NULL, 1, 1, '2026-10-01 08:00:00'),
(2, 'ops', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Ananya Deshmukh', 'ananya.ops@veridianops.net', 'operations', NULL, NULL, 0, 1, '2026-10-01 08:00:00'),
(3, 'partner', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Kavitha Raman', 'kavitha@northstarconnect.in', 'connector', 1, NULL, 0, 1, '2026-10-01 08:00:00'),
(4, 'partner2', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Manish Agarwal', 'manish@apexadvisors.in', 'connector', 2, NULL, 0, 1, '2026-10-05 08:00:00'),
(5, 'lender', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Rohit Malhotra', 'rohit.lender@riverbendcap.com', 'lender', NULL, 1, 0, 1, '2026-10-01 08:00:00'),
(6, 'auditor', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Gita Sundaram', 'gita.auditor@veridianops.net', 'auditor', NULL, NULL, 0, 1, '2026-10-01 08:00:00'),
(7, 'reviewer', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Sunil Chawla', 'sunil.reviewer@veridianops.net', 'reviewer', NULL, 1, 0, 1, '2026-10-01 08:00:00'),
(8, 'finance', 'scrypt$N=16384,r=8,p=1$7f8d6e5a4b3c2d1e$d082fa66847849e75553e1a6c4c9fae9d405b6fa72d3f443b7113110265f247d519cb7f1a5bb425c2826a793a3d5483ec8374a2ffeaebf8c1f93f6c8793b8214', 'Meera Namboodiri', 'meera.finance@veridianops.net', 'finance', NULL, NULL, 0, 1, '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- 4. Loan Products
INSERT INTO `loan_products` (`id`, `lender_id`, `category`, `product_name`, `min_amount`, `max_amount`, `min_cibil`, `min_monthly_income`, `interest_rate_range`, `territories`, `document_checklist_json`, `sla_hours`, `effective_from`, `effective_to`, `status`) VALUES
(1, 1, 'Personal Loan', 'Riverbend Personal Prime', 50000, 2500000, 680, 25000, '10.75% - 15.50%', 'Telangana, Andhra Pradesh, Karnataka, Maharashtra', '["PAN Card", "Aadhaar / Passport", "3 Months Bank Statements", "3 Months Salary Slips"]', 24, '2026-01-01', '2027-12-31', 'Active'),
(2, 1, 'Business Loan', 'Riverbend Business Growth', 500000, 10000000, 700, 100000, '12.25% - 17.00%', 'Telangana, Andhra Pradesh, Maharashtra, Tamil Nadu', '["PAN of Entity", "GST Returns (12 Months)", "Audited Financials (2 Years)", "Bank Statements (6 Months)"]', 36, '2026-01-01', '2027-12-31', 'Active'),
(3, 2, 'Home Loan', 'Apex Trust Super Home Loan', 1500000, 50000000, 720, 40000, '8.45% - 9.75%', 'Telangana, Karnataka, Tamil Nadu, Andhra Pradesh', '["Identity & Address Proof", "Property Link Documents", "Sale Agreement", "Form 16 / ITR 3 Years"]', 48, '2026-01-01', '2027-12-31', 'Active'),
(4, 3, 'MSME Express', 'Zenith MSME Booster Loan', 200000, 5000000, 650, 50000, '11.50% - 16.00%', 'Telangana, Tamil Nadu, Karnataka', '["Udyam Registration", "PAN Card", "6 Months Current Account Statements", "ITR 2 Years"]', 24, '2026-01-01', '2027-12-31', 'Active'),
(5, 1, 'Loan Against Property', 'Riverbend LAP Elite', 2500000, 30000000, 700, 75000, '9.25% - 11.50%', 'Telangana, Maharashtra', '["Title Deeds", "Approved Municipal Plan", "Income Tax Returns (3 Years)", "12 Months Bank Statements"]', 48, '2026-01-01', '2027-12-31', 'Active')
ON DUPLICATE KEY UPDATE `product_name` = VALUES(`product_name`);

-- 5. Partner-Lender Assignments
INSERT INTO `partner_lender_assignments` (`partner_id`, `lender_id`, `status`, `assigned_at`) VALUES
(1, 1, 'Active', '2026-10-01 10:00:00'),
(1, 2, 'Active', '2026-10-01 10:00:00'),
(2, 1, 'Active', '2026-10-05 11:30:00'),
(3, 3, 'Active', '2026-10-10 14:15:00')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 6. Commission Plans
INSERT INTO `commission_plans` (`id`, `name`, `version`, `plan_type`, `rules_config_json`, `trigger_event`, `holdback_percent`, `cap_amount`, `effective_date`, `is_active`, `created_at`) VALUES
(1, 'Standard Retail Disbursement Plan', 'v1.1', 'Percentage', '{"rate": 1.25, "currency": "INR"}', 'Disbursed', 10, 150000, '2026-01-01', 1, '2026-10-01 08:00:00'),
(2, 'High Volume Platinum Slabs', 'v2.1', 'Tiered Slabs', '{"slabs": [{"min": 0, "max": 2500000, "rate": 1.25}, {"min": 2500001, "max": 10000000, "rate": 1.50}, {"min": 10000001, "max": 999999999, "rate": 1.75}]}', 'Disbursed', 10, 300000, '2026-06-01', 1, '2026-10-01 08:00:00'),
(3, 'Lead Intake Referral Bounty', 'v1.0', 'Fixed', '{"fixedAmount": 1500, "currency": "INR"}', 'Accepted', 0, 5000, '2026-01-01', 1, '2026-10-01 08:00:00')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

SET FOREIGN_KEY_CHECKS = 1;
