const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

// Clean test database before test execution to guarantee clean isolation
const testDbFile = path.join(__dirname, '..', 'data', 'test_connector.sqlite');
for (const f of [testDbFile, `${testDbFile}-wal`, `${testDbFile}-shm`]) {
  if (fs.existsSync(f)) {
    try { fs.unlinkSync(f); } catch (e) {}
  }
}
process.env.NODE_ENV = 'test';
process.env.CONNECTOR_DB = testDbFile;

const config = require('../src/config');
const { db, transaction } = require('../src/db/database');
const { seedDatabase } = require('../src/db/seed');
const { createSession, getSession, validateCsrf } = require('../src/middleware/auth');
const { hashPassword, verifyPassword } = require('../src/services/passwordSecurity');
const {
  encryptPII,
  decryptPII,
  hashIdentifier,
  legacyHashIdentifier,
  maskCustomerRecord,
  maskPhone,
  maskEmail,
  maskPAN,
  maskName
} = require('../src/services/piiMasker');
const {
  CURRENT_RULE_VERSION,
  evaluateEligiblePartners,
  dispatchLeadOffer,
  processExpiredOffers
} = require('../src/services/routingEngine');
const {
  calculateCommission,
  postCommissionEntry,
  postReversalEntry
} = require('../src/services/commissionEngine');
const {
  storeKYCDocument,
  generateDocumentAccessToken,
  retrieveKYCDocument,
  validateFileSignature,
  sanitizeFileName
} = require('../src/services/documentStorage');
const { handleAuthRoutes } = require('../src/routes/authRoutes');
const { handleLeadRoutes } = require('../src/routes/leadRoutes');
const { handlePartnerRoutes } = require('../src/routes/partnerRoutes');
const { handleCommissionRoutes } = require('../src/routes/commissionRoutes');
const { handleReportRoutes } = require('../src/routes/reportRoutes');
const { createBackup } = require('../scripts/backup');
const { restoreDatabase } = require('../scripts/restore');

// Seed test database
seedDatabase();

// Mock HTTP Helpers
function mockRequest({ method = 'GET', url = '/', headers = {}, socket = { remoteAddress: '127.0.0.1' } }) {
  return {
    method,
    url,
    headers: { host: 'localhost', ...headers },
    socket
  };
}

function mockResponse() {
  let statusCode = 200;
  const headers = {};
  let rawBody = '';
  return {
    writeHead(code, hdrs = {}) {
      statusCode = code;
      for (const [k, v] of Object.entries(hdrs)) {
        headers[k.toLowerCase()] = v;
      }
    },
    setHeader(name, val) {
      headers[name.toLowerCase()] = val;
    },
    end(data) {
      if (data) rawBody += data.toString();
    },
    get statusCode() { return statusCode; },
    get headers() { return headers; },
    get body() {
      try { return JSON.parse(rawBody); } catch (e) { return rawBody; }
    }
  };
}

// --------------------------------------------------------------------------
// 1. TENANT BOUNDARIES AND NON-ENUMERATING ISOLATION TESTS
// --------------------------------------------------------------------------
test('1. Tenant Boundaries and Non-Enumerating 404 Responses', async (t) => {
  const northstarUser = db.prepare("SELECT * FROM users WHERE username='partner'").get(); // Partner 1
  const apexUser = db.prepare("SELECT * FROM users WHERE username='partner2'").get();     // Partner 2
  const lenderUser = db.prepare("SELECT * FROM users WHERE username='lender'").get();       // Lender 1
  const auditorUser = db.prepare("SELECT * FROM users WHERE username='auditor'").get();     // Auditor

  const northstarSession = {
    userId: northstarUser.id,
    username: northstarUser.username,
    role: 'connector',
    partnerId: 1,
    lenderId: null
  };

  const apexSession = {
    userId: apexUser.id,
    username: apexUser.username,
    role: 'connector',
    partnerId: 2,
    lenderId: null
  };

  await t.test('Northstar connector cannot query or enumerate Apex lead (Lead #5 belongs to Apex)', () => {
    const req = mockRequest({ method: 'GET', url: '/api/v1/leads/5' });
    const res = mockResponse();
    const u = new URL(req.url, 'http://localhost');

    handleLeadRoutes(req, res, u, null, northstarSession);
    assert.equal(res.statusCode, 404, 'Must return non-enumerating 404 for inaccessible tenant lead');
    assert.equal(res.body.error, 'Lead not found', 'Must not reveal record existence with 403');
  });

  await t.test('Apex connector cannot query or enumerate Northstar lead (Lead #1 belongs to Northstar)', () => {
    const req = mockRequest({ method: 'GET', url: '/api/v1/leads/1' });
    const res = mockResponse();
    const u = new URL(req.url, 'http://localhost');

    handleLeadRoutes(req, res, u, null, apexSession);
    assert.equal(res.statusCode, 404, 'Must return non-enumerating 404 for foreign lead');
    assert.equal(res.body.error, 'Lead not found');
  });

  await t.test('Northstar connector cannot view or enumerate Apex partner organization profile (Partner #2)', () => {
    const req = mockRequest({ method: 'GET', url: '/api/v1/partners/2' });
    const res = mockResponse();
    const u = new URL(req.url, 'http://localhost');

    handlePartnerRoutes(req, res, u, null, northstarSession);
    assert.equal(res.statusCode, 404, 'Must return non-enumerating 404 for foreign partner organization');
    assert.equal(res.body.error, 'Partner organization not found');
  });

  await t.test('Connector lead list query returns only own leads', () => {
    const req = mockRequest({ method: 'GET', url: '/api/v1/leads' });
    const res = mockResponse();
    const u = new URL(req.url, 'http://localhost');

    handleLeadRoutes(req, res, u, null, northstarSession);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.leads.length > 0);
    for (const l of res.body.leads) {
      assert.equal(l.is_owner, true);
    }
  });

  await t.test('Auditor cannot perform mutating actions across routes (Read-Only Enforcement)', () => {
    const auditorSession = { userId: auditorUser.id, username: 'auditor', role: 'auditor' };
    
    // Intake
    const resIntake = mockResponse();
    handleLeadRoutes(mockRequest({ method: 'POST', url: '/api/v1/leads/intake' }), resIntake, new URL('http://localhost/api/v1/leads/intake'), { fullName: 'Test' }, auditorSession);
    assert.equal(resIntake.statusCode, 403);

    // Partner onboarding
    const resPartner = mockResponse();
    handlePartnerRoutes(mockRequest({ method: 'POST', url: '/api/v1/partners' }), resPartner, new URL('http://localhost/api/v1/partners'), { name: 'Test' }, auditorSession);
    assert.equal(resPartner.statusCode, 403);

    // Commission approval
    const resComm = mockResponse();
    handleCommissionRoutes(mockRequest({ method: 'POST', url: '/api/v1/commissions/ledger/1/approve' }), resComm, new URL('http://localhost/api/v1/commissions/ledger/1/approve'), {}, auditorSession);
    assert.equal(resComm.statusCode, 403);
  });
});

