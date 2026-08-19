import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function _parseWebVotePaste(rawText, candidates)');
const end = html.indexOf('// ── 网页端 prompt 弹窗', start);
assert.ok(start >= 0 && end > start, 'web relay vote parser is missing');

const source = html.slice(start, end);
const parseAI = text => ({action:(text.match(/<action>([\s\S]*?)<\/action>/i)||[])[1] || ''});
const findPlayer = (text, candidates) => {
  const value = String(text || '').trim();
  return candidates.find(p => value === p.name || value === `P${p.id + 1}`) || null;
};
const parsers = new Function('parseAI', 'findPlayer', `${source}; return {_parseWebVotePaste,_parseWebOperationPaste};`)(parseAI, findPlayer);
const parseVote = parsers._parseWebVotePaste;
const parseOperation = parsers._parseWebOperationPaste;
const candidates = [
  {id:0,name:'Alpha'},
  {id:1,name:'Beta'},
  {id:2,name:'Gamma'}
];

assert.equal(parseVote('<thinking>比较Alpha和Beta</thinking><action>VOTE:P2</action>', candidates), 'Beta');
assert.equal(parseVote('投票：Gamma', candidates), 'Gamma');
assert.equal(parseVote('<action>PASS</action>', candidates), 'None');
assert.equal(parseVote('<action>EXPLODE:Alpha</action>', candidates), 'EXPLODE:Alpha');
assert.equal(parseVote('Alpha与Beta都被反复讨论，但我还没有提交明确投票目标，所以这段只是分析，不能按名字出现次数猜票。', candidates), '');

const operationOptions = [
  {label:'继续竞选',value:'stay'},
  {label:'退选',value:'quit'},
  {label:'查验 Beta',value:'Beta'}
];
assert.equal(parseOperation('<action>quit</action>', operationOptions), 'quit');
assert.equal(parseOperation('选择：查验 Beta', operationOptions), 'Beta');
assert.equal(parseOperation('我在分析继续竞选和退选的收益，但这不是最终选择，也没有提交action。', operationOptions), '');

for (const marker of [
  '网页AI决定（自动续接新增历史）',
  "{choiceOnly:'vote', voteCandidates:alive}",
  "if (isVoteChoice) { resolve('__CANCEL_WEB_VOTE__'); return; }",
  '本次只发新增内容',
  '<action>VOTE:玩家名</action>',
  "{choiceOnly:'operation', operationTitle:hint, operationContext:ctx, operationOptions:opts}",
  '交给网页AI决定（续接本局）',
  '━━━━ 当前私密操作 ━━━━',
  "{webActor:p});",
  "{webActor:hp});",
  "{webActor:sheriffP}"
]) assert.ok(html.includes(marker), `web relay vote flow lacks marker: ${marker}`);

assert.ok(html.includes('const requireGame = opts.requireGame === true || (!isSkillConfirm && opts.requireGame !== false);'), 'skill confirmations do not default to pure-operation mode');
assert.ok(html.includes('if (requireGame && !game && thinking && thinking.length >= 80)'), 'thinking rescue still runs during pure operations');
assert.match(html, /【投票】投谁出局[\s\S]*?requireGame:false/, 'day vote still requires or rescues public speech');
assert.match(html, /【选警长投票】[\s\S]*?requireGame:false/, 'sheriff vote still requires or rescues public speech');
assert.match(html, /【PK投票 - 关键决战】[\s\S]*?requireGame:false/, 'runoff vote still requires or rescues public speech');

console.log('web relay choices: incremental history, voting, sheriff decisions and private skill operations passed');
