import assert from 'node:assert/strict';
import fs from 'node:fs';

const EMPTY_KILL_VOTE = '__EMPTY_KILL__';

function tally(votes) {
  const counts = new Map();
  for (const vote of votes) counts.set(vote, (counts.get(vote) || 0) + 1);
  const max = Math.max(...counts.values());
  const leaders = [...counts.entries()].filter(([, count]) => count === max).map(([candidate]) => candidate);
  return leaders.length === 1 ? {winner:leaders[0], tie:[]} : {winner:null, tie:leaders};
}

assert.deepEqual(
  tally([EMPTY_KILL_VOTE, '3']),
  {winner:null, tie:[EMPTY_KILL_VOTE, '3']},
  'one empty vote and one target vote must be a tie'
);
assert.equal(tally([EMPTY_KILL_VOTE, EMPTY_KILL_VOTE, '3']).winner, EMPTY_KILL_VOTE,
  'an empty-kill majority must produce an empty kill');
assert.equal(tally(['3', '3', EMPTY_KILL_VOTE]).winner, '3',
  'a target majority must still produce that target');

for (const file of ['index.html', 'en/index.html']) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /const EMPTY_KILL_VOTE = '__EMPTY_KILL__'/, `${file}: missing empty-kill ballot sentinel`);
  assert.match(source, /wolfLastActions\[w\.id\] = EMPTY_KILL_VOTE/, `${file}: AI empty-kill intent is not persisted as a vote`);
  assert.match(source, /const finalVoteIsEmpty = \/\^\(\?:none\|pass/, `${file}: final wolf ballot cannot explicitly choose PASS`);
  assert.match(source, /<action>名字 或 PASS<\/action>/, `${file}: final wolf ballot format still forces a player name`);
  assert.match(source, /addWolfVote\(EMPTY_KILL_VOTE, pW\.name\)/, `${file}: human empty-kill selection is not counted`);
  assert.match(source, /rec && rec\.emptyKill \? EMPTY_KILL_VOTE/, `${file}: empty-kill proposal does not create opening disagreement`);
  assert.match(source, /tieCandidates\.includes\(EMPTY_KILL_VOTE\)/, `${file}: empty kill cannot enter the runoff`);
  assert.match(source, /S\.nightData\.kill = ki === EMPTY_KILL_VOTE \? null : ki/, `${file}: winning empty vote does not clear the attack target`);
  assert.doesNotMatch(source, /directorEmptyKill && !directorOverrideTarget/, `${file}: target choice still automatically overrides an empty vote`);
  assert.doesNotMatch(source, /safeRandomWolfTargets/, `${file}: a technical parse failure can still produce a random attack`);
  assert.doesNotMatch(source, /防止AI鸽刀/, `${file}: stale prompt still treats a missing target as an attack that must be filled`);
}

console.log('Wolf empty-kill voting: equal ballot, disagreement, runoff, and resolution passed');
