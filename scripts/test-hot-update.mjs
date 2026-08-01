// 热更新的行为测试：在 Node 里用 vm 造一个浏览器环境，把 hot-update.js 和 sw.js
// 真正跑起来，而不是只做字符串匹配。手机上很难复现的分支（校验失败、装了更新的 APK、
// 启动失败回滚、英文端缓存键）在这里全部走一遍。
//
// 用的是 Node 自带的真 Response / TextEncoder / crypto.subtle，所以哈希与内容类型的
// 行为和浏览器一致；只有 caches / localStorage / document 是桩。
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

let passed = 0;
const ok = (cond, label) => {
  if (!cond) { console.error('❌ ' + label); process.exit(1); }
  passed++;
};
const eq = (got, want, label) => ok(Object.is(got, want), `${label}（期望 ${want}，实际 ${got}）`);

mkdirSync('dist-hot', { recursive: true });

/* ══════ 浏览器环境桩 ══════ */

// 真实 Cache API 会把相对路径按【调用方各自的 base】解析。页面、根 SW、/en/ SW 三者
// base 不同，所以这里也按 base 解析——用相对键跨 base 读写就会自然读不到，和浏览器
// 表现一致（热更新 manifest 必须用按站点根算的绝对 URL，正是因为这个）。
function makeCaches() {
  const store = new Map();  // cacheName -> Map(绝对url -> {body, headers})
  const openCache = (name, base) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    const key = k => new URL(String(k && k.url ? k.url : k), base).href;
    return {
      async match(k) {
        const hit = m.get(key(k));
        // Response 的 body 只能读一次，每次 match 都新建一个。
        return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
      },
      async put(k, res) {
        m.set(key(k), { body: await res.text(), headers: Object.fromEntries(res.headers) });
      }
    };
  };
  // 每个执行上下文拿一份绑定了自己 base 的视图，底层存储共享（同源同一个 Cache Storage）
  const view = base => ({
    async open(name) { return openCache(name, base); },
    async delete(name) { return store.delete(name); },
    async match(req) {
      const k = new URL(String(req && req.url ? req.url : req), base).href;
      for (const m of store.values()) {
        if (m.has(k)) { const hit = m.get(k); return new Response(hit.body, { headers: hit.headers }); }
      }
      return undefined;
    }
  });
  return { _store: store, view };
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m
  };
}

function pageContext({ caches, fetchImpl, pathname, localStorage, source }) {
  const href = 'https://localhost' + pathname;
  const scriptSrc = 'https://localhost' + (pathname.includes('/en/') ? '/en' : '') + '/hot-update.js';
  const ctx = {
    console, setTimeout, clearTimeout, setImmediate, Response, Headers, TextEncoder, crypto, URL,
    caches: caches.view(href),
    localStorage,
    sessionStorage: makeStorage(),
    fetch: fetchImpl,
    location: { pathname, href, reload() { ctx.__reloaded = true; } },
    document: {
      currentScript: { src: scriptSrc },
      getElementById: () => null,
      createElement: () => ({ style: {}, append() {}, insertAdjacentElement() {}, onclick: null }),
      body: { appendChild() {} },
      documentElement: { appendChild() {} }
    },
    navigator: { serviceWorker: { getRegistrations: async () => [] } },
    __reloaded: false
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.window.addEventListener = () => {};   // 不触发 load，手动调 check 更好控制
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: 'hot-update.js' });
  return ctx;
}

function loadSw(file, { caches, href }) {
  const handlers = {};
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting() {}, clients: { claim() {} },
    location: { origin: 'https://localhost', href }
  };
  const ctx = {
    console, Response, Headers, URL, self,
    caches: caches.view(href),
    // 「网络」在 APK 里就是安装包内置的那份资源
    fetch: async () => new Response('BUNDLED', { headers: { 'Content-Type': 'text/html' } })
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  return {
    // 驱动真正注册的 fetch 监听器，而不是去猜内部状态
    async serve(url, mode = 'navigate') {
      let out;
      handlers.fetch({ request: { url, method: 'GET', mode }, respondWith(p) { out = p; } });
      return out ? await out : undefined;
    }
  };
}

/* ══════ 造一个和 CI 产物同构的更新包 ══════ */
function makeBundle(build, { minNative = 1, corrupt = false } = {}) {
  const files = {
    'index.html': `<!doctype html><title>build ${build}</title>`,
    'hot-update.js': `const APP_BUILD = ${build};`,
    'en/index.html': `<!doctype html><title>en build ${build}</title>`
  };
  const sha256 = {}, sizes = {};
  for (const [p, text] of Object.entries(files)) {
    const buf = Buffer.from(text, 'utf8');
    sha256[p] = createHash('sha256').update(buf).digest('hex');
    sizes[p] = buf.length;
  }
  if (corrupt) files['index.html'] += '<!-- 传输中被改动 -->';
  return {
    meta: { build, version: 'b' + build, minNative, sha256, sizes },
    bundle: { build, version: 'b' + build, files }
  };
}

