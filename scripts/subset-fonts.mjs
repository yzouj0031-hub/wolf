import fs from 'node:fs';
import path from 'node:path';
import Fontmin from 'fontmin'; // requires: npm install fontmin --save-dev

const scanFiles = ['index.html', 'en/index.html', 'i18n.js', 'mystery.js', 'en/mystery.js'];
let chars = new Set();

for (const file of scanFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    for (const char of content) {
      if (char.trim() !== '') {
        chars.add(char);
      }
    }
  }
}

// Minimal common characters list
const commonChars = "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质向道命此变条只没结建太最候起看起看";
for (const char of commonChars) {
  chars.add(char);
}

const text = Array.from(chars).join('');
console.log(`Extracted ${text.length} unique characters.`);

const srcPath = 'assets/fonts/src/*.ttf';
const destPath = 'assets/fonts/subset/';

if (!fs.existsSync('assets/fonts/src')) {
  console.error("❌ Please create 'assets/fonts/src' and place your TTF files there.");
  process.exit(1);
}

const fontmin = new Fontmin()
    .src(srcPath)
    .use(Fontmin.glyph({ text: text, hinting: false }))
    .use(Fontmin.ttf2woff2())
    .dest(destPath);

fontmin.run((err, files) => {
    if (err) throw err;
    console.log(`✅ Subset fonts generated in ${destPath}`);
});
