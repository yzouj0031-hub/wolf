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
  const speech = '我是女巫，昨晚救了自己。今天我投白马，请核对昨天的票型。';
  assert.equal(ctx.parseAI(speech, {_nativeThinking:thoughts}).game, speech);
  assert.equal(ctx.parseAI('<thinking>' + thoughts + '</thinking><game>' + speech + '</game>').game, speech);
  assert.equal(ctx.parseAI('<thinking>' + thoughts + '</thinking>' + speech).game, speech);
  assert.ok(!html.includes('rescueGameFromThinking'), file + ': secondary publisher still recovers private thinking');
}
console.log('thinking/public speech boundary passed');