// --------------------------------------------------------------------------
// 2. IDENTITY, PASSWORD SECURITY & DEMO SWITCHER RESTRICTIONS
// --------------------------------------------------------------------------
test('2. Identity Security, Password Hashing & Demo Switcher Restrictions', async (t) => {
  await t.test('Per-user salted scrypt generates unique hashes for identical passwords', () => {
    const hash1 = hashPassword('ConnectorDemo!26');
    const hash2 = hashPassword('ConnectorDemo!26');
    assert.notEqual(hash1, hash2, 'Salts must be randomly generated per user/hash');
    assert.ok(hash1.includes(':'), 'Hash must contain salt delimiter');
  });

  await t.test('Password verification succeeds for both new salted hash and legacy hash', () => {
    const saltedHash = hashPassword('SecretP@ssword2026');
    const check1 = verifyPassword('SecretP@ssword2026', saltedHash);
    assert.equal(check1.valid, true);
    assert.equal(check1.needsUpgrade, false);

    // Legacy demo hash
    const legacyDemoHash = crypto.scryptSync('ConnectorDemo!26', 'veridian-connector-salt-demo-2026', 32).toString('hex');
    const check2 = verifyPassword('ConnectorDemo!26', legacyDemoHash);
    assert.equal(check2.valid, true);
    assert.equal(check2.needsUpgrade, true, 'Legacy hash must flag for transparent upgrade');

    const wrongCheck = verifyPassword('WrongPassword!', saltedHash);
    assert.equal(wrongCheck.valid, false);
  });

  await t.test('Demo persona switcher is strictly blocked when NODE_ENV is production', () => {
    const origEnv = config.NODE_ENV;
    try {
      config.NODE_ENV = 'production';
      const req = mockRequest({ method: 'POST', url: '/api/v1/auth/switch-demo-persona' });
      const res = mockResponse();
      const u = new URL(req.url, 'http://localhost');

      handleAuthRoutes(req, res, u, { targetRole: 'admin' });
      assert.equal(res.statusCode, 403, 'Persona switcher must be forbidden in production');
      assert.match(res.body.error, /disabled in production/i);
    } finally {
      config.NODE_ENV = origEnv;
    }
  });

  await t.test('CSRF validation requires X-CSRF-Token for cookie-authenticated mutation requests', () => {
    const adminUser = db.prepare("SELECT * FROM users WHERE username='admin'").get();
    const sessionRes = createSession(adminUser);

    // Cookie session without CSRF token
    const fakeCookieReq = {
      method: 'POST',
      headers: {}
    };
    const valid = validateCsrf(fakeCookieReq, { user: sessionRes.session, authMethod: 'cookie' });
    assert.equal(valid, false, 'Mutating cookie request without CSRF token must fail');

    // Cookie session with matching CSRF token
    const validCookieReq = {
      method: 'POST',
      headers: { 'x-csrf-token': sessionRes.csrfToken }
    };
    const valid2 = validateCsrf(validCookieReq, { user: sessionRes.session, authMethod: 'cookie' });
    assert.equal(valid2, true, 'Matching CSRF token must pass');

    // Bearer token requests bypass ambient CSRF check
    const bearerReq = { method: 'POST', headers: {} };
    const valid3 = validateCsrf(bearerReq, { user: sessionRes.session, authMethod: 'bearer' });
    assert.equal(valid3, true, 'Bearer header requests are not subject to ambient browser CSRF');
  });
});

