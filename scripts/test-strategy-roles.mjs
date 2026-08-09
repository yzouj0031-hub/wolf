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
  const witchSteps = [...src.matchAll(/nightStep\('witch'/g)].map(match => match.index);
  const alchemistRescueSteps = [...src.matchAll(/nightStep\('alchemist-rescue'/g)].map(match => match.index);
  expect(witchSteps.length >= 2 && alchemistRescueSteps.length >= 2, `${file}: missing Witch/Alchemist rescue steps`);
  expect(witchSteps.every((position, index) => position < alchemistRescueSteps[index]), `${file}: Witch must receive first rescue priority`);
  expect(src.includes("result:'covered_by_witch'"), `${file}: Alchemist does not record an already rescued target`);
  expect(src.includes('法老之蛇未消耗'), `${file}: Alchemist is not told that duplicate rescue was skipped`);
  expect(src.includes('if (S.nightData.witchSave)'), `${file}: duplicate Alchemist rescue is not blocked`);
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
  expect(src.includes('const mistLocked = Array.isArray(S.nightData.alchemistMist)'), `${file}: wolf flow does not detect the Nameless Mist lock`);
  expect(src.includes('wolfRun.mistNoticeShown = true'), `${file}: wolves are not shown the locked target notice`);
  expect(src.includes("ws.forEach(w => w.memory.push({role:'system',content:notice}))"), `${file}: AI wolves do not receive the locked target notice`);
  expect(src.includes('const allTargets = validWolfTargets.slice()'), `${file}: final wolf voting escapes the mist target pool`);
  expect(src.includes('只能在这份名单中提议和投票') || src.includes('Other targets cannot be submitted'), `${file}: human wolf input lacks the mist constraint`);
  expect(src.includes('minTargetCount:2,maxTargetCount:Math.min(3,alive.length)'), `${file}: AI Alchemist cannot choose a 2-or-3 target mist`);
  expect(src.includes('mistTargets.length >= 2 && mistTargets.length <= 3'), `${file}: two-target mist is rejected at settlement`);
  expect(src.includes('未明之雾（圈定2～3人）'), `${file}: human Alchemist lacks the flexible mist choice`);
  expect(src.includes('sanctuaryTarget:null, sanctuaryUsed:false, sanctuaryBlocked:null'), `${file}: missing sanctuary state`);
  expect(src.indexOf("nightStep('wolfconcubine'") < src.indexOf("nightStep('soulwarden'"), `${file}: Soul Warden must act after Eclipse Consort`);
  expect(src.indexOf("nightStep('soulwarden'") < src.indexOf("nightStep('fox'"), `${file}: Soul Warden cleansing must resolve before later good actions`);
  expect(src.includes("consumeSanctuaryMark(attemptedCharm, 'wolfbeauty')"), `${file}: Wolf Beauty charm must use sanctuary interception`);
  expect(src.includes("consumeSanctuaryMark(t.id, 'wolfconcubine')"), `${file}: Eclipse Consort mark must be cleansable`);
  expect(src.includes("new Set(['inspect','protect','poison','charm','dream'])"), `${file}: Eclipse Consort lacks the unified reflectable-effect registry`);
  expect(src.includes("reflectTargetedNightSkill(dw, t.id, 'dream')"), `${file}: Dreamwalker is not connected to Eclipse Consort reflection`);
  expect(src.includes('const actualScry = reflectInspectSubject(gg, t)'), `${file}: Gargoyle scry is not connected to Eclipse Consort reflection`);
  expect(src.includes("reflectTargetedNightSkill(gu, submittedGuard, 'protect')"), `${file}: Guard reflection is not resolved in night-action order`);
  expect(src.includes("reflectTargetedNightSkill(wi, submittedWitchPoison, 'poison')"), `${file}: Witch poison reflection is not resolved in night-action order`);
  expect(src.includes('群体领域、自动信息、净化、救援、白天技与死亡技不受影响'), `${file}: Eclipse Consort exclusions are not documented`);
  expect(src.includes("case 'sanctuary-block'"), `${file}: missing god-view sanctuary record formatter`);
  expect(src.includes('function logPrivateNightResult(actor, zh, en)'), `${file}: missing private night-result visibility guard`);
  expect(src.includes('logPrivateNightResult(dw,dreamReflected?'), `${file}: Dreamwalker action is absent from the live observer feed`);
  expect(src.includes("logPrivateNightResult(al,'炼金魔女发动未明之雾"), `${file}: Alchemist mist is absent from the live observer feed`);
  expect(src.includes("logPrivateNightResult(al,'法老之蛇救下了实际刀口"), `${file}: Alchemist rescue is absent from the live observer feed`);
  expect(src.includes('logPrivateNightResult(gg,scryReflected?'), `${file}: Gargoyle scry is absent from the live observer feed`);
  expect(src.includes("if (!(actor.isPlayer || !isAnon() || observerView)) return"), `${file}: private action feed can leak into anonymous public view`);
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
