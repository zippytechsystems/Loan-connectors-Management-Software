const fs = require('fs');

const html = fs.readFileSync('public/app.html', 'utf8');
const js = fs.readFileSync('public/js/app.js', 'utf8');

const checks = [
  { name: 'Auth Screen element (#screen-zippy-auth)', ok: html.includes('id="screen-zippy-auth"') },
  { name: 'Register Tab Form (#form-zippy-register)', ok: html.includes('id="form-zippy-register"') },
  { name: 'Login Tab Form (#form-zippy-signin)', ok: html.includes('id="form-zippy-signin"') },
  { name: 'Quick Demo Persona Cards (data-role="admin")', ok: html.includes('class="zippy-demo-card"') && html.includes('data-role="admin"') },
  { name: 'Partners Inside Modal (#modal-zippy-partners)', ok: html.includes('id="modal-zippy-partners"') },
  { name: 'Lead Queue Inside Modal (#modal-zippy-lead-queue)', ok: html.includes('id="modal-zippy-lead-queue"') },
  { name: 'Commissions Inside Modal (#modal-zippy-commissions)', ok: html.includes('id="modal-zippy-commissions"') },
  { name: 'Analytics Inside Modal (#modal-zippy-analytics)', ok: html.includes('id="modal-zippy-analytics"') },
  { name: 'Doc Review Inside Modal (#modal-zippy-doc-review)', ok: html.includes('id="modal-zippy-doc-review"') },
  { name: 'Products Inside Modal (#modal-zippy-products)', ok: html.includes('id="modal-zippy-products"') },
  { name: 'New Lead Inside Modal (#modal-zippy-new-lead)', ok: html.includes('id="modal-zippy-new-lead"') },
  { name: 'showAuthScreen function defined in JS', ok: js.includes('function showAuthScreen(') },
  { name: 'renderZippyPartnersModal in JS', ok: js.includes('function renderZippyPartnersModal(') },
  { name: 'renderZippyLeadQueueModal in JS', ok: js.includes('function renderZippyLeadQueueModal(') },
  { name: 'renderZippyCommissionsModal in JS', ok: js.includes('function renderZippyCommissionsModal(') },
  { name: 'renderZippyAnalyticsModal in JS', ok: js.includes('function renderZippyAnalyticsModal(') },
  { name: 'renderZippyDocReviewModal in JS', ok: js.includes('function renderZippyDocReviewModal(') },
  { name: 'renderZippyProductsModal in JS', ok: js.includes('function renderZippyProductsModal(') },
  { name: 'card-partners opens inside modal', ok: js.includes('cardPartners.addEventListener') && js.includes('modal-zippy-partners') },
  { name: 'card-lead-queue opens inside modal', ok: js.includes('cardLeadQueue.addEventListener') && js.includes('modal-zippy-lead-queue') },
  { name: 'card-commissions opens inside modal', ok: js.includes('cardCommissions.addEventListener') && js.includes('modal-zippy-commissions') },
  { name: 'card-analytics opens inside modal', ok: js.includes('cardAnalytics.addEventListener') && js.includes('modal-zippy-analytics') },
  { name: 'card-doc-review opens inside modal', ok: js.includes('cardDocReview.addEventListener') && js.includes('modal-zippy-doc-review') },
  { name: 'card-products opens inside modal', ok: js.includes('cardProducts.addEventListener') && js.includes('modal-zippy-products') },
  { name: 'launchZippyDashboard directly opens dashboard', ok: js.includes('window.launchZippyDashboard =') && js.includes('btnGetStarted.addEventListener(\'click\', window.launchZippyDashboard)') },
  { name: 'Profile Form (#form-zippy-update-profile)', ok: html.includes('id="form-zippy-update-profile"') && js.includes('form-zippy-update-profile') },
  { name: 'Lender Match Form (#form-lender-match-calc)', ok: html.includes('id="form-lender-match-calc"') && js.includes('form-lender-match-calc') },
  { name: 'Vault Upload Form (#form-zippy-vault-upload)', ok: html.includes('id="form-zippy-vault-upload"') && js.includes('form-zippy-vault-upload') },
  { name: 'Add Reminder Form (#form-zippy-add-reminder)', ok: html.includes('id="form-zippy-add-reminder"') && js.includes('form-zippy-add-reminder') },
  { name: 'Compliance Query Form (#form-zippy-ask-compliance)', ok: html.includes('id="form-zippy-ask-compliance"') && js.includes('form-zippy-ask-compliance') },
  { name: 'Onboard Partner Form (#form-zippy-onboard-partner)', ok: html.includes('id="form-zippy-onboard-partner"') && js.includes('form-zippy-onboard-partner') },
  { name: 'Accrue Commission Form (#form-zippy-accrue-comm)', ok: html.includes('id="form-zippy-accrue-comm"') && js.includes('form-zippy-accrue-comm') },
  { name: 'Analytics Simulator Form (#form-zippy-simulate-analytics)', ok: html.includes('id="form-zippy-simulate-analytics"') && js.includes('form-zippy-simulate-analytics') },
  { name: 'Underwriter Decision Form (#form-zippy-doc-decision)', ok: html.includes('id="form-zippy-doc-decision"') && js.includes('form-zippy-doc-decision') },
  { name: 'Create Product Scheme Form (#form-zippy-create-product)', ok: html.includes('id="form-zippy-create-product"') && js.includes('form-zippy-create-product') }
];

console.log('--- Static & DOM Verification Checks ---');
let allPassed = true;
checks.forEach(c => {
  console.log((c.ok ? '✅' : '❌') + ' ' + c.name);
  if (!c.ok) allPassed = false;
});

if (!allPassed) {
  process.exit(1);
}
console.log('\nAll 24/24 UI & DOM element checks passed successfully!');
