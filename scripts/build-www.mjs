// 把要打进 APK 的网页资源收集到 www/（Capacitor 的 webDir）。
// 只复制运行所需文件，避免把 .git / android / node_modules 一起塞进 App。
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'www';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 单文件资源
const FILES = [
  'index.html',
  'i18n.js',
  'hot-update.js',
  'manifest.webmanifest',
  'sw.js',
  'tablet.css',
  'role-effects.css',
  'role-effects.js',
  'native-http.js',
  'horror.html',
  'style-preview.html'
];
// 目录资源
const DIRS = ['icons', 'en'];

let n = 0;
for (const f of FILES) {
  if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(OUT, f)); n++; }
}
for (const d of DIRS) {
  if (fs.existsSync(d)) { fs.cpSync(d, path.join(OUT, d), { recursive: true }); n++; }
}

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  console.error('❌ www/index.html 缺失，打包会失败');
  process.exit(1);
}
console.log(`✅ www/ 构建完成，收集 ${n} 项资源`);
