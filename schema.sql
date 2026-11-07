-- =============================================================================
-- ZIPPY LOAN CONNECTOR — PHASE 1 MYSQL SCHEMA
-- Application: Zippy Loan Connector
-- Owner: M. Lingaswamy
-- Hostinger MySQL Database Schema
-- Compatible with MySQL 8.0+ and MariaDB 10.5+ (InnoDB, UTF-8 MB4)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Admins Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'admin',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_admins_username` (`username`),
  INDEX `idx_admins_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Business Profiles Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `business_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `business_name` VARCHAR(255) NOT NULL DEFAULT 'Zippy Loan Connector',
  `owner_name` VARCHAR(255) NOT NULL DEFAULT 'M. Lingaswamy',
  `business_type` VARCHAR(100) NOT NULL DEFAULT 'Individual Loan Connector',
  `business_description` TEXT NULL,
  `business_start_date` DATE NULL,
  `mobile_number` VARCHAR(20) NOT NULL,
  `whatsapp_number` VARCHAR(20) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `alternate_contact` VARCHAR(20) NULL,
  `address_line` VARCHAR(255) NULL,
  `area` VARCHAR(150) NULL,
  `city` VARCHAR(100) NULL,
  `district` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `pin_code` VARCHAR(20) NULL,
  `country` VARCHAR(100) NOT NULL DEFAULT 'India',
  `lender_name` VARCHAR(150) NULL,
  `connector_id` VARCHAR(100) NULL,
  `agreement_reference` VARCHAR(100) NULL,
  `agreement_start_date` DATE NULL,
  `connector_status` VARCHAR(50) NOT NULL DEFAULT 'Active',
  `loan_categories` LONGTEXT NULL COMMENT 'JSON array of active categories, e.g. ["Personal Loan","Business Loan"]',
  `business_notes` TEXT NULL,
  `website_url` VARCHAR(255) NULL,
  `logo_path` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Audit Logs Table (Security & Activity Tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_username` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT NULL,
  `ip_address` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_admin` (`admin_username`),
  INDEX `idx_audit_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
