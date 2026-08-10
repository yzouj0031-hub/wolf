import fs from 'node:fs';

const failures = [];
const expect = (ok, message) => { if (!ok) failures.push(message); };

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');

  expect(src.includes('【跳身份收益账·默认隐藏】'), `${file}: witch guide does not default to hiding`);
  expect(src.includes('使用解药不等于必须跳身份'), `${file}: antidote use still implies disclosure`);
  expect(src.includes('行动事实不等于公开自证'), `${file}: private action and public proof are not separated`);
  expect(src.includes('摄梦等其他保护可以和解药同时作用而只是重复保护'), `${file}: dream protection overlap is unclear`);
  expect(!src.includes('【女巫的跳身份资本】'), `${file}: old pro-disclosure witch section remains`);
  expect(!src.includes('能洗清他、同时自证'), `${file}: witch claim still promises automatic self-proof`);

  expect(src.includes('【先后手不是身份公式】'), `${file}: counterclaim timing is still treated as a formula`);
  expect(src.includes('论证错不等于身份假，论证对也不等于身份真'), `${file}: identity and reasoning are not separated`);
  expect(!src.includes('嫌疑权重:后跳 > 先跳'), `${file}: late claimant still receives a fixed suspicion penalty`);

  expect(src.includes('公开发言不设短回复目标：普通轮次也要把立场、具体依据和票意说完整'), `${file}: free-output prompt still permits an underspecified ordinary speech`);
  expect(!src.includes('长度由你自己控制——通常 100-200 字'), `${file}: obsolete 100-200 character anchor remains`);
}

const source = fs.readFileSync('teaching-worldbooks.js', 'utf8');
expect(source.includes('【身份、行动事实与推理分开】'), 'official worldbook lacks perspective separation');
expect(source.includes('石像鬼等能获知具体身份的角色'), 'official worldbook ignores exact-role informed counterclaims');
expect(source.includes('【女巫默认隐藏】'), 'official good-team worldbook still encourages witch disclosure');
expect(!source.includes('预言家、女巫等若继续沉默会让假神长期控制归票和错误信息，通常应带着真实记录回应'), 'old generic reveal instruction remains');

const preset = JSON.parse(fs.readFileSync('worldbook_ryuzaki_masterclass.json', 'utf8'));
const byId = Object.fromEntries(preset.worldbooks.map(book => [book.id, book.content]));
expect(byId.wb_advanced_evidence_endgame?.includes('身份、行动事实与推理分开'), 'exportable preset lacks identity/reasoning separation');
expect(byId.wb_advanced_good_counterclaim?.includes('【女巫默认隐藏】'), 'exportable preset lacks conservative witch disclosure');

if (failures.length) {
  console.error(failures.map(message => `FAIL ${message}`).join('\n'));
  process.exit(1);
}

console.log('witch guidance: hidden-by-default disclosure, perspective separation and complete public speech passed');
