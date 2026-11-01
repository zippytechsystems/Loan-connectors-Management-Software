const fs = require('fs');
const html = fs.readFileSync('public/app.html', 'utf8');
const lines = html.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('id="modal-')) {
    console.log(`Line ${idx + 1}: ${l.trim()}`);
  }
});
