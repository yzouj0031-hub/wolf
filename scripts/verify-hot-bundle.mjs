// 用客户端的校验方式复核 dist-hot/ 的产物，把坏包挡在 CI 里而不是挡在用户手机上。
//
// 客户端拿到的是 JSON 里的字符串，会用 TextEncoder 重新编码成 UTF-8 再算 SHA-256；
// 这里走一遍完全相同的路径（JSON 往返 → Buffer.from(text,'utf8') → sha256），
// 确保线上不会出现「每次更新都卡在校验失败」这种只有用户才能发现的问题。
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const fail = msg => { console.error('❌ ' + msg); process.exit(1); };

for (const f of ['dist-hot/version.json', 'dist-hot/bundle.json']) {
  if (!existsSync(f)) fail(`缺少产物：${f}`);
}

const meta = JSON.parse(readFileSync('dist-hot/version.json', 'utf8'));
const bundle = JSON.parse(readFileSync('dist-hot/bundle.json', 'utf8'));

if (!Number.isInteger(meta.build) || meta.build <= 0) fail('version.json 的 build 非法');
if (bundle.build !== meta.build) fail(`bundle.build(${bundle.build}) 与 version.build(${meta.build}) 不一致`);
if (bundle.version !== meta.version) fail('bundle.version 与 version.version 不一致');
if (!Number.isInteger(meta.minNative) || meta.minNative < 1) fail('version.json 的 minNative 非法');

const files = bundle.files || {};
const paths = Object.keys(files);
if (!paths.length) fail('更新包是空的');
if (!files['index.html']) fail('更新包里没有 index.html');

// sw.js 绝不能进热更新包：它是「安装包内置版本」的判定基准，
// 热更新改掉它就等于把自己的比较基准也改了，新 APK 将再也压不过旧热更新包。
for (const banned of ['sw.js', 'en/sw.js']) {
  if (files[banned]) fail(`${banned} 不允许出现在热更新包里`);
}

// 客户端把热更新包里的 hot-update.js 也一起换掉，所以包里的 APP_BUILD 必须等于本次构建号，
// 否则装上之后它会立刻又把自己判成「有新版」，陷入反复下载。
const abi = (files['hot-update.js'] || '').match(/const APP_BUILD = (\d+);/);
if (!abi) fail('更新包里的 hot-update.js 找不到 APP_BUILD');
if (Number(abi[1]) !== meta.build) fail(`包内 APP_BUILD=${abi[1]} 与 build=${meta.build} 不符`);

for (const path of paths) {
  const text = files[path];
  if (typeof text !== 'string') fail(`${path} 内容不是字符串`);
  const bytes = Buffer.from(text, 'utf8');

  const expectSize = meta.sizes && meta.sizes[path];
  if (expectSize == null) fail(`${path} 在 version.json 里没有 size`);
  if (bytes.length !== expectSize) fail(`${path} 长度不符：包内 ${bytes.length} vs 清单 ${expectSize}`);

  const expectHash = meta.sha256 && meta.sha256[path];
  if (!expectHash) fail(`${path} 在 version.json 里没有 sha256`);
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== expectHash) fail(`${path} 哈希不符：${got} vs ${expectHash}`);
}

// 清单里列了、包里却没有的文件会让客户端永远校验不过
for (const path of Object.keys(meta.sha256 || {})) {
  if (!(path in files)) fail(`清单里有 ${path}，更新包里却没有`);
}

const mb = (readFileSync('dist-hot/bundle.json').length / 1024 / 1024).toFixed(2);
console.log(`✅ 热更新包校验通过：build=${meta.build} ${paths.length} 个文件 bundle.json ${mb}MB`);
