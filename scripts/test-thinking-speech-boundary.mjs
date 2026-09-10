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
}
console.log('thinking/public speech boundary passed');
