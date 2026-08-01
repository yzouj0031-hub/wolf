// 生成热更新包：dist-hot/version.json（小清单）+ dist-hot/bundle.json（整包内容）。
//
//   node scripts/stamp-build.mjs <build> <version>   # 先写入构建号
//   node scripts/make-hot-bundle.mjs <build> <version>
//
// 客户端先拉 version.json（约 1KB）比对构建号，只有确实有新版才去下 bundle.json。
//
// 刻意【不】包含：
//   sw.js / en/sw.js  —— 热更新写坏 Service Worker 会让整个 app 打不开，
//                        它只能随安装包更新。sw.js 里的 BUNDLED_BUILD 同时也是
//                        「安装包内置版本」的判定基准，热更新改了它就没有基准了。
//   icons/**          —— 体积大、几乎不变，且换图标本身就要重新打包。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const build = Number(process.argv[2]);
const version = process.argv[3];

if (!Number.isInteger(build) || build <= 0 || !version) {
  console.error('❌ 用法：node scripts/make-hot-bundle.mjs <build 正整数> <version 字符串>');
  process.exit(1);
}

const HOT_FILES = [
  'index.html',
  'i18n.js',
  'hot-update.js',
  'native-http.js',
  'role-effects.js',
  'role-effects.css',
  'tablet.css',
  'manifest.webmanifest',
  'horror.html',
  'en/index.html',
  'en/i18n.js',
  'en/hot-update.js',
  'en/native-http.js',
  'en/storage-scope.js',
  'en/role-effects.js',
  'en/role-effects.css',
  'en/tablet.css',
  'en/manifest.webmanifest',
  'en/horror.html'
];

// 原生壳 ABI 从 hot-update.js 里读，保证「网页要求的 ABI」和代码里写的永远一致。
const selfSrc = readFileSync('hot-update.js', 'utf8');
const abiMatch = selfSrc.match(/const NATIVE_ABI = (\d+);/);
if (!abiMatch) {
  console.error('❌ hot-update.js 里找不到 NATIVE_ABI');
  process.exit(1);
}
const minNative = Number(abiMatch[1]);

// 构建号必须已经写进 hot-update.js，否则热更新包里的 APP_BUILD 还是 0，
// 装上之后会立刻又把自己判成"有新版"，陷入反复下载。
const stamped = selfSrc.match(/const APP_BUILD = (\d+);/);
if (!stamped || Number(stamped[1]) !== build) {
  console.error(`❌ hot-update.js 的 APP_BUILD 是 ${stamped ? stamped[1] : '缺失'}，与 build=${build} 不符；请先跑 stamp-build.mjs`);
  process.exit(1);
}

const files = {};
const sha256 = {};
const sizes = {};
let total = 0;

for (const path of HOT_FILES) {
  if (!existsSync(path)) {
    console.warn(`⚠️  跳过不存在的文件：${path}`);
    continue;
  }
  const buf = readFileSync(path);
  const text = buf.toString('utf8');
  // 客户端是按 UTF-8 字符串重新编码后校验的，这里必须确认往返一致，
  // 否则哈希对不上会让每次更新都在校验这一步失败。
  if (!Buffer.from(text, 'utf8').equals(buf)) {
    console.error(`❌ ${path} 不是合法 UTF-8，无法放进 JSON 更新包`);
    process.exit(1);
  }
  files[path] = text;
  sha256[path] = createHash('sha256').update(buf).digest('hex');
  sizes[path] = buf.length;
  total += buf.length;
}

if (!files['index.html']) {
  console.error('❌ 更新包里没有 index.html，拒绝发布');
  process.exit(1);
}

const meta = { build, version, minNative, time: Date.now(), sha256, sizes };

rmSync('dist-hot', { recursive: true, force: true });
mkdirSync('dist-hot', { recursive: true });
writeFileSync('dist-hot/version.json', JSON.stringify(meta));
writeFileSync('dist-hot/bundle.json', JSON.stringify({ build, version, files }));

const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB';
console.log(`✅ 热更新包已生成 build=${build} version=${version} minNative=${minNative}`);
console.log(`   ${Object.keys(files).length} 个文件，原始 ${mb(total)}，bundle.json ${mb(readFileSync('dist-hot/bundle.json').length)}`);
