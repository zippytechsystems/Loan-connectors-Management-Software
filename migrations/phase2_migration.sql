-- =============================================================================
-- ZIPPY LOAN CONNECTOR — PHASE 2 MIGRATION: CUSTOMERS & LEADS
-- Application: Zippy Loan Connector
-- Owner: M. Lingaswamy
-- Safe migration: Creates customers, loan_leads, and lead_status_history tables
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Customers Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_code` VARCHAR(50) NOT NULL UNIQUE,
  `full_name` VARCHAR(255) NOT NULL,
  `mobile_number` VARCHAR(20) NOT NULL,
  `alternate_mobile` VARCHAR(20) NULL,
  `email` VARCHAR(255) NULL,
  `date_of_birth` DATE NULL,
  `address` TEXT NULL,
  `area` VARCHAR(150) NULL,
  `city` VARCHAR(100) NULL,
  `district` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pin_code` VARCHAR(20) NULL,
  `employment_type` VARCHAR(100) NULL,
  `monthly_income` DECIMAL(15,2) NULL,
  `employer_name` VARCHAR(255) NULL,
  `business_name` VARCHAR(255) NULL,
  `occupation` VARCHAR(150) NULL,
  `customer_source` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_customers_code` (`customer_code`),
  INDEX `idx_customers_mobile` (`mobile_number`),
  INDEX `idx_customers_email` (`email`),
  INDEX `idx_customers_city` (`city`),
  INDEX `idx_customers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Loan Leads Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `loan_leads` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_code` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `loan_type` VARCHAR(100) NOT NULL,
  `required_amount` DECIMAL(15,2) NOT NULL,
  `employment_type` VARCHAR(100) NULL,
  `monthly_income` DECIMAL(15,2) NULL,
  `business_name` VARCHAR(255) NULL,
  `lead_source` VARCHAR(100) NULL,
  `enquiry_date` DATE NOT NULL,
  `priority` ENUM('Low', 'Medium', 'High', 'Urgent') NOT NULL DEFAULT 'Medium',
  `lead_status` ENUM(
    'New',
    'Contacted',
    'Interested',
    'Documents Pending',
    'Qualified',
    'Converted',
    'Not Interested',
    'Duplicate',
    'Closed'
  ) NOT NULL DEFAULT 'New',
  `next_followup_date` DATE NULL,
  `followup_notes` TEXT NULL,
  `admin_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT,
  INDEX `idx_leads_code` (`lead_code`),
  INDEX `idx_leads_customer` (`customer_id`),
  INDEX `idx_leads_type` (`loan_type`),
  INDEX `idx_leads_status` (`lead_status`),
  INDEX `idx_leads_priority` (`priority`),
  INDEX `idx_leads_enquiry_date` (`enquiry_date`),
  INDEX `idx_leads_next_followup` (`next_followup_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Lead Status History Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lead_status_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lead_id` INT NOT NULL,
  `previous_status` VARCHAR(50) NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `changed_by` VARCHAR(100) NOT NULL,
  `change_notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`lead_id`) REFERENCES `loan_leads`(`id`) ON DELETE CASCADE,
  INDEX `idx_history_lead` (`lead_id`),
  INDEX `idx_history_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
