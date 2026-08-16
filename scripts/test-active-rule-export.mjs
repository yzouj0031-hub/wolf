import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');

function sliceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice: ${start}`);
  return source.slice(from, to);
}

const exportSource = [
  sliceBetween(html, 'function buildActiveRoleExportDesc', 'function buildRulesExport()'),
  sliceBetween(html, 'function buildRulesExport()', '// 网页端 AI 接力专用'),
  sliceBetween(html, 'function buildWebRulesExport(viewerP)', 'function buildNames(n)')
].join('\n');

const roleDefs = {
  werewolf:['狼人','bad'], wolfking:['狼王','bad'], wolfbeauty:['狼美人','bad'],
  seer:['预言家','good'], witch:['女巫','good'], hunter:['猎人','good'], guard:['守卫','good'],
  knight:['骑士','good'], magician:['魔术师','good'], merchant:['奇迹商人','good'], whitewolf:['白狼王','bad'],
  mechwolf:['机械狼','bad'], fox:['子狐','good'], jester:['小丑','third'],
  serialkiller:['连环杀手','third'], alchemist:['炼金魔女','good'],
  wolfconcubine:['蚀时狼妃','bad'], soulwarden:['净魂师','good'], imitator:['摹术师','good']
};
const ALL_ROLES = Object.fromEntries(Object.entries(roleDefs).map(([id,[name,team]]) => [id, {
  id, name, team, emoji:'', desc:`${name}默认说明。`
}]));

const sandbox = {
  ALL_ROLES,
  window:{WolfI18n:null},
  uiEnglish:() => false,
  $:() => ({checked:false}),
  S:null
};
vm.createContext(sandbox);
vm.runInContext(exportSource + '\nthis.buildRulesExport=buildRulesExport;this.buildWebRulesExport=buildWebRulesExport;', sandbox);

function setGame(ids) {
  sandbox.S = {
    players:ids.map((id, i) => ({id:i, name:`P${i + 1}`, role:ALL_ROLES[id]})),
    killEdgeMode:true, singleRound:true, round:1, extraSpeechEnabled:false,
    sheriffDailyOrderMode:false, knightChainMode:false
  };
}
function exportBoth(ids) {
  setGame(ids);
  return [sandbox.buildRulesExport(), sandbox.buildWebRulesExport(sandbox.S.players[0])];
}
function assertAbsent(ids, words) {
  exportBoth(ids).forEach(text => words.forEach(word => {
    assert.ok(!text.includes(word), `${ids.join('+')} export leaked absent role ${word}`);
  }));
}
function assertPresent(ids, word) {
  exportBoth(ids).forEach(text => assert.ok(text.includes(word), `${ids.join('+')} export omitted active interaction ${word}`));
}

assertAbsent(['wolfking'], ['骑士']);
assertPresent(['wolfking','knight'], '骑士');
assertAbsent(['whitewolf'], ['普通狼人']);
assertAbsent(['fox'], ['蚀时狼妃']);
assertPresent(['fox','wolfconcubine'], '蚀时狼妃');
assertAbsent(['jester'], ['预言家']);
assertAbsent(['serialkiller'], ['守卫','女巫','预言家']);
assertAbsent(['alchemist'], ['魔术师']);
assertAbsent(['mechwolf'], ['预言家','魔术师','平民']);
assertAbsent(['wolfconcubine'], ['净魂师']);
assertAbsent(['soulwarden'], ['蚀时狼妃','狼美人']);
assertPresent(['soulwarden','wolfbeauty'], '狼美人');

const i18nSource = fs.readFileSync(new URL('i18n.js', root), 'utf8');
const i18nSandbox = {
  window:{alert(){},confirm(){},prompt(){}},
  document:{addEventListener(){},querySelectorAll(){return[]},querySelector(){return null},body:{}},
  localStorage:{getItem(){return 'en'},setItem(){}},
  navigator:{language:'en'},
  MutationObserver:class { observe(){} },
  Node:{TEXT_NODE:3,ELEMENT_NODE:1}
};
vm.createContext(i18nSandbox);
vm.runInContext(i18nSource, i18nSandbox, {filename:'i18n.js'});
const englishRules = ids => i18nSandbox.window.WolfI18n.buildEnglishRules({
  players:ids.map(id => ({role:{id, name:id}})), edge:true, singleRound:true, hiddenDeath:false
});

assert.ok(!englishRules(['wolfking']).includes('Knight'), 'English Wolf King export leaked absent Knight');
assert.ok(englishRules(['wolfking','knight']).includes('Knight duel'), 'English active Knight interaction missing');
assert.ok(!englishRules(['werewolf']).includes('Known packmates'), 'single known-pack wolf should not receive packmate sacrifice rule');
assert.ok(englishRules(['werewolf','werewolf']).includes('Known packmates'), 'multi-wolf setup should include packmate sacrifice rule');
assert.ok(englishRules(['imitator']).includes('Imitator:'), 'English export omitted active Imitator');
assert.ok(!englishRules(['wolfking']).includes('Villager'), 'English edge rule leaked absent Villager role name');

console.log('active role export tests passed');
