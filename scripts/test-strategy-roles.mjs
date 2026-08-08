import fs from 'node:fs';

const clients = ['index.html', 'en/index.html'];
const roles = ['gravekeeper', 'dreamwalker', 'alchemist', 'gargoyle', 'soulwarden'];
const fail = [];

function expect(ok, message) {
  if (!ok) fail.push(message);
}

for (const file of clients) {
  const src = fs.readFileSync(file, 'utf8');
  for (const role of roles) expect(src.includes(`id:'${role}'`), `${file}: missing ${role} registration`);
  expect(src.includes('dreamTarget:null, dreamNightmare:null'), `${file}: missing dream state`);
  expect(src.includes('alchemistMist:null, alchemistMode:null, alchemistSave:null'), `${file}: missing alchemist state`);
  expect(src.indexOf("nightStep('alchemist-plan'") < src.indexOf("nightStep('wolf-kill'"), `${file}: mist must precede wolf attack`);
  expect(src.indexOf("nightStep('magic-swap'") < src.indexOf("nightStep('alchemist-rescue'"), `${file}: serpent must see redirected attack`);
  const magicianSteps = [...src.matchAll(/nightStep\('magician'/g)].map(match => match.index);
  const wolfKillSteps = [...src.matchAll(/nightStep\('wolf-kill'/g)].map(match => match.index);
  expect(magicianSteps.length >= 2 && wolfKillSteps.length >= 2, `${file}: missing repeated night order steps`);
  expect(magicianSteps.every((position, index) => position < wolfKillSteps[index]), `${file}: magician must act before wolf attack`);
  expect(src.includes('魔术师在狼刀确定前行动') || src.includes('每晚【在狼刀确定前】行动'), `${file}: magician timing wording not updated`);
  expect(!src.includes('魔术师最先行动') && !src.includes('每晚最先行动') && !src.includes('每晚【最先】行动'), `${file}: stale absolute-first magician wording`);
  expect(src.includes("p.role.id!=='mechwolf' && p.role.id!=='gargoyle'"), `${file}: pack must exclude isolated wolves`);
  expect(src.includes("role.id !== 'mechwolf' && role.id !== 'gargoyle'"), `${file}: shared wolf vision must exclude isolated wolves`);
  expect(src.includes("cause:'dreamkill'"), `${file}: missing lethal second-dream settlement`);
  expect(src.includes("cause:'dreamlink'"), `${file}: missing dreamer death link`);
  expect(src.includes('alchemistBlocked = S.nightData.alchemistSave'), `${file}: missing serpent rescue settlement`);
  expect(src.includes('sanctuaryTarget:null, sanctuaryUsed:false, sanctuaryBlocked:null'), `${file}: missing sanctuary state`);
  expect(src.indexOf("nightStep('wolfconcubine'") < src.indexOf("nightStep('soulwarden'"), `${file}: Soul Warden must act after Eclipse Consort`);
  expect(src.indexOf("nightStep('soulwarden'") < src.indexOf("nightStep('fox'"), `${file}: Soul Warden cleansing must resolve before later good actions`);
  expect(src.includes("consumeSanctuaryMark(attemptedCharm, 'wolfbeauty')"), `${file}: Wolf Beauty charm must use sanctuary interception`);
  expect(src.includes("consumeSanctuaryMark(t.id, 'wolfconcubine')"), `${file}: Eclipse Consort mark must be cleansable`);
  expect(src.includes("case 'sanctuary-block'"), `${file}: missing god-view sanctuary record formatter`);
}

const map = fs.readFileSync('action-cg.js', 'utf8');
for (const key of ['gravekeeper','dreamwalker','dreamwalkerNightmare','alchemist','alchemistRescue','gargoyle','gargoyleAwaken','soulwarden']) {
  expect(new RegExp('\\b'+key+'\\s*:').test(map), `action-cg.js: missing ${key}`);
}
for (const file of [
  'gravekeeper-revelation-v1.webp','dreamwalker-protection-v1.webp','dreamwalker-nightmare-v1.webp',
  'alchemist-mist-v1.webp','alchemist-serpent-v1.webp','gargoyle-scry-v1.webp','gargoyle-awakening-v1.webp',
  'soulwarden-sanctuary-v1.webp'
]) expect(fs.existsSync('assets/action-cg/'+file), `missing action CG ${file}`);
for (const role of roles) expect(fs.existsSync('icons/roles/'+role+'.jpg'), `missing portrait ${role}.jpg`);

if (fail.length) {
  console.error(fail.map(x=>'✗ '+x).join('\n'));
  process.exit(1);
}
console.log('strategy roles: registrations, isolation, settlement order and artwork passed');
