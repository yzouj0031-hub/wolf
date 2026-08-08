import fs from 'node:fs';

const clients = ['index.html', 'en/index.html'];
const failures = [];
const expect = (ok, msg) => { if (!ok) failures.push(msg); };

for (const file of clients) {
  const src = fs.readFileSync(file, 'utf8');
  for (const id of ['cr-portrait-file','cr-cg-file','cr-portrait-preview','cr-cg-preview']) {
    expect(src.includes(`id="${id}"`), `${file}: missing ${id}`);
  }
  expect(src.includes('function safeCustomRoleArt(value)'), `${file}: missing custom-art protocol guard`);
  expect(src.includes('function compressCustomRoleArt(file, kind)'), `${file}: missing client-side artwork compression`);
  expect(src.includes('portrait: safeCustomRoleArt(cr.portrait), actionCG: safeCustomRoleArt(cr.actionCG)'), `${file}: custom-role registration drops artwork`);
  expect(src.includes('customPortrait: safeCustomRoleArt(def.portrait), customActionCG: safeCustomRoleArt(def.actionCG)'), `${file}: template-cloned custom role drops artwork`);
  expect(src.includes("step === 'custom-gods'"), `${file}: custom ability actions do not trigger cinematics`);
  expect(src.includes('const portrait = safeCustomRoleArt(r.portrait)'), `${file}: encyclopedia does not prefer custom portrait`);
  expect(src.includes('customRolesDefs: window._customRolesDefs || []'), `${file}: exported config omits custom roles and artwork`);
  expect(src.includes('data-cr-edit='), `${file}: custom role list still relies on unsafe inline ids`);
}

const root = fs.readFileSync('index.html', 'utf8');
const builtInIds = [...root.matchAll(/reg\(\{id:'([^']+)'/g)].map(m => m[1]);
for (const id of builtInIds) {
  expect(fs.existsSync(`icons/roles/${id}.jpg`), `built-in encyclopedia portrait missing: ${id}.jpg`);
}

if (failures.length) {
  console.error(failures.map(x => `FAIL ${x}`).join('\n'));
  process.exit(1);
}
console.log(`custom role art: upload, compression, persistence, encyclopedia and CG hooks passed; ${builtInIds.length} built-in portraits present`);
