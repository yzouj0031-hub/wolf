// 内心独白 / 输出协议元语言泄漏到公开发言的回归测试。
// 场景：模型没打 <thinking>/<game> 标签，把"我要表现得像…遵约填None…写一版：'…'"整段当发言交了，
// 顺手把狼队友名字念了出来。修复只认输出协议词，截到最后一个协议词之后的正文；不碰跳神职/报查验。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(new URL(file, root), 'utf8');
  const start = html.indexOf('  function stripLeakedMonologue(game) {');
  const end = html.indexOf('  // ── 预处理：统一各模型的标签格式 ──', start);
  assert.ok(start >= 0 && end > start, `${file}: stripLeakedMonologue 未找到`);
  const strip = vm.runInNewContext(`${html.slice(start, end)}; stripLeakedMonologue`, {});

  // ── 截图里的真实泄漏形态（缩写）：思考 → 契约复述 → 写一版："…" → 评注 → 最终正文 ──
  const leaked = '当前任务说明就是遗言，明确写dead了说几句，action None。若系统需要咬人目标会另外给任务。遵约填None。'
    + '遗言内容（保持赤井风格）：已经暴露了也无妨——我别在遗言里把Yumeko卖了！绝不能。我要表现得像个被冤死的好人。'
    + '写一版："（把帽子摘下来放在桌上）这局我输在自己的一步上。新一，你的愚者账我说不过你。"'
    + '含糊、不供出Yumeko、不卖任何夜间信息、保持角色魅力。字数合适。'
    + '*把帽子摘下来，轻轻放在桌上* 这局我输在自己的一步上。昨天单挂白马，我赌的是拆骨架比拆发动机值钱——赌错了方向。新一，到死我还是那句话：真愚者握了四夜的盾，不会把自己盾的机制说错。等天亮翻牌的时候，替我看看这局最后亮出来的，到底是什么颜色。';
  const r = strip(leaked);
  assert.equal(r.stripped, true, `${file}: 应识别出协议元语言`);
  assert.ok(r.game.startsWith('*把帽子摘下来，轻轻放在桌上*'), `${file}: 应截到最后一个协议词之后的正文，实际：${r.game.slice(0, 40)}`);
  assert.doesNotMatch(r.game, /Yumeko|action|None|写一版|字数合适|遵约|任务说明/, `${file}: 截后正文仍含泄漏/协议词`);

  // ── 只剩草稿、没有正文 → 判空（由 parseAI 转为沉默），而不是把草稿念出来 ──
  const draftOnly = '当前任务说明就是遗言，action None。我要表现得像好人，不能把队友Yumeko卖了。字数合适。';
  const d = strip(draftOnly); assert.equal(d.stripped, true); assert.equal(d.game, '', `${file}: 纯草稿应判空`);

  // ── 合法发言一律不碰：跳神职、报查验、对跳、含"行动/游戏/思考"等普通词 ──
  for (const ok of [
    '我是预言家，昨晚验了P5，P5是狼人。警徽流先验P3再验P8。',
    '我才是真预言家，P8是悍跳，他给P10的金水是假的。',
    '我是女巫，昨晚刀口在P2，我用解药救了。毒药还在。',
    '大家冷静一点，想想昨天的行动和票型，这个游戏靠的是逻辑不是感觉。',
    '我思考了一下P7的发言，他的前提站不住。',
    'I am the seer. I checked P5 last night and P5 is a werewolf.',
  ]) {
    const rr = strip(ok);
    assert.equal(rr.stripped, false, `${file}: 误伤合法发言：${ok}`);
    assert.equal(rr.game, ok);
  }

  // ── parseAI 已接入，且截空时转沉默 ──
  assert.ok(html.includes("game = _ml.game || (requireGame ? '(沉默)' : '');"), `${file}: parseAI 未接入 stripLeakedMonologue`);
  assert.ok(html.includes('_monologueStripped };'), `${file}: parseAI 返回值缺少 _monologueStripped`);
}
console.log('monologue leak test passed');
