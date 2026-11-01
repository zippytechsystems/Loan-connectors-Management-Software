#!/usr/bin/env node
/**
 * Veridian Loan Connector OS — Build and Asset Validation Script
 * Executed during CI/CD and Hostinger build step ('npm run build')
 */

const fs = require('node:fs');
const path = require('node:path');

console.log('=======================================================');
console.log('  Veridian Loan Connector OS — Production Build Check ');
console.log('=======================================================');

const ROOT_DIR = path.resolve(__dirname, '..');
const requiredDirs = ['public', 'src', 'data', 'storage', 'scripts'];
const requiredFiles = [
  'server.js',
  'package.json',
  path.join('public', 'index.html'),
  path.join('public', 'app.html')
];

let errors = 0;

for (const dir of requiredDirs) {
  const dirPath = path.join(ROOT_DIR, dir);
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[Build] Created directory: ${dir}`);
    } catch (err) {
      console.error(`[Build Error] Could not create directory ${dir}:`, err.message);
      errors++;
    }
  } else {
    console.log(`[Build] Verified directory: ${dir}`);
  }
}

for (const file of requiredFiles) {
  const filePath = path.join(ROOT_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[Build Error] Missing required file: ${file}`);
    errors++;
  } else {
    console.log(`[Build] Verified file: ${file}`);
  }
}

if (errors > 0) {
  console.error(`\n❌ Build validation failed with ${errors} error(s).`);
  process.exit(1);
}

console.log('\n✅ Build completed successfully! Standalone production bundle ready.');
console.log('=======================================================');
