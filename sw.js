const CACHE_NAME = 'wolf-pwa-v12-i18n-complete';

/* ══════ 🔥 热更新支持 ══════
 * 内置资源的构建号：打包 APK / 发布网页时由 scripts/stamp-build.mjs 写入。
 * 只有当热更新缓存里的构建号【严格大于】它时，SW 才用热更新版本覆盖内置版本。
 * 这样用户装了更新的安装包之后，包里自带的资源会自动压过旧的热更新包，
 * 而不会出现「装了新 APK 反而被旧热更新顶回去」。
 * sw.js 自身【永不】参与热更新——热更新写坏 SW 会让整个 app 打不开。 */
const BUNDLED_BUILD = 0; /* @@BUNDLED_BUILD@@ */
const HOT_CACHE = 'wolf-hot-active';
// The Android Capacitor shell uses https://localhost. Browser/PWA origins
// must never consume the APK-only hot-update bundle.
const IS_NATIVE_ORIGIN = self.location.hostname === 'localhost' ||
  self.location.hostname === '127.0.0.1' || self.location.hostname === '[::1]';
// manifest 的键必须是【按站点根算的绝对 URL】。用相对路径的话 Cache API 会拿各自的 base
// 去解析，/en/sw.js 会去读 /en/__wolf_hot_manifest__，和页面写下的那份永远对不上。
const HOT_ROOT = self.location.href.replace(/[^/]*$/, '').replace(/(^|\/)en\/$/, '$1');
const HOT_MANIFEST_KEY = HOT_ROOT + '__wolf_hot_manifest__';

const APP_SHELL = [
  './',
  './index.html',
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
      const stale = keys.filter(key => key.startsWith('wolf-pwa-') && key !== CACHE_NAME);
      if (!IS_NATIVE_ORIGIN && keys.includes(HOT_CACHE)) stale.push(HOT_CACHE);
      return Promise.all(stale.map(key => caches.delete(key)));
    })
  );
  self.clients.claim();
});

/* 热更新状态缓存在内存里，避免每个请求都去读一次 manifest；
 * 页面完成下载/回滚后会 postMessage 让这里失效。 */
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

/* 导航请求统一归一到具体的 index.html（中文根目录 / 英文 ./en/ 各一份），
 * 并去掉 query/hash，让缓存键和 manifest 里的路径能对上。 */
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
    // 🔥 热更新优先：有生效中的热更新包就直接用它，内置资源退居其后。
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
