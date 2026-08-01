// 从现有角色立绘裁出大厅模式卡用的小图，输出到 icons/modes/。
//
//   node scripts/make-mode-art.mjs
//
// 为什么是裁剪而不是直接用原图：
//   · 原图每张约 1MB（21 张共 18MB），11 张铺到主菜单要加载 8MB，手机上不可接受。
//   · 原图本身画了一圈金色画框 + 底部名牌，塞进卡片会变成「框里套框」，还会露出
//     英文角色名。这里按比例裁掉外框和名牌，只留中间的人物。
//
// 不新增任何美术资源，纯粹是对已有立绘的再利用。
import sharp from 'sharp';
import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = 'icons/roles';
const OUT_DIR = 'icons/modes';

// 模式 → 借用哪张角色立绘。挑的是能代表该模式的标志性角色。
const MAP = {
  standard:  'werewolf',      // 十人局 · 经典狼
  super:     'wolfbeauty',    // 十二人局 · 含狼美
  mega:      'wolfking',      // 十四人局 · 含狼王
  chaos12:   'jester',        // 诡术局 · 小丑
  chaos14:   'serialkiller',  // 血案局 · 连环杀手
  cupid14:   'cupid',         // 红线局 · 丘比特
  custom:    'magician',      // 自定 · 自由变化
  pureai:    'seer',          // 天机 · 洞察全局
  customai:  'knight',        // 斗蛐蛐 · 对抗
  groupchat: 'merchant',      // 群聊 · 热闹社交
  mystery:   'fox'            // 剧本杀 · 搜证探查
};

// 立绘四周的装饰画框占比（按各图自身尺寸的比例裁，兼容不同分辨率的源图）。
// 底部留得多一些，是为了连同名牌（有的图上印着 THE SEER 之类英文）一起裁掉。
const CROP = { left: 0.095, right: 0.095, top: 0.080, bottom: 0.135 };

// 卡片显示宽度约 180px，按 2 倍屏取 360px 足够清晰；再大只是白白增加体积。
const OUT_W = 360;
const OUT_H = 480;
const QUALITY = 72;
// 归一化后的目标平均亮度（0-255）。原图偏暗，压到卡片上再叠遮罩会看不清。
const TARGET_MEAN = 92;

if (!existsSync(SRC_DIR)) {
  console.error(`❌ 找不到源目录 ${SRC_DIR}`);
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
const missing = [];

for (const [mode, role] of Object.entries(MAP)) {
  const src = path.join(SRC_DIR, role + '.jpg');
  if (!existsSync(src)) { missing.push(`${mode} → ${src}`); continue; }

  const img = sharp(src);
  const { width, height } = await img.metadata();
  if (!width || !height) { missing.push(`${mode} → ${src}（读不到尺寸）`); continue; }

  const left = Math.round(width * CROP.left);
  const top = Math.round(height * CROP.top);
  const w = Math.round(width * (1 - CROP.left - CROP.right));
  const h = Math.round(height * (1 - CROP.top - CROP.bottom));

  // 各张立绘明暗差别很大（小丑/连环杀手那几张明显更暗），直接缩图会让卡片一片糊。
  // 这里量出实际平均亮度，按目标值补一个亮度系数，让 11 张卡看上去是一套的。
  const stats = await sharp(src).stats();
  const mean = stats.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3;
  const boost = Math.min(1.75, Math.max(1, TARGET_MEAN / Math.max(mean, 1)));

  const out = path.join(OUT_DIR, mode + '.jpg');
  await img
    .extract({ left, top, width: w, height: h })
    // position top：人物的脸通常在上半部分，从顶部对齐裁切比居中更不容易切掉头
    .resize(OUT_W, OUT_H, { fit: 'cover', position: 'top' })
    .modulate({ brightness: boost })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(out);

  const size = statSync(out).size;
  total += size;
  console.log(`  ${mode.padEnd(10)} ← ${role.padEnd(13)} ${(size / 1024).toFixed(0)}KB  亮度 ${mean.toFixed(0)}→x${boost.toFixed(2)}`);
}

if (missing.length) {
  console.error('❌ 以下模式没能生成卡图：\n  ' + missing.join('\n  '));
  process.exit(1);
}

const count = readdirSync(OUT_DIR).filter(f => f.endsWith('.jpg')).length;
console.log(`✅ ${count} 张模式卡图已生成，合计 ${(total / 1024).toFixed(0)}KB（源图 18MB）`);
