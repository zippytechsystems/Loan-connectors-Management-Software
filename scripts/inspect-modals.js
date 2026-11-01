const fs = require('fs');

const appHtml = fs.readFileSync('public/app.html', 'utf8');

// Find all zippy modals
const modalMatches = [...appHtml.matchAll(/id="(modal-zippy-[^"]+)"/g)].map(m => m[1]);
console.log('Zippy Modals found (' + modalMatches.length + '):', modalMatches);

// Find console modals
const consoleModals = [...appHtml.matchAll(/id="(modal-[^"]+)"/g)].map(m => m[1]).filter(id => !id.startsWith('modal-zippy-'));
console.log('Console Modals found (' + consoleModals.length + '):', consoleModals);

// Find view sections
const viewMatches = [...appHtml.matchAll(/<section\s+id="(view-[^"]+)"/g)].map(m => m[1]);
console.log('Views found (' + viewMatches.length + '):', viewMatches);
