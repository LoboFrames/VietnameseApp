// Service Worker for VietLearn — enables the app to load with zero internet,
// and lets audio files be cached for offline playback (either organically, as
// each is played, or all at once via the "Download for offline" button).
//
// Bump CACHE_VERSION whenever LaiLingo.html changes meaningfully, so the old
// app-shell cache gets cleared and the new version is fetched fresh. Audio
// files don't need this treatment the same way — once a phrase's audio
// exists, it doesn't change, so the audio cache persists across versions.
const CACHE_VERSION = 'v31';
const APP_SHELL_CACHE = `vietlearn-shell-${CACHE_VERSION}`;
const AUDIO_CACHE = 'vietlearn-audio'; // no version suffix — persists across app updates

const APP_SHELL_URLS = [
  './LaiLingo.html',
];

self.addEventListener('install', (event) => {
  // Promise.allSettled (not addAll/all) deliberately — if any single URL here
  // fails to cache, the whole install step must NOT fail, or the service
  // worker gets stuck "installing" forever and never reaches "activated".
  // That silent-stuck-forever failure mode is exactly what caused the
  // Download for Offline Use button to hang with no explanation earlier.
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(cache =>
      Promise.allSettled(APP_SHELL_URLS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== APP_SHELL_CACHE && k !== AUDIO_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only GET requests are cacheable at all — the Cache API's match()/put()
  // both throw on anything else. Without this guard, the catch-all branch
  // at the bottom was calling cache.put() on POST requests (like the
  // coach-feedback call to Supabase), which threw a TypeError and
  // surfaced as "FetchEvent.respondWith received an error: Load failed" —
  // the exact bug that made pronunciation checking fail on iOS. Anything
  // non-GET just passes straight through to the network, untouched.
  if (event.request.method !== 'GET') {
    return;
  }

  // Audio files: cache-first. Once a clip has been played (or bulk
  // downloaded), it's served instantly from cache forever after, with no
  // network dependency at all.
  if (url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request)
            .then(response => {
              if (response.ok) cache.put(event.request, response.clone());
              return response;
            })
            .catch(() => cached); // offline and never cached — nothing more we can do for this one clip
        })
      )
    );
    return;
  }

  // The app page itself: network-first, so you always get the latest version
  // when online, falling back to the cached copy the moment you're offline.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./LaiLingo.html')))
    );
    return;
  }

  // Everything else (e.g. the Supabase SDK loaded from a CDN): cache-first,
  // since these rarely change and don't need the "always freshest" treatment.
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(APP_SHELL_CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
    )
  );
});
