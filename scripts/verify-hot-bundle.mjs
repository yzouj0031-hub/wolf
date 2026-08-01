// 复核 dist-hot/ 的产物，把坏包挡在 CI 里而不是挡在用户手机上。
//
// CapacitorUpdater 是【整目录替换】：zip 里缺什么，换包之后就没有什么。所以这里重点
// 检查包的完整性和结构，而不只是校验和对不对得上。
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const fail = msg => { console.error('❌ ' + msg); process.exit(1); };

for (const f of ['dist-hot/version.json', 'dist-hot/bundle.zip']) {
  if (!existsSync(f)) fail(`缺少产物：${f}`);
}

const meta = JSON.parse(readFileSync('dist-hot/version.json', 'utf8'));
if (!Number.isInteger(meta.build) || meta.build <= 0) fail('version.json 的 build 非法');
if (!meta.version) fail('version.json 缺少 version');
if (!Number.isInteger(meta.minNative) || meta.minNative < 1) fail('version.json 的 minNative 非法');
if (!/^https:\/\//.test(meta.zipUrl || '')) fail('version.json 的 zipUrl 必须是 https 绝对地址');

const zip = readFileSync('dist-hot/bundle.zip');
if (zip.length !== meta.size) fail(`zip 大小 ${zip.length} 与清单 ${meta.size} 不符`);
const sha = createHash('sha256').update(zip).digest('hex');
if (sha !== meta.sha256) fail(`zip 校验和不符：${sha} vs ${meta.sha256}`);

// 列出包内文件；插件按 zip 根目录展开，多套一层 www/ 会导致换包后整个页面 404
const listing = execFileSync('unzip', ['-Z1', 'dist-hot/bundle.zip'], { encoding: 'utf8' })
  .split('\n').map(s => s.trim()).filter(Boolean);

if (!listing.includes('index.html')) fail('zip 根目录没有 index.html（可能多套了一层目录）');
if (listing.some(p => p.startsWith('www/'))) fail('zip 里多套了一层 www/，插件展开后路径会全错');

// 换包是整目录替换，这些少一个都会让新版本跑不起来
for (const must of ['i18n.js', 'hot-update.js', 'native-http.js', 'en/index.html', 'en/i18n.js', 'en/hot-update.js']) {
  if (!listing.includes(must)) fail(`zip 里缺少必需文件：${must}`);
}

// 卡片插画和角色立绘都要在，否则换包之后大厅和图鉴会变成空图
const modeArt = listing.filter(p => /^icons\/modes\/.+\.jpg$/.test(p)).length;
const roleArt = listing.filter(p => /^icons\/roles\/.+\.jpg$/.test(p)).length;
if (modeArt < 11) fail(`zip 里模式卡图只有 ${modeArt} 张，应为 11 张`);
if (roleArt < 21) fail(`zip 里角色立绘只有 ${roleArt} 张，应为 21 张`);

// 包内的 hot-update.js 必须已经写上本次构建号，否则装上后会立刻又判成「有新版」反复下载
const stamped = execFileSync('unzip', ['-p', 'dist-hot/bundle.zip', 'hot-update.js'], { encoding: 'utf8' });
const build = stamped.match(/const APP_BUILD = (\d+);/);
if (!build) fail('包内 hot-update.js 找不到 APP_BUILD');
if (Number(build[1]) !== meta.build) fail(`包内 APP_BUILD=${build[1]} 与 build=${meta.build} 不符`);
const abi = stamped.match(/const NATIVE_ABI = (\d+);/);
if (!abi || Number(abi[1]) !== meta.minNative) fail(`包内 NATIVE_ABI 与清单 minNative=${meta.minNative} 不符`);

const mb = (zip.length / 1024 / 1024).toFixed(2);
console.log(`✅ 热更新包校验通过：build=${meta.build} ${listing.length} 个条目 ${mb}MB` +
  `（模式卡 ${modeArt} 张 / 角色立绘 ${roleArt} 张）`);
