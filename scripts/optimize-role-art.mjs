// 把 icons/roles/ 的角色立绘压到实际显示需要的尺寸（就地覆盖，可重复运行）。
//
//   node scripts/optimize-role-art.mjs
//
// 为什么：这些图原始是 896x1200、每张约 1MB，21 张共 18MB，但界面上只用在 .ri0
// 那个 8px 内边距的横向列表小条的背景里（全项目仅此一处）。18MB 既撑大安装包，
// 也让热更新包（要装整个网页目录）大到没法用。
//
// 600px 宽对列表背景绰绰有余，同时给 make-mode-art.mjs 的裁剪留足余量
// （裁掉画框后约 490px 宽，缩到 360px 卡图仍是下采样，不会糊）。
import sharp from 'sharp';
import { readdirSync, statSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const DIR = 'icons/roles';
const MAX_W = 600;
const QUALITY = 78;

const files = readdirSync(DIR).filter(f => f.endsWith('.jpg'));
if (!files.length) {
  console.error(`❌ ${DIR} 里没有 jpg`);
  process.exit(1);
}

let before = 0, after = 0, skipped = 0;

for (const f of files) {
  const src = path.join(DIR, f);
  const sizeBefore = statSync(src).size;
  before += sizeBefore;

  const meta = await sharp(src).metadata();
  if ((meta.width || 0) <= MAX_W) {   // 已经压过了，重复运行不再劣化
    after += sizeBefore;
    skipped++;
    continue;
  }

  // sharp 不能就地读写同一个文件，先写临时文件再替换
  const tmp = src + '.tmp';
  await sharp(src)
    .resize({ width: MAX_W, withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(tmp);

  const sizeAfter = statSync(tmp).size;
  if (sizeAfter >= sizeBefore) {   // 压完反而更大就放弃，保留原图
    unlinkSync(tmp);
    after += sizeBefore;
    skipped++;
    continue;
  }
  renameSync(tmp, src);
  after += sizeAfter;
  console.log(`  ${f.padEnd(18)} ${(sizeBefore / 1024).toFixed(0)}KB → ${(sizeAfter / 1024).toFixed(0)}KB`);
}

const mb = n => (n / 1024 / 1024).toFixed(2) + 'MB';
console.log(`✅ ${files.length} 张角色立绘：${mb(before)} → ${mb(after)}` +
  (skipped ? `（${skipped} 张已是压缩过的，跳过）` : ''));
