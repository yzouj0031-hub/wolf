// 「好人算信息，狼算对方的决策成本。」
//
// 这句话是用户给的，而它正好命中教学层最大的一处空白：狼人 guide 里那句
//   「捞队友/踩队友/投队友/悍跳/自刀/潜水/做对子——这些都是工具，什么时候用看本局判断。」
// 只列了工具名，一个字都没教怎么用；整份 guide 里「决策成本」「金水」「站边」出现 0 次。
// 结果就是 AI 被教会了「算信息然后隐瞒」——也就是用好人的思路打狼，从没被教过
// 去算「别人要付多大代价才会做出我想要的决定」。
//
// 这个测试守两件事：原则进了核心层（两边通用），战术进了狼人 guide（含队形和票数账）。
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FILES = ['index.html', 'en/index.html'];
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

function core(src, file) {
  const a = src.indexOf('const WB_CORE_COMPACT = `');
  const b = src.indexOf('\n\nconst WB_RULES_COMPACT', a);
  assert.ok(a >= 0 && b > a, `${file}: WB_CORE_COMPACT 未找到`);
  return src.slice(a, b);
}
function wolfGuide(src, file) {
  const a = src.indexOf("id:'werewolf'");
  const b = src.indexOf("id:'wolfking'", a);
  assert.ok(a >= 0 && b > a, `${file}: 狼人角色定义未找到`);
  return src.slice(a, b);
}

for (const file of FILES) {
  const src = read(file);
  const c = core(src, file);
  const g = wolfGuide(src, file);

  // ── 1. 核心层：决策成本这个维度，两边都要有 ────────────────────────────────
  assert.ok(c.includes('【算一算别人要付什么代价，才会做出你想要的决定】'), `${file}: 核心教学缺少决策成本原则`);
  assert.match(c, /多数人不是按「谁最可疑」投票，是按「投谁最划算」投票/, `${file}: 没有点明投票的真实依据`);
  // 证据不被执行时，该降成本而不是重复喊
  assert.match(c, /降低执行成本/, `${file}: 没有给出"证据推不动"时的正确做法`);
  assert.match(c, /而不是把同一条证据再喊一遍/, `${file}: 没有否掉"重复喊"这条死路`);
  // 攻击点要挑对方无法低成本回应的
  assert.match(c, /挑他【无法低成本回应】的点/, `${file}: 没有教怎么挑攻击点`);
  assert.match(c, /他一句话就能解释过去/, `${file}: 没有说明格式/口误类攻击为什么是白攻击`);

  // ★ 惩罚沉默：这条是给好人的，不写就等于把沉默变成免费策略
  assert.match(c, /【惩罚沉默要和惩罚说错话一样重】/, `${file}: 缺少"沉默不能免费"这条`);
  assert.match(c, /然后全场信息量归零，这正是狼要的/, `${file}: 没有说明纵容沉默的后果归谁得利`);

  // ★ 必败局面下方差是免费的
  assert.match(c, /【已经输定的时候，方差是免费的】/, `${file}: 缺少必败局面的方差原则`);
  assert.match(c, /「稳健」的期望值是零/, `${file}: 没有解释为什么必败时求稳无意义`);

  // ── 2. 狼人 guide：悍跳的队形 ──────────────────────────────────────────────
  assert.ok(g.includes('【悍跳不是一个人的事——先算票，再算说辞】'), `${file}: 狼人 guide 缺少悍跳队形`);
  assert.match(g, /取决于【最后有多少票压得上去】/, `${file}: 没有点明悍跳的价值由票数决定`);
  assert.match(g, /而是全队「谁都不沾边」/, `${file}: 没有点名最常见的失败形态`);
  assert.match(g, /1v7/, `${file}: 没有写出孤身悍跳的实际局面`);
  assert.match(g, /狼队至少要有两个人在场上干活/, `${file}: 没有给出"至少两人干活"的硬要求`);

  // 站边必须站死；半站边和装中立都是零价值
  assert.match(g, /而且要【站死】/, `${file}: 没有要求站边站死`);
  assert.match(g, /半站边（「我倾向他，但再看看」）不改变任何人的决策成本/, `${file}: 没有解释半站边为什么等于没站`);
  // 倒钩 ≠ 装中立，这是最容易混的一处
  assert.match(g, /倒钩是【主动站到对面】，不是装中立/, `${file}: 没有区分倒钩和装中立`);
  assert.match(g, /装中立既不给悍跳位选票、也不给自己换来任何东西，是最差的一种/, `${file}: 没有判定装中立是最差解`);

  // ── 3. 狼人 guide：报什么决定之后是几打几 ──────────────────────────────────
  assert.ok(g.includes('【报什么，决定你之后是几打几】'), `${file}: 缺少查杀/金水的取舍`);
  assert.match(g, /只发查杀：你制造了一个敌人，却没有制造任何盟友/, `${file}: 没有说明只发查杀的结构问题`);
  assert.match(g, /顺利的话是 2v6/, `${file}: 没有写出发金水的收益`);
  // 金水的代价必须写，否则会变成无脑发金水
  assert.match(g, /代价是两张牌绑死在一起/, `${file}: 没有写出金水的代价`);
  assert.match(g, /真预言家之后验到他，你当场死/, `${file}: 没有写出金水最硬的那个风险`);
  // 也不能变成"只发金水"
  assert.match(g, /完全不发查杀同样不行/, `${file}: 没有堵住"只发金水"这条路`);
  assert.match(g, /一个只发金水、从不推人的预言家，本身就是破绽/, `${file}: 没有解释为什么只发金水会被识破`);
  // 判据必须是票数账，不是"听起来可不可信"
  assert.match(g, /【我这边多几票、对面少几票】/, `${file}: 取舍判据不是票数账`);
  assert.match(g, /而不是「哪个听起来更可信」/, `${file}: 没有否掉"听起来可信"这个错误判据`);

  // ── 4. 不能把原来那句"只列工具名"的话删掉——它仍然是对的，只是不够 ──────────
  assert.ok(g.includes('这些都是工具,什么时候用看本局判断'), `${file}: 原有的"工具不是模板"提醒被删了`);
  assert.ok(g.includes('不要列招式名词、不要套模板'), `${file}: 原有的反模板提醒被删了`);
}

console.log('decision cost: principle in core teaching, fake-claim formation and vote arithmetic in the wolf guide');
