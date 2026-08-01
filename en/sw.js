const CACHE_NAME = 'wolf-en-pwa-v2-ui-translation';

/* ══════ 🔥 Hot-update support ══════
 * Build number of the assets bundled into this APK / PWA deploy; written by
 * scripts/stamp-build.mjs at release time. The hot-update cache only wins when
 * its build number is STRICTLY GREATER, so installing a newer APK automatically
 * retires an older hot-update package instead of being pushed back by it.
 * sw.js itself is NEVER hot-updated — a broken SW would brick the whole app.
 * The hot cache is shared with the root client (same origin, keyed by full URL);
 * this worker only ever serves the entries inside its own /en/ scope. */
const BUNDLED_BUILD = 0; /* @@BUNDLED_BUILD@@ */
const HOT_CACHE = 'wolf-hot-active';
// The Android Capacitor shell uses https://localhost. Browser/PWA origins
// must never consume the APK-only hot-update bundle.
const IS_NATIVE_ORIGIN = self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' || self.location.hostname === '[::1]';
// The manifest key must be an absolute URL resolved against the SITE ROOT. A relative
// path would be resolved against each worker's own base, so this /en/ worker would look
// for /en/__wolf_hot_manifest__ and never find the one the page wrote at the root.
const HOT_ROOT = self.location.href.replace(/[^/]*$/, '').replace(/(^|\/)en\/$/, '$1');
const HOT_MANIFEST_KEY = HOT_ROOT + '__wolf_hot_manifest__';

const APP_SHELL = [
  './',
  './index.html',
  './storage-scope.js',
  './i18n.js',
  './manifest.webmanifest',
  './tablet.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const stale = keys.filter(key => key.startsWith('wolf-en-') && key !== CACHE_NAME);
      if (!IS_NATIVE_ORIGIN && keys.includes(HOT_CACHE)) stale.push(HOT_CACHE);
      return Promise.all(stale.map(key => caches.delete(key)));
    })
  );
  self.clients.claim();
});

let _hotState = null;

async function hotState() {
  if (!IS_NATIVE_ORIGIN) return (_hotState = { build: 0, active: false });
  if (_hotState) return _hotState;
  try {
    const cache = await caches.open(HOT_CACHE);
    const res = await cache.match(HOT_MANIFEST_KEY);
    if (!res) return (_hotState = { build: 0, active: false });
    const manifest = await res.json();
    const build = Number(manifest && manifest.build) || 0;
    return (_hotState = { build, active: build > BUNDLED_BUILD });
  } catch (e) {
    return (_hotState = { build: 0, active: false });
  }
}

function cacheKeyFor(request) {
  const u = new URL(request.url);
  if (u.pathname.endsWith('/')) u.pathname += 'index.html';
  u.search = '';
  u.hash = '';
  return u.href;
}

async function hotMatch(request) {
  const st = await hotState();
  if (!st.active) return null;
  const cache = await caches.open(HOT_CACHE);
  return (await cache.match(cacheKeyFor(request))) || null;
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'wolf-hot-invalidate') _hotState = null;
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const hot = await hotMatch(request);
    if (hot) return hot;

    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
        return response;
      } catch (e) {
        return (await caches.match('./index.html')) || Response.error();
      }
    }

    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })());
});
