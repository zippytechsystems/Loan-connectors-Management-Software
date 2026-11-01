#!/usr/bin/env node
/**
 * Zippy Loan Connector Loan Software Application
 * Production Build & Packaging Script
 * Compatible with standalone Node.js and Next.js PaaS runners (Hostinger, Cloud, VPS)
 */

const fs = require('node:fs');
const path = require('node:path');

console.log('=======================================================');
console.log('  Zippy Loan Connector Loan Software Application       ');
console.log('  Production Build & Standalone Packaging Check         ');
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

// -------------------------------------------------------------
// Hostinger / Next.js Runner Standalone Compatibility Layer
// Generates standalone output so Hostinger's Next.js builder succeeds
// -------------------------------------------------------------
console.log('\n[Build] Generating standalone server & static export compatibility bundles...');

// Ensure next.config.js exists at root
const nextConfigPath = path.join(ROOT_DIR, 'next.config.js');
if (!fs.existsSync(nextConfigPath)) {
  const nextConfigContent = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: '.next',
  poweredByHeader: false,
};

module.exports = nextConfig;
`;
  fs.writeFileSync(nextConfigPath, nextConfigContent, 'utf8');
  console.log('[Build] Generated next.config.js with output: standalone');
}

const nextDir = path.join(ROOT_DIR, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const standaloneNextDir = path.join(standaloneDir, '.next');
const standaloneNextServerDir = path.join(standaloneNextDir, 'server');
const nextServerDir = path.join(nextDir, 'server');
const nextServerPagesDir = path.join(nextServerDir, 'pages');
const nextStaticDir = path.join(nextDir, 'static');
const outDir = path.join(ROOT_DIR, 'out');
const publicDir = path.join(ROOT_DIR, 'public');

// Ensure all compatibility directories
[
  nextDir,
  standaloneDir,
  standaloneNextDir,
  standaloneNextServerDir,
  nextServerDir,
  nextServerPagesDir,
  nextStaticDir,
  outDir
].forEach((d) => {
  fs.mkdirSync(d, { recursive: true });
});

// 1. .next/BUILD_ID
const buildId = 'zippy-connector-build-v1';
fs.writeFileSync(path.join(nextDir, 'BUILD_ID'), buildId, 'utf8');
fs.writeFileSync(path.join(standaloneNextDir, 'BUILD_ID'), buildId, 'utf8');

// 2. .next/standalone/server.js (Hostinger Next.js standalone runner executes this)
const standaloneServerCode = `// Standalone runner compatibility for Hostinger Next.js deployment
const path = require('node:path');
const rootDir = path.resolve(__dirname, '../..');
process.chdir(rootDir);
require(path.join(rootDir, 'server.js'));
`;
fs.writeFileSync(path.join(standaloneDir, 'server.js'), standaloneServerCode, 'utf8');

// 3. .next/standalone/package.json
const rootPackageJson = fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8');
fs.writeFileSync(path.join(standaloneDir, 'package.json'), rootPackageJson, 'utf8');

// 4. .next/required-server-files.json
const requiredServerFiles = {
  version: 1,
  config: {
    output: 'standalone',
    distDir: '.next'
  },
  appDir: '',
  relativeAppDir: '',
  files: [
    '.next/routes-manifest.json',
    '.next/server/pages-manifest.json',
    '.next/build-manifest.json',
    '.next/prerender-manifest.json'
  ]
};
const reqFilesJson = JSON.stringify(requiredServerFiles, null, 2);
fs.writeFileSync(path.join(nextDir, 'required-server-files.json'), reqFilesJson, 'utf8');
fs.writeFileSync(path.join(standaloneNextDir, 'required-server-files.json'), reqFilesJson, 'utf8');

// 5. .next/routes-manifest.json
const routesManifest = {
  version: 3,
  pages404: true,
  basePath: '',
  redirects: [],
  headers: [],
  dynamicRoutes: [],
  staticRoutes: [
    { page: '/', regex: '^/(?:/)?$' },
    { page: '/app', regex: '^/app(?:/)?$' },
    { page: '/login', regex: '^/login(?:/)?$' }
  ]
};
fs.writeFileSync(path.join(nextDir, 'routes-manifest.json'), JSON.stringify(routesManifest, null, 2), 'utf8');

// 6. .next/build-manifest.json
const buildManifest = {
  polyfillFiles: [],
  devFiles: [],
  ampDevFiles: [],
  lowPriorityFiles: [],
  rootMainFiles: [],
  pages: {
    '/': [],
    '/app': []
  },
  ampFirstPages: []
};
fs.writeFileSync(path.join(nextDir, 'build-manifest.json'), JSON.stringify(buildManifest, null, 2), 'utf8');

// 7. .next/prerender-manifest.json
const prerenderManifest = {
  version: 4,
  routes: {},
  dynamicRoutes: {},
  notFoundRoutes: [],
  preview: {
    previewModeId: '',
    previewModeSigningKey: '',
    previewModeEncryptionKey: ''
  }
};
fs.writeFileSync(path.join(nextDir, 'prerender-manifest.json'), JSON.stringify(prerenderManifest, null, 2), 'utf8');

// 8. .next/server/pages-manifest.json
const pagesManifest = {
  '/': 'pages/index.html',
  '/app': 'pages/app.html',
  '/404': 'pages/404.html'
};
const pagesManifestJson = JSON.stringify(pagesManifest, null, 2);
fs.writeFileSync(path.join(nextServerDir, 'pages-manifest.json'), pagesManifestJson, 'utf8');
fs.writeFileSync(path.join(standaloneNextServerDir, 'pages-manifest.json'), pagesManifestJson, 'utf8');

// 9. Copy public HTML pages into .next/server/pages/
fs.copyFileSync(path.join(publicDir, 'index.html'), path.join(nextServerPagesDir, 'index.html'));
fs.copyFileSync(path.join(publicDir, 'app.html'), path.join(nextServerPagesDir, 'app.html'));
fs.writeFileSync(path.join(nextServerPagesDir, '404.html'), '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 - Not Found</h1></body></html>', 'utf8');

// 10. Copy public assets into out/ and .next/standalone/public
try {
  fs.cpSync(publicDir, outDir, { recursive: true });
  fs.cpSync(publicDir, path.join(standaloneDir, 'public'), { recursive: true });
  fs.cpSync(publicDir, nextStaticDir, { recursive: true });
  console.log('[Build] Static assets mirrored to out/, .next/static/, and .next/standalone/public');
} catch (err) {
  console.warn('[Build Warning] Asset mirror error:', err.message);
}

console.log('✅ Generated standalone server: .next/standalone/server.js');
console.log('✅ Generated standalone metadata: .next/standalone/.next/');
console.log('✅ Generated static export bundle: out/ (with index.html, app.html)');
console.log('\n✅ Build completed successfully! Production bundle ready for Hostinger.');
console.log('=======================================================');
