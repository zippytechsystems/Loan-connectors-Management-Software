const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { db, transaction } = require('./database');
const { encryptPII, hashIdentifier } = require('../services/piiMasker');
const { storeKYCDocument } = require('../services/documentStorage');

const { hashPassword } = require('../services/passwordSecurity');

function seedDatabase() {
  const existingUsers = db.prepare('SELECT count(*) as count FROM users').get();
  if (existingUsers.count > 0) {
    return; // Already seeded
  }

  console.log('Seeding initial synthetic dataset for Veridian Network OS...');

  transaction((dbSync) => {
    // 1. Partners
    const partnerStmt = dbSync.prepare(`
      INSERT INTO partners (
        id, name, type, status, tier, territory, 
        authorized_products, capacity_limit, active_leads_count,
        contact_person, contact_email, contact_phone, pan_or_gst, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    partnerStmt.run(
      1, 'Northstar Connect', 'Connector', 'Approved', 'Tier 1 Platinum',
      'Telangana, Andhra Pradesh', 'Personal Loan, Business Loan, Home Loan',
      50, 3, 'Kavitha Raman', 'kavitha@northstarconnect.in', '+91 98490 11223', 'AAACN1234F', '2026-10-01T10:00:00Z'
    );
    partnerStmt.run(
      2, 'Apex Financial Advisors', 'Connector', 'Approved', 'Tier 2 Gold',
      'Telangana, Karnataka, Maharashtra', 'Personal Loan, Loan Against Property',
      35, 1, 'Manish Agarwal', 'manish@apexadvisors.in', '+91 97000 44556', 'ABAPA5678K', '2026-10-05T11:30:00Z'
    );
    partnerStmt.run(
      3, 'BluePeak DSA Network', 'DSA Partner', 'Approved', 'Tier 2 Gold',
      'Telangana, Tamil Nadu', 'Home Loan, Business Loan, MSME Express',
      40, 2, 'Ramesh Babu', 'ramesh@bluepeakdsa.com', '+91 98840 99887', 'AACPB9012J', '2026-10-10T14:15:00Z'
    );
    partnerStmt.run(
      4, 'Vanguard FinServe', 'Connector', 'Pending', 'Tier 3 Silver',
      'Karnataka', 'Personal Loan',
      20, 0, 'Suresh Kulkarni', 'suresh@vanguardfin.in', '+91 94480 33445', 'AAEFV3456P', '2026-10-25T09:00:00Z'
    );
    partnerStmt.run(
      5, 'Zenith Credit Associates', 'Connector', 'Suspended', 'Tier 3 Silver',
      'Maharashtra', 'Personal Loan, Business Loan',
      25, 0, 'Deepak Shah', 'deepak@zenithcredit.in', '+91 98200 66778', 'AAACZ7890Q', '2026-09-15T12:00:00Z'
    );

    // 2. Lenders
    const lenderStmt = dbSync.prepare(`
      INSERT INTO lenders (id, name, code, status, contact_email, sla_turnaround_hours, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    lenderStmt.run(1, 'Riverbend Capital Ltd', 'RBCAP', 'Active', 'underwriting@riverbendcap.com', 24, '2026-10-01T08:00:00Z');
    lenderStmt.run(2, 'Apex Trust Housing Finance', 'ATHF', 'Active', 'liaison@apextrusthf.com', 48, '2026-10-01T08:00:00Z');
    lenderStmt.run(3, 'Zenith Commercial Bank', 'ZCB', 'Active', 'credit-desk@zenithbank.com', 36, '2026-10-01T08:00:00Z');

    // 3. Users for all 5 Personas
    const userStmt = dbSync.prepare(`
      INSERT INTO users (id, username, password_hash, full_name, email, role, partner_id, lender_id, mfa_enabled, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const demoPasswordHash = hashPassword('ConnectorDemo!26');
    const lingaswamyPasswordHash = hashPassword('zippy@pass0001');
    userStmt.run(1, 'M.Lingaswamy@123', lingaswamyPasswordHash, 'M. Lingaswamy', 'm.lingaswamy@zippyconnector.com', 'admin', null, null, 0, 1, '2026-10-01T08:00:00Z');
    userStmt.run(2, 'admin', demoPasswordHash, 'Vikram Singhania', 'admin@veridianops.net', 'admin', null, null, 1, 1, '2026-10-01T08:00:00Z');
    userStmt.run(3, 'ops', demoPasswordHash, 'Ananya Deshmukh', 'ananya.ops@veridianops.net', 'operations', null, null, 0, 1, '2026-10-01T08:00:00Z');
    userStmt.run(4, 'partner', demoPasswordHash, 'Kavitha Raman', 'kavitha@northstarconnect.in', 'connector', 1, null, 0, 1, '2026-10-01T08:00:00Z');
    userStmt.run(5, 'partner2', demoPasswordHash, 'Manish Agarwal', 'manish@apexadvisors.in', 'connector', 2, null, 0, 1, '2026-10-05T08:00:00Z');
    userStmt.run(6, 'lender', demoPasswordHash, 'Rohit Malhotra', 'rohit.lender@riverbendcap.com', 'lender', null, 1, 0, 1, '2026-10-01T08:00:00Z');
    userStmt.run(7, 'auditor', demoPasswordHash, 'Gita Sundaram', 'gita.auditor@veridianops.net', 'auditor', null, null, 0, 1, '2026-10-01T08:00:00Z');
    userStmt.run(8, 'reviewer', demoPasswordHash, 'Sunil Chawla', 'sunil.reviewer@veridianops.net', 'reviewer', null, 1, 0, 1, '2026-10-01T08:00:00Z');
    userStmt.run(9, 'finance', demoPasswordHash, 'Meera Namboodiri', 'meera.finance@veridianops.net', 'finance', null, null, 0, 1, '2026-10-01T08:00:00Z');

    // 4. Loan Products
    const prodStmt = dbSync.prepare(`
      INSERT INTO loan_products (
        id, lender_id, category, product_name, min_amount, max_amount,
        min_cibil, min_monthly_income, interest_rate_range, territories,
        document_checklist_json, sla_hours, effective_from, effective_to, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    prodStmt.run(
      1, 1, 'Personal Loan', 'Riverbend Personal Prime', 50000, 2500000, 680, 25000,
      '10.75% - 15.50%', 'Telangana, Andhra Pradesh, Karnataka, Maharashtra',
      JSON.stringify(['PAN Card', 'Aadhaar / Passport', '3 Months Bank Statements', '3 Months Salary Slips']),
      24, '2026-01-01', '2027-12-31', 'Active'
    );
    prodStmt.run(
      2, 1, 'Business Loan', 'Riverbend Business Growth', 500000, 10000000, 700, 100000,
      '12.25% - 17.00%', 'Telangana, Andhra Pradesh, Maharashtra, Tamil Nadu',
      JSON.stringify(['PAN of Entity', 'GST Returns (12 Months)', 'Audited Financials (2 Years)', 'Bank Statements (6 Months)']),
      36, '2026-01-01', '2027-12-31', 'Active'
    );
    prodStmt.run(
      3, 2, 'Home Loan', 'Apex Trust Super Home Loan', 1500000, 50000000, 720, 40000,
      '8.45% - 9.75%', 'Telangana, Karnataka, Tamil Nadu, Andhra Pradesh',
      JSON.stringify(['Identity & Address Proof', 'Property Link Documents', 'Sale Agreement', 'Form 16 / ITR 3 Years']),
      48, '2026-01-01', '2027-12-31', 'Active'
    );
    prodStmt.run(
      4, 3, 'MSME Express', 'Zenith MSME Booster Loan', 200000, 5000000, 650, 50000,
      '11.50% - 16.00%', 'Telangana, Tamil Nadu, Karnataka',
      JSON.stringify(['Udyam Registration', 'PAN Card', '6 Months Current Account Statements', 'ITR 2 Years']),
      24, '2026-01-01', '2027-12-31', 'Active'
    );
    prodStmt.run(
      5, 1, 'Loan Against Property', 'Riverbend LAP Elite', 2500000, 30000000, 700, 75000,
      '9.25% - 11.50%', 'Telangana, Maharashtra',
      JSON.stringify(['Title Deeds', 'Approved Municipal Plan', 'Income Tax Returns (3 Years)', '12 Months Bank Statements']),
      48, '2026-01-01', '2027-12-31', 'Active'
    );

    // 5. Customers (Isolated PII Store)
    const custStmt = dbSync.prepare(`
      INSERT INTO customers (
        id, full_name, phone_hash, phone_encrypted, email_encrypted,
        pan_hash, pan_encrypted, employment_type, monthly_income,
        residence_city, residence_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const customersData = [
      { id: 1, name: 'Aarav Mehta', phone: '+91 98491 23456', email: 'aarav.mehta@gmail.com', pan: 'ABCDE1234F', emp: 'Salaried', inc: 95000, city: 'Hyderabad', state: 'Telangana' },
      { id: 2, name: 'Nisha Rao', phone: '+91 97012 34567', email: 'nisha.rao@techniche.com', pan: 'BKUPR5678M', emp: 'Self-Employed Professional', inc: 280000, city: 'Secunderabad', state: 'Telangana' },
      { id: 3, name: 'Rajesh Varma', phone: '+91 98850 45678', email: 'rajesh.varma@varmaenterprises.in', pan: 'CFRPV9012K', emp: 'Business Owner', inc: 450000, city: 'Vijayawada', state: 'Andhra Pradesh' },
      { id: 4, name: 'Sana Iqbal', phone: '+91 99590 56789', email: 'sana.iqbal@cloudworks.io', pan: 'DHSQI3456L', emp: 'Salaried', inc: 140000, city: 'Hyderabad', state: 'Telangana' },
      { id: 5, name: 'Dr. Vikramaditya Reddy', phone: '+91 94401 67890', email: 'dr.vikram@reddycare.in', pan: 'EGKVR7890N', emp: 'Self-Employed Professional', inc: 320000, city: 'Warangal', state: 'Telangana' },
      { id: 6, name: 'Priya Sharma', phone: '+91 98450 78901', email: 'priya.sharma@accentrix.com', pan: 'FKLPS1234P', emp: 'Salaried', inc: 110000, city: 'Bengaluru', state: 'Karnataka' },
      { id: 7, name: 'Karthik Nambiar', phone: '+91 98410 89012', email: 'karthik@nambiarfab.com', pan: 'GMNKN5678R', emp: 'Business Owner', inc: 500000, city: 'Chennai', state: 'Tamil Nadu' }
    ];

    for (const c of customersData) {
      custStmt.run(
        c.id,
        c.name,
        hashIdentifier(c.phone),
        encryptPII(c.phone),
        encryptPII(c.email),
        hashIdentifier(c.pan),
        encryptPII(c.pan),
        c.emp,
        c.inc,
        c.city,
        c.state,
        '2026-10-20T10:00:00Z'
      );
    }

    // 6. Consent Receipts
    const consentStmt = dbSync.prepare(`
      INSERT INTO consent_receipts (
        customer_id, consent_purpose, consent_version, channel,
        ip_hash, granted_at, expires_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `);
    for (const c of customersData) {
      consentStmt.run(
        c.id,
        'Loan connector matching and authorized credit assessment under DPDP Act 2023',
        'v1.2-2026-CONSENT',
        'web_portal_consent_flow',
        crypto.createHash('sha256').update(`127.0.0.1-${c.id}`).digest('hex').slice(0, 16),
        '2026-10-20T10:05:00Z',
        '2027-10-20T10:05:00Z'
      );
    }

    // 7. Operational Leads
    const leadStmt = dbSync.prepare(`
      INSERT INTO leads (
        id, lead_reference, customer_id, product_id, requested_amount,
        city, state, status, assigned_partner_id, lender_id,
        offer_sent_at, offer_expires_at, sanctioned_amount, disbursed_amount,
        estimated_commission, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Lead 1: Accepted by Northstar Connect (Partner 1)
    leadStmt.run(
      1, 'LND-2026-1001', 1, 1, 600000, 'Hyderabad', 'Telangana', 'Accepted',
      1, null, '2026-10-28T10:00:00Z', '2026-10-29T10:00:00Z', 0, 0,
      7500, '2026-10-28T09:30:00Z', '2026-10-28T11:15:00Z'
    );
    // Lead 2: Referred to Riverbend Capital by Northstar Connect
    leadStmt.run(
      2, 'LND-2026-1002', 2, 2, 2500000, 'Secunderabad', 'Telangana', 'Referred',
      1, 1, '2026-10-27T14:00:00Z', '2026-10-28T14:00:00Z', 0, 0,
      31250, '2026-10-27T13:45:00Z', '2026-10-29T16:20:00Z'
    );
    // Lead 3: Under Lender Review at Apex Trust Housing Finance
    leadStmt.run(
      3, 'LND-2026-1003', 3, 3, 6500000, 'Vijayawada', 'Andhra Pradesh', 'Lender Review',
      3, 2, '2026-10-25T11:00:00Z', '2026-10-26T11:00:00Z', 0, 0,
      65000, '2026-10-25T10:30:00Z', '2026-10-28T15:00:00Z'
    );
    // Lead 4: Disbursed! Fully closed deal with commission
    leadStmt.run(
      4, 'LND-2026-1004', 4, 1, 450000, 'Hyderabad', 'Telangana', 'Disbursed',
      1, 1, '2026-10-22T09:00:00Z', '2026-10-23T09:00:00Z', 450000, 450000,
      5625, '2026-10-22T08:30:00Z', '2026-10-30T17:45:00Z'
    );
    // Lead 5: Offered to Apex Financial Advisors (Countdown active)
    const offerNow = new Date();
    const offerExpiry = new Date(offerNow.getTime() + 18 * 60 * 60 * 1000).toISOString();
    leadStmt.run(
      5, 'LND-2026-1005', 5, 5, 4500000, 'Warangal', 'Telangana', 'Offered',
      2, null, offerNow.toISOString(), offerExpiry, 0, 0,
      45000, offerNow.toISOString(), offerNow.toISOString()
    );
    // Lead 6: Eligible (Ready for intake / routing simulator)
    leadStmt.run(
      6, 'LND-2026-1006', 6, 1, 800000, 'Bengaluru', 'Karnataka', 'Eligible',
      null, null, null, null, 0, 0,
      10000, '2026-11-01T08:00:00Z', '2026-11-01T08:00:00Z'
    );
    // Lead 7: Contacted by BluePeak DSA
    leadStmt.run(
      7, 'LND-2026-1007', 7, 4, 1800000, 'Chennai', 'Tamil Nadu', 'Contacted',
      3, null, '2026-10-29T10:00:00Z', '2026-10-30T10:00:00Z', 0, 0,
      22500, '2026-10-29T09:00:00Z', '2026-10-30T12:00:00Z'
    );

    // 8. Lead Assignments
    const assignStmt = dbSync.prepare(`
      INSERT INTO lead_assignments (
        lead_id, partner_id, rule_version_id, routing_method,
        candidate_scores_json, assigned_by, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    assignStmt.run(1, 1, 'RULE-v2.4-AUTO', 'Priority', JSON.stringify({ score: 92, partner: 'Northstar Connect' }), 'ops', 'Accepted', '2026-10-28T10:00:00Z');
    assignStmt.run(2, 1, 'RULE-v2.4-AUTO', 'Weighted Round-Robin', JSON.stringify({ score: 88, partner: 'Northstar Connect' }), 'ops', 'Accepted', '2026-10-27T14:00:00Z');
    assignStmt.run(3, 3, 'RULE-v2.4-AUTO', 'Priority', JSON.stringify({ score: 85, partner: 'BluePeak DSA' }), 'ops', 'Accepted', '2026-10-25T11:00:00Z');
    assignStmt.run(4, 1, 'RULE-v2.4-AUTO', 'Priority', JSON.stringify({ score: 95, partner: 'Northstar Connect' }), 'admin', 'Accepted', '2026-10-22T09:00:00Z');
    assignStmt.run(5, 2, 'RULE-v2.4-AUTO', 'Priority', JSON.stringify({ score: 82, partner: 'Apex Financial Advisors' }), 'ops', 'Offered', offerNow.toISOString());
    assignStmt.run(7, 3, 'RULE-v2.4-AUTO', 'Manual Dispatch', JSON.stringify({ score: 80, partner: 'BluePeak DSA' }), 'ops', 'Accepted', '2026-10-29T10:00:00Z');

    // 9. Lead Events (Timeline)
    const eventStmt = dbSync.prepare(`
      INSERT INTO lead_events (lead_id, actor_username, actor_role, from_status, to_status, action_name, notes, reason_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    eventStmt.run(4, 'admin', 'admin', 'New', 'Eligible', 'consent_verified', 'Customer consent verified via mobile OTP link', 'CONSENT_GRANTED', '2026-10-22T08:35:00Z');
    eventStmt.run(4, 'ops', 'operations', 'Eligible', 'Offered', 'routed_to_partner', 'Auto-routed to Northstar Connect via Priority Score algorithm', 'RULE_V2.4_MATCH', '2026-10-22T09:00:00Z');
    eventStmt.run(4, 'partner', 'connector', 'Offered', 'Accepted', 'offer_accepted', 'Partner accepted customer lead within 35 minutes', 'PARTNER_CONFIRM', '2026-10-22T09:35:00Z');
    eventStmt.run(4, 'partner', 'connector', 'Accepted', 'Contacted', 'customer_call_logged', 'Introductory consultation completed. Customer ready with documents.', 'CONTACT_SUCCESS', '2026-10-23T11:00:00Z');
    eventStmt.run(4, 'partner', 'connector', 'Contacted', 'Referred', 'referred_to_lender', 'Referred to Riverbend Capital Personal Prime program', 'LENDER_DISPATCH', '2026-10-24T14:30:00Z');
    eventStmt.run(4, 'lender', 'lender', 'Referred', 'Lender Review', 'underwriting_review', 'Underwriting desk initiated credit evaluation and bureau check', 'BUREAU_PULL_OK', '2026-10-26T10:00:00Z');
    eventStmt.run(4, 'lender', 'lender', 'Lender Review', 'Sanctioned', 'sanction_letter_issued', 'Loan approved for full requested ticket size ₹4,50,000 at 11.25%', 'SANCTION_APPROVED', '2026-10-29T15:30:00Z');
    eventStmt.run(4, 'lender', 'lender', 'Sanctioned', 'Disbursed', 'disbursement_confirmed', 'Disbursement transferred to customer account via NEFT UTR #RBCAP26103001', 'FUNDS_DISBURSED', '2026-10-30T17:45:00Z');

    eventStmt.run(1, 'ops', 'operations', 'Offered', 'Accepted', 'offer_accepted', 'Lead accepted by Northstar Connect', 'PARTNER_CONFIRM', '2026-10-28T11:15:00Z');
    eventStmt.run(2, 'partner', 'connector', 'Accepted', 'Referred', 'referred_to_lender', 'Referred to Riverbend Capital Business Loan team', 'LENDER_DISPATCH', '2026-10-29T16:20:00Z');
    eventStmt.run(5, 'ops', 'operations', 'Eligible', 'Offered', 'offer_dispatched', 'Offered to Apex Financial Advisors (24h acceptance SLA)', 'OFFER_DISPATCH', offerNow.toISOString());

    // 10. Commission Plans
    const planStmt = dbSync.prepare(`
      INSERT INTO commission_plans (
        id, name, version, plan_type, rules_config_json,
        trigger_event, holdback_percent, cap_amount, effective_date, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    planStmt.run(
      1, 'Standard Retail Disbursal Plan', 'v2.1', 'Percentage',
      JSON.stringify({ rate: 1.25 }),
      'Disbursed', 10, 150000, '2026-01-01', 1, '2026-01-01T00:00:00Z'
    );
    planStmt.run(
      2, 'Commercial Tiered Slabs Plan', 'v1.4', 'Tiered Slabs',
      JSON.stringify({
        slabs: [
          { max: 1000000, rate: 1.0 },
          { max: 5000000, rate: 1.5 },
          { max: 999999999, rate: 2.0 }
        ]
      }),
      'Disbursed', 15, 300000, '2026-01-01', 1, '2026-01-01T00:00:00Z'
    );
    planStmt.run(
      3, 'Referral Split Incentive Plan', 'v1.0', 'Referral Split',
      JSON.stringify({ baseRate: 1.5, partnerSharePercent: 70 }),
      'Disbursed', 10, 200000, '2026-01-01', 0, '2026-01-01T00:00:00Z'
    );
    planStmt.run(
      4, 'Connector Intake Activation Bounty', 'v1.1', 'Fixed',
      JSON.stringify({ fixedAmount: 1500 }),
      'Accepted', 0, 5000, '2026-01-01', 0, '2026-01-01T00:00:00Z'
    );

    // 11. Commission Ledger (Immutable Records)
    const commStmt = dbSync.prepare(`
      INSERT INTO commission_ledger (
        id, ledger_code, lead_id, partner_id, trigger_event,
        gross_amount, holdback_amount, net_payable,
        status, plan_version_applied, payout_reference, approved_by,
        reversal_reason, created_at, settled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Commission for Lead 4 (Paid)
    commStmt.run(
      1, 'COM-2026-10041', 4, 1, 'Disbursed',
      5625, 563, 5062,
      'Paid', 'v2.1', 'HDFC-NEFT-90412854', 'admin',
      null, '2026-10-30T17:46:00Z', '2026-10-31T11:00:00Z'
    );
    // Commission for Lead 2 (Approved, awaiting payout batch)
    commStmt.run(
      2, 'COM-2026-10042', 2, 1, 'Referred',
      12500, 1250, 11250,
      'Approved', 'v2.1', null, 'ops',
      null, '2026-10-29T16:21:00Z', null
    );
    // Commission for Lead 1 (Accrued)
    commStmt.run(
      3, 'COM-2026-10043', 1, 1, 'Accepted',
      1500, 0, 1500,
      'Accrued', 'v1.1', null, null,
      null, '2026-10-28T11:16:00Z', null
    );
    // Historical reversal demonstration row
    commStmt.run(
      4, 'REV-2026-90012', 4, 1, 'Clawback: Disbursed',
      -1200, -120, -1080,
      'Reversed', 'v2.1', 'CLAWBACK_ADJ_PRIOR', 'admin',
      'Early customer foreclosure within 30-day lender clawback window',
      '2026-10-15T14:00:00Z', '2026-10-15T14:00:00Z'
    );

    // 12. Audit Events
    const auditStmt = dbSync.prepare(`
      INSERT INTO audit_events (
        actor_username, actor_role, actor_ip, event_type,
        resource_type, resource_id, action_summary, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    auditStmt.run(
      'admin', 'admin', '127.0.0.1', 'SYSTEM_INITIALIZED',
      'system', '1', 'System seed initialization completed with 5 personas and synthetic records',
      JSON.stringify({ version: '1.0.0', mode: 'sandbox_review' }),
      '2026-10-01T08:00:00Z'
    );
    auditStmt.run(
      'ops', 'operations', '127.0.0.1', 'LEAD_ROUTED',
      'lead', '4', 'Auto-routed lead #LND-2026-1004 to Northstar Connect',
      JSON.stringify({ algorithm: 'Priority Score', score: 95 }),
      '2026-10-22T09:00:00Z'
    );
    auditStmt.run(
      'admin', 'admin', '127.0.0.1', 'COMMISSION_SETTLED',
      'commission_ledger', 'COM-2026-10041', 'Settled commission payout of ₹5,062 via NEFT to Northstar Connect',
      JSON.stringify({ utr: 'HDFC-NEFT-90412854', net: 5062, holdback: 563 }),
      '2026-10-31T11:00:00Z'
    );

    // 13. Partner-Lender Assignments (Authorized Connector-Lender Relationships)
    const plaStmt = dbSync.prepare(`
      INSERT INTO partner_lender_assignments (partner_id, lender_id, status, assigned_at)
      VALUES (?, ?, ?, ?)
    `);
    plaStmt.run(1, 1, 'Active', '2026-10-01T10:00:00Z'); // Northstar -> Riverbend
    plaStmt.run(1, 2, 'Active', '2026-10-01T10:00:00Z'); // Northstar -> Apex Trust
    plaStmt.run(2, 1, 'Active', '2026-10-05T11:30:00Z'); // Apex Advisors -> Riverbend
    plaStmt.run(3, 3, 'Active', '2026-10-10T14:15:00Z'); // BluePeak -> Zenith Bank

    // 14. Lead Follow-Up Reminders & Operational Tasks
    const reminderStmt = dbSync.prepare(`
      INSERT INTO lead_reminders (lead_id, assigned_to, title, reminder_type, due_date, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    reminderStmt.run(
      1, 'kavitha@northstarconnect.in', 'Verify updated 6-month bank statement',
      'Document Collection', '2026-11-05T17:00:00Z', 'Pending',
      'Customer promised to email current account PDF by Thursday afternoon', '2026-11-01T10:00:00Z'
    );
    reminderStmt.run(
      2, 'ananya.ops@veridianops.net', 'Lender credit desk valuation check for LAP',
      'Lender Review', '2026-11-03T14:00:00Z', 'Pending',
      'Check Riverbend valuation desk for Secunderabad property report', '2026-11-01T11:30:00Z'
    );
    reminderStmt.run(
      4, 'kavitha@northstarconnect.in', 'Collect signed sanction receipt',
      'Follow Up', '2026-10-31T12:00:00Z', 'Completed',
      'Customer signed and disbursed through Riverbend Capital', '2026-10-30T09:00:00Z'
    );
  });

  // Create sample KYC documents in storage vault for Lead 4 and Lead 1
  try {
    const sampleBuffer1 = Buffer.from('%PDF-1.4 Synthetic PAN Card Document for Aarav Mehta (Veridian Review MVP)');
    storeKYCDocument({
      leadId: 1,
      documentType: 'PAN Card',
      originalName: 'Customer_PAN_AaravMehta.pdf',
      fileBuffer: sampleBuffer1,
      mimeType: 'application/pdf',
      actorUsername: 'ops'
    });

    const sampleBuffer2 = Buffer.from('%PDF-1.4 Synthetic 3-Month Bank Statements for Sana Iqbal (Veridian Review MVP)');
    storeKYCDocument({
      leadId: 4,
      documentType: 'Bank Statement',
      originalName: 'HDFC_Bank_Statement_3M_SanaIqbal.pdf',
      fileBuffer: sampleBuffer2,
      mimeType: 'application/pdf',
      actorUsername: 'partner'
    });
  } catch (err) {
    console.warn('Notice: Sample document seeding skipped:', err.message);
  }

  console.log('Veridian Network OS database successfully initialized and seeded.');
}

module.exports = {
  seedDatabase,
  hashPassword
};
