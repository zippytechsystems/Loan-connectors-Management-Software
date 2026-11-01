# Loan Connector Management Software
## Technical & Functional Specification

### 1. Product Definition
An independent, multi-party loan lead routing and partner network platform ("Connector Network OS"). The platform enables network operators, business connectors, and lending liaisons to onboard partners, configure lender/product eligibility and commission rules, intake consented customer leads, preview and execute deterministic routing, track multi-stage lead lifecycles, and reconcile partner commission ledgers.

**Boundary Notice:** This application is strictly an independent loan connector network and lead exchange platform. It is NOT a Direct Selling Agent (DSA) loan-origination system, does not process direct loan underwriting, and does not make credit decisions. It operates on an independent codebase, database, authentication store, and deployment boundary.

---

### 2. Users and Access Control Matrix (RBAC & Tenant Isolation)

| Role | Tenant Boundary | Capabilities |
| :--- | :--- | :--- |
| **Platform Administrator (`admin`)** | Global / Network | Full system governance, partner approval/suspension, lender & product catalog, commission plan versioning, routing rule configuration, user security, audit inspection, and system reports. |
| **Operations Manager (`operations`)** | Global / Operations | Lead eligibility review, manual dispatch and rerouting, acceptance SLA queue monitoring, partner dispute resolution, lead timeline management. |
| **Connector (`connector`)** | Scoped to own Partner Org (`org_id`) | Organization profile maintenance, review and accept/decline offered leads, customer contact timeline updates, own commission ledger & statement export. Cannot enumerate or view other partners' leads or earnings. |
| **Lender Liaison (`lender`)** | Scoped to affiliated Lender (`lender_id`) | View lender-bound referred leads, update lender sanction & disbursement status, add underwriting liaison notes, view product performance. |
| **Auditor / Compliance (`auditor`)** | Global / Read-Only | Read-only access to permitted records, immutable audit events, consent receipts, rule version traces, and masked customer PII. |

---

### 3. Core Functional Modules

1. **Role-Aware Auth & Portals:** Secure session management, role-based navigation, tenant-filtered views, privileged MFA toggle, PII masking, and instant persona demo switcher.
2. **Partner Onboarding & Management:** Partner organization profiles, verification status (Draft, Pending, Verified, Suspended), territory coverage, authorized product categories, and commercial agreements.
3. **Lender & Product Catalog:** Participating financial institutions, product rules (Personal, Home, Business, LAP, MSME), ticket size limits, geography, document checklists, SLA expectations, and active date windows.
4. **Consent-Aware Intake & Routing Engine:**
   - Explicit consent tracking (consent purpose, version, timestamp, channel, IP/source hash).
   - Duplicate prevention (sliding window telephone/PAN hash checking).
   - Deterministic rule evaluation (geo-match, product authorization, partner tier, capacity limit).
   - Routing algorithms: Priority Rank, Capacity-Weighted Round-Robin, and Operator Manual Dispatch.
   - Assignment preview with rule version trace, acceptance SLA timer, decline reason codes, and automatic fallback.
5. **Lead Lifecycle & Event Timeline:**
   - Normalized lifecycle states: `Intake` → `Eligible` → `Offered` → `Accepted` → `Contacted` → `Referred` → `Lender Review` → `Sanctioned` → `Disbursed` (or `Declined`, `Withdrawn`, `Expired`).
   - Append-only event history capturing timestamp, actor, state transition, reason code, and notes.
6. **Versioned Commission Ledger:**
   - Multi-type commission rules: Fixed payout, Flat percentage, Tiered volume slabs, and Referral chain splits.
   - Event-driven triggers (`Accepted`, `Referred`, `Sanctioned`, `Disbursed`).
   - Holdbacks (escrow retention periods), caps, and clawbacks/reversals.
   - Dual-approval workflows, payout status tracking (`Accrued`, `Approved`, `In Payout`, `Settled`, `Reversed`), and statement generation.
7. **Network Analytics, Reports & Audit Trail:**
   - Network pipeline metrics (volume, velocity, conversion rate, SLA compliance).
   - Partner productivity & lender conversion ratios.
   - Immutable audit log tracking all auth, access, routing, and ledger mutations.
   - Permission-aware CSV/JSON export with automatic PII masking.

---

### 4. Security & Privacy Architecture
- **PII Separation:** Customer PII (name, phone, email, identity number) is stored in a separate table/model (`customer_identities`) isolated from operational lead data (`leads`), with masked presentation by default.
- **Document Protection:** KYC documents are assigned opaque UUIDs, verified via simulated malware/checksum validation, and accessed only via short-lived authorized endpoints with logged access events.
- **Tenant Isolation:** Enforced strictly at the server/API layer on every request; UI filters serve only as UX conveniences.
- **Audit Immutability:** Event tables and financial ledgers are append-only.
