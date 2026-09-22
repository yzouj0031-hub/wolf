// 女巫不敢抛毒：问题出在"数人数"那一步，不在胆量。
//
// 现象：残局 4 好人 vs 4 狼的赛点上，女巫仍然选择留毒。留下来的毒药在天亮结算时
// 直接烂在手里——系统判狼胜，白天根本不会到来。
//
// 原来的【终局毒药必须算账】已经写了"先把人数数一遍"，但没写【怎么数】，而 AI 恰好
// 在这一步系统性地数错，且两个错误都偏向"还不着急"：
//   ① 按自己相信的那套身份归类死者。那通常是最乐观的一份牌面（"我觉得昨天出的那个是狼，
//      所以现在还有 6 好人"），于是永远得出"再等一夜也来得及"。
//   ② 只算今晚，不算明天天亮。少算了狼今晚那一刀，就看不见"明天没有白天"这件事。
//
// 第二块是选目标时的思路：AI 会卡在"他到底是不是狼"上反复掂量把握，因为不够确定而
// 什么都不做。正确的算法是把两种假设摊开各算一遍——而代价和假设是绑在一起的，你搞错的
// 那个假设常常恰好是你方赔得起的那个。这条不是女巫专用，所以放在核心层。
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FILES = ['index.html', 'en/index.html'];

function witchGuide(file) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const a = src.indexOf("id:'witch'");
  const b = src.indexOf('reg({', a + 10);
  assert.ok(a >= 0 && b > a, `${file}: 女巫角色定义未找到`);
  return src.slice(a, b);
}

function core(file) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const a = src.indexOf('const WB_CORE_COMPACT = `');
  const b = src.indexOf('\n\nconst WB_RULES_COMPACT', a);
  assert.ok(a >= 0 && b > a, `${file}: WB_CORE_COMPACT 未找到`);
  return src.slice(a, b);
}

for (const file of FILES) {
  const g = witchGuide(file);
  const c = core(file);

  // ── 1. ★ 怎么数人数：两条纠错必须都在 ────────────────────────────────────────
  // 只说"先数一遍"是没用的，AI 会数出一份最乐观的牌面然后心安理得地留毒。
  assert.match(g, /死者按【最坏情况】归类/, `${file}: 没有要求按最坏情况归类死者`);
  assert.match(g, /已死的人先当成好人、死掉的跳神位先当成真神/, `${file}: 最坏情况的具体做法没写清`);
  assert.match(g, /按你自己相信的那套身份去数，得到的永远是最乐观的一份牌面/, `${file}: 没有点名"按自己的判断数"这个错误`);
  assert.match(g, /算到【明天天亮】，不是算今晚/, `${file}: 没有要求把结算点推到明天天亮`);
  assert.match(g, /今晚狼还会再刀掉一个好人，把这一刀先算进去/, `${file}: 没有把狼今晚那一刀算进去`);

  // ── 2. ★ 赛点：留毒的代价必须写成"价值归零"，不是"错过机会" ──────────────────
  assert.match(g, /没有明天的白天/, `${file}: 没写出赛点上留毒会直接失去使用机会`);
  assert.match(g, /连一场投票都换不到/, `${file}: 没写出留下的毒药换不到任何东西`);
  assert.match(g, /今晚就是赛点/, `${file}: 没有给这个局面命名`);
  assert.match(g, /空毒不是谨慎，是把胜负交给狼队的刀/, `${file}: 没有直接点名"空毒"这个症状`);
  // 原有的期望值论证不能丢
  assert.match(g, /没出手的毒药在结算时价值恒为零/, `${file}: 期望值论证被删了`);
  assert.match(g, /一发五成把握的毒药，期望是半匹狼/, `${file}: 期望值论证被删了`);

  // ── 3. 反过度修正：这条只能在残局生效，前期自检必须还在且在它前面 ──────────────
  // 否则会从"不敢抛毒"直接翻到"首夜就乱毒"。
  assert.match(g, /这条只在残局生效，不推翻上面的自检/, `${file}: 残局限定被删了，会变成鼓励前期乱毒`);
  const iCheck = g.indexOf('【用毒前自检】');
  const iEnd = g.indexOf('【终局毒药必须算账');
  assert.ok(iCheck >= 0, `${file}: 【用毒前自检】被删了`);
  assert.ok(iEnd > iCheck, `${file}: 终局条款跑到了自检之前，读到的顺序变成"先放开、后收紧"`);
  assert.match(g, /把握不足可以留毒，证据充分也不要带毒进棺材/, `${file}: 自检里的双向约束被删了`);

  // ── 4. ★ 选目标：从"把握有几成"换成"两个假设各算一遍" ──────────────────────
  assert.match(g, /别再纠缠"他到底是不是狼"/, `${file}: 女巫 guide 没有把选目标从概率掂量里拽出来`);
  assert.match(g, /看毒他在两种假设下是不是都能接受/, `${file}: 没有给出选目标的替代算法`);
  assert.match(g, /找不到这样的目标，就按当前概率最高的怀疑对象出手/, `${file}: 没写出找不到占优目标时怎么办`);
  // 内容在核心层（所有角色都会卡在"他到底是谁"上），guide 只留指路
  assert.ok(
    c.includes('【卡在"他到底是谁"的时候，改算两个假设下的后果】'),
    `${file}: 核心层缺少两假设检查`,
  );
  assert.ok(
    g.includes('用通用教学里的【卡在"他到底是谁"的时候，改算两个假设下的后果】'),
    `${file}: 女巫 guide 没有指向核心层那条`,
  );

  // ★ 关键的那一层：代价不是常数，它和假设绑在一起。缺了这层，"两个假设都算一遍"会
  //   退化成"算完还是不敢做"——因为毒错好人的代价看起来永远太贵。
  assert.match(c, /代价和假设是【绑在一起】的，不是一个固定数字/, `${file}: 没写出代价与假设相关`);
  assert.match(
    c,
    /你搞错的那个假设，常常恰好\s*就是你方还宽裕、错得起的那个假设/,
    `${file}: 没写出"搞错的那个世界里你方反而宽裕"`,
  );
  assert.match(c, /不要把"万一搞错了"当成一个常数去怕/, `${file}: 没有直接纠正把风险当常数的算法`);
  // "什么都不做"要被明确标成一个选项，而且是会输的那个
  assert.match(c, /"什么都不做"经常是唯一一个一定输的选项/, `${file}: 没有把"不行动"也算成一个有代价的选项`);
  // 反向护栏：不能变成"反正两种假设都算过了，随便梭"
  assert.match(
    c,
    /只要有一种假设下的后果是你承受不起的，这条就不适用，回到按概率下注/,
    `${file}: 两假设检查没有护栏，会被用来给任何冒险背书`,
  );
}

console.log('poison endgame: worst-case head count, match-point projection and the two-hypothesis dominance check');
