// Edit this filename if yours differs from the default.
const APP_HTML = './index.html';
const WORDS_FILE = './words.xlsx';

// Verbs and the 15 category word lists now live inside WORDS_FILE itself
// (Category column), so there's nothing to list here anymore - one file to
// cache instead of 17.

const CACHE_NAME = 'palabra-cache-v4';
const ASSETS_TO_CACHE = [
  './',
  APP_HTML,
  './manifest.json',
  WORDS_FILE,
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // If one asset 404s (e.g. a renamed file) don't let it block install entirely
        return Promise.allSettled(ASSETS_TO_CACHE.map((url) => cache.add(url)));
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to fetch the latest version when online, so a
// deploy takes effect on the very next load rather than the one after that.
// Falls back to the cached copy only when the network fails (offline), and
// keeps the cache updated with whatever succeeded, for that fallback to stay
// useful.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Only handle requests for our own origin. Without this check, taps on
  // external links (e.g. the Telegram contact link) get swallowed here too
  // — the SW tries to fetch/cache a cross-origin navigation, that silently
  // fails, and the link appears to do nothing.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