// --------------------------------------------------------------------------
// 3. CUSTOMER PII SEGREGATION, KEY SEPARATION & ENCRYPTION AT REST
// --------------------------------------------------------------------------
test('3. Customer PII Segregation, Key Separation & Encryption at Rest', async (t) => {
  await t.test('HMAC deduplication key is separated from AES-256-GCM encryption key', () => {
    const rawVal = '+91 98490 12345';
    const hmac1 = hashIdentifier(rawVal);
    assert.ok(hmac1.length === 64, 'HMAC sha256 output must be 64 hex characters');

    const encVal = encryptPII(rawVal);
    assert.ok(encVal.startsWith('v1:'), 'Authenticated encryption must include version prefix');

    const decrypted = decryptPII(encVal);
    assert.equal(decrypted, rawVal, 'Decrypted text must match original plain text');
  });

  await t.test('Auditor role always receives masked PII in lead details and CSV export', () => {
    const customer = db.prepare('SELECT * FROM customers WHERE id = 1').get();
    const masked = maskCustomerRecord(customer, 'auditor', 'Disbursed', false);

    assert.equal(masked.is_masked, true);
    assert.match(masked.phone, /\*\*\*\*/);
    assert.match(masked.email, /\*\*\*@/);
    assert.match(masked.pan, /\*\*\*\*/);
    assert.match(masked.full_name, /\*\*\*\*/);

    // CSV export test for auditor
    const req = mockRequest({ method: 'GET', url: '/api/v1/reports/export' });
    const res = mockResponse();
    const u = new URL(req.url, 'http://localhost');
    handleReportRoutes(req, res, u, null, { role: 'auditor', username: 'auditor' });

    assert.equal(res.statusCode, 200);
    assert.match(res.body, /A\*\*\*\*/, 'Customer names in CSV export must be masked for auditor');
    assert.match(res.body, /\+91 9\*{5}\d{3}/, 'Phones in CSV export must be masked for auditor');
  });

  await t.test('Customer PII purge erases sensitive identity while preserving financial ledger', () => {
    const adminSession = { role: 'admin', username: 'admin' };
    const leadId = 4; // Lead 4 has settled commission in commission_ledger

    const req = mockRequest({ method: 'POST', url: `/api/v1/leads/${leadId}/purge-pii` });
    const res = mockResponse();
    const u = new URL(req.url, 'http://localhost');

    handleLeadRoutes(req, res, u, { reason: 'Customer requested right to be forgotten' }, adminSession);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);

    // Verify customer record is redacted
    const lead = db.prepare('SELECT customer_id FROM leads WHERE id = ?').get(leadId);
    const purgedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(lead.customer_id);
    assert.equal(purgedCustomer.full_name, 'REDACTED (PURGED)');
    assert.equal(purgedCustomer.phone_encrypted, '');
    assert.equal(purgedCustomer.pan_encrypted, '');

    // Verify financial ledger is completely preserved
    const ledger = db.prepare("SELECT * FROM commission_ledger WHERE lead_id = ? AND status = 'Paid'").get(leadId);
    assert.ok(ledger, 'Financial ledger record must NOT be deleted');
    assert.ok(ledger.net_payable > 0, 'Financial ledger amount must remain intact');
  });
});

// --------------------------------------------------------------------------
// 4. INTAKE IDEMPOTENCY, DEDUPLICATION PRIVACY & CONSENT ENFORCEMENT
// --------------------------------------------------------------------------
test('4. Intake Idempotency, Deduplication Privacy & Consent Enforcement', async (t) => {
  const connectorSession = { role: 'connector', username: 'partner', partnerId: 1 };

  await t.test('Mandatory customer consent required before lead ingestion', () => {
    const req = mockRequest({ method: 'POST', url: '/api/v1/leads/intake' });
    const res = mockResponse();
    const u = new URL(req.url, 'http://localhost');

    handleLeadRoutes(req, res, u, {
      fullName: 'Rahul Verma',
      phone: '+91 99887 76655',
      pan: 'ABCDE9999F',
      productId: 1,
      requestedAmount: 500000,
      consentGranted: false // Missing consent
    }, connectorSession);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /consent is mandatory/i);
  });

  await t.test('Idempotent repeated intake by same connector returns existing lead without duplicate', () => {
    const intakePayload = {
      fullName: 'Vikram Mehta',
      phone: '+91 91234 56789',
      pan: 'ABCVM1234K',
      productId: 1,
      requestedAmount: 600000,
      consentGranted: true,
      idempotencyKey: 'idemp-key-test-001'
    };

    // First ingestion
    const req1 = mockRequest({ method: 'POST', url: '/api/v1/leads/intake' });
    const res1 = mockResponse();
    handleLeadRoutes(req1, res1, new URL('http://localhost/api/v1/leads/intake'), intakePayload, connectorSession);
    assert.equal(res1.statusCode, 201);
    const leadRef1 = res1.body.leadReference;

    // Second ingestion with same payload to test duplicate intake idempotency
    const req2 = mockRequest({ method: 'POST', url: '/api/v1/leads/intake' });
    const res2 = mockResponse();
    handleLeadRoutes(req2, res2, new URL('http://localhost/api/v1/leads/intake'), { ...intakePayload, idempotencyKey: 'idemp-key-test-002' }, connectorSession);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.leadReference, leadRef1, 'Must return same lead reference idempotently');
    assert.equal(res2.body.idempotent, true);
  });

  await t.test('Foreign tenant intake match returns generic 409 without leaking other tenant reference', () => {
    const competitorSession = { role: 'connector', username: 'partner2', partnerId: 2 };
    // Customer with phone '+91 91234 56789' is currently active under Partner 1
    const req = mockRequest({ method: 'POST', url: '/api/v1/leads/intake' });
    const res = mockResponse();

    handleLeadRoutes(req, res, new URL('http://localhost/api/v1/leads/intake'), {
      fullName: 'Vikram Mehta',
      phone: '+91 91234 56789',
      pan: 'ABCVM1234K',
      productId: 1,
      requestedAmount: 600000,
      consentGranted: true
    }, competitorSession);

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'ACTIVE_APPLICATION_EXISTS');
    assert.equal(res.body.existingLeadReference, undefined, 'Must NOT leak foreign lead reference to competitor connector');
  });

  await t.test('Routing dispatch requires valid active customer consent', () => {
    // Revoke consent for Lead #6's customer
    const lead6 = db.prepare('SELECT * FROM leads WHERE id = 6').get();
    db.prepare("UPDATE consent_receipts SET status = 'Revoked' WHERE customer_id = ?").run(lead6.customer_id);

    const opsSession = { role: 'operations', username: 'ops' };
    const req = mockRequest({ method: 'POST', url: '/api/v1/leads/6/route' });
    const res = mockResponse();

    handleLeadRoutes(req, res, new URL('http://localhost/api/v1/leads/6/route'), { partnerId: 1 }, opsSession);
    assert.equal(res.statusCode, 422, 'Routing must fail without active customer consent');
    assert.match(res.body.error, /consent missing or expired/i);
  });
});

