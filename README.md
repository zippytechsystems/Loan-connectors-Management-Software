# Zippy Loan Connector — Management Software (Phase 1)

**Application:** Zippy Loan Connector  
**Owner:** M. Lingaswamy  
**Role:** Single Owner / Admin  
**Business Type:** Individual Loan Connector  
**Platform:** Responsive Web Application (Fintech Style)  
**Technology Platform Brand:** ZippyTech Solutions  
**Database:** Hostinger MySQL 8.0+  
**Architecture:** React + Vite + TypeScript Frontend | Node.js + Express Backend | MySQL2 Connection Pool

---

## 📌 Phase 1 Scope (Strictly Enforced)

Phase 1 focuses exclusively on establishing a rock-solid, production-ready foundation:
1. **Premium Login Page** with initial admin credentials, password visibility toggle, and brute-force rate limiting.
2. **Secure Authentication Backend** with 12-round bcrypt password hashing, session tokens, and secure HTTP-only cookies.
3. **Home Dashboard** displaying genuine business status, contact summary, active loan categories, and last update timestamp (zero fake statistics).
4. **Business Profile Management** allowing the owner to save, retrieve, and update business parameters without creating duplicate rows.
5. **Hostinger MySQL Integration** with parameterized SQL queries, transactions, and audit logging.
6. **Strict Category Validation**: Supports Personal Loan, Business Loan, Home Loan, Loan Against Property, Vehicle Loan. **Agriculture Loan is strictly excluded and prohibited across UI and backend validation.**
7. **Logout & Protected Routes** ensuring unauthenticated visitors are automatically redirected to Login.

*Note: Customer intake, lead management, loan applications, KYC documents, commission ledgers, and referral agents are scheduled for upcoming phases.*

---

## 🏗️ Clean Modular Project Architecture

```
Loan connector Management Software/
├── package.json               # Root orchestrator scripts (dev, build, test)
├── .env.example               # Complete environment variable template
├── schema.sql                 # Clean MySQL table definitions for phpMyAdmin
├── README.md                  # Comprehensive setup & deployment guide
│
├── client/                    # React 19 + Vite + TypeScript + Tailwind CSS
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts         # Configured with proxy for /api -> localhost:5000
│   ├── public/
│   │   └── logo.svg           # Scalable ZippyTech / Zippy Loan Connector brand logo
│   └── src/
│       ├── main.tsx
│       ├── App.tsx            # Protected client-side routing
│       ├── index.css          # Tailwind CSS theme (#071426, #087FE5, #12A8F5, #F59A16)
│       ├── types/             # Strict TypeScript models (User, BusinessProfile, etc.)
│       ├── services/api.ts    # Centralized API client with credentials: 'include'
│       ├── context/           # AuthContext managing user state and sessions
│       ├── components/        # Navbar, Sidebar, ProtectedRoute, DashboardLayout
│       └── pages/
│           ├── LoginPage.tsx
│           ├── DashboardPage.tsx
│           ├── BusinessProfilePage.tsx
│           └── SettingsPage.tsx
│
└── server/                    # Node.js + Express + Hostinger MySQL
    ├── package.json
    ├── server.js              # Server entrypoint with auto-bootstrap
    └── src/
        ├── app.js             # Express middleware, CORS, Helmet, static serving
        ├── config/env.js      # Centralized environment variable loader
        ├── db/
        │   ├── connection.js  # MySQL2 connection pool with health probes
        │   ├── init.js        # Table creation & initial admin bootstrap
        │   ├── queries.js     # Parameterized SQL statements (Zero SQL injection)
        │   └── testAdapter.js # In-memory mock adapter for lightning-fast test isolation
        ├── middleware/
        │   ├── auth.js        # HTTP-only cookie JWT validator
        │   ├── rateLimiter.js # 10 requests / 15 min brute-force shield
        │   └── validation.js  # Zod schema validation (enforcing category rules)
        ├── routes/
        │   ├── authRoutes.js  # /api/auth/login, /logout, /me
        │   └── profileRoutes.js # /api/business-profile (GET, POST, PUT)
        ├── utils/security.js  # Bcrypt hashing & JWT signing
        ├── scripts/
        │   ├── testConnection.js # Diagnostic connection testing script
        │   └── bootstrap.js      # Manual database table & admin creation
        └── tests/
            └── api.test.js    # 10 comprehensive automated integration tests
```

---

## 🎨 Fintech Color Palette

- **Deep Navy:** `#071426` (Primary backgrounds, sidebar, brand accents)
- **Primary Blue:** `#087FE5` (Action buttons, primary highlights)
- **Bright Blue:** `#12A8F5` (Interactive states, gradients)
- **Orange Accent:** `#F59A16` (Brand sparkles, important indicators)
- **Neutral Background:** `#F4F7FB` (Clean contrast for cards)
- **White:** `#FFFFFF` (Surface card backgrounds)

---

## 🗄️ Hostinger MySQL Database Setup (hPanel & phpMyAdmin)

Follow these steps to set up your production database on Hostinger:

