import fs from 'node:fs';

const clients = ['index.html', 'en/index.html'];
const roles = ['gravekeeper', 'dreamwalker', 'alchemist', 'gargoyle'];
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
  expect(src.includes("p.role.id!=='mechwolf' && p.role.id!=='gargoyle'"), `${file}: pack must exclude isolated wolves`);
  expect(src.includes("role.id !== 'mechwolf' && role.id !== 'gargoyle'"), `${file}: shared wolf vision must exclude isolated wolves`);
  expect(src.includes("cause:'dreamkill'"), `${file}: missing lethal second-dream settlement`);
  expect(src.includes("cause:'dreamlink'"), `${file}: missing dreamer death link`);
  expect(src.includes('alchemistBlocked = S.nightData.alchemistSave'), `${file}: missing serpent rescue settlement`);
}

const map = fs.readFileSync('action-cg.js', 'utf8');
for (const key of ['gravekeeper','dreamwalker','dreamwalkerNightmare','alchemist','alchemistRescue','gargoyle','gargoyleAwaken']) {
  expect(new RegExp('\\b'+key+'\\s*:').test(map), `action-cg.js: missing ${key}`);
}
for (const file of [
  'gravekeeper-revelation-v1.webp','dreamwalker-protection-v1.webp','dreamwalker-nightmare-v1.webp',
  'alchemist-mist-v1.webp','alchemist-serpent-v1.webp','gargoyle-scry-v1.webp','gargoyle-awakening-v1.webp'
]) expect(fs.existsSync('assets/action-cg/'+file), `missing action CG ${file}`);
for (const role of roles) expect(fs.existsSync('icons/roles/'+role+'.jpg'), `missing portrait ${role}.jpg`);

if (fail.length) {
  console.error(fail.map(x=>'✗ '+x).join('\n'));
  process.exit(1);
}
console.log('strategy roles: registrations, isolation, settlement order and artwork passed');