const serveJson = pkg => async url => {
  if (url.includes('version.json')) return new Response(JSON.stringify(pkg.meta));
  if (url.includes('bundle.json')) return new Response(JSON.stringify(pkg.bundle));
  return new Response('not found', { status: 404 });
};

const HOT = 'wolf-hot-active';
const MANIFEST = 'https://localhost/__wolf_hot_manifest__';
const HOT_SRC = readFileSync('hot-update.js', 'utf8');
const stampedWith = build => HOT_SRC.replace(/const APP_BUILD = \d+;/, `const APP_BUILD = ${build};`);

const load = (caches, fetchImpl, opts = {}) => pageContext({
  caches, fetchImpl,
  pathname: opts.pathname || '/',
  localStorage: opts.localStorage || makeStorage(),
  source: opts.source || HOT_SRC
});

/* ══════ ① 仓库里必须保持占位值，否则本地开发版会把自己当成线上版本 ══════ */
eq(Number(HOT_SRC.match(/const APP_BUILD = (\d+);/)[1]), 0, '仓库里的 hot-update.js 应保持 APP_BUILD=0');
eq(Number(readFileSync('sw.js', 'utf8').match(/const BUNDLED_BUILD = (\d+);/)[1]), 0, '仓库里的 sw.js 应保持 BUNDLED_BUILD=0');
eq(Number(readFileSync('en/sw.js', 'utf8').match(/const BUNDLED_BUILD = (\d+);/)[1]), 0, '仓库里的 en/sw.js 应保持 BUNDLED_BUILD=0');

/* ══════ ② 远端不比本地新 → 什么都不做 ══════ */
{
  const caches = makeCaches();
  const ctx = load(caches, serveJson(makeBundle(0)));
  const r = await ctx.window.WolfHotUpdate.check({ manual: true });
  eq(r.status, 'current', '远端构建号不大于本地时应报 current');
  eq(caches._store.size, 0, 'current 时不应写任何缓存');
}

/* ══════ ③ 正常更新 → 全部文件落缓存，manifest 最后写 ══════ */
{
  const caches = makeCaches();
  const ctx = load(caches, serveJson(makeBundle(77)));
  const r = await ctx.window.WolfHotUpdate.check({ manual: true });
  eq(r.status, 'staged', '有新版时应报 staged');
  const cache = caches._store.get(HOT);
  ok(cache, '应创建热更新缓存');
  ok(cache.has('https://localhost/index.html'), 'index.html 应按站点根写入');
  ok(cache.has('https://localhost/en/index.html'), 'en/index.html 应保留子目录');
  ok(cache.has(MANIFEST), 'manifest 应按站点根写入绝对 URL');
  eq([...cache.keys()].pop(), MANIFEST, 'manifest 必须最后写（保证「有 manifest = 文件齐」）');
  ok(cache.get('https://localhost/index.html').headers['content-type'].startsWith('text/html'),
    'html 应带 text/html 内容类型');
}

/* ══════ ④ 内容被改动 → 整包拒绝，一个字节都不落盘 ══════ */
{
  const caches = makeCaches();
  const ctx = load(caches, serveJson(makeBundle(78, { corrupt: true })));
  let threw = false;
  try { await ctx.window.WolfHotUpdate.check({ manual: true }); } catch (e) { threw = true; }
  ok(threw, '校验不过应抛错');
  const cache = caches._store.get(HOT);
  ok(!cache || !cache.has(MANIFEST), '校验失败绝不能留下 manifest');
  ok(!cache || cache.size === 0, '校验失败应完全不写缓存，避免半个版本');
}

/* ══════ ⑤ 新网页要求更高的原生 ABI → 不热更新，提示重装 ══════ */
{
  const caches = makeCaches();
  const ctx = load(caches, serveJson(makeBundle(79, { minNative: 99 })));
  const r = await ctx.window.WolfHotUpdate.check({ manual: true });
  eq(r.status, 'needs-apk', '原生 ABI 不够时应报 needs-apk');
  eq(caches._store.size, 0, 'needs-apk 时不应写缓存');
}

/* ══════ ⑥ /en/ 下的副本也必须按站点根写缓存键 ══════ */
{
  const caches = makeCaches();
  const ctx = load(caches, serveJson(makeBundle(80)), { pathname: '/en/index.html' });
  await ctx.window.WolfHotUpdate.check({ manual: true });
  const cache = caches._store.get(HOT);
  ok(cache.has('https://localhost/index.html'), 'en 客户端不能把 index.html 写成 /en/index.html');
  ok(cache.has('https://localhost/en/index.html'), 'en 客户端仍要写 /en/index.html');
  ok(cache.has(MANIFEST), 'en 客户端的 manifest 也必须写在站点根');
}

