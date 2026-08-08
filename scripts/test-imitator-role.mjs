import fs from 'node:fs';

const clients = ['index.html', 'en/index.html'];
const fail = [];
const expect = (ok, message) => { if (!ok) fail.push(message); };

for (const file of clients) {
  const src = fs.readFileSync(file, 'utf8');
  expect(src.includes("id:'imitator'"), `${file}: missing imitator registration`);
  expect(src.includes("imitator:      ['learn']"), `${file}: missing ability index entry`);
  expect(src.includes("'_imitatorTried','_imitatorSuccesses'"), `${file}: missing persistent state keys`);
  expect(src.includes('im._imitatorSuccesses >= 3'), `${file}: missing three-copy cap`);
  expect(src.includes('!im._imitatorTried.includes(p.id)'), `${file}: targets can be learned more than once`);
  expect(src.includes("async imitator(alive)"), `${file}: missing learning action`);
  expect(src.includes("async _imitatorUse(im, skill, alive)"), `${file}: missing temporary skill action`);
  expect(src.includes("async imitatorRescue(alive)"), `${file}: missing delayed rescue settlement`);
  expect(src.includes('S.nightData.imitatorSave=victim.id'), `${file}: copied rescue must use native save settlement`);
  expect(src.includes('S.nightData.witchSave || S.nightData.imitatorSave === S.nightData.kill'), `${file}: copied rescue must participate in guard/save collision`);
  expect(src.includes('S.nightData.customPoison.includes(S.nightData.kill)'), `${file}: copied poison must win cause priority when it hits the wolf target`);
  expect(src.includes("S.nightData.imitatorSwap"), `${file}: missing copied swap settlement`);
  expect(src.includes("imitatorSanctuaryTarget"), `${file}: missing copied sanctuary settlement`);
  expect(src.includes("role:'imitator_use'"), `${file}: missing private action records`);

  const fox = [...src.matchAll(/nightStep\('fox'/g)].map(m => m.index);
  const imitate = [...src.matchAll(/nightStep\('imitator'/g)].map(m => m.index);
  const wolfKill = [...src.matchAll(/nightStep\('wolf-kill'/g)].map(m => m.index);
  const swap = [...src.matchAll(/nightStep\('magic-swap'/g)].map(m => m.index);
  const rescue = [...src.matchAll(/nightStep\('imitator-rescue'/g)].map(m => m.index);
  const witch = [...src.matchAll(/nightStep\('witch'/g)].map(m => m.index);
  expect(fox.length >= 2 && imitate.length >= 2 && wolfKill.length >= 2, `${file}: incomplete repeated night order`);
  expect(imitate.every((pos, i) => fox[i] < pos && pos < wolfKill[i]), `${file}: imitator must act after fox control and before wolf attack`);
  expect(rescue.length >= 2 && rescue.every((pos, i) => swap[i] < pos && pos < witch[i]), `${file}: copied rescue must see redirected wolf target before witch`);
}

const cg = fs.readFileSync('action-cg.js', 'utf8');
const sigils = fs.readFileSync('role-sigils.js', 'utf8');
expect(/\bimitator\s*:\s*\{\s*src:'imitator-memory-copy-v1\.webp'/.test(cg), 'action-cg.js: missing imitator mapping');
expect(/\bimitator\s*:/.test(sigils), 'role-sigils.js: missing imitator sigil');
expect(fs.existsSync('icons/roles/imitator.jpg'), 'missing imitator portrait');
expect(fs.existsSync('assets/action-cg/imitator-memory-copy-v1.webp'), 'missing optimized imitator CG');

if (fail.length) {
  console.error(fail.map(x => 'FAIL ' + x).join('\n'));
  process.exit(1);
}
console.log('imitator: limits, compatible temporary skills, night order, persistence and artwork passed');
