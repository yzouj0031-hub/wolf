/* ══════════════════════════════════════════════════════════════════
 *  🔥 热更新（APK / PWA 静默自动更新）
 *
 *  这个 app 的本体就是一份 index.html 加几个小文件，全是网页资源。
 *  绝大多数更新根本不碰原生层，所以没必要让用户重装安装包：
 *
 *    启动 → 拉 version.json（约 1KB）→ 有新版就后台下载整包
 *         → 校验通过后写进 Cache Storage → 下次启动 SW 直接用新版本
 *
 *  几条硬性约束：
 *  · sw.js 自身永不热更新——写坏它整个 app 就打不开了。
 *  · 只有热更新包的 build 【严格大于】安装包内置的 BUNDLED_BUILD 时才生效，
 *    所以用户装了更新的 APK 之后，旧热更新包会自动退位。
 *  · 绝不在对局中途切换版本：新版本只在下一次冷启动生效，避免存档格式撕裂。
 *  · 热更新包连续 3 次启动失败会自动回滚到安装包内置版本（见 bootGuard）。
 *  · 原生层真的变了（加插件/改权限）时，version.json 里的 minNative 会高于本壳的
 *    NATIVE_ABI，此时不做热更新，改为提示用户去下载新安装包。
 * ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // APK-only: browser/PWA users already receive the latest GitHub Pages files.
  // Short-circuit before any manifest check, boot guard, download, or UI injection.
  const IS_NATIVE = !!(
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  ) || /^(https?:\/\/)(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(window.location.href);
  if (!IS_NATIVE) return;

  // ── 发布时由 scripts/stamp-build.mjs 写入；仓库里永远是占位值 ──
  // 本地开发时 APP_BUILD 恒为 0，任何线上构建号都大于它，所以本地永远不会误判成"已最新"。
  const APP_BUILD = 0;
  const APP_VERSION = 'dev';
  // 原生壳 ABI：只有改动 Capacitor 插件 / 权限 / 图标时才手动 +1。
  // 网页热更新改不了原生层，所以新网页要求的 ABI 高于当前壳时只能提示重装。
  const NATIVE_ABI = 1;

  const REPO = 'yzouj0031-hub/wolf';
  const ASSET_BASE = 'https://github.com/' + REPO + '/releases/download/web-latest/';
  const MANIFEST_URL = ASSET_BASE + 'version.json';
  const BUNDLE_URL = ASSET_BASE + 'bundle.json';
  const APK_PAGE = 'https://github.com/' + REPO + '/releases/tag/android-latest';

  const HOT_CACHE = 'wolf-hot-active';

  const LS_TRIES = 'wolfHotBootTries';   // "build:次数" —— 该热更新包已尝试启动几次
  const LS_OK = 'wolfHotBootOk';         // 已确认能正常启动的最高 build
  const LS_PENDING = 'wolfHotPending';   // 已下载完成、等待下次启动生效的 build
  const LS_LAST = 'wolfHotLastCheck';

  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;  // 自动检查最多 6 小时一次
  const MAX_BOOT_TRIES = 3;

  const EN = /(^|\/)en\/?$/.test(location.pathname.replace(/[^/]*$/, '')) ||
             /\/en\//.test(location.pathname);
  const T = EN ? {
    staged: b => 'Update ' + b + ' downloaded — it will apply next time you open the app.',
    current: 'Already up to date.',
    checking: 'Checking for updates…',
    failed: 'Update check failed.',
    needsApk: 'A new version needs a new installer. Tap to open the download page.',
    rolled: 'That update failed to start, so the built-in version was restored.',
    version: 'Version',
    check: 'Check for updates',
    pending: b => 'Update ' + b + ' is ready — restart the app to use it.'
  } : {
    staged: b => '已在后台更新到 ' + b + '，下次启动生效。',
    current: '已经是最新版本。',
    checking: '正在检查更新…',
    failed: '检查更新失败。',
    needsApk: '新版本需要重新安装安装包，点这里打开下载页。',
    rolled: '上个更新包启动失败，已自动回退到内置版本。',
    version: '版本',
    check: '检查更新',
    pending: b => '更新 ' + b + ' 已就绪，重启应用即可生效。'
  };

  // 站点根目录：本文件在 /en/ 下也有一份副本，缓存键必须统一按站点根算，
  // 否则 en 客户端会把 index.html 写成 /en/index.html 的键。
  const SELF_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = SELF_SRC.replace(/[^/]*$/, '').replace(/(^|\/)en\/$/, '$1');

  const absUrl = path => new URL(path, ROOT).href;

  // manifest 的键必须是【按站点根算的绝对 URL】。用相对路径的话，Cache API 会拿各自的
  // base 去解析：根客户端写成 /__wolf_hot_manifest__，而 /en/sw.js 会去读
  // /en/__wolf_hot_manifest__，两边永远对不上，英文端的热更新就完全不会生效。
  const HOT_MANIFEST_KEY = absUrl('__wolf_hot_manifest__');

  function mimeOf(path) {
    if (/\.html?$/i.test(path)) return 'text/html; charset=utf-8';
    if (/\.m?js$/i.test(path)) return 'text/javascript; charset=utf-8';
    if (/\.css$/i.test(path)) return 'text/css; charset=utf-8';
    if (/\.webmanifest$/i.test(path)) return 'application/manifest+json; charset=utf-8';
    if (/\.json$/i.test(path)) return 'application/json; charset=utf-8';
    return 'text/plain; charset=utf-8';
  }

  const utf8 = new TextEncoder();

  async function sha256Hex(text) {
    if (!(window.crypto && window.crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', utf8.encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function fetchJson(url) {
    // 滚动标签的 Release 资源会被 CDN 缓存，加时间戳 + no-store 强制拿最新的。
    const res = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function readHotManifest() {
    try {
      if (!window.caches) return null;
      const cache = await caches.open(HOT_CACHE);
      const res = await cache.match(HOT_MANIFEST_KEY);
      if (!res) return null;
      const m = await res.json();
      return Number.isInteger(m && m.build) ? m : null;
    } catch (e) { return null; }
  }

  async function notifySW() {
    try {
      if (!navigator.serviceWorker) return;
      const regs = await navigator.serviceWorker.getRegistrations();
      regs.forEach(r => {
        const w = r.active || r.waiting || r.installing;
        if (w) w.postMessage({ type: 'wolf-hot-invalidate' });
      });
    } catch (e) {}
  }

  async function dropHotCache() {
    try { if (window.caches) await caches.delete(HOT_CACHE); } catch (e) {}
    try {
      localStorage.removeItem(LS_PENDING);
      localStorage.removeItem(LS_TRIES);
    } catch (e) {}
    await notifySW();
  }

  /* ── 启动守护 ──
   * 本文件在主脚本之前加载：这里先记一次"尝试启动"，主脚本完整跑完后才会写 OK。
   * 热更新包把 app 写崩时 OK 永远写不下，累计 3 次就清掉热更新缓存回到内置版本。
   * 只有"当前正在跑的确实是热更新包"时才计数，否则内置版本自身崩溃会被反复重载。 */
  async function bootGuard() {
    if (APP_BUILD <= 0) return;
    const hot = await readHotManifest();
    if (!hot || hot.build !== APP_BUILD) return;   // 跑的是内置版本，与热更新无关

    let okBuild = 0, raw = '';
    try {
      okBuild = Number(localStorage.getItem(LS_OK)) || 0;
      raw = String(localStorage.getItem(LS_TRIES) || '');
    } catch (e) { return; }
    if (okBuild >= APP_BUILD) return;              // 这个构建已经成功启动过

    const parts = raw.split(':');
    const tries = (Number(parts[0]) === APP_BUILD ? Number(parts[1]) || 0 : 0) + 1;
    try { localStorage.setItem(LS_TRIES, APP_BUILD + ':' + tries); } catch (e) {}

    if (tries > MAX_BOOT_TRIES) {
      await dropHotCache();
      try { sessionStorage.setItem('wolfHotRolledBack', '1'); } catch (e) {}
      location.reload();
    }
  }

  function markBootOk() {
    if (APP_BUILD <= 0) return;
    try {
      localStorage.setItem(LS_OK, String(APP_BUILD));
      localStorage.removeItem(LS_TRIES);
      // 生效了就不再是 pending
      if ((Number(localStorage.getItem(LS_PENDING)) || 0) <= APP_BUILD) localStorage.removeItem(LS_PENDING);
    } catch (e) {}
  }

  /* ── 下载并暂存新版本 ──
   * 先把整包校验完再写缓存；manifest 最后写，保证「有 manifest = 文件齐全」。 */
  async function stage(bundle, meta) {
    const files = bundle && bundle.files;
    if (!files || typeof files !== 'object') throw new Error('更新包格式错误');
    const paths = Object.keys(files);
    if (!paths.length) throw new Error('更新包是空的');

    const sizes = meta.sizes || {};
    const hashes = meta.sha256 || {};
    for (const path of paths) {
      const content = files[path];
      if (typeof content !== 'string') throw new Error('内容异常：' + path);
      if (sizes[path] != null && utf8.encode(content).length !== sizes[path]) {
        throw new Error('长度不符：' + path);
      }
      if (hashes[path]) {
        const got = await sha256Hex(content);
        // crypto.subtle 不可用时退回长度校验（上面已做），不因此阻断更新。
        if (got && got !== hashes[path]) throw new Error('校验失败：' + path);
      }
    }

    const cache = await caches.open(HOT_CACHE);
    for (const path of paths) {
      await cache.put(absUrl(path), new Response(files[path], {
        headers: { 'Content-Type': mimeOf(path), 'Cache-Control': 'no-cache' }
      }));
    }
    await cache.put(HOT_MANIFEST_KEY, new Response(JSON.stringify({
      build: meta.build, version: meta.version, time: Date.now()
    }), { headers: { 'Content-Type': 'application/json' } }));
    await notifySW();
  }

  function metered() {
    const c = navigator.connection;
    return !!(c && (c.saveData || /^(slow-2g|2g)$/.test(c.effectiveType || '')));
  }

  async function check(opts) {
    const manual = !!(opts && opts.manual);
    let last = 0;
    try { last = Number(localStorage.getItem(LS_LAST)) || 0; } catch (e) {}
    if (!manual && Date.now() - last < CHECK_INTERVAL_MS) return { status: 'skipped' };
    try { localStorage.setItem(LS_LAST, String(Date.now())); } catch (e) {}

    const meta = await fetchJson(MANIFEST_URL);
    if (!meta || !Number.isInteger(meta.build)) throw new Error('version.json 格式错误');

    if (meta.build <= APP_BUILD) return { status: 'current', build: APP_BUILD };

    if ((Number(meta.minNative) || 1) > NATIVE_ABI) {
      return { status: 'needs-apk', build: meta.build, version: meta.version };
    }

    let pending = 0;
    try { pending = Number(localStorage.getItem(LS_PENDING)) || 0; } catch (e) {}
    if (pending >= meta.build) return { status: 'pending', build: pending };

    // 整包约几 MB：省流量模式和 2G 下不自动下载，用户手动点还是照下。
    if (!manual && metered()) return { status: 'skipped-metered', build: meta.build };

    const bundle = await fetchJson(BUNDLE_URL);
    if (!bundle || bundle.build !== meta.build) throw new Error('更新包与清单不匹配');
    await stage(bundle, meta);
    try { localStorage.setItem(LS_PENDING, String(meta.build)); } catch (e) {}
    return { status: 'staged', build: meta.build, version: meta.version };
  }

  /* ── 轻量提示条：不依赖 app 自身的 CSS，热更新出问题时也能显示 ── */
  function toast(text, onClick) {
    let el = document.getElementById('wolf-hot-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wolf-hot-toast';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:99999;' +
        'max-width:88vw;padding:10px 16px;border-radius:10px;font-size:13px;line-height:1.5;' +
        'background:rgba(20,18,30,.95);color:#e8dcc0;border:1px solid rgba(200,168,76,.45);' +
        'box-shadow:0 6px 24px rgba(0,0,0,.45);text-align:center;';
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = text;
    el.style.cursor = onClick ? 'pointer' : 'default';
    el.onclick = onClick || null;
    el.style.display = '';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = 'none'; }, onClick ? 12000 : 6000);
  }

  function report(r, manual) {
    if (!r) return;
    if (r.status === 'staged') toast(T.staged(r.version || r.build));
    else if (r.status === 'pending' && manual) toast(T.pending(r.build));
    else if (r.status === 'needs-apk') toast(T.needsApk, () => window.open(APK_PAGE, '_blank'));
    else if (r.status === 'current' && manual) toast(T.current);
  }

  /* ── 主菜单里挂一行版本号 + 手动检查按钮（DOM 注入，不动 index.html 结构）── */
  function mountUi() {
    const anchor = document.getElementById('cloud-card');
    if (!anchor || document.getElementById('wolf-hot-row')) return;
    const row = document.createElement('div');
    row.id = 'wolf-hot-row';
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;' +
      'margin:6px 0 2px;padding:0 4px;font-size:.72em;color:#8a7e6a;';
    const label = document.createElement('span');
    label.textContent = T.version + ' ' + APP_VERSION;
    const btn = document.createElement('button');
    btn.textContent = T.check;
    btn.style.cssText = 'background:none;border:1px solid rgba(200,168,76,.35);color:#c8a84c;' +
      'border-radius:6px;padding:3px 10px;font-size:1em;cursor:pointer;';
    btn.onclick = async () => {
      btn.disabled = true;
      toast(T.checking);
      try { report(await check({ manual: true }), true); }
      catch (e) { toast(T.failed + ' ' + (e && e.message ? e.message : '')); }
      finally { btn.disabled = false; }
    };
    row.append(label, btn);
    anchor.insertAdjacentElement('afterend', row);
  }

  // 启动守护要尽早跑，赶在主脚本可能崩溃之前把"尝试次数"记下来。
  bootGuard();

  window.WolfHotUpdate = {
    build: APP_BUILD,
    version: APP_VERSION,
    nativeAbi: NATIVE_ABI,
    check,
    markBootOk,
    rollback: dropHotCache
  };

  window.addEventListener('load', () => {
    mountUi();
    try {
      if (sessionStorage.getItem('wolfHotRolledBack')) {
        sessionStorage.removeItem('wolfHotRolledBack');
        toast(T.rolled);
      }
    } catch (e) {}
    // 延后一点再查，别和开局的资源加载抢带宽。
    setTimeout(() => {
      check().then(r => report(r, false)).catch(() => {});
    }, 8000);
  });
})();
