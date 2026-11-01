// Zippy Loan Connector Software - Service Worker for Google Play Store PWA / TWA
const CACHE_NAME = 'zippy-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/app.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/onboarding_bg.jpg',
  '/img/dashboard/logo.svg',
  '/img/dashboard/card_profile.png',
  '/img/dashboard/card_partners.png',
  '/img/dashboard/card_feedback.png',
  '/img/dashboard/card_reminders.png',
  '/img/dashboard/card_lender_match.png',
  '/img/dashboard/card_ai_underwriter.png',
  '/img/dashboard/card_new_lead.png',
  '/img/dashboard/card_lead_queue.png',
  '/img/dashboard/card_payouts.png',
  '/img/dashboard/card_commissions.png',
  '/img/dashboard/card_analytics.png',
  '/img/dashboard/card_doc_review.png',
  '/img/dashboard/card_circulars.png',
  '/img/dashboard/card_products.png',
  '/img/dashboard/card_doc_vault.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-cache partial fallback:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Let API requests bypass cache
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/app.html');
        }
      });
    })
  );
});
