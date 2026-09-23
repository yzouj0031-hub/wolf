// 「前面自报平民、后面跳神」的定档。
//
// 起因：这个组合几乎每局都被当成铁狼点。按本项目自己的标尺它不配铁证：
//   · 顺序本身狼和好人都做得出来；
//   · 白天发言提示明确授权藏身份的神职"使用符合规则的公开假口径"——这个行为常常
//     正是教学层自己批准的打法；
//   · 他一句"我当时在藏"就能回应。
//
// ★ 第一版写过头了，一局实测把两处毛病都暴露了出来：
//   ① 写成了"不是狼点""白攻击"。可那一局里，警上说"我不是神职、没有记录"、被查杀后
//      跳进一个已被占用的摄梦人位的，正是狼。被查杀后才穿衣服的狼确实比真神更常走这条路，
//      似然比 > 1。它是 C 级，不是零——在双方结构五五开时，它恰好是打破平局的那一点重量。
//   ② 给的替代打法自相矛盾："当平民时说我什么都不知道，补跳后却报得出刀口"——这正是
//      理由②刚批准的那种伪装，他一句"我在藏"就解释掉了。
//      修正：别对他的【话】（伪装允许说假话），对他的【行动】（伪装不需要逆着自己的信息投票）。
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
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

  // ── 1. ★ 定档是 C，不是零 ──────────────────────────────────────────────────
  assert.ok(c.includes('【「前面自报平民、后面跳神」是C级，别当铁狼点】'), `${file}: 没有给这个组合定档`);
  // 第一版的过度降级措辞不能回流
  assert.ok(!c.includes('不是狼点，别拿顺序当证据'), `${file}: 第一版"不是狼点"的过度降级回流了`);
  assert.ok(!c.includes('点名禁止的白攻击'), `${file}: 第一版"白攻击"的说法回流了`);
  assert.match(c, /但C级不是零/, `${file}: 没说清C级不等于零`);
  assert.match(c, /被查杀后才穿衣服的狼确实比真神更常走这条路/, `${file}: 没给出它仍有分量的理由`);
  assert.match(c, /在双方结构已经五五开、\s*别的证据都抵消掉的时候，它可以当打破平局的那一点重量/, `${file}: 没写出C级的正当用法`);
  assert.match(c, /它不能做的，\s*是在没有其他结构支撑时单独定罪/, `${file}: 没写出C级的边界`);

  // ── 2. 为什么只是 C：三条理由 ──────────────────────────────────────────────
  assert.match(c, /顺序本身狼和好人都做得出来/, `${file}: 缺少理由①`);
  assert.match(c, /藏身份的神职本来就被允许使用公开假口径/, `${file}: 缺少理由②`);
  assert.match(c, /他一句「我当时在藏」就能回应/, `${file}: 缺少理由③`);
  assert.match(c, /不能在他\s*推翻它的时候按铁证收利息/, `${file}: 缺少内部一致性那条`);

  // ── 3. ★ 替代打法：对行动，不对话 ─────────────────────────────────────────
  // 第一版的例子自相矛盾（拿被批准的伪装去对账），不能回流
  assert.ok(!c.includes('当平民时说「我昨晚什么都'), `${file}: 第一版自相矛盾的例子回流了`);
  assert.match(c, /别对他的【话】，对他的【行动】/, `${file}: 没有把对账对象从话换成行动`);
  assert.match(c, /是被允许的伪装，拿伪装去对账没有意义/, `${file}: 没说明为什么不能对话`);
  assert.match(c, /伪装允许说假话，但不需要逆着自己手里的信息去投票/, `${file}: 没说明为什么行动能对`);
  // 例子必须满足时序：私密信息在前、投票在后，否则违反时点知识账本
  assert.match(c, /验人在前、投票在后，他当时已经知道/, `${file}: 例子没有交代时序，会和时点知识账本打架`);
  assert.match(c, /能不能靠补跳之前已经公开的信息倒填/, `${file}: 缺少倒填检验`);

  // ── 4. 护栏 ────────────────────────────────────────────────────────────────
  assert.match(c, /这条不是禁止怀疑他，是禁止把顺序本身当铁证/, `${file}: 缺少护栏`);

  // ── 5. 它依赖的前提必须还在 ────────────────────────────────────────────────
  assert.ok(c.includes('【身份声明同标尺】'), `${file}: 身份声明同标尺被删了`);
  assert.ok(src.includes('【先后手不是身份公式】'), `${file}: 先后手不是身份公式被删了`);
  assert.ok(
    src.includes('也可以暂缓、部分披露或使用符合规则的公开假口径'),
    `${file}: 藏身份神职的假口径授权被删了，理由②会失去依据`,
  );
  assert.match(c, /C级：单次口误、记错规则、措辞混乱、改口/, `${file}: 改口的 C 级定档被改动了`);
  const iStd = c.indexOf('【身份声明同标尺】');
  const iOrder = c.indexOf('【「前面自报平民、后面跳神」是C级');
  assert.ok(iOrder > iStd, `${file}: 这条跑到了【身份声明同标尺】前面`);
}

console.log('claim order: villager-then-god is C-level (not zero), tie-breaker only, attack actions not cover words');
