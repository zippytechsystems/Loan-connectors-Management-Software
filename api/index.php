<?php
/**
 * Zippy Loan Connector — Production API Gateway for Hostinger LiteSpeed / Apache
 * Application: Zippy Loan Connector
 * Owner: M. Lingaswamy
 * Architecture: Native PHP 8.x + MySQL PDO REST Engine
 */

header('Content-Type: application/json; charset=utf-8');

// Error reporting: Hide raw errors in production, return JSON
error_reporting(0);
ini_set('display_errors', '0');

// CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// -----------------------------------------------------------------------------
// 1. Environment & Configuration Loader
// -----------------------------------------------------------------------------
if (!defined('ZIPPY_APP_LOADED')) {
    define('ZIPPY_APP_LOADED', true);
}

function loadEnv() {
    $env = [];
    $configFile = __DIR__ . '/config.php';
    if (file_exists($configFile) && is_readable($configFile)) {
        $loaded = include $configFile;
        if (is_array($loaded)) {
            $env = array_merge($env, $loaded);
        }
    }

    $envFiles = [
        __DIR__ . '/../.env',
        __DIR__ . '/../../.env',
        __DIR__ . '/../server/.env',
    ];
    foreach ($envFiles as $file) {
        if (file_exists($file) && is_readable($file)) {
            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || $line[0] === '#') continue;
                if (strpos($line, '=') !== false) {
                    list($key, $val) = explode('=', $line, 2);
                    $key = trim($key);
                    $val = trim($val, " \t\n\r\0\x0B\"'");
                    $env[$key] = $val;
                }
            }
        }
    }
    return $env;
}

$fileEnv = loadEnv();
$dbHost = getenv('DB_HOST') ?: ($_SERVER['DB_HOST'] ?? ($fileEnv['DB_HOST'] ?? '127.0.0.1'));
$dbPort = getenv('DB_PORT') ?: ($_SERVER['DB_PORT'] ?? ($fileEnv['DB_PORT'] ?? '3306'));
$dbName = getenv('DB_NAME') ?: ($_SERVER['DB_NAME'] ?? ($fileEnv['DB_NAME'] ?? 'u914601002_DSA_management'));
$dbUser = getenv('DB_USER') ?: ($_SERVER['DB_USER'] ?? ($fileEnv['DB_USER'] ?? 'u914601002_DSA_database'));
$dbPass = getenv('DB_PASSWORD') ?: ($_SERVER['DB_PASSWORD'] ?? ($fileEnv['DB_PASSWORD'] ?? 'M.Linga@123'));
$sessionSecret = getenv('SESSION_SECRET') ?: ($_SERVER['SESSION_SECRET'] ?? ($fileEnv['SESSION_SECRET'] ?? 'zippy_loan_connector_dev_secret_key_849204859345'));
$cookieName = getenv('COOKIE_NAME') ?: ($_SERVER['COOKIE_NAME'] ?? ($fileEnv['COOKIE_NAME'] ?? 'zippy_auth_token'));
$adminUser = getenv('ADMIN_USERNAME') ?: ($_SERVER['ADMIN_USERNAME'] ?? ($fileEnv['ADMIN_USERNAME'] ?? 'M.Lingaswamy@123'));
$adminPass = getenv('ADMIN_INITIAL_PASSWORD') ?: ($_SERVER['ADMIN_INITIAL_PASSWORD'] ?? ($fileEnv['ADMIN_INITIAL_PASSWORD'] ?? 'M.Linga@123'));

// -----------------------------------------------------------------------------
// 2. MySQL PDO Connection Helper
// -----------------------------------------------------------------------------
function getDbConnection() {
    global $dbHost, $dbPort, $dbName, $dbUser, $dbPass;
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $hostsToTry = array_values(array_unique([$dbHost, '127.0.0.1', 'localhost', 'srv1555.hstgr.io']));

    foreach ($hostsToTry as $host) {
        try {
            $dsn = "mysql:host=$host;port=$dbPort;dbname=$dbName;charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 4,
            ];
            $pdo = new PDO($dsn, $dbUser, $dbPass, $options);
            return $pdo;
        } catch (PDOException $e) {
            // Fallback to next host candidate
        }
    }

    return null;
}

