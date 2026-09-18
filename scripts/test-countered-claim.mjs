// 被查杀之后怎么自辩。
//
// 缺口是这样发现的：「查杀」两个字在活的教学层里【出现 0 次】——被报查杀之后该做什么，
// 一个字都没教。而 AI 的第一反应几乎总是"我是平民，他的查杀是假的"，然后当天被投出去。
//
// 真正要命的是：解释这件事的原则【本来就在】——【零成本行为不分阵营】那段已经写了
// "真正有分量的是要付代价的东西"。但整段是从【怎么评估别人】的角度写的，从没从
// 【你自己被指控时】的角度说过。而"我是平民"正是那段所说的零成本声明的教科书例子。
//
// 这个测试守住两件事：条目在核心层里、而且教的是「交出要付代价的东西」而不是「显得更诚恳」。
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

for (const file of FILES) {
  const c = core(file);

  assert.ok(c.includes('【被查杀之后：自辩的重量等于你交出了什么】'), `${file}: 缺少被查杀后的自辩条目`);

  // ── 核心判据：为什么"我是平民"没用 ──────────────────────────────────────────
  // 两层原因缺一不可。只讲"没人信"是错的——真正的结构是【零成本】+【出错代价小】。
  assert.match(c, /零成本、零信息/, `${file}: 没有点明"我是平民"是零成本声明`);
  assert.match(c, /出错一张平民牌，好人损失小/, `${file}: 没有点明真正要命的那一层——投错的代价低`);
  assert.match(c, /他们不是不信你，是【不需要】信你/, `${file}: 没有区分"不被相信"和"不需要相信"`);
  // 方向必须是"让投错你变贵"，不是"显得更诚恳"——后者正是 AI 的默认失败模式
  assert.match(c, /不是显得更诚恳/, `${file}: 没有否掉"更诚恳"这条死路`);
  assert.match(c, /让"投错你"这件事变贵/, `${file}: 没有给出正确的努力方向`);

  // ── 必须按真实身份分开教，不能一句"跳神职"了事 ──────────────────────────────
  assert.match(c, /你确实是神职：现在就是跳的时刻/, `${file}: 没有教真神职该跳`);
  assert.match(c, /憋着不跳等于自愿把自己降级/, `${file}: 没有说明憋着不跳的代价`);
  assert.match(c, /你确实是平民：/, `${file}: 没有单独教平民怎么办`);
  // 平民手里只有承诺，这是【零成本原则】的正面应用
  assert.match(c, /那就打【承诺】/, `${file}: 没有教平民用承诺代替身份`);
  assert.match(c, /锁死的\n?\s*表态说错了要自己承担后果，所以它有重量/, `${file}: 没有解释承诺为什么有重量`);

  // ★ 不能变成"被查杀就去冒充神职"。那是拿阵营胜率买个人的一天，代价记在好人账上。
  assert.match(c, /冒充神职确实能换来一时的注意力/, `${file}: 没有正面处理"平民悍跳"这个选项`);
  assert.match(c, /稀释真神的公信力/, `${file}: 没有说明冒充神职对好人阵营的伤害`);
  assert.match(c, /拿阵营的\n?\s*胜率买你个人的一天/, `${file}: 没有点明这笔账记在谁头上`);

  // ── 反打查杀者只能打可验证的点 ──────────────────────────────────────────────
  assert.match(c, /只打【可验证】的点/, `${file}: 没有约束反打的方式`);
  assert.match(c, /"我觉得他是假的"和"我是平民"一样零成本/, `${file}: 没有把"我觉得他假"也归为零成本`);

  // ── 给其他人的对应一条：别把"代价小"当成"辩解无力"的证据 ──────────────────────
  assert.match(c, /"投错平民代价小"不是"他辩解无力"的证据/, `${file}: 缺少给场上其他人的对应约束`);
  assert.match(c, /代价小只决定你愿意为他冒多大风险，不决定他说的话有几分真/, `${file}: 没有把两件事拆开`);

  // ── 位置：必须紧跟【零成本行为不分阵营】，它是那条原则的应用 ──────────────────
  const zero = c.indexOf('【零成本行为不分阵营');
  const self = c.indexOf('【被查杀之后');
  assert.ok(zero >= 0 && self > zero, `${file}: 新条目没有跟在【零成本行为不分阵营】之后`);
  const between = c.slice(zero, self);
  assert.ok(!/^【/m.test(between.slice(1)), `${file}: 两段之间插进了别的条目，耦合被打断`);

  // ── 不能和既有条目打架 ──────────────────────────────────────────────────────
  // 【身份声明同标尺】说自报平民只能暂留；新条目说的是"自报平民对你自己没用"，两者一致。
  assert.ok(c.includes('自报平民只能暂留'), `${file}: 既有的【身份声明同标尺】被改坏了`);
}

console.log('countered claim: zero-cost self-defence, role-split guidance, fake-claim cost stated and evidence separation passed');
