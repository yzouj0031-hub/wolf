// 白狼王在发言里宣告自爆却没炸：实局原话「我是白狼王，现在发动自爆，带走黑羽快斗。」
// 旧识别只认「现在自爆 / 我自爆」，「发动自爆」不算，且认不出时悄悄当没说。
// 现在：常见宣告直接识别；只是"提到自爆"的，单独问白狼王一次（真炸给目标、只是威胁就 PASS）。
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cases = [
  // [发言, 直接识别为宣告, 会触发确认]
  ['我不是魔术师。我是白狼王，现在发动自爆，带走黑羽快斗。', true, true],
  ['我选择自爆带走3号', true, true],
  ['我决定自爆。', true, true],
  ['我要自爆带走梦子', true, true],
  ['我现在自爆', true, true],
  ['我要自爆了', false, true],
  ['白狼王随时可能自爆带走神职', false, true],
  ['我不会发动自爆的，放心', false, false],
  ['我先不自爆', false, false],
  ['如果你们投我，我就自爆带走你', false, false],
  ['白狼王还没露头，神职没必要第一天就站上靶子', false, false],
];

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('function _stripConditionalActionClauses');
  const b = src.indexOf('async function _confirmWhitewolfExplodeFromSpeech', a);
  assert.ok(a >= 0 && b > a, `${file}: 找不到自爆识别函数`);
  const ctx = {};
  new Function('ctx', src.slice(a, b) + ';ctx.strict=_hasExplicitExplodeIntent;ctx.loose=_mentionsSelfExplode;')(ctx);
  for (const [text, strict, loose] of cases) {
    assert.equal(ctx.strict(text), strict, `${file}: 「${text}」直接识别应为 ${strict}`);
    assert.equal(ctx.loose(text) || ctx.strict(text), loose, `${file}: 「${text}」确认触发应为 ${loose}`);
  }
  // 两条发言路径（普通流程 / 主持人逐个点名）都要在认不出时问一次，而不是悄悄当没说
  assert.equal((src.match(/if \(!target\) target = await _confirmWhitewolfExplodeFromSpeech\(p, r, aliveCandidates\);/g) || []).length, 2,
    `${file}: 有发言路径在认不出自爆时没有追问`);
  assert.ok(src.includes("{action: '', game: r.game, thinking: r.thinking}"), `${file}: 确认请求会被发言里的 action=None 直接当成放弃`);
}

console.log('whitewolf explode speech: "现在发动自爆，带走X" triggers, threats and denials do not, and vague mentions get one confirmation');
