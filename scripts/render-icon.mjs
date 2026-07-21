// 从 icons/icon.svg 渲染出 @capacitor/assets 需要的源图（在 CI 里跑，sharp 联网可用）。
//   assets/icon.png        —— 1024 满幅图标（深底居中狼头，圆形/方形遮罩都好看）
//   assets/splash.png/-dark —— 2732 深色启动图，狼头居中，避免开屏白闪
import sharp from 'sharp';
import fs from 'node:fs';

fs.mkdirSync('assets', { recursive: true });
const svg = fs.readFileSync('icons/icon.svg');
const BG = { r: 10, g: 10, b: 20, alpha: 1 }; // #0a0a14，与 manifest 背景色一致

// 1024 图标（满幅，本身就是深底，遮罩成圆也只露出狼头+深底）
await sharp(svg, { density: 600 }).resize(1024, 1024).png().toFile('assets/icon.png');

// 启动图：2732 深色画布 + 居中狼头 ~980px
const wolf = await sharp(svg, { density: 600 }).resize(980, 980).png().toBuffer();
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
  .composite([{ input: wolf, gravity: 'center' }])
  .png()
  .toFile('assets/splash.png');
fs.copyFileSync('assets/splash.png', 'assets/splash-dark.png');

console.log('✅ 已生成 assets/icon.png + splash.png + splash-dark.png');
