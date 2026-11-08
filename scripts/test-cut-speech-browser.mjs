// 回复在半句被截断：连接中途断开（流里没有 [DONE]/finish_reason）或达到输出上限时，
// 发言截到最后一个完整句子；剩下太短就重问。正常结束的回复原样使用。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      $('g-url').value = 'https://api.example.test/v1'; $('g-key').value = 'k'; $('g-model').value = 'm';
      if ($('g-apitype')) $('g-apitype').value = 'openai';
      window.__DEMO__ = true; MODE_CONFIGS.cutSim = { name: 'c', count: 6, roles: ['seer','werewolf','villager','villager','guard','werewolf'] };
      for (const k in playerConfigs) delete playerConfigs[k];
      S.mode = 'cutSim'; S.pureAI = true; startGame(); window.__DEMO__ = false; S.round = 1; S.phase = 'day';
      const p = S.players[2];
      let queue = [];
      let calls = 0;
      window.fetch = async () => {
        calls++;
        const { text, end, finish } = queue.shift();
        let sse = 'data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n';
        if (finish) sse += 'data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] }) + '\n\n';
        if (end) sse += 'data: [DONE]\n\n';
        return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      };
      const ask = async (...items) => { queue = items; calls = 0; const out = await Promise.race([callAI(p, '【第1天·白天发言】说话。', { maxRetries: 2 }), new Promise(res => setTimeout(() => res({ game: 'TIMEOUT' }), 15000))]); return { game: out.game, calls }; };
      const longCut = '<thinking>想好了</thinking><game>我同意刀十二号。四个人选同一个目标，没什么好争的。第一夜谁都没有信息，刀谁都是赌，所以我不反对这一刀，也不打算再拖时间。另外，女巫会不会';
      return {
        dropped: await ask({ text: longCut, end: false }),
        length: await ask({ text: longCut, end: true, finish: 'length' }),
        normal: await ask({ text: '<game>我先听听后面的人怎么说。</game><action>None</action>', end: true, finish: 'stop' }),
        noTagsNormal: await ask({ text: '<game>我觉得三号可疑，因为他刚才改了口</game>', end: true, finish: 'stop' }),
        tooShort: await ask({ text: '<game>我同意。另外女巫会不会', end: false }, { text: '<game>我同意刀十二号，先这样。</game>', end: true, finish: 'stop' }),
        claude: await (async () => {
          // Claude 官方接口：非流式，停止原因在 stop_reason
          if ($('g-apitype')) $('g-apitype').value = 'anthropic';
          $('g-url').value = 'https://api.anthropic.com';
          const runA = async (text, stop) => {
            window.fetch = async () => new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
            const out = await Promise.race([callAI(p, '【第1天·白天发言】说话。', { maxRetries: 1 }), new Promise(res => setTimeout(() => res({ game: 'TIMEOUT' }), 15000))]);
            return out.game;
          };
          return { refusal: await runA(longCut, 'refusal'), maxTok: await runA(longCut, 'max_tokens'), normal: await runA('<game>我先听听后面的人怎么说。</game>', 'end_turn') };
        })(),
      };
    });
    assert.equal(r.dropped.game, '我同意刀十二号。四个人选同一个目标，没什么好争的。第一夜谁都没有信息，刀谁都是赌，所以我不反对这一刀，也不打算再拖时间。', `${file}: 连接断开的半句没有截掉 ${JSON.stringify(r.dropped)}`);
    assert.equal(r.length.game, '我同意刀十二号。四个人选同一个目标，没什么好争的。第一夜谁都没有信息，刀谁都是赌，所以我不反对这一刀，也不打算再拖时间。', `${file}: 达到输出上限的半句没有截掉 ${JSON.stringify(r.length)}`);
    assert.equal(r.normal.game, '我先听听后面的人怎么说。', `${file}: 正常结束的回复被改了`);
    assert.equal(r.noTagsNormal.game, '我觉得三号可疑，因为他刚才改了口', `${file}: 正常结束、只是没写句号的发言不应被截`);
    assert.equal(r.tooShort.game, '我同意刀十二号，先这样。', `${file}: 截完太短时应重问 ${JSON.stringify(r.tooShort)}`);
    assert.equal(r.tooShort.calls, 2, `${file}: 截完太短时应再请求一次`);
    const full = '我同意刀十二号。四个人选同一个目标，没什么好争的。第一夜谁都没有信息，刀谁都是赌，所以我不反对这一刀，也不打算再拖时间。';
    assert.deepEqual(r.claude, { refusal: full, maxTok: full, normal: '我先听听后面的人怎么说。' }, `${file}: Claude 官方接口的中途停止没有处理 ${JSON.stringify(r.claude)}`);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${file}: cut-off replies trimmed to the last full sentence; normal replies untouched`);
  });
}
console.log('cut speech salvage OK');
