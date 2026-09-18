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
  for (const verdicts of [['A'], ['B', 'A'], ['B', 'B', 'B'], [null], ['busy']]) {
    let calls = 0, checks = 0;
    const ctx = vm.createContext({
      S: {}, p: {id: 0, name: 'test'}, opts: {},
      _r: {game: 'candidate'}, _judgeMode: 'all',
      SPEECH_JUDGE_CAP: {all: 300}, SPEECH_JUDGE_FAIL_STREAK: 3, JUDGE_BUSY: 'busy',
      needsSpeechJudge: r => !!r.game,
      // 'candidate' / 'replacement' 都不像思维链倾倒，这里只验判官路径
      looksLikeThinkingDump: () => null,
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
    // 限流只是暂时的：本次放行，但绝不能算进连败——算了的话配额抖三下就熔断，整局停摆
    if (verdicts[0] === 'busy') {
      assert.equal(ctx.S._judgeStats.busy, 1, '限流没有单独计数');
      assert.equal(ctx.S._judgeStats.failed, 0, '限流被记成了判官不可用');
      assert.equal(ctx.S._judgeStats.streak, 0, '限流累计了连败，会误触熔断');
      assert.equal(ctx._r.game, 'candidate', '限流时发言应当原样放行');
    }
  }
  const a = src.indexOf('// ★ 限流是【暂时】的');
  const b = src.indexOf('// ── 发言顺序', a);
  // 判词解析：严格到不认标点，会把 "A." 这类极常见的回复记成 failed —— 连续三条就熔断，
  // 整局分诊停摆。所以要容忍包裹字母的标点/markdown，但仍拒绝整句作答。
  const VERDICTS = [
    ['A', 'A'], ['B', 'B'], [[{text: 'A'}], 'A'],
    ['A.', 'A'], ['B。', 'B'], ['**A**', 'A'], ['A）', 'A'], ['「B」', 'B'], [' a \n', 'A'],
    ['A - public speech', 'A'], ['B — 内心盘算', 'B'],
    ['Because it is private', null], ['Answer: A', null], ['CANNOT DETERMINE', null],
    ['这是公开发言', null], ['', null], [null, null], ['A'.repeat(300), null],
  ];
  for (const [content, expected] of VERDICTS) {
    const ctx = vm.createContext({
      getJudgeAPI: () => ({url: 'https://mock.invalid/v1', key: 'mock', model: 'mock'}),
      AbortController, setTimeout, clearTimeout, SPEECH_JUDGE_SYS: 'classification',
      fetch: async () => ({ok: true, status: 200}),
      parseAPIResponseWithSSEFallback: async () => ({choices: [{message: {content}}]})
    });
    vm.runInContext(src.slice(a, b), ctx);
    assert.equal(await ctx.judgeSpeechIsPublic('speech'), expected);
  }

  // 限流 / 过载 → 'busy'（退避重试一次后仍限流）；配置错误 → null（该触发熔断的是这类）
  for (const [statuses, expected, wantCalls] of [
    [[429, 200], 'A', 2], [[429, 429], 'busy', 2], [[503, 503], 'busy', 2], [[529, 529], 'busy', 2],
    [[401], null, 1], [[404], null, 1], [[400], null, 1],
  ]) {
    let i = 0, calls = 0;
    const ctx = vm.createContext({
      getJudgeAPI: () => ({url: 'https://mock.invalid/v1', key: 'mock', model: 'mock'}),
      AbortController, setTimeout, clearTimeout, SPEECH_JUDGE_SYS: 'classification', Promise,
      fetch: async () => { calls++; const st = statuses[i++] ?? 200; return {status: st, ok: st >= 200 && st < 300}; },
      parseAPIResponseWithSSEFallback: async () => ({choices: [{message: {content: 'A'}}]})
    });
    vm.runInContext(src.slice(a, b), ctx);
    assert.equal(await ctx.judgeSpeechIsPublic('speech'), expected, `状态 ${statuses} 的判定不对`);
    assert.equal(calls, wantCalls, `状态 ${statuses} 的重试次数不对`);
  }
}
console.log('final speech judge: rechecks, bounded retries, fail-open, punctuation-tolerant verdicts, rate-limit isolation and shared parser passed');