/* ══════ ⑦ SW 闸门：热更新包必须严格新于内置版本才生效 ══════ */
for (const [file, navUrl] of [['sw.js', 'https://localhost/'], ['en/sw.js', 'https://localhost/en/']]) {
  for (const [bundled, hot, serveHot] of [[10, 20, true], [20, 20, false], [30, 20, false]]) {
    const caches = makeCaches();
    const root = caches.view('https://localhost/');
    const c = await root.open(HOT);
    await c.put(navUrl + 'index.html', new Response('HOT', { headers: { 'Content-Type': 'text/html' } }));
    await c.put(MANIFEST, new Response(JSON.stringify({ build: hot })));

    const tmp = 'dist-hot/.test-' + file.replace('/', '-');
    writeFileSync(tmp, readFileSync(file, 'utf8').replace(/const BUNDLED_BUILD = \d+;/, `const BUNDLED_BUILD = ${bundled};`));
    // href 决定 SW 怎么算站点根：/en/sw.js 必须回退到根去找 manifest
    const sw = loadSw(tmp, { caches, href: 'https://localhost/' + file });
    eq(await (await sw.serve(navUrl)).text(), serveHot ? 'HOT' : 'BUNDLED',
      `${file}：内置 ${bundled} vs 热更新 ${hot} 应返回${serveHot ? '热更新' : '内置'}版本`);
  }
}

/* ══════ ⑧ SW 归一化：目录形式、带 query 的导航都要命中同一个缓存键 ══════ */
{
  const caches = makeCaches();
  const c = await caches.view('https://localhost/').open(HOT);
  await c.put('https://localhost/index.html', new Response('HOT', { headers: { 'Content-Type': 'text/html' } }));
  await c.put(MANIFEST, new Response(JSON.stringify({ build: 20 })));
  const tmp = 'dist-hot/.test-norm-sw.js';
  writeFileSync(tmp, readFileSync('sw.js', 'utf8').replace(/const BUNDLED_BUILD = \d+;/, 'const BUNDLED_BUILD = 1;'));
  const sw = loadSw(tmp, { caches, href: 'https://localhost/sw.js' });
  for (const u of ['https://localhost/', 'https://localhost/index.html', 'https://localhost/?x=1']) {
    eq(await (await sw.serve(u)).text(), 'HOT', `导航 ${u} 应命中热更新缓存`);
  }
}

/* ══════ ⑨ 启动守护：热更新包连续启动失败达上限后自动回滚 ══════ */
{
  const caches = makeCaches();
  const c = await caches.view('https://localhost/').open(HOT);
  await c.put(MANIFEST, new Response(JSON.stringify({ build: 55 })));
  const ls = makeStorage();
  const src = stampedWith(55);
  let reloaded = false;
  for (let i = 1; i <= 4; i++) {   // 4 次都没走到 markBootOk
    const ctx = load(caches, async () => new Response('{}'), { localStorage: ls, source: src });
    await new Promise(r => setImmediate(r));   // 等 bootGuard 的异步链跑完
    if (ctx.__reloaded) reloaded = true;
  }
  ok(reloaded, '连续启动失败达上限后应回滚并重载');
  ok(!caches._store.has(HOT) || caches._store.get(HOT).size === 0, '回滚应清空热更新缓存');
}

/* ══════ ⑩ 启动成功打点后，再启动多少次都不回滚 ══════ */
{
  const caches = makeCaches();
  const c = await caches.view('https://localhost/').open(HOT);
  await c.put(MANIFEST, new Response(JSON.stringify({ build: 66 })));
  const ls = makeStorage();
  const src = stampedWith(66);
  let reloaded = false;
  for (let i = 0; i < 6; i++) {
    const ctx = load(caches, async () => new Response('{}'), { localStorage: ls, source: src });
    await new Promise(r => setImmediate(r));
    ctx.window.WolfHotUpdate.markBootOk();     // 主脚本完整跑完
    if (ctx.__reloaded) reloaded = true;
  }
  ok(!reloaded, '已确认可正常启动的构建不应再被回滚');
  ok(caches._store.get(HOT).has(MANIFEST), '正常启动不应清掉热更新缓存');
}

/* ══════ ⑪ 内置版本自身崩溃时绝不能被当成热更新失败反复重载 ══════ */
{
  const caches = makeCaches();     // 没有任何热更新缓存 = 跑的是内置版本
  const ls = makeStorage();
  let reloaded = false;
  for (let i = 0; i < 6; i++) {
    const ctx = load(caches, async () => new Response('{}'), { localStorage: ls, source: stampedWith(70) });
    await new Promise(r => setImmediate(r));
    if (ctx.__reloaded) reloaded = true;
  }
  ok(!reloaded, '内置版本启动失败与热更新无关，不能触发重载循环');
}

/* ══════ ⑫ 两个客户端的 hot-update.js 必须逐字一致，避免只改了一边 ══════ */
ok(HOT_SRC === readFileSync('en/hot-update.js', 'utf8'), 'en/hot-update.js 必须与根目录版本逐字一致');

console.log(`hot update: ${passed} 项检查通过`);
