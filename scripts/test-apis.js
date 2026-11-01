const http = require('node:http');

function testEndpoint(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: 4180,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function auditApis() {
  console.log('Testing Endpoints against local server...');
  
  // 1. Health
  const h = await testEndpoint('/health');
  console.log('GET /health:', h.status, h.body);

  // 2. Login as demo admin to get cookie/token
  const login = await testEndpoint('/api/v1/auth/login', 'POST', { username: 'admin', password: 'ConnectorDemo!26' });
  console.log('POST /api/v1/auth/login:', login.status, login.body?.user ? 'Authenticated: ' + login.body.user.username : login.body);
  const cookie = login.headers['set-cookie'] ? login.headers['set-cookie'][0].split(';')[0] : '';
  const csrfToken = login.body?.csrfToken;
  const authHeaders = { 'Cookie': cookie, 'X-CSRF-Token': csrfToken };

  // 3. Leads endpoint
  const leads = await testEndpoint('/api/v1/leads', 'GET', null, authHeaders);
  console.log('GET /api/v1/leads:', leads.status, Array.isArray(leads.body?.leads) ? `Returned ${leads.body.leads.length} leads` : leads.body);

  // 4. Partners endpoint
  const partners = await testEndpoint('/api/v1/partners', 'GET', null, authHeaders);
  console.log('GET /api/v1/partners:', partners.status, Array.isArray(partners.body?.partners) ? `Returned ${partners.body.partners.length} partners` : partners.body);

  // 5. Products Catalog
  const products = await testEndpoint('/api/v1/catalog/products', 'GET', null, authHeaders);
  console.log('GET /api/v1/catalog/products:', products.status, Array.isArray(products.body?.products) ? `Returned ${products.body.products.length} products` : products.body);

  // 6. Commission Ledger
  const comms = await testEndpoint('/api/v1/commissions/ledger', 'GET', null, authHeaders);
  console.log('GET /api/v1/commissions/ledger:', comms.status, Array.isArray(comms.body?.entries) ? `Returned ${comms.body.entries.length} entries, stats: ₹${comms.body.stats?.totalAccrued}` : comms.body);

  // 7. Tasks & Reminders
  const reminders = await testEndpoint('/api/v1/tasks', 'GET', null, authHeaders);
  console.log('GET /api/v1/tasks:', reminders.status, Array.isArray(reminders.body?.tasks) ? `Returned ${reminders.body.tasks.length} tasks` : reminders.body);

  console.log('\nAudit complete!');
}

auditApis().catch(console.error);
