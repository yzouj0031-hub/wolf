// 生成热更新包：dist-hot/version.json（小清单）+ dist-hot/bundle.zip（整个网页目录）。
//
//   node scripts/stamp-build.mjs <build> <version>   # 先写入构建号
//   node scripts/make-hot-bundle.mjs <build> <version>
//
// 客户端先拉 version.json（约 1KB）比对构建号，只有确实有新版才去下 bundle.zip。
//
// zip 的内容【必须】和打进 APK 的 www/ 完全一致：CapacitorUpdater 是整目录替换的，
// zip 里没有的文件在换包之后就不存在了。所以这里直接复用 build-www.mjs 的产物，
// 而不是另维护一份文件清单——两边一旦不同步，热更新后就会缺文件。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const build = Number(process.argv[2]);
const version = process.argv[3];

if (!Number.isInteger(build) || build <= 0 || !version) {
  console.error('❌ 用法：node scripts/make-hot-bundle.mjs <build 正整数> <version 字符串>');
  process.exit(1);
}

// 原生壳 ABI 从 hot-update.js 里读，保证「网页要求的 ABI」和代码里写的永远一致。
const selfSrc = readFileSync('hot-update.js', 'utf8');
const abiMatch = selfSrc.match(/const NATIVE_ABI = (\d+);/);
if (!abiMatch) {
  console.error('❌ hot-update.js 里找不到 NATIVE_ABI');
  process.exit(1);
}
const minNative = Number(abiMatch[1]);

// 构建号必须已经写进 hot-update.js，否则包里的 APP_BUILD 还是 0，
// 装上之后会立刻又把自己判成"有新版"，陷入反复下载。
const stamped = selfSrc.match(/const APP_BUILD = (\d+);/);
if (!stamped || Number(stamped[1]) !== build) {
  console.error(`❌ hot-update.js 的 APP_BUILD 是 ${stamped ? stamped[1] : '缺失'}，与 build=${build} 不符；请先跑 stamp-build.mjs`);
  process.exit(1);
}

// 用与 APK 完全相同的方式收集网页资源
execFileSync('node', ['scripts/build-www.mjs'], { stdio: 'inherit' });
if (!existsSync('www/index.html')) {
  console.error('❌ www/index.html 缺失');
  process.exit(1);
}

rmSync('dist-hot', { recursive: true, force: true });
mkdirSync('dist-hot', { recursive: true });

// -r 递归、-q 安静、-X 不存额外属性（让同样内容产出稳定的包）
// 在 www/ 内部打包，保证 zip 根目录直接是 index.html 而不是套一层 www/
execFileSync('zip', ['-r', '-q', '-X', '../dist-hot/bundle.zip', '.'], { cwd: 'www' });

const zip = readFileSync('dist-hot/bundle.zip');
const sha256 = createHash('sha256').update(zip).digest('hex');

const meta = {
  build,
  version,
  minNative,
  time: Date.now(),
  size: zip.length,
  sha256,
  zipUrl: 'https://github.com/yzouj0031-hub/wolf/releases/download/web-latest/bundle.zip'
};
writeFileSync('dist-hot/version.json', JSON.stringify(meta));

const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB';
console.log(`✅ 热更新包已生成 build=${build} version=${version} minNative=${minNative}`);
console.log(`   bundle.zip ${mb(zip.length)}  sha256 ${sha256.slice(0, 16)}…`);
