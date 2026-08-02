// Build every install surface from one high-resolution master.
// Keep the emblem inside Android's adaptive-icon safe zone so launcher masks
// (circle, squircle, rounded square) never crop the ears or moon.
import sharp from 'sharp';
import fs from 'node:fs';

const MASTER = 'icons/app-icon-master-v2.png';
// Sampled from the master artwork's outer edge so the safe-zone padding is seamless.
const BACKGROUND = { r: 2, g: 1, b: 13, alpha: 1 };

fs.mkdirSync('assets', { recursive: true });
fs.mkdirSync('icons', { recursive: true });

async function makeIcon(size) {
  const emblemSize = Math.round(size * 0.78);
  const emblem = await sharp(MASTER)
    .resize(emblemSize, emblemSize, { fit: 'cover' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: emblem, gravity: 'center' }])
    .png()
    .toBuffer();
}

const icon1024 = await makeIcon(1024);
await sharp(icon1024).toFile('assets/icon.png');
await sharp(icon1024).resize(512, 512).toFile('icons/icon-512.png');
await sharp(icon1024).resize(512, 512).toFile('icons/icon-maskable-512.png');
await sharp(icon1024).resize(192, 192).toFile('icons/icon-192.png');
await sharp(icon1024).resize(180, 180).toFile('icons/apple-touch-icon.png');

// Splash artwork stays restrained and centered against the same midnight base.
const splashEmblem = await sharp(icon1024).resize(980, 980).png().toBuffer();
await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: BACKGROUND,
  },
})
  .composite([{ input: splashEmblem, gravity: 'center' }])
  .png()
  .toFile('assets/splash.png');
fs.copyFileSync('assets/splash.png', 'assets/splash-dark.png');

console.log('Generated Android, PWA, Apple touch, and splash artwork from app-icon-master-v2.png');