### Step 1: Create Database & User in Hostinger hPanel
1. Log in to [Hostinger hPanel](https://hpanel.hostinger.com).
2. Go to **Websites** → Select your domain → **Databases** → **MySQL Databases**.
3. Under **Create a New MySQL Database and Database User**:
   - **MySQL Database Name:** e.g., `u914601002_Zippyloansdata`
   - **MySQL Username:** e.g., `u914601002_zippyicicloan`
   - **Password:** Generate a strong password (minimum 16 characters with letters, numbers, symbols).
4. Click **Create**.
5. Note down your full database name, username, and password.

### Step 2: Import `schema.sql` via phpMyAdmin
1. In hPanel, under the **List of Current MySQL Databases And Users**, locate your newly created database.
2. Click the **phpMyAdmin** button on the right.
3. In phpMyAdmin, click on your database name in the left panel.
4. Click the **Import** tab in the top navigation bar.
5. Under **File to import**, click **Choose File** and select `schema.sql` from this project folder.
6. Scroll down and click **Import**.
7. You will see green success confirmation messages indicating the following tables were created:
   - `admins`
   - `business_profiles`
   - `audit_logs`

### Step 3: Enable Remote MySQL (Optional for Local Development)
If you want to connect from your local development machine directly to Hostinger MySQL:
1. In hPanel, navigate to **Databases** → **Remote MySQL**.
2. Under **IP (IPv4 or IPv6)**, enter `%` (to allow connections from any IP) or your specific home/office IP.
3. Select your database from the dropdown.
4. Click **Create**.
5. Use the Hostinger remote hostname provided in hPanel (e.g., `srv1555.hstgr.io`).

---

## ⚙️ Environment Variables Configuration

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Fill in your actual Hostinger credentials:

```ini
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

# Hostinger MySQL Database
# When deployed on Hostinger web server, DB_HOST is 127.0.0.1
# When connecting remotely from your dev machine, use srv1555.hstgr.io
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=u914601002_Zippyloansdata
DB_USER=u914601002_zippyicicloan
DB_PASSWORD=YourActualHostingerPasswordHere

# Security
SESSION_SECRET=a_very_long_random_entropy_secret_key_minimum_32_characters
COOKIE_NAME=zippy_auth_token
COOKIE_MAX_AGE_DAYS=7

# Initial Admin Bootstrap
ADMIN_USERNAME=M.Lingaswamy@123
ADMIN_INITIAL_PASSWORD=YourSecureAdminPasswordHere
```

> [!CAUTION]
> **Never commit your `.env` file to GitHub.** The `.gitignore` file is pre-configured to ignore all `.env` files.

---

## 🚀 Deployment to Hostinger Node.js Application

### Method: Hostinger hPanel Node.js Application
1. In hPanel, go to **Websites** → **Dashboard** → scroll to **Advanced** → click **Node.js**.
2. Click **Create Application**:
   - **Node.js version:** Select **Node.js 20 LTS** or **Node.js 22 LTS**.
   - **Application mode:** Select **Production**.
   - **Application root:** `/home/u914601002/domains/yourdomain.com/public_html`
   - **Application startup file:** `server/server.js` (or copy server build to root).
3. Build the React frontend before deploying:
   ```bash
   npm run build:client
   ```
   This compiles the React SPA into `client/dist/`. The Express server (`server/src/app.js`) is pre-configured to automatically serve `client/dist/` as static assets for all web routes, and handle `/api/*` for REST endpoints!
4. Install production dependencies on the server:
   ```bash
   npm install --omit=dev
   cd server && npm install --omit=dev
   ```
5. Set your environment variables in Hostinger hPanel under **Node.js** → **Environment Variables**.
6. Click **Restart Application**.

---

## 🧪 Local Testing & Verification

### 1. Run Automated Test Suite (10 Passing Tests)
To run the automated integration tests verifying login, rate limiting, cookies, profile persistence, and loan category restrictions:
```bash
npm test
```
*All 10 tests execute in seconds using Node.js's native test runner (`node:test`).*

### 2. Test Hostinger Database Connectivity
Verify whether your Hostinger MySQL credentials connect successfully:
```bash
npm run db:test
```

### 3. Run Development Servers
Start both the Express backend and Vite React frontend concurrently:
```bash
# Terminal 1: Backend API (port 5000)
npm run dev:server

# Terminal 2: React Vite Client (port 3000)
npm run dev:client
```
Open your browser at `http://localhost:3000`.

---

## 🔐 Security Specifications

- **Argon2 / Bcrypt Hashing:** Passwords hashed with 12 salt rounds before storage.
- **HTTP-Only Cookies:** Tokens stored in cookies with `httpOnly: true`, `sameSite: 'lax'`, preventing JavaScript XSS theft.
- **Rate Limiting:** Login endpoint limited to 10 requests per 15-minute window per IP to block brute-force attacks.
- **Parameterized SQL:** All queries use `mysql2` prepared statements with `?` placeholders, eliminating SQL injection risks.
- **Strict Role Authorization:** Protected routes check token validity on every request.
- **Audit Logging:** Every login attempt and business profile update is recorded in the `audit_logs` table with timestamp and IP address.
- **No Banking Secrets:** Never stores passwords, banking PINs, or OTPs.

---

## 👤 Owner & Technology Attribution

- **Owner:** M. Lingaswamy
- **Application:** Zippy Loan Connector
- **Technology Partner:** ZippyTech Solutions
- **Version:** Phase 1.0.0
