import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const mapSource = fs.readFileSync('action-cg.js', 'utf8');
const mappedFiles = [...mapSource.matchAll(/\bsrc:'([^']+)'/g)].map(match => match[1]);
const dir = path.join('assets', 'action-cg');

for (const mappedFile of mappedFiles) {
  const pngFile = mappedFile.replace(/\.webp$/i, '.png');
  const source = path.join(dir, pngFile);
  const output = path.join(dir, pngFile.replace(/\.png$/i, '.webp'));
  if (!fs.existsSync(source)) {
    console.error(`❌ PNG 源图缺失：${source}`);
    process.exit(1);
  }
  await sharp(source).webp({ quality: 90, effort: 6 }).toFile(output);
  console.log(`✓ ${path.basename(output)}`);
}

console.log(`✅ 已优化 ${mappedFiles.length} 张行动 CG`);
