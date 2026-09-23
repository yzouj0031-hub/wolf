import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const start = html.indexOf('function parseAI(c, opts)');
  const end = html.indexOf('// ★ v9.6 抽出全局 SSE', start);
  const ctx = vm.createContext({console});
  vm.runInContext(html.slice(start, end), ctx);
  const thoughts = '**Assessing suspect 2 evidence** **我继续核对7号的投票逻辑** **我在核对查验线索** **我在整理刀药记录** **权衡是否公开身份**';
  for (const privateText of [thoughts, thoughts + '\n\n我的发言：我是女巫，昨晚救了自己，毒药还在。']) {
    for (const [body, opts] of [
      ['', {_nativeThinking:privateText}],
      ['<thinking>' + privateText + '</thinking>', {}],
      ['<thinking>' + privateText, {}],
    ]) {
      const r = ctx.parseAI(body, opts);
      assert.ok(!r.game || r.game === '(沉默)', file + ': private thinking became public speech: ' + r.game);
    }
  }
  // 裸 content：既没有 <thinking> 也没有 <game>，模型把"推理摘要标题"直接当回复交上来。
  // 这条路此前是开着的——摘要会被原样念成公开发言，后置位还会拿"我在整理刀药记录"
  // 反推他是女巫/神职，一次技术故障凭空造出一张身份牌。
  for (const bare of [
    thoughts,
    '**我在整理刀药记录****权衡是否公开身份**',        // 被截断后只剩两片
    '**Assessing suspect 2 evidence**\n**Weighing whether to reveal identity**',
  ]) {
    for (const opts of [{}, {_nativeThinking: thoughts}]) {
      const r = ctx.parseAI(bare, opts);
      assert.ok(!r.game || r.game === '(沉默)', file + ': reasoning summary became public speech: ' + r.game);
    }
  }

  // ── 不能误伤：真发言里出现粗体强调是正常的 ──────────────────────────────────
  const emphasised = '我是**女巫**。昨晚我救了自己，毒药还在手上。今天我投白马探，理由是他在7号跳预言家之后立刻改口，这一点必须解释清楚。';
  assert.equal(ctx.parseAI(emphasised, {}).game.includes('毒药还在手上'), true, file + ': 带粗体强调的正常发言被误拦');
  // 用了协议的一律放行，哪怕整段都是粗体
  assert.equal(
    ctx.parseAI('<game>**我是预言家，昨晚查验白马探是狼人，今天必须出他。**</game>').game,
    '我是预言家，昨晚查验白马探是狼人，今天必须出他。',
    file + ': 带 <game> 标签的发言被误拦',
  );
  // 只有一段粗体的短发言不算摘要堆叠（过短自有下游重写兜底，不该在这里判死）
  assert.equal(ctx.parseAI('**我跟票投白马探。**', {}).game, '我跟票投白马探。', file + ': 单段粗体短发言被误拦');

  const speech = '我是女巫，昨晚救了自己。今天我投白马，请核对昨天的票型。';
  assert.equal(ctx.parseAI(speech, {_nativeThinking:thoughts}).game, speech);
  assert.equal(ctx.parseAI('<thinking>' + thoughts + '</thinking><game>' + speech + '</game>').game, speech);
  assert.equal(ctx.parseAI('<thinking>' + thoughts + '</thinking>' + speech).game, speech);
  assert.ok(!html.includes('rescueGameFromThinking'), file + ': secondary publisher still recovers private thinking');

  // ── 行动占位符漏进公开发言 ──────────────────────────────────────────────────
  // 实战：警长两天的发言末尾都挂着一行孤零零的 "None"，战报里单独成行。模型把
  // <action>None</action> 的占位符写进了 <game>，或者干脆没用标签。
  const tail = '今天票落在五号，理由是他的发言太圆，这一点必须解释清楚，剩下的账明天接着算。';
  for (const raw of [
    '<thinking>t</thinking><game>' + tail + '\n\nNone</game>',
    '<thinking>t</thinking>' + tail + '\n\nNone',
    '<thinking>t</thinking><game>' + tail + '\nnull</game>',
  ]) {
    const r = ctx.parseAI(raw, {});
    assert.equal(r.game, tail, file + ': action placeholder leaked into public speech: ' + JSON.stringify(r.game.slice(-12)));
    assert.equal(r.action, 'None', file + ': stripped placeholder was not kept as the action');
  }
  // 不能误伤：正文里正常提到 None / 无 的句子，以及已有的真 action
  const mention = '他说他的警徽流是None，这种写法我没见过，今天先记账，票还是落在五号身上。';
  assert.equal(ctx.parseAI('<game>' + mention + '</game>').game, mention, file + ': a sentence mentioning None was mangled');
  const withVote = ctx.parseAI('<game>' + tail + '\nNone</game><action>白马探</action>');
  assert.equal(withVote.action, '白马探', file + ': stripping the placeholder overwrote a real action');
}
console.log('thinking/public speech boundary passed');