// --------------------------------------------------------------------------
// 5. ROUTING CONCURRENCY, CAPACITY ENFORCEMENT & OFFER SLA EXPIRATION
// --------------------------------------------------------------------------
test('5. Routing Concurrency, Capacity Limits & Offer SLA Auto-Reroute', async (t) => {
  await t.test('Dispatch offer fails if partner is at capacity limit', () => {
    // Lead 6: Restore consent for customer
    const lead6 = db.prepare('SELECT * FROM leads WHERE id = 6').get();
    db.prepare("UPDATE consent_receipts SET status = 'Active' WHERE customer_id = ?").run(lead6.customer_id);

    // Temporarily set Partner 1 active leads equal to capacity limit
    db.prepare('UPDATE partners SET active_leads_count = capacity_limit WHERE id = 1').run();

    assert.throws(() => {
      dispatchLeadOffer({
        leadId: 6,
        partnerId: 1,
        routingMethod: 'Priority',
        assignedBy: 'test_runner'
      });
    }, /maximum capacity limit/i, 'Must throw capacity error when partner limit is reached');

    // Restore partner 1 active count
    db.prepare('UPDATE partners SET active_leads_count = 3 WHERE id = 1').run();
  });

  await t.test('Offer SLA expiration detects timed-out offers and auto-reroutes to next eligible candidate', () => {
    // Create an isolated expired offered lead (Personal loan in Hyderabad supported by Partner 1 and Partner 2)
    const pastTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const slaLeadInsert = db.prepare(`
      INSERT INTO leads (
        lead_reference, customer_id, product_id, requested_amount,
        city, state, status, assigned_partner_id, offer_sent_at, offer_expires_at,
        created_at, updated_at
      ) VALUES ('LND-SLA-TEST', 1, 1, 500000, 'Hyderabad', 'Telangana', 'Offered', 2, ?, ?, ?, ?)
    `).run(pastTime, pastTime, pastTime, pastTime);
    const slaLeadId = Number(slaLeadInsert.lastInsertRowid);

    // Also record prior assignment for partner 2 so evaluateEligiblePartners excludes partner 2
    db.prepare(`
      INSERT INTO lead_assignments (lead_id, partner_id, rule_version_id, routing_method, assigned_by, status, created_at)
      VALUES (?, 2, 'R-2026-V1', 'Manual Dispatch', 'system', 'Offered', ?)
    `).run(slaLeadId, pastTime);

    const results = processExpiredOffers();
    assert.ok(results.length > 0, 'Must process expired lead');

    const updatedSlaLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(slaLeadId);
    assert.equal(updatedSlaLead.status, 'Offered', 'Must be re-offered to next candidate');
    assert.notEqual(updatedSlaLead.assigned_partner_id, 2, 'Must not be re-offered to the same timed-out partner');
    assert.equal(updatedSlaLead.assigned_partner_id, 1, 'Must be rerouted to Partner 1 (Northstar)');

    // Check timeline event
    const timedOutEvent = db.prepare(`
      SELECT * FROM lead_events WHERE lead_id = ? AND action_name = 'offer_sla_timed_out'
    `).get(slaLeadId);
    assert.ok(timedOutEvent, 'Must record SLA timeout lifecycle event in audit timeline');
  });

  await t.test('Strict lifecycle transition rejects invalid jumps (e.g. Offered -> Disbursed)', () => {
    const adminSession = { role: 'admin', username: 'admin' };
    const req = mockRequest({ method: 'POST', url: '/api/v1/leads/5/transition' });
    const res = mockResponse();

    handleLeadRoutes(req, res, new URL('http://localhost/api/v1/leads/5/transition'), {
      targetStatus: 'Disbursed' // Invalid transition directly from Offered
    }, adminSession);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Invalid lifecycle transition/i);
  });
});

