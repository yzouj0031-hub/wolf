// 狼盟密约的多样性：
// ① 写方案不再被压低随机性——提案走 skillConfirm（为了"只要行动、不要公开发言"），它会把温度
//    压到 ≤0.5；投票/选刀需要这样，写战术方案不需要。提案加 creative，只放开温度。
// ② 每只狼一个不同的出发点：同一份教学、常常同一个模型，各自提案也会趋同。一只狼从常规打法
//    出发（常规线也要交账），其余各从一个不同的非常规方向出发；选哪条仍由投票按成败账决定。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');

  // ① 温度
  assert.ok(src.includes('const rationalCap = (opts.skillConfirm && !opts.creative) ? 0.5 : Infinity;'), `${file}: creative 没有放开温度上限`);
  assert.equal((src.match(/callAI\(w, proposalPrompt\(w\), \{noMemory: true, skillConfirm: true, creative: true,/g) || []).length, 2,
    `${file}: 两处 AI 提案（AI 狼 / 真人"让 AI 替我写"）都应带 creative`);
  assert.ok(!/【狼盟密约·投票】[^\n]*\n[\s\S]{0,400}creative: true/.test(src), `${file}: 投票不该放开温度`);

  // ② 出发点分配
  const a = src.indexOf('  const PACT_ANGLES = [');
  const b = src.indexOf('  const proposalPrompt = (w) => {', a);
  assert.ok(a >= 0 && b > a, `${file}: 出发点分配未找到`);
  assert.ok(src.includes("mechPactNote + pactRuleFacts.zh + pactAngleBlock(w) + '\\n\\n【方案要求】"), `${file}: 提案提示词没有带上出发点`);
  const run = n => {
    const ctx = {shuffle: x => x.slice().sort(() => Math.random() - .5), aliveWolves: Array.from({length: n}, (_, i) => ({id: i}))};
    vm.createContext(ctx);
    vm.runInContext(src.slice(a, b) + ';this.of = pactAngleOf; this.block = pactAngleBlock;', ctx);
    return ctx;
  };
  for (let trial = 0; trial < 30; trial++) {
    const c = run(3);
    const keys = [0, 1, 2].map(i => c.of({id: i}).key);
    assert.equal(keys.filter(k => k === 'conventional').length, 1, `${file}: 3 只狼时应恰好一只从常规打法出发 (${keys})`);
    assert.equal(new Set(keys).size, 3, `${file}: 3 只狼的出发点应各不相同 (${keys})`);
    assert.match(c.block({id: 0}), /哪条都不预设赢/, `${file}: 出发点没有说明"投票不预设哪条赢"`);
  }
  const seen = new Set();
  for (let trial = 0; trial < 60; trial++) seen.add(run(2).of({id: 0}).key);
  assert.ok(seen.size >= 3, `${file}: 出发点分配没有每局打乱（同一座位只拿到过 ${[...seen]}）`);
  const solo = run(1);
  assert.equal(solo.of({id: 0}), null, `${file}: 只有一只狼时不该分配出发点（它的方案会直接通过）`);
  assert.equal(solo.block({id: 0}), '', `${file}: 只有一只狼时提示词里不该有出发点`);
}

console.log('pact angles: proposals are written at normal temperature, and each wolf starts from a different angle (one conventional, the rest distinct)');
