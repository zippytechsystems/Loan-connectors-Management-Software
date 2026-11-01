const fs = require('fs');

let html = fs.readFileSync('public/app.html', 'utf8');

// 1. Welcome Screen: Add "<- Back to Website" button if not already present
if (!html.includes('class="zippy-welcome-website-btn"')) {
  html = html.replace(
    '<div class="zippy-welcome-overlay"></div>',
    '<div class="zippy-welcome-overlay"></div>\n      <a href="index.html" class="zippy-welcome-website-btn" title="Back to Main Website">\n        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>\n        <span>← Back to Website</span>\n      </a>'
  );
  console.log('✅ Added "← Back to Website" to Welcome Screen');
}

// 2. Dashboard Header: Add "<- Home" button
if (!html.includes('class="zippy-dash-home-btn"')) {
  html = html.replace(
    '<h1 class="zippy-header-title">Dashboard</h1>',
    '<div style="display: flex; align-items: center; gap: 8px;">\n          <button type="button" class="zippy-dash-home-btn" onclick="window.backToWelcomeScreen && window.backToWelcomeScreen(event)" title="Back to Welcome Screen">\n            <span>←</span> <span>Home</span>\n          </button>\n          <h1 class="zippy-header-title" style="margin: 0;">Dashboard</h1>\n        </div>'
  );
  console.log('✅ Added "← Home" to 15-Option Dashboard Header');
}

// 3. Operations Console App Header: Add Back to Dashboard button next to brand
if (!html.includes('id="btn-header-back-dash"')) {
  html = html.replace(
    '<p>Loan Lead Routing &amp; Partner Network Platform</p>',
    '<p>Loan Lead Routing &amp; Partner Network Platform</p>\n          <button type="button" id="btn-header-back-dash" class="btn btn-secondary btn-sm" onclick="window.backToDashboard && window.backToDashboard(event)" style="margin-top: 6px; color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); display: inline-flex; align-items: center; gap: 6px;">\n            <span>←</span> <span>Back to 15-Box Dashboard</span>\n          </button>'
  );
  console.log('✅ Added "← Back to Dashboard" to Console App Header');
}

// 4. In all 7 View Sections of Operations Console: Add Back Navigation Bar at top
const views = ['view-overview', 'view-leads', 'view-partners', 'view-simulator', 'view-commissions', 'view-catalog', 'view-audit'];
for (const vId of views) {
  const marker = `id="${vId}" class="view-section`;
  const backBar = `<!-- View Top Back Bar -->\n      <div class="zippy-view-back-bar">\n        <button type="button" class="zippy-btn-back-dash" onclick="window.backToDashboard && window.backToDashboard(event)" title="Back to 15-Box Dashboard">\n          <span>←</span> <span>Back to 15-Box Dashboard</span>\n        </button>\n        <span style="font-size: 12px; color: #38bdf8; font-weight: 700;">Zippy Loan Connector Platform</span>\n      </div>\n`;

  // Find where section opens
  const idx = html.indexOf(marker);
  if (idx !== -1) {
    const closeTagIdx = html.indexOf('>', idx);
    const existingCheck = html.slice(closeTagIdx, closeTagIdx + 400);
    if (!existingCheck.includes('class="zippy-view-back-bar"')) {
      html = html.slice(0, closeTagIdx + 1) + '\n      ' + backBar + html.slice(closeTagIdx + 1);
      console.log(`✅ Added Back Bar to view #${vId}`);
    }
  }
}

// 5. In all 15 Zippy Modals: Add "<- Back" button in header & "<- Back to Dashboard" button in footer
const zippyModals = [
  'modal-zippy-profile',
  'modal-zippy-ai',
  'modal-zippy-lenders',
  'modal-zippy-vault',
  'modal-zippy-payouts',
  'modal-zippy-reminders',
  'modal-zippy-circulars',
  'modal-zippy-feedback',
  'modal-zippy-partners',
  'modal-zippy-new-lead',
  'modal-zippy-lead-queue',
  'modal-zippy-commissions',
  'modal-zippy-analytics',
  'modal-zippy-doc-review',
  'modal-zippy-products'
];

for (const mId of zippyModals) {
  const mIndex = html.indexOf(`id="${mId}"`);
  if (mIndex === -1) {
    console.log(`⚠️ Warning: modal ${mId} not found`);
    continue;
  }

  // Find header inside this modal
  const headerIdx = html.indexOf('<div class="zippy-modal-header">', mIndex);
  if (headerIdx !== -1) {
    const afterHeaderIdx = headerIdx + '<div class="zippy-modal-header">'.length;
    const headerSnippet = html.slice(afterHeaderIdx, afterHeaderIdx + 150);
    if (!headerSnippet.includes('zippy-modal-back-btn')) {
      const backBtn = `\n        <button type="button" class="zippy-modal-back-btn" onclick="window.closeZippyModal('${mId}', event)" aria-label="Back to Dashboard">\n          <span>←</span> <span>Back</span>\n        </button>`;
      html = html.slice(0, afterHeaderIdx) + backBtn + html.slice(afterHeaderIdx);
      console.log(`✅ Added header Back button to ${mId}`);
    }
  }

  // Find closing </div></div> for the modal card
  // A modal ends with:
  //    </div>
  //  </div>
  // Let's locate the modal card and insert the footer Back button before its closing </div>
}

// 6. Global JS functions in app.html
if (!html.includes('window.backToDashboard =')) {
  const globalFuncs = `
    window.backToDashboard = function(e) {
      if (e && e.preventDefault) e.preventDefault();
      var consoleWrap = document.getElementById('enterprise-console-wrapper');
      var zippyScreen = document.getElementById('zippy-dashboard-screen');
      var welcomeScreen = document.getElementById('screen-welcome-login') || document.getElementById('zippy-welcome-screen');
      var authScreen = document.getElementById('screen-zippy-auth');
      if (consoleWrap) consoleWrap.style.display = 'none';
      if (welcomeScreen) welcomeScreen.style.display = 'none';
      if (authScreen) authScreen.style.display = 'none';
      if (zippyScreen) zippyScreen.style.display = 'block';
      document.querySelectorAll('.zippy-modal.active, .modal-backdrop.active').forEach(function(m) {
        m.classList.remove('active');
        m.style.display = 'none';
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.backToWelcomeScreen = function(e) {
      if (e && e.preventDefault) e.preventDefault();
      var consoleWrap = document.getElementById('enterprise-console-wrapper');
      var zippyScreen = document.getElementById('zippy-dashboard-screen');
      var welcomeScreen = document.getElementById('screen-welcome-login') || document.getElementById('zippy-welcome-screen');
      var authScreen = document.getElementById('screen-zippy-auth');
      if (consoleWrap) consoleWrap.style.display = 'none';
      if (zippyScreen) zippyScreen.style.display = 'none';
      if (authScreen) authScreen.style.display = 'none';
      if (welcomeScreen) welcomeScreen.style.display = 'block';
      document.querySelectorAll('.zippy-modal.active, .modal-backdrop.active').forEach(function(m) {
        m.classList.remove('active');
        m.style.display = 'none';
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Keyboard ESC key to go back
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var activeModal = document.querySelector('.zippy-modal.active, .modal-backdrop.active');
        if (activeModal) {
          activeModal.classList.remove('active');
          activeModal.style.display = 'none';
        }
      }
    });
`;
  html = html.replace('window.openZippyModal =', globalFuncs + '\n    window.openZippyModal =');
  console.log('✅ Added global window.backToDashboard and window.backToWelcomeScreen');
}

fs.writeFileSync('public/app.html', html, 'utf8');
console.log('App.html updated successfully.');