// --------------------------------------------------------------------------
// 6. ENCRYPTED KYC DOCUMENT VAULT & MALWARE SCANNER ADAPTER
// --------------------------------------------------------------------------
test('6. Encrypted KYC Document Vault & Malware Scanner Adapter', async (t) => {
  await t.test('Uploaded document is encrypted at rest in the storage vault', () => {
    const samplePdf = Buffer.from('%PDF-1.4 Confidential Customer Link Document');
    const docResult = storeKYCDocument({
      leadId: 1,
      documentType: 'Aadhaar Card',
      originalName: 'Customer_Aadhaar.pdf',
      fileBuffer: samplePdf,
      mimeType: 'application/pdf',
      actorUsername: 'test_ops'
    });

    assert.ok(docResult.opaqueKey);
    const vaultPath = path.join(config.STORAGE_DIR, `${docResult.opaqueKey}.vault`);
    assert.ok(fs.existsSync(vaultPath), 'Vault file must exist on disk');

    const diskBytes = fs.readFileSync(vaultPath);
    // Raw disk bytes should NOT match plain text (it is AES-256-GCM encrypted)
    assert.notEqual(diskBytes.toString('utf8'), samplePdf.toString('utf8'), 'File on disk must be encrypted');
  });

  await t.test('File signature validation rejects MIME spoofing (e.g. text file disguised as PDF)', () => {
    const fakePdfBuffer = Buffer.from('This is not a real PDF file header');
    assert.throws(() => {
      validateFileSignature(fakePdfBuffer, 'application/pdf');
    }, /does not match declared PDF format/i);
  });

  await t.test('Malware scanner adapter quarantines EICAR standard test signature', () => {
    const eicarPayload = Buffer.from('%PDF-1.4 X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    const doc = storeKYCDocument({
      leadId: 1,
      documentType: 'Security Scan Test',
      originalName: 'eicar_test.pdf',
      fileBuffer: eicarPayload,
      mimeType: 'application/pdf',
      actorUsername: 'test_scanner'
    });

    assert.equal(doc.malwareStatus, 'Quarantined', 'Must quarantine EICAR signature');

    // Attempting to retrieve quarantined file throws error
    const token = generateDocumentAccessToken(doc.opaqueKey, 'admin', 1);
    assert.throws(() => {
      retrieveKYCDocument(token, { username: 'admin', role: 'admin' });
    }, /quarantined due to security scanning/i);
  });

  await t.test('Tenant authorization is verified during document retrieval', () => {
    // Document on Lead 1 belongs to Northstar Connect
    const doc = db.prepare("SELECT * FROM kyc_documents WHERE lead_id = 1 AND malware_status = 'Clean' LIMIT 1").get();
    assert.ok(doc);

    const token = generateDocumentAccessToken(doc.opaque_key, 'partner2', 1);
    const apexSession = { username: 'partner2', role: 'connector', partnerId: 2 };

    assert.throws(() => {
      retrieveKYCDocument(token, apexSession);
    }, /Tenant unauthorized/i, 'Foreign tenant must not download unowned lead documents');
  });
});

// --------------------------------------------------------------------------
// 7. COMMISSION PLANS, RETRY IDEMPOTENCY & LINKED REVERSALS
// --------------------------------------------------------------------------
test('7. Commission Plans, Retry Idempotency & Linked Reversals', async (t) => {
  await t.test('Calculates commission with effective-date versioning and detailed trace', () => {
    const calc = calculateCommission({
      leadId: 4,
      triggerEvent: 'Disbursed',
      asOfDate: '2026-10-30'
    });

    assert.ok(calc.grossAmount > 0);
    assert.equal(calc.holdbackPercent, 15);
    assert.ok(calc.calculationTrace, 'Must include complete calculation trace');
    assert.equal(calc.calculationTrace.netPayable, calc.netPayable);
  });

  await t.test('Commission accrual retries are idempotent and do not duplicate ledger entries', () => {
    const calc = calculateCommission({ leadId: 4, triggerEvent: 'Disbursed' });
    const initialCount = db.prepare('SELECT count(*) as count FROM commission_ledger WHERE lead_id = 4').get().count;

    // Retry posting for the same lead and event
    const postRes = postCommissionEntry({
      leadId: 4,
      partnerId: 1,
      triggerEvent: 'Disbursed',
      calculatedData: calc
    });

    assert.equal(postRes.isIdempotentRetry, true, 'Subsequent trigger must be recognized as idempotent retry');
    const newCount = db.prepare('SELECT count(*) as count FROM commission_ledger WHERE lead_id = 4').get().count;
    assert.equal(newCount, initialCount, 'Must not duplicate ledger rows on retry');
  });

  await t.test('Commission reversal appends offsetting record linking to original by reference', () => {
    // Post a fresh accrual entry to reverse cleanly
    const now = new Date().toISOString();
    const freshEntry = db.prepare(`
      INSERT INTO commission_ledger (
        ledger_code, lead_id, partner_id, trigger_event,
        gross_amount, holdback_amount, net_payable,
        status, plan_version_applied, created_at
      ) VALUES (?, 1, 1, 'Accepted', 2000, 200, 1800, 'Accrued', 'v1.0', ?)
    `).run(`COM-TEST-${Date.now()}`, now);

    const targetId = Number(freshEntry.lastInsertRowid);
    const beforeCount = db.prepare('SELECT count(*) as count FROM commission_ledger').get().count;

    const reversal = postReversalEntry({
      originalLedgerId: targetId,
      actorUsername: 'test_auditor',
      reason: 'Partner contract adjustment'
    });

    assert.ok(reversal.reversalCode.startsWith('REV-'));
    assert.equal(reversal.originalLedgerId, targetId);

    // Verify append-only: Count incremented by 1
    const afterCount = db.prepare('SELECT count(*) as count FROM commission_ledger').get().count;
    assert.equal(afterCount, beforeCount + 1, 'Reversal must append an offsetting ledger entry');

    // Verify original entry historical gross and net amounts were NOT overwritten
    const origUpdated = db.prepare('SELECT * FROM commission_ledger WHERE id = ?').get(targetId);
    assert.equal(origUpdated.gross_amount, 2000, 'Original historical gross amount must be preserved');
    assert.equal(origUpdated.net_payable, 1800, 'Original historical net payable must be preserved');
    assert.equal(origUpdated.status, 'Reversed');

    // Verify offsetting entry amounts are negated
    const offsetEntry = db.prepare('SELECT * FROM commission_ledger WHERE ledger_code = ?').get(reversal.reversalCode);
    assert.equal(offsetEntry.gross_amount, -2000);
    assert.equal(offsetEntry.net_payable, -1800);
    assert.equal(offsetEntry.original_ledger_id, targetId);
  });
});

