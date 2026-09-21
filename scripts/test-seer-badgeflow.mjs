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

function core(file) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const a = src.indexOf('const WB_CORE_COMPACT = `');
  const b = src.indexOf('\n\nconst WB_RULES_COMPACT', a);
  assert.ok(a >= 0 && b > a, `${file}: WB_CORE_COMPACT 未找到`);
  return src.slice(a, b);
}

function seerGuide(file) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const a = src.indexOf("id:'seer'");
  const b = src.indexOf("id:'witch'", a);
  assert.ok(a >= 0 && b > a, `${file}: 预言家角色定义未找到`);
  return src.slice(a, b);
}

for (const file of FILES) {
  const g = seerGuide(file);
  const c = core(file);

  // ── 0. ★ 症状修复：警上跳又不跳、攥着查杀不发 ──────────────────────────────
  // 起因是我把对跳那段写到 930 字，占了整份 guide 一半以上，把「要么跳要么闭嘴」
  // 的规则（当时只有 184 字）彻底淹没，模型读完的印象变成「对跳很复杂很危险」→ 在
  // 跳不跳这一步畏手畏脚。所以除了压缩对跳段，还要把「有查杀就发」钉成硬规则。
  assert.ok(g.includes('【⚠️ 手里有查杀就发，别攥着】'), `${file}: 缺少"有查杀就发"的硬规则`);
  // 判据是【价值会归零】，不是"要果断"——查杀今天能执行，而你今晚可能就死了
  assert.match(g, /它是【今天就能执行】的东西/, `${file}: 没说明查杀为什么不能攥着`);
  assert.match(g, /攥着它死，等于把它带进棺材/, `${file}: 没写出攥着查杀的真实代价`);
  assert.match(g, /越晚发越要解释"为什么当时不说"/, `${file}: 没写出拖延的额外代价`);
  // 金水/查杀的不对称要讲清楚，否则会变成"什么都立刻发"
  assert.match(g, /金水可以留/, `${file}: 没有区分金水和查杀`);
  // 不跳仍然合法，但要收紧到唯一的成立条件
  assert.match(g, /「不跳」只在一种局面成立/, `${file}: 把"不跳"整个否掉了，这是过度修正`);
  assert.match(g, /有查杀却不跳，不是策略，是浪费/, `${file}: 没有直接点名这个症状`);

  // ── 0a. ★ 跳是【默认】，不是和"不跳"并列的两个选项 ───────────────────────────
  // 上一版标题写的是「跳与不跳是你的策略选择」，把两者摆成对等的分支，模型读完就在
  // 警上扭扭捏捏：又想跳又想留一手。实战里绝大多数局面都应该先跳，不跳是例外。
  assert.ok(g.includes('【默认就是跳。不跳是例外，门槛很高】'), `${file}: "跳"没有被写成默认选项`);
  assert.ok(!g.includes('【跳与不跳是你的策略选择】'), `${file}: 旧的"跳/不跳对等"标题还在`);
  // 三条理由缺一不可——只说"要跳"是命令，给不出理由模型就会在具体局面里自己推翻它
  assert.match(g, /定义权就落到悍跳狼手里/, `${file}: 缺少理由①：不跳等于把定义权让出去`);
  assert.match(g, /沉默买不到安全/, `${file}: 缺少理由②：不跳并不能换来安全`);
  assert.match(g, /会把你当成潜水的可疑位/, `${file}: 没写出"不跳反而会被误解"这个实际后果`);
  assert.match(g, /晚跳要还债/, `${file}: 缺少理由③：晚跳的公信力代价`);
  assert.match(g, /你为什么早不说/, `${file}: 没写出晚跳会被追问什么`);
  // 例外条件要同时卡死两头，否则"等更好时机"会变成万能借口
  assert.match(g, /只要你有查杀、或者场上已经有人悍跳/, `${file}: 例外条件没有卡死`);
  assert.match(g, /就不存在"等更好时机"这回事/, `${file}: 没有堵住"等更好时机"这个借口`);
  // 警长竞选是第一个时机，症状正是发生在这里
  assert.match(g, /警长竞选就是第一个时机，别在台上含糊其辞留半句/, `${file}: 没有点名竞选阶段`);

  // ── 0b. ★ 比例：对跳段不能再压过"跳不跳"的规则 ─────────────────────────────
  const iJump = g.indexOf('【默认就是跳。不跳是例外，门槛很高】');
  const iTiming = g.indexOf('【⚠️ 报查验理由时的时序铁律');
  const iDual = g.indexOf('【验对跳你的人');
  const iSpeak = g.indexOf('【跳出来后,发言重点是什么】');
  assert.ok(iJump >= 0 && iTiming > iJump && iDual > iTiming && iSpeak > iDual, `${file}: guide 段落顺序被打乱`);
  const jumpRules = iTiming - iJump;            // 跳/不跳 + 禁止中间状态 + 有查杀就发
  const dualClaim = iSpeak - iDual;             // 对跳相关
  assert.ok(jumpRules >= 380, `${file}: 管"跳不跳"的规则只有 ${jumpRules} 字，太容易被别的段落淹没`);
  assert.ok(dualClaim < jumpRules * 1.6, `${file}: 对跳段 ${dualClaim} 字 vs 跳不跳规则 ${jumpRules} 字，比例失衡`);

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
  // 「怎么分辨对跳者」是所有人都要做的判断，不该只塞在预言家 guide 里——那既挤爆了
  // 这份 guide 的比例，也让别的角色读不到。所以内容放核心层，guide 只留指路。
  assert.ok(c.includes('【对跳者是悍跳狼还是挡刀好人：算他付了什么代价】'), `${file}: 核心层缺少对跳者的分辨方法`);
  assert.match(c, /好人假跳身份替真神挡刀是正当打法/, `${file}: 核心层没有先声明假跳不定罪`);
  assert.match(g, /怎么分辨见通用教学里的【对跳者是悍跳狼还是挡刀好人】/, `${file}: 预言家 guide 没有指向通用教学`);

  // ★ 三条信号必须带上「为什么是这三条」。只列信号不给理由，读的人会自然翻译成
  //   「看他诚不诚恳」——这正是【零成本行为不分阵营】点名禁止的那类判据。
  assert.ok(c.includes('是否编造污染性假信息'), `${file}: 行为分辨线索被删了`);
  assert.ok(c.includes('是否抢归票'), `${file}: 行为分辨线索被删了`);
  assert.match(c, /只有狼需要污染场上信息，挡刀的好人污染了等于害自己队/, `${file}: 没说明"污染信息"为什么能用`);
  assert.match(c, /只有狼需要定义权/, `${file}: 没说明"抢归票"为什么能用`);
  // 退水的分量来自价格差，不是来自"显得干脆"
  assert.match(c, /退水对悍跳狼【极贵】/, `${file}: 没写出退水对狼的代价`);
  assert.match(c, /对挡刀好人却很便宜/, `${file}: 没写出退水对挡刀好人的代价`);
  // 统一判据：贵不贵，不是像不像
  assert.match(c, /衡量【这个动作对狼来说贵不贵】，不是【他像不像好人】/, `${file}: 三条信号缺少统一判据`);
  assert.match(c, /他显得诚恳、解释得通顺、动机讲得感人，全都零成本/, `${file}: 没有排除零成本信号`);
  // 动机解释同样要按"有没有把自己绑进去"算
  assert.match(c, /事后无法核对，是便宜话/, `${file}: 没有区分便宜的动机解释`);
  assert.match(c, /把自己未来的行动锁死了，说错要付代价——这才算/, `${file}: 没有给出有分量的动机解释长什么样`);
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
