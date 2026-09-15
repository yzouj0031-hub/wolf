import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const start = src.indexOf('        // 最终候选统一检查');
  const end = src.indexOf('        // 所有抢救/备用路径结束', start);
  assert.ok(start > src.indexOf('const recoveredSpeech ='));
  assert.ok(src.includes("const _liveOK = _judgeMode === 'off'"));
  const loop = src.slice(start, end);
  for (const verdicts of [['A'], ['B', 'A'], ['B', 'B', 'B'], [null]]) {
    let calls = 0, checks = 0;
    const ctx = vm.createContext({
      S: {}, p: {id: 0, name: 'test'}, opts: {},
      _r: {game: 'candidate'}, _judgeMode: 'all',
      SPEECH_JUDGE_CAP: {all: 300}, SPEECH_JUDGE_FAIL_STREAK: 3,
      needsSpeechJudge: r => !!r.game,
      getJudgeAPI: () => ({model: 'mock'}),
      judgeSpeechIsPublic: async () => verdicts[checks++],
      Render: {log() {}, devLog() {}},
      factCheck: (_, r) => r, promptFn: () => 'original',
      callAI: async (_, prompt, options) => {
        calls++;
        assert.equal(options.liveTTS, false);
        assert.ok(prompt.startsWith('original'));
        return {game: 'replacement'};
      }
    });
    await vm.runInContext('(async () => {' + loop + '})()', ctx);
    assert.equal(checks, verdicts.length);
    assert.equal(calls, Math.min(verdicts.filter(v => v === 'B').length, 2));
    assert.equal(ctx._r.game === '', verdicts.length === 3);
  }
  const a = src.indexOf('async function judgeSpeechIsPublic');
  const b = src.indexOf('// ── 发言顺序', a);
  for (const [content, expected] of [['A', 'A'], ['B', 'B'], ['Because it is private', null], [[{text: 'A'}], 'A']]) {
    const ctx = vm.createContext({
      getJudgeAPI: () => ({url: 'https://mock.invalid/v1', key: 'mock', model: 'mock'}),
      AbortController, setTimeout, clearTimeout, SPEECH_JUDGE_SYS: 'classification',
      fetch: async () => ({ok: true}),
      parseAPIResponseWithSSEFallback: async () => ({choices: [{message: {content}}]})
    });
    vm.runInContext(src.slice(a, b), ctx);
    assert.equal(await ctx.judgeSpeechIsPublic('speech'), expected);
  }
}
console.log('final speech judge: rechecks, bounded retries, fail-open, strict verdicts and shared parser passed');
