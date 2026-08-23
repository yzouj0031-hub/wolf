import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('function normalizeGoodRoleClass');
  const end = src.indexOf('function buildRulesExport()', start);
  assert.ok(start >= 0 && end > start, `${file}: cannot locate good-role classification helpers`);

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src.slice(start, end) + '\nthis.getGoodRoleClass=getGoodRoleClass;this.isGoodGodRole=isGoodGodRole;this.isGoodVillagerRole=isGoodVillagerRole;this.roleFactionClassLabel=roleFactionClassLabel;', sandbox);

  const builtInVillager = {id:'villager', team:'good'};
  const builtInGod = {id:'seer', team:'good'};
  const legacyCustomGood = {id:'custom_legacy', team:'good'};
  const customGod = {id:'custom_god', team:'good', goodRoleClass:'god'};
  const customCivilian = {id:'custom_civilian', team:'good', goodRoleClass:'villager'};

  assert.equal(sandbox.getGoodRoleClass(builtInVillager), 'villager', `${file}: built-in Villager is not civilian`);
  assert.equal(sandbox.getGoodRoleClass(builtInGod), 'god', `${file}: built-in power role is not god-class`);
  assert.equal(sandbox.getGoodRoleClass(legacyCustomGood), 'god', `${file}: legacy custom good role did not retain god-class compatibility`);
  assert.equal(sandbox.getGoodRoleClass(customGod), 'god', `${file}: explicit custom god-class was ignored`);
  assert.equal(sandbox.getGoodRoleClass(customCivilian), 'villager', `${file}: explicit custom civilian class was ignored`);
  assert.equal(sandbox.roleFactionClassLabel(customCivilian), '好人阵营·民牌（计入屠民）', `${file}: custom civilian export label is wrong`);

  assert.ok(src.includes('id="cr-good-class"'), `${file}: custom-role class selector missing`);
  assert.ok(src.includes("const goodRoleClass = team === 'good'"), `${file}: custom-role class is not saved`);
  assert.ok(src.includes('goodRoleClass: normalizeGoodRoleClass(def.goodRoleClass, b.team, def.id)'), `${file}: template clone drops custom role class`);
  assert.equal((src.match(/alive\.filter\(p => isGoodGodRole\(p\.role\)\)/g) || []).length, 2, `${file}: live god counts do not use the shared classifier in both end checks`);
  assert.equal((src.match(/alive\.filter\(p => isGoodVillagerRole\(p\.role\)\)/g) || []).length, 2, `${file}: live civilian counts do not use the shared classifier in both end checks`);
  assert.ok(src.includes('S.players.filter(p => isGoodGodRole(p.role)).length'), `${file}: initial/rewind god count ignores custom class`);
  assert.ok(src.includes('S.players.filter(p => isGoodVillagerRole(p.role)).length'), `${file}: initial/rewind civilian count ignores custom class`);
}

console.log('custom role edge class: selector, compatibility, exports, rewind and win counting passed');