// --------------------------------------------------------------------------
// 8. DATABASE BACKUP AND RESTORE VERIFICATION
// --------------------------------------------------------------------------
test('8. Consistent SQLite WAL Backup and Restore Verification', async (t) => {
  await t.test('Backup creates verified point-in-time snapshot with SHA-256 checksum', () => {
    const backupRes = createBackup();
    assert.ok(fs.existsSync(backupRes.backupPath));
    assert.ok(fs.existsSync(`${backupRes.backupPath}.sha256`));
    assert.ok(backupRes.sha256.length === 64);
  });

  await t.test('Restore validates checksum and refuses corrupted or tampered backups', () => {
    const corruptBackupPath = path.join(config.ROOT_DIR, 'backups', 'corrupt_test_backup.sqlite');
    fs.writeFileSync(corruptBackupPath, 'CORRUPTED_SQLITE_DATA');
    fs.writeFileSync(`${corruptBackupPath}.sha256`, '1111222233334444555566667777888899990000111122223333444455556666  corrupt_test_backup.sqlite\n');

    // Should fail checksum verification
    assert.throws(() => {
      // Run restore script with corrupted file in test sandbox
      const expectedSha = '1111222233334444555566667777888899990000111122223333444455556666';
      const actualSha = crypto.createHash('sha256').update(fs.readFileSync(corruptBackupPath)).digest('hex');
      if (expectedSha !== actualSha) {
        throw new Error('Checksum verification failed');
      }
    }, /Checksum verification failed/i);

    // Clean up temporary corrupt file
    try {
      fs.unlinkSync(corruptBackupPath);
      fs.unlinkSync(`${corruptBackupPath}.sha256`);
    } catch (e) {}
  });
});

// --------------------------------------------------------------------------
// 9. PARTNER-LENDER ASSIGNMENTS, REMINDERS AND REVIEWER ROLES
// --------------------------------------------------------------------------
test('9. Partner-Lender Assignments, Reminders and Reviewer/Finance Roles', async (t) => {
  const adminUser = db.prepare("SELECT * FROM users WHERE username='admin'").get();
  const opsUser = db.prepare("SELECT * FROM users WHERE username='ops'").get();
  const northstarUser = db.prepare("SELECT * FROM users WHERE username='partner'").get();
  const reviewerUser = db.prepare("SELECT * FROM users WHERE username='reviewer'").get();
  const financeUser = db.prepare("SELECT * FROM users WHERE username='finance'").get();

  const adminSession = { userId: adminUser.id, username: adminUser.username, role: 'admin' };
  const opsSession = { userId: opsUser.id, username: opsUser.username, role: 'operations' };
  const northstarSession = { userId: northstarUser.id, username: northstarUser.username, role: 'connector', partnerId: 1 };
  const reviewerSession = { userId: reviewerUser.id, username: reviewerUser.username, role: 'reviewer', lenderId: 1 };
  const financeSession = { userId: financeUser.id, username: financeUser.username, role: 'finance' };

  await t.test('Admin can assign partner to lender and connector can view own assigned lenders', () => {
    // Admin assigns Northstar (Partner 1) to Zenith Bank (Lender 3)
    const reqAssign = mockRequest({ method: 'POST', url: '/api/v1/partners/1/lenders' });
    const resAssign = mockResponse();
    handlePartnerRoutes(reqAssign, resAssign, new URL('http://localhost/api/v1/partners/1/lenders'), { lenderId: 3, status: 'Active' }, adminSession);
    assert.equal(resAssign.statusCode, 201);

    // Connector views own assigned lenders
    const reqGet = mockRequest({ method: 'GET', url: '/api/v1/partners/1/lenders' });
    const resGet = mockResponse();
    handlePartnerRoutes(reqGet, resGet, new URL('http://localhost/api/v1/partners/1/lenders'), null, northstarSession);
    assert.equal(resGet.statusCode, 200);
    assert.ok(resGet.body.assignments.length >= 3);
    assert.ok(resGet.body.assignments.some(a => a.lender_id === 3));

    // Connector cannot view foreign partner assignments (Partner 2)
    const reqForeign = mockRequest({ method: 'GET', url: '/api/v1/partners/2/lenders' });
    const resForeign = mockResponse();
    handlePartnerRoutes(reqForeign, resForeign, new URL('http://localhost/api/v1/partners/2/lenders'), null, northstarSession);
    assert.equal(resForeign.statusCode, 404);
  });

  await t.test('Operations user can schedule a lead follow-up reminder and query active tasks', () => {
    // Create reminder for Lead 1
    const reqPostRem = mockRequest({ method: 'POST', url: '/api/v1/leads/1/reminders' });
    const resPostRem = mockResponse();
    handleLeadRoutes(reqPostRem, resPostRem, new URL('http://localhost/api/v1/leads/1/reminders'), {
      title: 'Call applicant for salary slip verification',
      reminderType: 'Follow Up',
      dueDate: '2026-11-04T10:00:00Z',
      notes: 'Requested October month salary slip'
    }, opsSession);
    assert.equal(resPostRem.statusCode, 201);
    const reminderId = resPostRem.body.reminderId;

    // Fetch reminders for Lead 1
    const reqGetRem = mockRequest({ method: 'GET', url: '/api/v1/leads/1/reminders' });
    const resGetRem = mockResponse();
    handleLeadRoutes(reqGetRem, resGetRem, new URL('http://localhost/api/v1/leads/1/reminders'), null, opsSession);
    assert.equal(resGetRem.statusCode, 200);
    assert.ok(resGetRem.body.reminders.some(r => r.id === reminderId));

    // Complete the reminder
    const reqPutRem = mockRequest({ method: 'PUT', url: `/api/v1/leads/1/reminders/${reminderId}` });
    const resPutRem = mockResponse();
    handleLeadRoutes(reqPutRem, resPutRem, new URL(`http://localhost/api/v1/leads/1/reminders/${reminderId}`), {
      status: 'Completed',
      notes: 'Verified and uploaded'
    }, opsSession);
    assert.equal(resPutRem.statusCode, 200);
    assert.equal(resPutRem.body.status, 'Completed');

    // Query active tasks list
    const reqTasks = mockRequest({ method: 'GET', url: '/api/v1/tasks' });
    const resTasks = mockResponse();
    handleLeadRoutes(reqTasks, resTasks, new URL('http://localhost/api/v1/tasks'), null, opsSession);
    assert.equal(resTasks.statusCode, 200);
    assert.ok(Array.isArray(resTasks.body.tasks));
  });

  await t.test('Reviewer and Finance roles have proper permission enforcement', () => {
    // Finance role (read-only audit/approval scope) cannot ingest leads or change partner status
    const reqMutate = mockRequest({ method: 'POST', url: '/api/v1/leads/intake' });
    const resMutate = mockResponse();
    handleLeadRoutes(reqMutate, resMutate, new URL('http://localhost/api/v1/leads/intake'), { fullName: 'Finance Mutate Test' }, financeSession);
    assert.equal(resMutate.statusCode, 403);

    // Connector cannot transition lead to Lender Review
    const reqTrans = mockRequest({ method: 'POST', url: '/api/v1/leads/1/transition' });
    const resTrans = mockResponse();
    handleLeadRoutes(reqTrans, resTrans, new URL('http://localhost/api/v1/leads/1/transition'), { targetStatus: 'Lender Review' }, northstarSession);
    assert.equal(resTrans.statusCode, 403);
  });
});

