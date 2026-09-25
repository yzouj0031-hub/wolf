// 页面脚本引用的完整性：
// 1. index.html / en/index.html 里每个本地 <script src> 都指向真实存在的文件。
//    曾经 en/index.html 写成 "replay-generator.js"（实际在根目录），英文版一直 404，
//    「导出复盘」悄悄退回旧版。
// 2. 每个被引用的脚本都会被 build-www 打进 APK / 热更新包。
//    replay-generator.js 曾经不在 FILES 里，APK 里中英文都缺这个文件。
// 3. js/ 共用模块的加载位置：原本写在启动代码之后、会接管主脚本函数的，必须在主脚本之后加载；
//    其余必须在主脚本之前（主脚本末尾的启动代码会直接用到它们）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const build = fs.readFileSync('scripts/build-www.mjs', 'utf8');
const files = new Set([...build.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const dirs = [...build.match(/const DIRS = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const packaged = rel => files.has(rel) || dirs.some(d => rel === d || rel.startsWith(d + '/'));

const AFTER_MAIN = ['name-pool.js', 'api-vault.js', 'character-generator.js', 'permanent-memory.js'];
const MAIN_MARK = '<script>\n\n/* ===== AI社交博弈认知规则 ===== */';

for (const page of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(page, 'utf8');
  const dir = path.dirname(page);
  const main = html.indexOf(MAIN_MARK);
  assert.ok(main >= 0, `${page}: 主脚本起点未找到`);
  const mainEnd = html.indexOf('</script>', main);
  let sharedCount = 0;
  for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
    if (/^(?:https?:)?\/\//.test(m[1])) continue;
    const rel = path.posix.normalize(path.posix.join(dir, m[1].replace(/\?.*$/, '')));
    assert.ok(fs.existsSync(rel), `${page}: <script src="${m[1]}"> 指向不存在的文件 ${rel}`);
    assert.ok(packaged(rel), `${page}: ${rel} 没有被 scripts/build-www.mjs 打包进 APK`);
    if (rel.startsWith('js/') && rel !== 'js/demo-match.js') {
      sharedCount++;
      const after = AFTER_MAIN.includes(path.basename(rel));
      assert.ok(after ? m.index > mainEnd : m.index < main,
        `${page}: ${rel} 必须在主脚本${after ? '之后' : '之前'}加载`);
    }
  }
  assert.ok(sharedCount >= 10, `${page}: js/ 共用模块没有全部加载（${sharedCount}）`);
}

// 两个页面加载的 js/ 模块必须是同一套
const shared = p => [...fs.readFileSync(p, 'utf8').matchAll(/<script src="(?:\.\.?\/)?(js\/[^"]+)"/g)].map(m => m[1]);
assert.deepEqual(shared('en/index.html'), shared('index.html'), '中英文页面加载的 js/ 共用模块不一致');

console.log('page scripts: every local script exists, is packaged, and shared modules load in the right place');
