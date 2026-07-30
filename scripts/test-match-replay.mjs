import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  for (const id of ['mr-events','mr-play','mr-skip','mr-all','mr-speed','mr-progress-text','mr-progress-bar']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${file}: missing ${id}`);
  }
  for (const symbol of [
    'streamMatchReplayEvent',
    'runMatchReplayAuto',
    'finishMatchReplayTyping',
    'matchReplaySceneDivider',
    "insertAdjacentHTML('beforeend'",
    "$('mr-skip').addEventListener('click', finishMatchReplayTyping)"
  ]) assert.ok(html.includes(symbol), `${file}: missing replay behavior ${symbol}`);
  assert.match(html, /Array\.from\((?:data\.text|displayText)\)/, `${file}: replay text is not streamed by Unicode character`);

  const replayStart = html.indexOf('const MatchReplay =');
  const replayEnd = html.indexOf('async function runPostGame', replayStart);
  const replayCode = html.slice(replayStart, replayEnd);
  assert.ok(replayStart >= 0 && replayEnd > replayStart, `${file}: replay block not found`);
  assert.ok(!replayCode.includes('setInterval('), `${file}: legacy slide-style replay interval remains`);
  assert.match(replayCode, /MatchReplay\.visible\s*=\s*Math\.max/, `${file}: completed streamed events are not checkpointed`);
  assert.match(replayCode, /MatchReplay\.runToken\+\+/, `${file}: replay cancellation token missing`);

  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  inlineScripts.forEach((source, index) => {
    try { new Function(source); }
    catch (error) { throw new Error(`${file}: inline script ${index} does not parse: ${error.message}`); }
  });
}

console.log('match replay: streamed timeline checks passed');
