// 警长投票权：谁有票。
//
// 实测：摄梦人在警上论证"我梦的11号没参选，换不来任何一张票；1号梦10号，是因为10号在
// 候选席，能拉他的警长票"——恰好说反了。11号在警下，有票；10号是候选人，没有票。
// 警长本人还拿这条当了偏向出人的主要理由。
//
// 根因：AI 看不到这条规则。"竞选者不能投票"只写在代码注释里；给人看的规则原文是
// "留在台上的候选人进行最终陈词后投票"，读起来反而像候选人自己也投票。
//
// 规则必须和代码一致：投票者 = 不在【最终候选名单】里的存活玩家。退选者会从候选名单
// 里移除，因此【退选的人有票】——这一点和部分线下规则不同，按本项目的实际结算写。
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

  // ── 1. ★ AI 在竞选阶段能读到这条（此刻的硬事实，附在每条竞选提示后） ──────────
  const a = src.indexOf("} else if (S.phase === 'sheriff') {");
  const b = src.indexOf('} else {', a);
  assert.ok(a >= 0 && b > a, `${file}: buildNowFacts 的竞选分支未找到`);
  const facts = src.slice(a, b);
  assert.match(facts, /警长投票只由【不在最终候选名单里】的存活玩家投/, `${file}: 竞选阶段的硬事实里没有投票权规则`);
  assert.match(facts, /没上警的、以及中途退选的都有票/, `${file}: 没写清退选者有票`);
  assert.match(facts, /仍留在台上的候选人没有投票权，也不能投给自己/, `${file}: 没写清候选人没有票`);
  assert.match(facts, /拉拢一个还在台上的候选人换不来他的警长票/, `${file}: 没把规则落到"拉票"的推理上`);

  // ── 2. 给人看的规则原文不能再有歧义 ──────────────────────────────────────────
  assert.ok(!src.includes('留在台上的候选人进行最终陈词后投票。'), `${file}: 有歧义的旧规则原文还在`);
  assert.match(src, /【谁有票】只有不在最终候选名单里的存活玩家投票/, `${file}: 完整规则里没有投票权说明`);

  // ── 3. ★ 规则文本必须和实际结算一致 ─────────────────────────────────────────
  // 退选后候选名单被替换为留下的人 → 退选者不在 candIds 里 → 他们是投票者
  assert.ok(src.includes('if (remaining.length > 0) candidates = remaining;'), `${file}: 退选后候选名单的更新方式变了，请同步规则文本`);
  assert.ok(src.includes('const candIds = new Set(candidates.map(c => c.id));'), `${file}: 投票者判定变了，请同步规则文本`);
  assert.ok(src.includes('const voters = alive.filter(p => !candIds.has(p.id));'), `${file}: 投票者判定变了，请同步规则文本`);
}

console.log('sheriff voters: rule visible to AI during the election, matches the actual voter filter');
