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
const parseVote = new Function('parseAI', 'findPlayer', `${source}; return _parseWebVotePaste;`)(parseAI, findPlayer);
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

for (const marker of [
  '网页AI决定（自动续接新增历史）',
  "{choiceOnly:'vote', voteCandidates:alive}",
  "if (isVoteChoice) { resolve('__CANCEL_WEB_VOTE__'); return; }",
  '本次只发新增内容',
  '<action>VOTE:玩家名</action>'
]) assert.ok(html.includes(marker), `web relay vote flow lacks marker: ${marker}`);

console.log('web relay vote: incremental history, explicit parsing, PASS and White Wolf explode passed');
