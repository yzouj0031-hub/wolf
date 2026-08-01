// 把构建号 / 版本号写进网页资源，供热更新比对使用。
//
//   node scripts/stamp-build.mjs <build> <version>
//
// 仓库里的源文件始终保留占位值（build=0 / version='dev'），只有 CI 在打包和发布时
// 才把真实值写进去。这样本地开发的构建号永远是 0，绝不会误判成「已是最新」。
//
// 被写入的位置：
//   hot-update.js / en/hot-update.js  →  APP_BUILD、APP_VERSION（当前正在运行的版本）
//   sw.js / en/sw.js                  →  BUNDLED_BUILD（安装包内置版本，热更新的比较基准）
//
// 这两处必须同时写、写同一个值：sw.js 只在「热更新包 build > BUNDLED_BUILD」时才
// 启用热更新包，如果只写了 hot-update.js，装上新 APK 之后旧热更新包会一直压着新包。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const build = Number(process.argv[2]);
const version = process.argv[3];

if (!Number.isInteger(build) || build <= 0) {
  console.error('❌ 用法：node scripts/stamp-build.mjs <build 正整数> <version 字符串>');
  process.exit(1);
}
if (!version) {
  console.error('❌ 缺少 version 参数');
  process.exit(1);
}

// 版本号会被写进 JS 单引号字符串，先挡掉能破坏字面量的字符。
if (/['\\\r\n]/.test(version)) {
  console.error('❌ version 不能包含单引号、反斜杠或换行');
  process.exit(1);
}

const edits = [
  {
    file: 'hot-update.js',
    subs: [
      [/const APP_BUILD = \d+;/, `const APP_BUILD = ${build};`],
      [/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`]
    ]
  },
  {
    file: 'en/hot-update.js',
    subs: [
      [/const APP_BUILD = \d+;/, `const APP_BUILD = ${build};`],
      [/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${version}';`]
    ]
  },
  { file: 'sw.js', subs: [[/const BUNDLED_BUILD = \d+;/, `const BUNDLED_BUILD = ${build};`]] },
  { file: 'en/sw.js', subs: [[/const BUNDLED_BUILD = \d+;/, `const BUNDLED_BUILD = ${build};`]] }
];

const missing = edits.filter(e => !existsSync(e.file)).map(e => e.file);
if (missing.length) {
  console.error('❌ 缺少必须写入的文件：' + missing.join('、'));
  process.exit(1);
}

for (const { file, subs } of edits) {
  let text = readFileSync(file, 'utf8');
  for (const [re, replacement] of subs) {
    if (!re.test(text)) {
      console.error(`❌ ${file} 里找不到占位符：${re}`);
      process.exit(1);
    }
    text = text.replace(re, replacement);
  }
  writeFileSync(file, text);
}

console.log(`✅ 已写入 build=${build} version=${version}（${edits.length} 个文件）`);