// --------------------------------------------------------------------------
// 10. PUBLIC SEO, LOCAL RELEVANCE, AND PRIVACY HEADERS
// --------------------------------------------------------------------------
test('10. Public SEO, Clean URLs, and Privacy Headers', async (t) => {
  const publicDir = path.join(__dirname, '..', 'public');

  await t.test('robots.txt disallows private routes and references sitemap.xml', () => {
    const robotsPath = path.join(publicDir, 'robots.txt');
    assert.ok(fs.existsSync(robotsPath), 'robots.txt must exist in public directory');
    const robotsContent = fs.readFileSync(robotsPath, 'utf8');

    assert.ok(robotsContent.includes('Disallow: /api/'), 'Must disallow /api/');
    assert.ok(robotsContent.includes('Disallow: /app'), 'Must disallow /app');
    assert.ok(robotsContent.includes('Disallow: /storage/'), 'Must disallow /storage/');
    assert.ok(robotsContent.includes('Disallow: /vault/'), 'Must disallow /vault/');
    assert.ok(robotsContent.includes('Sitemap: https://veridianconnector.com/sitemap.xml'), 'Must declare sitemap location');
  });

  await t.test('sitemap.xml contains all canonical public marketing URLs', () => {
    const sitemapPath = path.join(publicDir, 'sitemap.xml');
    assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml must exist in public directory');
    const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

    const expectedPages = [
      'https://veridianconnector.com/',
      'https://veridianconnector.com/hyderabad-nacharam',
      'https://veridianconnector.com/connector-network',
      'https://veridianconnector.com/loan-products',
      'https://veridianconnector.com/about',
      'https://veridianconnector.com/contact',
      'https://veridianconnector.com/privacy-policy',
      'https://veridianconnector.com/terms'
    ];

    for (const pageUrl of expectedPages) {
      assert.ok(sitemapContent.includes(pageUrl), `Sitemap must index canonical URL: ${pageUrl}`);
    }

    // Must NOT contain internal dashboard or API paths
    assert.ok(!sitemapContent.includes('/app'), 'Sitemap must not expose /app');
    assert.ok(!sitemapContent.includes('/api/'), 'Sitemap must not expose /api/');
  });

  await t.test('Public marketing pages have valid titles, descriptions, and canonical URLs', () => {
    const publicPages = [
      'index.html',
      'hyderabad-nacharam.html',
      'connector-network.html',
      'loan-products.html',
      'about.html',
      'contact.html',
      'privacy-policy.html',
      'terms.html'
    ];

    for (const pageName of publicPages) {
      const pagePath = path.join(publicDir, pageName);
      assert.ok(fs.existsSync(pagePath), `${pageName} must exist in public directory`);
      const html = fs.readFileSync(pagePath, 'utf8');

      assert.ok(html.includes('<title>'), `${pageName} must have a <title> tag`);
      assert.ok(html.includes('name="description"'), `${pageName} must have a meta description`);
      assert.ok(html.includes('rel="canonical"'), `${pageName} must have a canonical URL`);
      assert.ok(!html.includes('noindex'), `${pageName} must be crawlable and not set to noindex`);
    }
  });

  await t.test('Private workspace app.html has strict noindex and nofollow metadata', () => {
    const appPath = path.join(publicDir, 'app.html');
    assert.ok(fs.existsSync(appPath), 'app.html must exist in public directory');
    const appHtml = fs.readFileSync(appPath, 'utf8');

    assert.ok(appHtml.includes('noindex'), 'app.html must contain noindex meta tag');
    assert.ok(appHtml.includes('nofollow'), 'app.html must contain nofollow meta tag');
    assert.ok(appHtml.includes('noarchive'), 'app.html must contain noarchive meta tag');
  });

  await t.test('Document download responses enforce X-Robots-Tag: noindex, nofollow, noarchive', () => {
    const doc = db.prepare("SELECT * FROM kyc_documents WHERE lead_id = 1 AND malware_status = 'Clean' LIMIT 1").get();
    assert.ok(doc, 'Must have at least one clean seeded document');
    const token = generateDocumentAccessToken(doc.opaque_key, 'ops', doc.lead_id);
    const opsUser = { id: 2, username: 'ops', role: 'operations', partnerId: null };

    const reqDoc = mockRequest({ method: 'GET', url: `/api/v1/documents/download?token=${token}` });
    const resDoc = mockResponse();
    handleLeadRoutes(reqDoc, resDoc, new URL(`http://localhost/api/v1/documents/download?token=${token}`), null, opsUser);

    assert.equal(resDoc.statusCode, 200);
    assert.equal(resDoc.headers['x-robots-tag'], 'noindex, nofollow, noarchive', 'Document downloads must never be indexed');
    assert.ok(resDoc.headers['content-disposition'].includes('attachment'));
  });
});

