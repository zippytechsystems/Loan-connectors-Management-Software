const http = require('http');

const BASE_URL = 'http://127.0.0.1:4180';
let authToken = '';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=======================================================');
  console.log('   Testing All Zippy Backend APIs & SQLite Database    ');
  console.log('=======================================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // 1. Health check
  await test('GET /health', async () => {
    const res = await request('GET', '/health');
    if (res.status !== 200 || res.data.status !== 'healthy') throw new Error(`Status ${res.status}`);
  });

  // 2. Auth Login
  await test('POST /api/v1/auth/login', async () => {
    const res = await request('POST', '/api/v1/auth/login', { username: 'admin', password: 'ConnectorDemo!26' });
    if (res.status !== 200 || !res.data.token) throw new Error(`Login failed with status ${res.status}`);
    authToken = res.data.token;
  });

  // 3. Partner Profile Save & Retrieve
  await test('POST & GET /api/v1/partners/profile', async () => {
    const saveRes = await request('POST', '/api/v1/partners/profile', {
      bank_account: '987654321098',
      ifsc: 'HDFC0001234',
      upi_id: 'zippypartner@hdfcbank',
      agency_name: 'Zippy Prime Network',
      mobile: '9876543210'
    }, authToken);
    if (saveRes.status !== 200) throw new Error(`Profile save status ${saveRes.status}`);

    const getRes = await request('GET', '/api/v1/partners/profile', null, authToken);
    if (getRes.status !== 200 || !getRes.data.profile) throw new Error(`Profile get status ${getRes.status}`);
  });

  // 4. Tasks & Follow-up Reminders
  await test('POST & GET /api/v1/tasks', async () => {
    const createRes = await request('POST', '/api/v1/tasks', {
      lead_id: 1,
      title: 'Collect Form 16 and bank statement for Lead #1',
      due_date: '2026-11-05',
      priority: 'High'
    }, authToken);
    if (![200, 201].includes(createRes.status)) throw new Error(`Task create status ${createRes.status}`);

    const getRes = await request('GET', '/api/v1/tasks', null, authToken);
    if (getRes.status !== 200 || !Array.isArray(getRes.data.tasks) || getRes.data.tasks.length === 0) {
      throw new Error(`Tasks retrieve failed`);
    }
  });

  // 5. Document Vault Upload
  await test('POST /api/v1/vault/upload', async () => {
    const res = await request('POST', '/api/v1/vault/upload', {
      lead_id: 1,
      doc_type: 'PAN Card',
      file_name: 'pan_card_aarav.pdf',
      classification: 'Confidential'
    }, authToken);
    if (res.status !== 200 || !res.data.doc_id) throw new Error(`Vault upload failed: ${res.status}`);
  });

  // 6. Manual Commission Accrual
  await test('POST /api/v1/commissions/accrue', async () => {
    const res = await request('POST', '/api/v1/commissions/accrue', {
      lead_id: 1,
      partner_id: 1,
      payout_amount: 12500,
      tds_rate: 5,
      notes: 'Commission for Aarav Mehta loan disbursement'
    }, authToken);
    if (res.status !== 200 || !res.data.ledger_id) throw new Error(`Commission accrue status ${res.status}`);
  });

  // 7. Commission Payout Settlement
  await test('POST /api/v1/commissions/payout', async () => {
    const res = await request('POST', '/api/v1/commissions/payout', {
      partner_id: 1,
      amount: 11875,
      mode: 'NEFT',
      utr: 'UTR2026110298765'
    }, authToken);
    if (res.status !== 200 || !res.data.utr) throw new Error(`Payout status ${res.status}`);
  });

  // 8. Lead Review & Underwriter Decision
  await test('POST /api/v1/leads/:id/review', async () => {
    const res = await request('POST', '/api/v1/leads/1/review', {
      decision: 'Approved',
      notes: 'KYC verified and CIBIL score 785 meets prime threshold.'
    }, authToken);
    if (res.status !== 200) throw new Error(`Lead review status ${res.status}`);
  });

  // 9. Multi-Lender Matching
  await test('POST /api/v1/leads/match', async () => {
    const res = await request('POST', '/api/v1/leads/match', {
      amount: 1500000,
      cibil: 760,
      product_type: 'Personal Loan',
      employment_type: 'Salaried'
    }, authToken);
    if (res.status !== 200 || !Array.isArray(res.data.recommendations)) throw new Error(`Lender match failed`);
  });

  // 10. AI Underwriting Simulation
  await test('POST /api/v1/leads/underwrite', async () => {
    const res = await request('POST', '/api/v1/leads/underwrite', {
      cibil: 750,
      monthly_income: 85000,
      existing_emi: 15000,
      requested_amount: 500000,
      tenure_months: 36
    }, authToken);
    if (res.status !== 200 || !res.data.approval_probability) throw new Error(`AI Underwrite failed`);
  });

  // 11. Feedback
  await test('POST /api/v1/feedback', async () => {
    const res = await request('POST', '/api/v1/feedback', {
      lead_id: 1,
      rating: 5,
      comment: 'Excellent portal and fast processing!'
    }, authToken);
    if (res.status !== 200) throw new Error(`Feedback submit status ${res.status}`);
  });

  // 12. Compliance FAQ Ask
  await test('POST /api/v1/compliance/ask', async () => {
    const res = await request('POST', '/api/v1/compliance/ask', {
      query: 'What is the RBI mandate for digital lending connector consent?'
    }, authToken);
    if (res.status !== 200 || !res.data.answer) throw new Error(`Compliance ask status ${res.status}`);
  });

  // 13. Products List
  await test('GET /api/v1/products', async () => {
    const res = await request('GET', '/api/v1/products', null, authToken);
    if (res.status !== 200 || !Array.isArray(res.data.products)) throw new Error(`Products failed`);
  });

  // 14. Circulars List
  await test('GET /api/v1/circulars', async () => {
    const res = await request('GET', '/api/v1/circulars', null, authToken);
    if (res.status !== 200 || !Array.isArray(res.data.circulars)) throw new Error(`Circulars failed`);
  });

  // 15. Leads List
  await test('GET /api/v1/leads', async () => {
    const res = await request('GET', '/api/v1/leads', null, authToken);
    if (res.status !== 200 || !Array.isArray(res.data.leads)) throw new Error(`Leads failed`);
  });

  // 16. Create New Lead
  await test('POST /api/v1/leads', async () => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const res = await request('POST', '/api/v1/leads', {
      customer: {
        first_name: 'Suresh',
        last_name: 'Kumar',
        phone: `9848${randomSuffix}`,
        email: `suresh.${randomSuffix}@example.com`,
        pan_masked: `ABCDE${randomSuffix.toString().slice(0, 4)}F`,
        cibil_score: 770,
        monthly_income: 95000,
        city: 'Hyderabad',
        employment_type: 'Salaried'
      },
      lead: {
        product_code: 'PL-UNSEC-01',
        loan_purpose: 'Home Renovation',
        requested_amount: 800000,
        tenure_months: 48,
        consent_channel: 'Digital OTP',
        consent_artifact: `OTP_VERIFIED_9848${randomSuffix}`
      }
    }, authToken);
    if (![200, 201].includes(res.status) || (!res.data.lead_reference && !res.data.leadReference)) {
      throw new Error(`Lead create failed: status ${res.status}`);
    }
  });

  console.log('=======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('=======================================================');

  if (failed > 0) process.exit(1);
}

run();
