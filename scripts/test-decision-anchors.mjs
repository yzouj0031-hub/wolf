import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function buildDecisionAnchor(p, kind, candidates, meta)');
const end = html.indexOf('\nasync function callAI(', start);
assert.ok(start >= 0 && end > start, 'decision anchor helper is missing');

const source = html.slice(start, end);
const makeAnchor = new Function(
  'S', 'ALL_ROLES', 'document', '_publiclyRevealedRoleName', '_publiclyVerifiedAlignment', 'isPackWolfRole',
  `${source}; return buildDecisionAnchor;`
);

const roles = {
  wolf:{id:'wolf',name:'狼人',team:'bad'},
  villager:{id:'villager',name:'村民',team:'good'}
};
const players = [
  {id:0,name:'A',alive:true,revealed:false,role:roles.villager},
  {id:1,name:'B',alive:true,revealed:false,role:roles.villager},
  {id:2,name:'C',alive:true,revealed:false,role:roles.wolf},
  {id:3,name:'D',alive:true,revealed:false,role:roles.villager},
  {id:4,name:'E',alive:false,revealed:true,role:roles.wolf},
  {id:5,name:'F',alive:false,revealed:true,role:roles.villager}
];
const S = {players};
const hiddenDocument = {getElementById:id => id === 'm-hdeath' ? {checked:true} : null};
const openDocument = {getElementById:id => id === 'm-hdeath' ? {checked:false} : null};
const noPublicRole = () => '';
const isPackWolfRole = role => role && role.id === 'wolf';

const hiddenAnchor = makeAnchor(S, roles, hiddenDocument, noPublicRole, noPublicRole, isPackWolfRole)(players[0], 'day-vote', players.filter(x=>x.alive), {allowPass:true});
assert.match(hiddenAnchor, /私密决策锚点·白天放逐/);
assert.match(hiddenAnchor, /公开确认已死狼阵营0人/, 'hidden death leaked an internally revealed wolf');
assert.match(hiddenAnchor, /至少比较首选与第二候选/);
assert.match(hiddenAnchor, /太自洽、太像故事/);
assert.match(hiddenAnchor, /同标尺复核/);
assert.match(hiddenAnchor, /信息时点/);
assert.match(hiddenAnchor, /不要在公开发言中复读/);

const openAnchor = makeAnchor(S, roles, openDocument, noPublicRole, noPublicRole, isPackWolfRole)(players[0], 'day-vote', players.filter(x=>x.alive), {allowPass:true});
assert.match(openAnchor, /公开确认已死狼阵营1人/, 'open identity mode did not count a revealed wolf');

const wolfAnchor = makeAnchor(S, roles, hiddenDocument, noPublicRole, noPublicRole, isPackWolfRole)(players[2], 'wolf-kill', players.filter(x=>x.alive), {allowPass:true});
assert.match(wolfAnchor, /首选刀口、第二刀口与合法空刀/);
assert.match(wolfAnchor, /限制区/);
assert.match(html, /inferredDecisionKind[\s\S]*?【猎人开枪】[\s\S]*?'hunter'/, 'hunter shot does not receive a private decision anchor');

for (const marker of [
  "decisionKind:'day-vote'",
  "decisionKind:'pk-vote'",
  "decisionKind:'wolf-kill'",
  "decisionKind:'witch'",
  "decisionKind:'guard'",
  "decisionKind:'dreamwalker'",
  "decisionKind:'magician'",
  "decisionKind:'alchemist'",
  "decisionKind:'knight'",
  "const voteAnchor = buildDecisionAnchor",
  "operationAnchor = buildDecisionAnchor"
]) assert.ok(html.includes(marker), `decision anchor integration missing: ${marker}`);

assert.doesNotMatch(html, /平票就意味着至少有一个是狼/, 'PK prompt still invents a wolf among tied candidates');
assert.match(html, /这是流程强制二选一，不代表平票者中必然有狼/, 'PK prompt lacks uncertainty correction');

console.log('Decision anchors: private timing, candidate comparison, hidden-info safety and critical action wiring passed');
