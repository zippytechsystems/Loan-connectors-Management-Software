const fs = require('fs');
const path = require('path');

console.log('=======================================================');
console.log('   Adding Universal Back Buttons to Every Single Page   ');
console.log('=======================================================');

// 1. UPDATE public/app.html
let appHtml = fs.readFileSync('public/app.html', 'utf8');

// 15 Zippy Modals
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
  // Check if footer back button already added
  const regex = new RegExp(`id="${mId}"[\\s\\S]*?class="zippy-modal-card"([\\s\\S]*?)<\\/div>\\s*<\\/div>`, 'i');
  const match = appHtml.match(regex);
  if (match) {
    const cardContent = match[1];
    if (!cardContent.includes('zippy-btn-modal-back')) {
      const footerBtn = `\n      <button type="button" class="zippy-btn-modal-back" onclick="window.closeZippyModal('${mId}', event)">\n        <span>←</span> <span>Back to Dashboard</span>\n      </button>\n    </div>\n  </div>`;
      // Replace closing of this specific modal card
      const targetStr = match[0];
      const newStr = targetStr.replace(/<\/div>\s*<\/div>$/, footerBtn);
      appHtml = appHtml.replace(targetStr, newStr);
      console.log(`✅ Added footer Back button to #${mId}`);
    }
  }
}

// Console Modals: Add back button to modal headers & footers
const consoleModals = [
  { id: 'modal-intake', label: 'Back to Dashboard', closeTarget: 'modal-intake' },
  { id: 'modal-lead-detail', label: 'Back to Lead Queue', closeTarget: 'modal-lead-detail' },
  { id: 'modal-route-dispatch', label: 'Back to Leads', closeTarget: 'modal-route-dispatch' },
  { id: 'modal-partner', label: 'Back to Partners', closeTarget: 'modal-partner' },
  { id: 'modal-statement', label: 'Back to Commissions', closeTarget: 'modal-statement' }
];

for (const cm of consoleModals) {
  const mIndex = appHtml.indexOf(`id="${cm.id}"`);
  if (mIndex !== -1) {
    // Find header
    const headerIdx = appHtml.indexOf('<div class="modal-header">', mIndex);
    if (headerIdx !== -1 && headerIdx < mIndex + 400) {
      const afterHeader = headerIdx + '<div class="modal-header">'.length;
      const headerSnippet = appHtml.slice(afterHeader, afterHeader + 150);
      if (!headerSnippet.includes('zippy-modal-back-btn')) {
        const backBtn = `\n        <button type="button" class="zippy-modal-back-btn" data-close="${cm.closeTarget}" aria-label="${cm.label}" style="margin-right: 10px;">\n          <span>←</span> <span>Back</span>\n        </button>`;
        appHtml = appHtml.slice(0, afterHeader) + backBtn + appHtml.slice(afterHeader);
        console.log(`✅ Added header Back button to #${cm.id}`);
      }
    }
  }
}

// Verify DIV counts in app.html
const openDivs = (appHtml.match(/<div(\s|>)/gi) || []).length;
const closeDivs = (appHtml.match(/<\/div>/gi) || []).length;
console.log(`[app.html] Open divs: ${openDivs}, Close divs: ${closeDivs}, Diff: ${openDivs - closeDivs}`);

if (openDivs === closeDivs) {
  fs.writeFileSync('public/app.html', appHtml, 'utf8');
  console.log('✅ Successfully wrote updated public/app.html');
} else {
  console.error('❌ Error: Div mismatch! Not writing app.html');
  process.exit(1);
}

// 2. UPDATE PUBLIC MARKETING PAGES WITH BREADCRUMB "← Back to Home" BUTTON
const publicPages = [
  'about.html',
  'connector-network.html',
  'contact.html',
  'hyderabad-nacharam.html',
  'loan-products.html',
  'privacy-policy.html',
  'terms.html'
];

const breadcrumbSnippet = `
    <!-- Universal Top Back to Home Button -->
    <div class="container" style="padding-top: 1.25rem; padding-bottom: 0.25rem;">
      <a href="/" class="btn-breadcrumb-back" style="display: inline-flex; align-items: center; gap: 6px; color: #38bdf8; font-size: 13px; font-weight: 700; text-decoration: none; padding: 6px 14px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; transition: all 0.2s;">
        <span>←</span> <span>Back to Home</span>
      </a>
    </div>
`;

const footerBackSnippet = `
        <div style="margin-top: 1.5rem; text-align: center;">
          <a href="/" style="display: inline-flex; align-items: center; gap: 6px; color: #38bdf8; font-size: 13px; font-weight: 700; text-decoration: none; padding: 7px 18px; border: 1.5px solid rgba(56, 189, 248, 0.4); border-radius: 20px; background: rgba(15, 23, 42, 0.6);">
            <span>←</span> <span>Back to Home</span>
          </a>
        </div>
`;

for (const p of publicPages) {
  const filePath = path.join('public', p);
  if (!fs.existsSync(filePath)) continue;

  let pageContent = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Insert breadcrumb after </header> if not present
  if (!pageContent.includes('class="btn-breadcrumb-back"') && pageContent.includes('</header>')) {
    pageContent = pageContent.replace('</header>', '</header>\n' + breadcrumbSnippet);
    modified = true;
  }

  // Insert footer back button before </footer> if not present
  if (!pageContent.includes('Back to Home</span>\n          </a>\n        </div>') && pageContent.includes('</footer>')) {
    pageContent = pageContent.replace('</footer>', footerBackSnippet + '\n  </footer>');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, pageContent, 'utf8');
    console.log(`✅ Added Back to Home buttons to public/${p}`);
  }
}

console.log('=======================================================');
console.log(' Universal Back Buttons Configuration Completed!       ');
console.log('=======================================================');