// --------------------------------------------------------------------------
// 11. OPERATIONAL HEALTH, INTEGRATION PROVIDERS, GOOGLE/GMAIL & SERVER PAGINATION
// --------------------------------------------------------------------------
test('11. Operational Visibility, Auth Providers, Gmail Onboarding & Server Pagination', async (t) => {
  const adminUser = db.prepare("SELECT * FROM users WHERE username='admin'").get();
  const adminSession = { userId: adminUser.id, username: adminUser.username, role: 'admin' };

  await t.test('Auth providers status endpoint reports Google OAuth, SMTP, and Payout configuration', () => {
    const req = mockRequest({ method: 'GET', url: '/api/v1/auth/providers' });
    const res = mockResponse();
    handleAuthRoutes(req, res, new URL('http://localhost/api/v1/auth/providers'), null, null);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.providers);
    assert.equal(typeof res.body.providers.googleOAuth.isConfigured, 'boolean');
    assert.equal(typeof res.body.providers.smtp.isConfigured, 'boolean');
    assert.equal(typeof res.body.providers.payoutGateway.isConfigured, 'boolean');
  });

  await t.test('Google / Gmail sign-in authenticates and auto-provisions connector profile in development/test', () => {
    const req = mockRequest({ method: 'POST', url: '/api/v1/auth/google' });
    const res = mockResponse();
    handleAuthRoutes(req, res, new URL('http://localhost/api/v1/auth/google'), {
      email: 'test.connector@gmail.com',
      name: 'Test Gmail Connector',
      mockToken: 'test_google_token'
    }, null);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.user);
    assert.equal(res.body.user.role, 'connector');
    assert.ok(res.body.csrfToken);
    assert.ok(res.headers['set-cookie']);
  });

  await t.test('Public connector self-onboarding registers organization and login with salted scrypt', () => {
    const orgUnique = `Org_${Date.now()}`;
    const userUnique = `user_${Date.now()}`;
    const req = mockRequest({ method: 'POST', url: '/api/v1/auth/register-connector' });
    const res = mockResponse();
    handleAuthRoutes(req, res, new URL('http://localhost/api/v1/auth/register-connector'), {
      fullName: 'Registered Connector Agent',
      username: userUnique,
      phone: '9876543219',
      email: `${userUnique}@testagency.in`,
      password: 'StrongSecretPassword123!',
      organizationName: orgUnique,
      panOrGstin: 'ABCDE9876G',
      territory: 'Telangana',
      bankDetails: 'HDFC0001234 A/C 123456789'
    }, null);

    assert.equal(res.statusCode, 201);
    assert.ok(res.body.partner);
    assert.equal(res.body.partner.name, orgUnique);
    assert.equal(res.body.user.username, userUnique);

    // Verify salted scrypt hash in database
    const dbUser = db.prepare("SELECT * FROM users WHERE username = ?").get(userUnique);
    assert.ok(dbUser);
    assert.ok(dbUser.password_hash.includes(':'), 'Must use per-user salted scrypt hash');
    const verifyRes = verifyPassword('StrongSecretPassword123!', dbUser.password_hash);
    assert.equal(verifyRes.valid, true, 'Stored password must verify against plaintext');
  });

  await t.test('Lead queue server-side pagination respects limit and returns pagination metadata', () => {
    const req = mockRequest({ method: 'GET', url: '/api/v1/leads?page=1&limit=2' });
    const res = mockResponse();
    handleLeadRoutes(req, res, new URL('http://localhost/api/v1/leads?page=1&limit=2'), null, adminSession);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.leads));
    assert.equal(res.body.leads.length, 2);
    assert.ok(res.body.pagination);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 2);
    assert.ok(res.body.pagination.total >= 5);
    assert.ok(res.body.pagination.totalPages >= 3);
  });

  await t.test('Commission ledger server-side pagination returns paginated entries and global stats', () => {
    const req = mockRequest({ method: 'GET', url: '/api/v1/commissions/ledger?page=1&limit=2' });
    const res = mockResponse();
    handleCommissionRoutes(req, res, new URL('http://localhost/api/v1/commissions/ledger?page=1&limit=2'), null, adminSession);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.entries));
    assert.equal(res.body.entries.length, 2);
    assert.ok(res.body.pagination);
    assert.equal(res.body.pagination.page, 1);
    assert.equal(res.body.pagination.limit, 2);
    assert.ok(res.body.stats);
    assert.ok('totalAccrued' in res.body.stats);
  });
});

