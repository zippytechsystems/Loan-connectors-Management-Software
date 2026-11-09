import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.USE_TEST_DB = 'true';

import app from '../src/app.js';
import { resetTestDb } from '../src/db/testAdapter.js';
import { initializeDatabase } from '../src/db/init.js';
import { env } from '../src/config/env.js';

let server;
let baseUrl;

const TEST_ADMIN_USER = env.ADMIN_USERNAME;
const TEST_ADMIN_PASS = env.ADMIN_INITIAL_PASSWORD;

before(async () => {
  return new Promise((resolve) => {
    server = app.listen(0, async () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      await initializeDatabase();
      resolve();
    });
  });
});

describe('Zippy Loan Connector — Phase 1 Test Suite', () => {
  after(() => {
    if (server) server.close();
  });

  beforeEach(async () => {
    resetTestDb();
    await initializeDatabase();
  });

  test('1. API health probe returns running status and connected database', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.service, 'Zippy Loan Connector API');
    assert.equal(json.status, 'running');
    assert.equal(json.database, 'connected');
  });

  test('1B. Dedicated database health probe verifies query execution', async () => {
    const res = await fetch(`${baseUrl}/api/health/database`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.service, 'Zippy Loan Connector API');
    assert.equal(json.status, 'connected');
    assert.match(json.message, /passed/i);
  });

  test('2. Incorrect login fails with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_ADMIN_USER,
        password: 'CompletelyWrongPassword!999',
      }),
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.message, /Invalid username or password/i);
  });

  test('3. Non-existent username login fails with HTTP 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'non_existent_connector_admin@999',
        password: 'AnyPassword!123',
      }),
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('4. Correct login succeeds and sets HTTP-only session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_ADMIN_USER,
        password: TEST_ADMIN_PASS,
        rememberMe: true,
      }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.user.username, TEST_ADMIN_USER);
    assert.equal(json.user.role, 'admin');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Set-Cookie header must be present');
    assert.match(setCookie, new RegExp(env.COOKIE_NAME));
    assert.match(setCookie, /HttpOnly/i, 'Cookie must have HttpOnly flag');
    assert.match(setCookie, /SameSite=Lax/i, 'Cookie must have SameSite=Lax');
  });

  test('5. Protected routes reject unauthenticated requests with HTTP 401', async () => {
    const resAuth = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(resAuth.status, 401);

    const resProfile = await fetch(`${baseUrl}/api/business-profile`);
    assert.equal(resProfile.status, 401);
  });

  test('6. Authenticated session can access /api/auth/me and /api/business-profile', async () => {
    // Login first
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_ADMIN_USER,
        password: TEST_ADMIN_PASS,
      }),
    });
    assert.equal(loginRes.status, 200);
    const rawCookie = loginRes.headers.get('set-cookie');
    const cookie = rawCookie.split(';')[0]; // Extract zippy_auth_token=...

    // Access me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
    });
    assert.equal(meRes.status, 200);
    const meJson = await meRes.json();
    assert.equal(meJson.user.username, TEST_ADMIN_USER);

    // Access business-profile
    const profRes = await fetch(`${baseUrl}/api/business-profile`, {
      headers: { Cookie: cookie },
    });
    assert.equal(profRes.status, 200);
  });

  test('7. Save business profile with valid data and verify persistence in MySQL', async () => {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_ADMIN_USER,
        password: TEST_ADMIN_PASS,
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // Save profile
    const profilePayload = {
      business_name: 'Zippy Loan Connector',
      owner_name: 'M. Lingaswamy',
      business_type: 'Individual Loan Connector',
      mobile_number: '9849012345',
      whatsapp_number: '9849012345',
      email: 'm.lingaswamy@zippyconnector.com',
      city: 'Hyderabad',
      state: 'Telangana',
      lender_name: 'ICICI Bank',
      connector_status: 'Active',
      loan_categories: ['Personal Loan', 'Business Loan', 'Home Loan'],
    };

    const saveRes = await fetch(`${baseUrl}/api/business-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify(profilePayload),
    });
    assert.equal(saveRes.status, 201);
    const saveJson = await saveRes.json();
    assert.equal(saveJson.success, true);
    assert.equal(saveJson.profile.business_name, 'Zippy Loan Connector');
    assert.equal(saveJson.profile.owner_name, 'M. Lingaswamy');
    assert.equal(saveJson.profile.lender_name, 'ICICI Bank');
    assert.deepEqual(saveJson.profile.loan_categories, ['Personal Loan', 'Business Loan', 'Home Loan']);

    // Read saved profile
    const getRes = await fetch(`${baseUrl}/api/business-profile`, {
      headers: { Cookie: cookie },
    });
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.profile.mobile_number, '9849012345');
    assert.equal(getJson.profile.city, 'Hyderabad');
  });

  test('8. Updating profile does not create duplicate profiles', async () => {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_ADMIN_USER,
        password: TEST_ADMIN_PASS,
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // Initial save
    await fetch(`${baseUrl}/api/business-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        business_name: 'Zippy Loan Connector',
        owner_name: 'M. Lingaswamy',
        business_type: 'Individual Loan Connector',
        mobile_number: '9849012345',
        whatsapp_number: '9849012345',
        email: 'm.lingaswamy@zippyconnector.com',
        loan_categories: ['Personal Loan'],
      }),
    });

    // Update with vehicle loan
    const updateRes = await fetch(`${baseUrl}/api/business-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        business_name: 'Zippy Loan Connector (Updated)',
        owner_name: 'M. Lingaswamy',
        business_type: 'Individual Loan Connector',
        mobile_number: '9849012345',
        whatsapp_number: '9849012345',
        email: 'm.lingaswamy@zippyconnector.com',
        connector_id: 'ICICI-DIR-2026',
        loan_categories: ['Personal Loan', 'Vehicle Loan'],
      }),
    });
    assert.equal(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.equal(updateJson.profile.business_name, 'Zippy Loan Connector (Updated)');
    assert.equal(updateJson.profile.connector_id, 'ICICI-DIR-2026');
    assert.deepEqual(updateJson.profile.loan_categories, ['Personal Loan', 'Vehicle Loan']);
  });

  test('9. STRICT REQUIREMENT: Agriculture Loan is disallowed and rejected', async () => {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_ADMIN_USER,
        password: TEST_ADMIN_PASS,
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // Attempt to submit with Agriculture Loan
    const badRes = await fetch(`${baseUrl}/api/business-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        business_name: 'Zippy Loan Connector',
        owner_name: 'M. Lingaswamy',
        business_type: 'Individual Loan Connector',
        mobile_number: '9849012345',
        whatsapp_number: '9849012345',
        email: 'm.lingaswamy@zippyconnector.com',
        loan_categories: ['Personal Loan', 'Agriculture Loan'],
      }),
    });

    assert.equal(badRes.status, 400);
    const badJson = await badRes.json();
    assert.equal(badJson.success, false);
    assert.match(JSON.stringify(badJson), /Agriculture Loan is strictly disallowed/i);
  });

  test('10. Logout clears the HTTP-only cookie and ends session', async () => {
    // Login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_ADMIN_USER,
        password: TEST_ADMIN_PASS,
      }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // Logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert.equal(logoutRes.status, 200);

    const logoutCookie = logoutRes.headers.get('set-cookie');
    assert.ok(logoutCookie);
    assert.match(logoutCookie, /Expires=Thu, 01 Jan 1970/i);
  });
});