// Ensure database tables and initial admin exist
function ensureDatabaseSchema($pdo) {
    global $adminUser, $adminPass;
    if (!$pdo) return;

    try {
        $pdo->exec("
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
        ");

        $pdo->exec("
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
              `loan_categories` LONGTEXT NULL,
              `business_notes` TEXT NULL,
              `website_url` VARCHAR(255) NULL,
              `logo_path` VARCHAR(255) NULL,
              `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        $pdo->exec("
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
        ");

        // Seed admin if not present or sync password
        $stmt = $pdo->prepare("SELECT id, password_hash FROM admins WHERE username = ? LIMIT 1");
        $stmt->execute([$adminUser]);
        $existing = $stmt->fetch();

        $hash = password_hash($adminPass, PASSWORD_BCRYPT, ['cost' => 12]);
        if (!$existing) {
            $insert = $pdo->prepare("INSERT INTO admins (username, password_hash, role, is_active) VALUES (?, ?, 'admin', 1)");
            $insert->execute([$adminUser, $hash]);
        } else {
            if (!password_verify($adminPass, $existing['password_hash'])) {
                $update = $pdo->prepare("UPDATE admins SET password_hash = ? WHERE username = ?");
                $update->execute([$hash, $adminUser]);
            }
        }
    } catch (Exception $e) {
        // Schema creation errors ignored if already existing
    }
}

// -----------------------------------------------------------------------------
// 3. JWT & Authentication Functions (Binary-compatible with jsonwebtoken)
// -----------------------------------------------------------------------------
function base64UrlEncode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function createJwtToken($payload, $rememberMe = false) {
    global $sessionSecret;
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $exp = time() + ($rememberMe ? (7 * 24 * 3600) : (24 * 3600));
    $payload['exp'] = $exp;
    $payload['iat'] = time();
    $body = base64UrlEncode(json_encode($payload));
    $signature = base64UrlEncode(hash_hmac('sha256', "$header.$body", $sessionSecret, true));
    return "$header.$body.$signature";
}

function verifyJwtToken($token) {
    global $sessionSecret;
    if (empty($token) || !is_string($token)) return null;

    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    list($header64, $payload64, $sig64) = $parts;
    $expectedSig = base64UrlEncode(hash_hmac('sha256', "$header64.$payload64", $sessionSecret, true));

    if (!hash_equals($expectedSig, $sig64)) return null;

    $payload = json_decode(base64UrlDecode($payload64), true);
    if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
        return null;
    }
    return $payload;
}

function getAuthUser() {
    global $cookieName;
    $token = $_COOKIE[$cookieName] ?? null;

    if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }

    if (!$token) return null;
    return verifyJwtToken($token);
}

function logAudit($pdo, $adminUsername, $action, $details = null) {
    if (!$pdo) return;
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $detailsStr = is_array($details) ? json_encode($details) : $details;
        $stmt = $pdo->prepare("INSERT INTO audit_logs (admin_username, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, NOW())");
        $stmt->execute([$adminUsername, $action, $detailsStr, $ip]);
    } catch (Exception $e) {}
}

// -----------------------------------------------------------------------------
// 4. Request Routing
// -----------------------------------------------------------------------------
$pdo = getDbConnection();
if ($pdo) {
    ensureDatabaseSchema($pdo);
}

// Normalize endpoint path
$uri = $_SERVER['REQUEST_URI'] ?? '';
$parsedUri = parse_url($uri, PHP_URL_PATH);
$endpoint = $_GET['endpoint'] ?? '';

if (empty($endpoint)) {
    // Strip /api or /api/
    $endpoint = preg_replace('#^/api/?#i', '', $parsedUri);
}
$endpoint = trim($endpoint, '/');
$method = $_SERVER['REQUEST_METHOD'];
$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true) ?: [];

// -----------------------------------------------------------------------------
// Route: GET /api/health
// -----------------------------------------------------------------------------
if ($endpoint === 'health' && $method === 'GET') {
    if ($pdo) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'service' => 'Zippy Loan Connector API',
            'status' => 'running',
            'database' => 'connected'
        ]);
    } else {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'service' => 'Zippy Loan Connector API',
            'status' => 'degraded',
            'database' => 'disconnected',
            'message' => 'Database connection check failed'
        ]);
    }
    exit;
}

// -----------------------------------------------------------------------------
// Route: GET /api/health/database
// -----------------------------------------------------------------------------
if ($endpoint === 'health/database' && $method === 'GET') {
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT 1 AS verification");
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'service' => 'Zippy Loan Connector API',
                'status' => 'connected',
                'message' => 'Database query verification passed'
            ]);
            exit;
        } catch (Exception $e) {}
    }

    http_response_code(503);
    echo json_encode([
        'success' => false,
        'service' => 'Zippy Loan Connector API',
        'status' => 'disconnected',
        'message' => 'Database query verification failed'
    ]);
    exit;
}

// -----------------------------------------------------------------------------
// Route: POST /api/auth/login
// -----------------------------------------------------------------------------
if ($endpoint === 'auth/login' && $method === 'POST') {
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';
    $rememberMe = !empty($body['rememberMe']);

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username and password are required']);
        exit;
    }

    if (!$pdo) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Database connection unavailable']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, username, password_hash, role, is_active FROM admins WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $admin = $stmt->fetch();

    if (!$admin) {
        logAudit($pdo, $username, 'LOGIN_FAILED_USER_NOT_FOUND');
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        exit;
    }

    if (!$admin['is_active']) {
        logAudit($pdo, $username, 'LOGIN_BLOCKED_INACTIVE');
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Account is inactive. Please contact support.']);
        exit;
    }

    if (!password_verify($password, $admin['password_hash'])) {
        logAudit($pdo, $username, 'LOGIN_FAILED_WRONG_PASSWORD');
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        exit;
    }

    // Login successful
    $token = createJwtToken([
        'id' => (int)$admin['id'],
        'username' => $admin['username'],
        'role' => $admin['role'],
    ], $rememberMe);

    $maxAge = $rememberMe ? (7 * 24 * 3600) : (24 * 3600);
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] == 443);

    setcookie($cookieName, $token, [
        'expires' => time() + $maxAge,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    logAudit($pdo, $admin['username'], 'LOGIN_SUCCESS', ['rememberMe' => $rememberMe]);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => (int)$admin['id'],
            'username' => $admin['username'],
            'role' => $admin['role'],
        ]
    ]);
    exit;
}

// -----------------------------------------------------------------------------
// Route: POST /api/auth/logout
// -----------------------------------------------------------------------------
if ($endpoint === 'auth/logout' && $method === 'POST') {
    $authUser = getAuthUser();
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] == 443);

    setcookie($cookieName, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);

    if ($authUser && $pdo) {
        logAudit($pdo, $authUser['username'], 'LOGOUT_SUCCESS');
    }

    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
    exit;
}

// -----------------------------------------------------------------------------
// Route: GET /api/auth/me
// -----------------------------------------------------------------------------
if ($endpoint === 'auth/me' && $method === 'GET') {
    $authUser = getAuthUser();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required. Please log in.']);
        exit;
    }

    if (!$pdo) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $authUser['id'],
                'username' => $authUser['username'],
                'role' => $authUser['role'],
            ]
        ]);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, username, role, is_active, created_at FROM admins WHERE username = ? LIMIT 1");
    $stmt->execute([$authUser['username']]);
    $admin = $stmt->fetch();

    if (!$admin || !$admin['is_active']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Session expired or invalid user.']);
        exit;
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => (int)$admin['id'],
            'username' => $admin['username'],
            'role' => $admin['role'],
            'createdAt' => $admin['created_at'],
        ]
    ]);
    exit;
}

// -----------------------------------------------------------------------------
// Route: GET /api/business-profile
// -----------------------------------------------------------------------------
if ($endpoint === 'business-profile' && $method === 'GET') {
    $authUser = getAuthUser();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required']);
        exit;
    }

    if (!$pdo) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Database unavailable']);
        exit;
    }

    $stmt = $pdo->query("SELECT * FROM business_profiles ORDER BY id ASC LIMIT 1");
    $profile = $stmt->fetch();

    if ($profile) {
        if (!empty($profile['loan_categories'])) {
            $decoded = json_decode($profile['loan_categories'], true);
            $profile['loan_categories'] = is_array($decoded) ? $decoded : [];
        } else {
            $profile['loan_categories'] = [];
        }
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'profile' => $profile ?: null
    ]);
    exit;
}

// -----------------------------------------------------------------------------
// Route: POST / PUT /api/business-profile
// -----------------------------------------------------------------------------
if ($endpoint === 'business-profile' && ($method === 'POST' || $method === 'PUT')) {
    $authUser = getAuthUser();
    if (!$authUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Authentication required']);
        exit;
    }

    if (!$pdo) {
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'Database unavailable']);
        exit;
    }

    // Validation (Supports both snake_case and camelCase payloads)
    $bName = trim($body['business_name'] ?? ($body['businessName'] ?? ''));
    $oName = trim($body['owner_name'] ?? ($body['ownerName'] ?? ''));
    $bType = trim($body['business_type'] ?? ($body['businessType'] ?? 'Individual Loan Connector'));
    $bDesc = trim($body['business_description'] ?? ($body['businessDescription'] ?? '')) ?: null;
    $bStart = trim($body['business_start_date'] ?? ($body['businessStartDate'] ?? '')) ?: null;
    $mobile = trim($body['mobile_number'] ?? ($body['mobileNumber'] ?? ''));
    $waNumber = trim($body['whatsapp_number'] ?? ($body['whatsappNumber'] ?? $mobile));
    $email = trim($body['email'] ?? '');
    $altContact = trim($body['alternate_contact'] ?? ($body['alternateContact'] ?? '')) ?: null;
    $addr = trim($body['address_line'] ?? ($body['addressLine'] ?? '')) ?: null;
    $area = trim($body['area'] ?? '') ?: null;
    $city = trim($body['city'] ?? '') ?: null;
    $dist = trim($body['district'] ?? '') ?: null;
    $state = trim($body['state'] ?? '') ?: null;
    $pin = trim($body['pin_code'] ?? ($body['pinCode'] ?? '')) ?: null;
    $country = trim($body['country'] ?? '') ?: 'India';
    $lender = trim($body['lender_name'] ?? ($body['lenderName'] ?? '')) ?: null;
    $connId = trim($body['connector_id'] ?? ($body['connectorId'] ?? '')) ?: null;
    $agreeRef = trim($body['agreement_reference'] ?? ($body['agreementReference'] ?? '')) ?: null;
    $agreeStart = trim($body['agreement_start_date'] ?? ($body['agreementStartDate'] ?? '')) ?: null;
    $connStatus = trim($body['connector_status'] ?? ($body['connectorStatus'] ?? 'Active'));
    $bNotes = trim($body['business_notes'] ?? ($body['businessNotes'] ?? ($body['notes'] ?? ''))) ?: null;
    $webUrl = trim($body['website_url'] ?? ($body['websiteUrl'] ?? '')) ?: null;
    $logo = trim($body['logo_path'] ?? ($body['logoPath'] ?? '')) ?: null;

    if (empty($bName) || empty($oName) || empty($mobile) || empty($email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Business name, owner name, mobile and email are required']);
        exit;
    }

    // Strictly disallow Agriculture Loan
    $cats = $body['loan_categories'] ?? ($body['loanCategories'] ?? []);
    if (!is_array($cats)) $cats = [];
    foreach ($cats as $cat) {
        if (stripos($cat, 'agri') !== false) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Loan type cannot be Agriculture Loan. Agriculture Loan is strictly disallowed.'
            ]);
            exit;
        }
    }
    $catsJson = json_encode(array_values($cats));

    // Check existing single profile
    $check = $pdo->query("SELECT id FROM business_profiles ORDER BY id ASC LIMIT 1");
    $existing = $check->fetch();

    if ($existing) {
        $updateSql = "
            UPDATE business_profiles SET
                business_name = ?,
                owner_name = ?,
                business_type = ?,
                business_description = ?,
                business_start_date = ?,
                mobile_number = ?,
                whatsapp_number = ?,
                email = ?,
                alternate_contact = ?,
                address_line = ?,
                area = ?,
                city = ?,
                district = ?,
                state = ?,
                pin_code = ?,
                country = ?,
                lender_name = ?,
                connector_id = ?,
                agreement_reference = ?,
                agreement_start_date = ?,
                connector_status = ?,
                loan_categories = ?,
                business_notes = ?,
                website_url = ?,
                logo_path = ?,
                updated_at = NOW()
            WHERE id = ?
        ";
        $updateParams = [
            $bName,
            $oName,
            $bType,
            $bDesc,
            $bStart,
            $mobile,
            $waNumber,
            $email,
            $altContact,
            $addr,
            $area,
            $city,
            $dist,
            $state,
            $pin,
            $country,
            $lender,
            $connId,
            $agreeRef,
            $agreeStart,
            $connStatus,
            $catsJson,
            $bNotes,
            $webUrl,
            $logo,
            $existing['id']
        ];
        $stmt = $pdo->prepare($updateSql);
        $stmt->execute($updateParams);
        $profileId = $existing['id'];
    } else {
        $insertSql = "
            INSERT INTO business_profiles (
                business_name, owner_name, business_type, business_description,
                business_start_date, mobile_number, whatsapp_number, email,
                alternate_contact, address_line, area, city, district, state,
                pin_code, country, lender_name, connector_id, agreement_reference,
                agreement_start_date, connector_status, loan_categories,
                business_notes, website_url, logo_path, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, NOW(), NOW()
            )
        ";
        $insertParams = [
            $bName,
            $oName,
            $bType,
            $bDesc,
            $bStart,
            $mobile,
            $waNumber,
            $email,
            $altContact,
            $addr,
            $area,
            $city,
            $dist,
            $state,
            $pin,
            $country,
            $lender,
            $connId,
            $agreeRef,
            $agreeStart,
            $connStatus,
            $catsJson,
            $bNotes,
            $webUrl,
            $logo,
        ];
        $stmt = $pdo->prepare($insertSql);
        $stmt->execute($insertParams);
        $profileId = $pdo->lastInsertId();
    }

    logAudit($pdo, $authUser['username'], 'BUSINESS_PROFILE_SAVED', ['business_name' => $bName]);

    // Fetch saved profile
    $getStmt = $pdo->prepare("SELECT * FROM business_profiles WHERE id = ? LIMIT 1");
    $getStmt->execute([$profileId]);
    $saved = $getStmt->fetch();
    if ($saved && !empty($saved['loan_categories'])) {
        $saved['loan_categories'] = json_decode($saved['loan_categories'], true) ?: [];
    }

    http_response_code($method === 'POST' ? 201 : 200);
    echo json_encode([
        'success' => true,
        'message' => 'Business profile saved successfully',
        'profile' => $saved
    ]);
    exit;
}

// -----------------------------------------------------------------------------
// Route: Dashboard Fallback
// -----------------------------------------------------------------------------
if ($endpoint === 'dashboard/summary' && $method === 'GET') {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => [
            'total_customers' => 0,
            'total_leads' => 0,
            'new_leads' => 0,
            'contacted_leads' => 0,
            'qualified_leads' => 0,
            'converted_leads' => 0,
            'status_breakdown' => [
                'New' => 0, 'Contacted' => 0, 'Interested' => 0,
                'Documents Pending' => 0, 'Qualified' => 0, 'Converted' => 0,
                'Not Interested' => 0, 'Duplicate' => 0, 'Closed' => 0
            ]
        ]
    ]);
    exit;
}

if (($endpoint === 'dashboard/recent-customers' || $endpoint === 'dashboard/recent-leads') && $method === 'GET') {
    http_response_code(200);
    echo json_encode(['success' => true, 'data' => []]);
    exit;
}

// 404 for undefined endpoints
http_response_code(404);
echo json_encode([
    'success' => false,
    'message' => "API endpoint $method /api/$endpoint not found"
]);
