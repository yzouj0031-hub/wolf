// 真预言家不会浪费查验去验对跳。
//
// 现象：AI 明知自己是真预言家（所以对跳必假），却仍然坚持把警徽流指向对跳位，白扔一夜。
//
// 查下来教学层【没有】教这个，反而教了相反的。但原来那段压不住，问题出在它自己的措辞：
//   「他一定不是真预言家，但【他可能是悍跳狼，也可能是替你挡刀的好人】；……信息增量都很低。」
// 本意是「别默认他是狼」，副作用却是亲手制造了一个悬念——明确告诉模型这里有不确定性，
// 而模型碰到不确定性的本能就是「那我去验一下」。再加上「低」不是「零」，
// 模型读完会觉得「虽然低，但我想确认，值得花」。
//
// 真正能压住它的那一层原来完全没写：就算验出狼，你也【用不出去】——
// 「我验了对跳，他是狼」这句话悍跳狼会一字不差地说同一遍，说服力增量是零。
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FILES = ['index.html', 'en/index.html'];

function seerGuide(file) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const a = src.indexOf("id:'seer'");
  const b = src.indexOf("id:'witch'", a);
  assert.ok(a >= 0 && b > a, `${file}: 预言家角色定义未找到`);
  return src.slice(a, b);
}

for (const file of FILES) {
  const g = seerGuide(file);

  // ── 1. ★ 必须先给出「用不出去」这一层，它才是能压住冲动的那条 ────────────────
  assert.match(g, /就算验出狼，你也【用不出去】/, `${file}: 缺少"验出来也用不出去"这一层`);
  assert.match(g, /悍跳狼会一字不差地说同一遍/, `${file}: 没有说明为什么报出来没有说服力`);
  assert.match(g, /你的说服力增量是【零】/, `${file}: 没有把说服力增量明确写成零`);

  // 「低」压不住，必须出现「零」和机会成本
  assert.match(g, /机会成本却是一整夜/, `${file}: 没有写出机会成本`);
  assert.match(g, /本可以开出一个全新的查杀或金水/, `${file}: 没有给出那一夜的正确用途`);

  // ── 2. 原来那句制造悬念的话要保留判断、但不能再引出"去验一下" ────────────────
  // 「悍跳狼 or 挡刀好人」这个区分本身是对的，保留；但必须明说别用查验去买答案。
  assert.match(g, /别用查验去买这个答案/, `${file}: 没有堵住"用查验解决这个不确定性"`);
  assert.match(g, /用他后续的行为去分辨/, `${file}: 没有给出分辨的替代手段`);
  assert.ok(g.includes('是否编造污染性假信息、是否抢归票'), `${file}: 原有的行为分辨线索被删了`);
  assert.ok(g.includes('别把他默认成铁狼去推'), `${file}: 原有的"别默认成铁狼"提醒被删了`);

  // ── 3. ★ 反向武器：这条也是识别悍跳狼的结构性破绽 ──────────────────────────
  assert.match(g, /【真预言家不会把警徽流指向对跳位】/, `${file}: 没有把这条变成识别悍跳的武器`);
  assert.match(g, /他解释不掉，因为这是身份和行为在收益上的结构矛盾/, `${file}: 没有说明为什么对方解释不掉`);
  // 和核心层【挑对方无法低成本回应的点】呼应：格式/口误是白攻击
  assert.match(g, /而争他的格式、口误、语气，他一句话就糊弄过去了/, `${file}: 没有对比出"争格式是白攻击"`);

  // ── 4. 不能把警徽流那条通则弄丢 ──────────────────────────────────────────────
  assert.ok(
    g.includes('你预告的目标应该指向"想知道答案"的位置,而不是"已经知道答案"的位置'),
    `${file}: 警徽流的通则被删了`,
  );
  // 其余三档查验价值排序也要还在
  for (const kept of ['验全场已经怀疑的人', '验完全不了解好坏的边角位', '验发言模糊、立场摇摆、票型可疑的人']) {
    assert.ok(g.includes(kept), `${file}: 查验价值排序里的「${kept}」被删了`);
  }
}

console.log('seer badge flow: unusable-verdict layer, opportunity cost, behaviour-based discrimination and the counter-claim tell');
