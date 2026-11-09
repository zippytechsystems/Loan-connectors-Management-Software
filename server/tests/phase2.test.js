import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.USE_TEST_DB = 'true';

import app from '../src/app.js';
import { resetTestDb } from '../src/db/testAdapter.js';
import { initializeDatabase } from '../src/db/init.js';
import { signToken } from '../src/utils/security.js';

let server;
let baseUrl;
let authCookie;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, async () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      await initializeDatabase();
      resolve();
    });
  });
});

after(() => {
  if (server) server.close();
});

beforeEach(async () => {
  resetTestDb();
  await initializeDatabase();
  const token = signToken({ id: 1, username: 'M.Lingaswamy@123', role: 'admin' });
  authCookie = `zippy_auth_token=${token}`;
});

describe('Zippy Loan Connector — Phase 2: Customers & Lead Management', () => {
  test('1. Unauthenticated requests to customer & lead endpoints are blocked with HTTP 401', async () => {
    const custRes = await fetch(`${baseUrl}/api/customers`);
    assert.equal(custRes.status, 401);

    const leadRes = await fetch(`${baseUrl}/api/leads`);
    assert.equal(leadRes.status, 401);

    const dashRes = await fetch(`${baseUrl}/api/dashboard/summary`);
    assert.equal(dashRes.status, 401);
  });

  test('2. Register new customer with valid data and auto-generated ZLC-CUS code', async () => {
    const payload = {
      full_name: 'Rajesh Sharma',
      mobile_number: '9876543210',
      email: 'rajesh.sharma@example.com',
      city: 'Hyderabad',
      state: 'Telangana',
      employment_type: 'Salaried',
      monthly_income: 75000,
    };

    const res = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.customer.full_name, 'Rajesh Sharma');
    assert.match(body.customer.customer_code, /^ZLC-CUS-\d{6}$/);
    assert.equal(body.customer.mobile_number, '9876543210');
  });

  test('3. Detects duplicate customers by mobile number', async () => {
    // 1. Create first customer
    await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'First User',
        mobile_number: '9123456789',
        city: 'Hyderabad',
      }),
    });

    // 2. Query check-duplicate endpoint
    const checkRes = await fetch(`${baseUrl}/api/customers/check-duplicate?mobile_number=9123456789`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(checkRes.status, 200);
    const checkBody = await checkRes.json();
    assert.equal(checkBody.exists, true);
    assert.equal(checkBody.customer.mobile_number, '9123456789');

    // 3. Attempting to create another customer with the same mobile is rejected with 409
    const dupRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'Duplicate User',
        mobile_number: '9123456789',
        city: 'Secunderabad',
      }),
    });
    assert.equal(dupRes.status, 409);
    const dupBody = await dupRes.json();
    assert.equal(dupBody.isDuplicate, true);
  });

  test('4. Retrieve customer details and edit customer information', async () => {
    // 1. Create customer
    const createRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'Kiran Kumar',
        mobile_number: '9848022338',
        city: 'Warangal',
        employment_type: 'Self-Employed',
      }),
    });
    const created = await createRes.json();
    const custId = created.customer.id;

    // 2. Update customer
    const updateRes = await fetch(`${baseUrl}/api/customers/${custId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'Kiran Kumar M',
        city: 'Hanamkonda',
        monthly_income: 120000,
      }),
    });
    assert.equal(updateRes.status, 200);
    const updatedBody = await updateRes.json();
    assert.equal(updatedBody.customer.full_name, 'Kiran Kumar M');
    assert.equal(updatedBody.customer.city, 'Hanamkonda');

    // 3. Get customer by ID
    const getRes = await fetch(`${baseUrl}/api/customers/${custId}`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.customer.full_name, 'Kiran Kumar M');
  });

  test('5. Create loan lead for existing customer with valid loan type', async () => {
    // 1. Create customer
    const custRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'Venkat Rao',
        mobile_number: '9988776655',
        city: 'Vijayawada',
      }),
    });
    const { customer } = await custRes.json();

    // 2. Create Home Loan lead
    const leadRes = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        customer_id: customer.id,
        loan_type: 'Home Loan',
        required_amount: 3500000,
        enquiry_date: '2026-11-09',
        priority: 'High',
        lead_status: 'New',
        lead_source: 'Direct Enquiry',
      }),
    });

    assert.equal(leadRes.status, 201);
    const leadBody = await leadRes.json();
    assert.equal(leadBody.success, true);
    assert.match(leadBody.lead.lead_code, /^ZLC-LEAD-\d{6}$/);
    assert.equal(leadBody.lead.loan_type, 'Home Loan');
    assert.equal(leadBody.lead.customer_name, 'Venkat Rao');
  });

  test('6. STRICT REQUIREMENT: Agriculture Loan is disallowed and rejected on lead creation', async () => {
    // 1. Create customer
    const custRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'Suresh Reddy',
        mobile_number: '9876500001',
        city: 'Khammam',
      }),
    });
    const { customer } = await custRes.json();

    // 2. Attempt to create Agriculture Loan lead
    const badRes = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        customer_id: customer.id,
        loan_type: 'Agriculture Loan',
        required_amount: 500000,
        enquiry_date: '2026-11-09',
      }),
    });

    assert.equal(badRes.status, 400);
    const errBody = await badRes.json();
    assert.equal(errBody.success, false);
    assert.match(JSON.stringify(errBody), /Agriculture Loan/i);
  });

  test('7. Update lead status and record in status audit history', async () => {
    // 1. Create customer and lead
    const custRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'Anitha Devi',
        mobile_number: '9440112233',
        city: 'Nalgonda',
      }),
    });
    const { customer } = await custRes.json();

    const leadRes = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        customer_id: customer.id,
        loan_type: 'Business Loan',
        required_amount: 1500000,
        priority: 'High',
      }),
    });
    const { lead } = await leadRes.json();

    // 2. Update status to 'Contacted'
    const patchRes = await fetch(`${baseUrl}/api/leads/${lead.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        new_status: 'Contacted',
        change_notes: 'Spoke with customer, requested ITR filings',
      }),
    });
    assert.equal(patchRes.status, 200);

    // 3. Check status history
    const histRes = await fetch(`${baseUrl}/api/leads/${lead.id}/history`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(histRes.status, 200);
    const histBody = await histRes.json();
    assert.equal(histBody.success, true);
    assert.ok(histBody.history.length >= 2); // Initial 'New' + updated 'Contacted'
    assert.equal(histBody.history[0].new_status, 'Contacted');
    assert.equal(histBody.history[0].previous_status, 'New');
  });

  test('8. Safe customer archival preserves records when linked leads exist', async () => {
    // 1. Create customer with lead
    const custRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        full_name: 'Praveen V',
        mobile_number: '9849055443',
        city: 'Karimnagar',
      }),
    });
    const { customer } = await custRes.json();

    await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        customer_id: customer.id,
        loan_type: 'Vehicle Loan',
        required_amount: 800000,
      }),
    });

    // 2. Delete customer
    const delRes = await fetch(`${baseUrl}/api/customers/${customer.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.hasLinkedLeads, true);
    assert.match(delBody.message, /safely archived/i);
  });

  test('9. Dashboard live metrics computed from real database records', async () => {
    // 1. Fetch dashboard summary
    const dashRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(dashRes.status, 200);
    const dashBody = await dashRes.json();
    assert.equal(dashBody.success, true);
    assert.ok(typeof dashBody.data.total_customers === 'number');
    assert.ok(typeof dashBody.data.total_leads === 'number');

    // 2. Recent customers and recent leads
    const recCustRes = await fetch(`${baseUrl}/api/dashboard/recent-customers`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(recCustRes.status, 200);

    const recLeadRes = await fetch(`${baseUrl}/api/dashboard/recent-leads`, {
      headers: { Cookie: authCookie },
    });
    assert.equal(recLeadRes.status, 200);
  });
});
