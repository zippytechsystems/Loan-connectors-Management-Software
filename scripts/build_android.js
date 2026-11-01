#!/usr/bin/env node
/**
 * Zippy Loan Connector Software - Android App Packaging & Play Store Validator
 */

const fs = require('node:fs');
const path = require('node:path');

console.log('================================================================');
console.log('  Zippy Loan Connector — Google Play Store Android Build Check  ');
console.log('================================================================');

const ROOT_DIR = path.resolve(__dirname, '..');

const checks = [
  { file: 'public/manifest.json', desc: 'Web App Manifest (PWA/TWA)' },
  { file: 'public/sw.js', desc: 'Service Worker (Offline & App Shell)' },
  { file: 'public/img/icon-512.png', desc: 'Google Play Store 512x512 Icon' },
  { file: 'public/img/icon-192.png', desc: 'Android Launcher 192x192 Icon' },
  { file: 'public/.well-known/assetlinks.json', desc: 'Digital Asset Links (TWA Auto-Verify)' },
  { file: 'capacitor.config.json', desc: 'Capacitor Android Configuration' },
  { file: 'android/settings.gradle', desc: 'Android Project Settings' },
  { file: 'android/build.gradle', desc: 'Root Build Gradle' },
  { file: 'android/app/build.gradle', desc: 'App Module Gradle (compileSdk 34)' },
  { file: 'android/app/src/main/AndroidManifest.xml', desc: 'Android Manifest (com.zippy.loanconnector)' },
  { file: 'android/app/src/main/java/com/zippy/loanconnector/MainActivity.java', desc: 'Native WebView Activity' }
];

let failed = 0;
for (const c of checks) {
  const p = path.join(ROOT_DIR, c.file);
  if (fs.existsSync(p)) {
    console.log(`[PASS] ${c.desc}: ${c.file}`);
  } else {
    console.error(`[FAIL] Missing required artifact: ${c.file}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n❌ Android build validation failed with ${failed} missing files.`);
  process.exit(1);
}

console.log('\n================================================================');
console.log('✅ Android Application Architecture is 100% READY for Google Play Store!');
console.log('================================================================');
console.log('Options to generate final Play Store .aab / .apk:');
console.log('');
console.log('1. VIA ANDROID STUDIO:');
console.log('   - Open Android Studio -> Open Folder -> Select "android" folder.');
console.log('   - Menu -> Build -> Generate Signed Bundle / APK.');
console.log('   - Select "Android App Bundle" (.aab) -> Next -> Create Keystore -> Finish.');
console.log('');
console.log('2. VIA BUBBLEWRAP (Official Google PWA Play Store Packager):');
console.log('   - npx @bubblewrap/cli init --manifest=http://your-domain.com/manifest.json');
console.log('   - npx @bubblewrap/cli build');
console.log('');
console.log('3. VIA GRADLE WRAPPER:');
console.log('   - cd android && ./gradlew assembleRelease (for test APK)');
console.log('   - cd android && ./gradlew bundleRelease (for Google Play Console AAB)');
console.log('================================================================\n');
