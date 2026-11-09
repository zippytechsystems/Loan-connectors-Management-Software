<?php
/**
 * Zippy Loan Connector — Production Configuration
 * Application: Zippy Loan Connector
 * Owner: M. Lingaswamy
 * Hostinger MySQL Database Configuration
 */

if (!defined('ZIPPY_APP_LOADED')) {
    define('ZIPPY_APP_LOADED', true);
}

return [
    'DB_HOST' => getenv('DB_HOST') ?: ($_SERVER['DB_HOST'] ?? ($_ENV['DB_HOST'] ?? '127.0.0.1')),
    'DB_PORT' => getenv('DB_PORT') ?: ($_SERVER['DB_PORT'] ?? ($_ENV['DB_PORT'] ?? '3306')),
    'DB_NAME' => getenv('DB_NAME') ?: ($_SERVER['DB_NAME'] ?? ($_ENV['DB_NAME'] ?? 'u914601002_DSA_management')),
    'DB_USER' => getenv('DB_USER') ?: ($_SERVER['DB_USER'] ?? ($_ENV['DB_USER'] ?? 'u914601002_DSA_database')),
    'DB_PASSWORD' => getenv('DB_PASSWORD') ?: ($_SERVER['DB_PASSWORD'] ?? ($_ENV['DB_PASSWORD'] ?? 'M.Linga@123')),
    'SESSION_SECRET' => getenv('SESSION_SECRET') ?: ($_SERVER['SESSION_SECRET'] ?? ($_ENV['SESSION_SECRET'] ?? 'zippy_loan_connector_dev_secret_key_849204859345')),
    'COOKIE_NAME' => getenv('COOKIE_NAME') ?: ($_SERVER['COOKIE_NAME'] ?? ($_ENV['COOKIE_NAME'] ?? 'zippy_auth_token')),
    'ADMIN_USERNAME' => getenv('ADMIN_USERNAME') ?: ($_SERVER['ADMIN_USERNAME'] ?? ($_ENV['ADMIN_USERNAME'] ?? 'M.Lingaswamy@123')),
    'ADMIN_INITIAL_PASSWORD' => getenv('ADMIN_INITIAL_PASSWORD') ?: ($_SERVER['ADMIN_INITIAL_PASSWORD'] ?? ($_ENV['ADMIN_INITIAL_PASSWORD'] ?? 'M.Linga@123')),
];
