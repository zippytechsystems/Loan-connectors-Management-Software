const fs = require('fs');
const html = fs.readFileSync('public/app.html', 'utf8');

const checks = [
  { name: 'Get Started button with openZippyLoginPage', test: html.includes('id="btn-get-started"') && html.includes('openZippyLoginPage') },
  { name: 'Strict Sign In Panel', test: html.includes('id="panel-zippy-signin"') && html.includes('class="zippy-auth-panel active"') },
  { name: 'Quick Fill M. Lingaswamy Button', test: html.includes('id="btn-quick-fill-lingaswamy"') },
  { name: 'Strict Authentication Banner', test: html.includes('STRICT AUTHENTICATION REQUIRED') },
  { name: 'Username Input with M.Lingaswamy@123', test: html.includes('id="zippy-login-username"') && html.includes('value="M.Lingaswamy@123"') },
  { name: 'Password Input with zippy@pass0001', test: html.includes('id="zippy-login-password"') && html.includes('value="zippy@pass0001"') },
  { name: 'Sign In Submit Button', test: html.includes('id="btn-submit-zippy-signin"') },
  { name: 'Back to Home Button', test: html.includes('id="btn-signin-back-welcome"') },
  { name: 'Active User Banner in Dashboard', test: html.includes('id="zippy-active-user-banner"') && html.includes('M. Lingaswamy') },
  { name: 'Dashboard Logout Button', test: html.includes('id="zippy-dash-logout-btn"') }
];

console.log('--- HTML ELEMENT VERIFICATION ---');
let allPass = true;
for (const c of checks) {
  console.log((c.test ? '✅ PASS: ' : '❌ FAIL: ') + c.name);
  if (!c.test) allPass = false;
}

if (!allPass) process.exit(1);
console.log('All 10 structural elements successfully verified in public/app.html!');
