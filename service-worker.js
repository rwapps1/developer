// Edit this filename if yours differs from the default.
const APP_HTML = './index.html';
const WORDS_FILE = './words.xlsx';

// Verbs and the 15 category word lists now live inside WORDS_FILE itself
// (Category column), so there's nothing to list here anymore - one file to
// cache instead of 17.

// Bumped for the index.html file-reorganisation deploy (monolithic
// index.html split into css/*.js and js/*.js) - gives the activate handler
// below a clean break from the old palabra-cache-v4 entries (old index.html
// plus its inline CSS/JS) instead of leaving old and new assets mixed
// together under the same cache name.
const CACHE_NAME = 'palabra-cache-v6';
const ASSETS_TO_CACHE = [
  './',
  APP_HTML,
  './manifest.json',
  WORDS_FILE,
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './css/base.css',
  './css/components.css',
  './css/auth.css',
  './css/quiz.css',
  './css/memory.css',
  './css/progress.css',
  './css/celebration.css',
  './css/daily-double.css',
  './css/hub.css',
  './js/firebase-auth.js',
  './js/config.js',
  './js/utils.js',
  './js/audio.js',
  './js/progress-xp.js',
  './js/state.js',
  './js/auth.js',
  './js/cloud-sync.js',
  './js/data-loading.js',
  './js/word-selection.js',
  './js/conjugation-engine.js',
  './js/achievements.js',
  './js/game-quiz.js',
  './js/game-timeattack.js',
  './js/game-memory.js',
  './js/game-conjugate.js',
  './js/views/render-auth.js',
  './js/views/render-hub.js',
  './js/views/render-quiz.js',
  './js/views/render-timeattack.js',
  './js/views/render-memory.js',
  './js/views/render-conjugate.js',
  './js/views/render-progress.js',
  './js/views/render-dispatch.js',
  './js/navigation.js',
  './js/app-boot.js',
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
