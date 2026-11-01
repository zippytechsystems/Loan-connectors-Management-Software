# Zippy Enterprises — Loan Connector Management Software
## Multi-Party Loan Lead Routing & Partner Network Platform

[![Architecture: Independent](https://img.shields.io/badge/Architecture-Independent_Product-1E664E)](SPECIFICATION.md)
[![Runtime: Node.js 24](https://img.shields.io/badge/Runtime-Node.js_v24_Native-0F382A)](https://nodejs.org/)
[![Database: SQLite WAL / MySQL](https://img.shields.io/badge/Database-SQLite_WAL_ACID-C5A059)](src/db/schema.js)
[![Security: DPDP Act 2023](https://img.shields.io/badge/Compliance-DPDP_Act_2023-blue)](SPECIFICATION.md)

**Zippy Enterprises — Loan Connector OS** is an independent, multi-party loan lead exchange, partner network governance, and commission reconciliation platform. It allows lending networks, loan connectors (brokers, referral agents, fintech partners), and institutional lender liaisons to onboard partners, configure eligibility rules, intake consented customer leads, preview deterministic routing with explainability traces, manage multi-party lead lifecycles, and reconcile immutable financial commission ledgers.

> [!IMPORTANT]
> **Product Independence Boundary:** This application is strictly an independent loan connector management software. It is **NOT** a DSA loan-origination system (LOS), does not process direct loan underwriting, and does not make credit decisions. It operates on its own dedicated codebase, database, authentication store, branding, and deployment boundary.

---

## 🌟 Key Functional Modules

1. **Role-Aware Auth & Persona Portals**:
   - Distinct sign-in and role-filtered operational views for **Platform Administrator (`admin`)**, **Operations Manager (`operations`)**, **Connector Partner (`connector`)**, **Lender Liaison (`lender`)**, and **Compliance Auditor (`auditor`)**.
   - Includes a real-time **Sandbox Persona Switcher** on top for instant role-based evaluation and tenant isolation verification.
2. **Partner Onboarding & Governance**:
   - Partner organization directory with verification statuses (`Draft`, `Pending`, `Approved`, `Suspended`, `Terminated`).
   - Partner tiers (`Tier 1 Platinum`, `Tier 2 Gold`, `Tier 3 Silver`), geographic territory coverage, authorized product categories, and active lead capacity limits.
3. **Lender & Product Catalog**:
   - Configurable loan categories: *Personal Loan*, *Home Loan*, *Business Loan*, *Loan Against Property (LAP)*, and *MSME Express*.
   - Criteria rules: ticket size boundaries, CIBIL thresholds, minimum monthly income/turnaround, interest rate ranges, required document checklists, and SLA turnaround hours.
4. **Consent-Aware Intake & Deterministic Routing Engine**:
   - Minimum contact intake with digital consent receipts (`consent_purpose`, `consent_version`, `timestamp`, `channel`, `ip_hash`).
   - Deduplication protection preventing multiple active applications within 30 days via HMAC-SHA256 hashes.
   - Explainable rule engine (`RULE-v2.4-AUTO`) ranking candidate partners by suitability score (tier weight + available capacity headroom + geographic proximity).
   - 24-hour acceptance SLA timer countdown, partner decline reason codes, and automated fallback pool return.
5. **Lead Lifecycle & Append-Only Event Timeline**:
   - Multi-party lifecycle progression: `Eligible` → `Offered` → `Accepted` → `Contacted` → `Referred` → `Lender Review` → `Sanctioned` → `Disbursed` (or `Declined`, `Withdrawn`, `Expired`).
   - Append-only chronological timeline capturing actors, timestamps, state transitions, notes, and reason codes.
6. **Versioned Commission Engine & Ledger**:
   - Configurable versioned plans: *Fixed Bounty*, *Flat Percentage*, *Tiered Volume Slabs*, and *Referral Splits*.
   - Event-driven triggers (`Accepted`, `Referred`, `Disbursed`).
   - Escrow holdback mechanism (e.g. 10% or 15% retention for clawback buffers) and cap ceilings.
   - Dual-approval workflows (`Accrued` → `Approved` → `Paid`).
   - Non-destructive clawback reversals posting offsetting financial records without rewriting past history.
   - Monthly reconciliation partner settlement statements.
7. **Security, Privacy & Compliance**:
   - Customer PII (name, phone, email, PAN) is encrypted at rest using AES-256-GCM and stored in an isolated `customers` table separated from operational `leads`.
   - Auditors and unprivileged roles receive strictly masked PII.
   - KYC documents stored in a private object storage vault outside public web roots with opaque UUIDs, simulated malware scanning, and short-lived (15 min) signed download tokens.
   - Immutable system audit trail logging all authentication, dispatch, PII view, and commission events.
   - Automated database point-in-time backup and restore scripts with SHA-256 verification.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v22.0.0 or later (v24 recommended; leverages native `node:sqlite` DatabaseSync and `node:crypto`).
- Zero external npm packages required for core execution!

### Installation & Launch

1. Clone or navigate to the project directory:
   ```powershell
   cd "c:\Users\madya\OneDrive\Business Software Management Applications\Loan connector Management  Software"
   ```

2. Start the standalone server:
   ```powershell
   npm start
   # or run directly:
   node server.js
   ```

3. Open your browser and navigate to:
   ```
   http://127.0.0.1:4180
   ```

---

## 🔑 Demo Personas & Credentials

All demo accounts share the password: `ConnectorDemo!26`. You can also switch personas with a single click using the **Top Persona Bar** in the web app:

| Persona / Role | Username | Password | Tenant Scope & Purpose |
| :--- | :--- | :--- | :--- |
| **Platform Administrator** | `admin` | `ConnectorDemo!26` | Global network visibility, partner approvals, commission plan editor, settlements, full audit inspection. |
| **Operations Manager** | `ops` | `ConnectorDemo!26` | Lead qualification, manual dispatch, SLA queue monitoring, dispute resolution. |
| **Connector 1 (Northstar)** | `partner` | `ConnectorDemo!26` | Scoped to **Northstar Connect (Org #1)**. Can only view, accept, and track own assigned leads and commission earnings. |
| **Connector 2 (Apex)** | `partner2` | `ConnectorDemo!26` | Scoped to **Apex Financial Advisors (Org #2)**. Cannot view Northstar or BluePeak data. |
| **Lender Liaison** | `lender` | `ConnectorDemo!26` | Scoped to **Riverbend Capital Ltd**. Reviews referred loans, issues sanctions, and confirms disbursements. |
| **Compliance Auditor** | `auditor` | `ConnectorDemo!26` | Global read-only compliance inspection. Customer PII (Names, Phones, Emails, PAN) is **strictly masked**. |

---

## 🧪 Automated Testing

Run the automated integration and unit test suite verifying tenant isolation, PII masking, routing rules, and commission calculations:

```powershell
npm test
# runs: node --test tests/api.test.js
```

---

## 💾 Point-in-Time Database Backup & Restore

To take an instant backup of the SQLite database with SHA-256 integrity checksum:
```powershell
npm run backup
# Output: backups/connector_network_backup_YYYY-MM-DD_HHMMSS.sqlite + .sha256
```

To restore the latest backup (or specify a particular backup file):
```powershell
npm run restore
# or specify file: node scripts/restore.js backups/connector_network_backup_XXXX.sqlite
```

---

## 🏛️ Project Directory Structure

```
Loan connector Management  Software/
├── SPECIFICATION.md          # Canonical product specification and requirements
├── README.md                 # Setup guide, role credentials, and architecture summary
├── package.json              # Project scripts and engine requirements
├── .env.example              # Environment configuration template
├── server.js                 # Standalone HTTP server & API routing entry point
├── src/
│   ├── config.js             # Configuration loader, secrets, paths, and flags
│   ├── db/
│   │   ├── database.js       # SQLite DatabaseSync connection & ACID transaction helper
│   │   ├── schema.js         # Relational schema (WAL mode, foreign keys, 13 tables)
│   │   └── seed.js           # Synthetic dataset generator for all 5 personas & demo leads
│   ├── middleware/
│   │   ├── auth.js           # Session token management, RBAC, tenant isolation guards
│   │   ├── security.js       # Hardened CSP, HSTS, X-Frame-Options, in-memory rate limiting
│   │   └── audit.js          # Append-only system audit logger & lead event logger
│   ├── services/
│   │   ├── routingEngine.js  # Rule versioning (v2.4), suitability scoring, capacity checks
│   │   ├── commissionEngine.js# Tiered, percentage, split plans, holdbacks, clawbacks
│   │   ├── documentStorage.js# Private vault, malware scanning status, signed download links
│   │   └── piiMasker.js      # AES-256-GCM encryption and selective PII masking service
│   └── routes/
│       ├── authRoutes.js     # /api/v1/auth (login, logout, me, switch-persona)
│       ├── partnerRoutes.js  # /api/v1/partners (onboarding, approval, commercials)
│       ├── catalogRoutes.js  # /api/v1/catalog (lenders, loan products & criteria)
│       ├── leadRoutes.js     # /api/v1/leads (intake, deduplication, dispatch, transitions)
│       ├── commissionRoutes.js # /api/v1/commissions (plans, ledger, approvals, payouts)
│       └── reportRoutes.js   # /api/v1/reports (overview KPIs, audit events, masked CSV export)
├── public/
│   ├── index.html            # Main single-page web app with all 7 role portals
│   ├── css/
│   │   └── style.css         # Forest-green & warm-neutral fintech design system
│   └── js/
│       └── app.js            # Reactive UI logic, routing simulator, modals, and tables
├── scripts/
│   ├── backup.js             # Automated database backup with SHA-256 checksum
│   └── restore.js            # Verified database restore utility
└── tests/
    └── api.test.js           # 12 automated unit and integration tests
```

---

## 🔒 Security & Launch Invariant Summary

1. **PII Segregation**: All customer identity details (`name`, `phone`, `email`, `pan`) are stored in an isolated `customers` table and encrypted using AES-256-GCM. Operational lead records store only anonymized references (`LND-2026-XXXX`).
2. **Server-Side Tenant Scoping**: Every API request checks the authenticated session. Connectors cannot view, query, or enumerate other partners' leads, customers, or commissions.
3. **Private KYC Vault**: Files are stored with opaque UUID keys in `storage/kyc_vault/` outside the web server root. Download links require a cryptographically signed HMAC token valid for only 15 minutes.
4. **Immutable Financial Ledger**: Commission records are append-only. Clawbacks and reversals create offsetting `REV-` rows rather than overwriting historical financial entries.
5. **Pre-Production Checklist Notice**: Before deploying with real customer or banking data, ensure production TLS termination, managed HSM KMS key rotation, active antivirus daemon integration, and formal jurisdiction privacy counsel review under DPDP Act 2023.
