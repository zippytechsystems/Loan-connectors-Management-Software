// Standalone runner compatibility for Hostinger Next.js deployment
const path = require('node:path');
const rootDir = path.resolve(__dirname, '../..');
process.chdir(rootDir);
require(path.join(rootDir, 'server.js'));
