// 实际作答的模型：接口回复里的 model 字段和请求的对不上时，在对局日志里如实说一次（之后只记开发日志）。
//   覆盖三条路径：OpenAI 兼容（JSON 与 SSE 流）、Anthropic 原生（含 fallback 块）、Gemini 原生。
//   同一模型的不同写法（日期快照、preview、思考档位后缀、中转前缀）不算不一致。只做显示，不改请求。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(!/server-side-fallback|["']fallbacks["']\s*:|\bfallbacks:\s*["'\[]/.test(src), `${file}: 游戏不应替用户开启服务端换模型`);
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const out = {};
      out.same = [['gpt-5', 'gpt-5-2025-08-07'], ['claude-opus-5-5', 'claude-opus-5-5'], ['gemini-3-pro-high', 'gemini-3-pro'], ['gemini-2.5-pro', 'models/gemini-2.5-pro-preview-06-05'],
        ['[官]claude-fable-5-2', 'claude-fable-5-2'], ['anthropic/claude-opus-4-8', 'claude-opus-4-8'], ['GPT-5', 'gpt-5'], ['deepseek-reasoner', ''], ['', 'x']].map(([a, b]) => sameServedModel(a, b));
      out.diff = [['claude-fable-5-2', 'claude-opus-4-8'], ['claude-opus-5', 'claude-opus-5-5'], ['gpt-5', 'gpt-5-mini'], ['gpt-5', 'gpt-4o'], ['gemini-3-pro', 'gemini-3-flash'], ['claude-sonnet-5-5', 'claude-sonnet-5']].map(([a, b]) => sameServedModel(a, b));
      const lines = [];
      const realLog = Render.log;
      Render.log = (kind, text) => { if (kind === 'system' && /🔀/.test(String(text))) lines.push(String(text)); return realLog.apply(Render, [kind, text]); };
      const setup = (type, model) => {
        MODE_CONFIGS.served = { name: 's', count: 6, roles: ['villager', 'werewolf', 'villager', 'villager', 'seer', 'werewolf'] };
        for (const k in playerConfigs) delete playerConfigs[k];
        $('g-url').value = 'https://api.example.test/v1'; $('g-key').value = 'k'; $('g-model').value = model;
        if ($('g-apitype')) $('g-apitype').value = type;
        window.__DEMO__ = true; S.mode = 'served'; S.pureAI = true; startGame(); window.__DEMO__ = false; S.round = 1; S.phase = 'day';
        return S.players.find(x => x.role.id === 'villager');
      };
      const text = '<game>我先听听大家怎么说。</game>';
      const ask = async (type, model, respond, times = 1) => {
        const p = setup(type, model); lines.length = 0;
        let body = null;
        window.fetch = async (url, init) => { body = JSON.parse(init.body || '{}'); return respond(body); };
        let last;
        for (let i = 0; i < times; i++) last = await callAI(p, '【第1天·白天发言】这是第1天投票前唯一的一次发言。', { noMemory: true });
        return { lines: lines.slice(), game: last && last.game, sentModel: body && body.model, hasFallbacks: !!(body && ('fallbacks' in body)) };
      };
      const json = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
      const sse = (model) => new Response(['data: ' + JSON.stringify({ model, choices: [{ delta: { content: text } }] }), 'data: ' + JSON.stringify({ model, choices: [{ delta: {}, finish_reason: 'stop' }] }), 'data: [DONE]', ''].join('\n\n'), { status: 200, headers: { 'content-type': 'text/event-stream' } });
      const oai = model => b => b.stream ? sse(model) : json({ model, choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] });
      out.oaiSame = await ask('openai', 'gpt-5', oai('gpt-5-2025-08-07'));
      out.oaiSwapped = await ask('openai', 'gpt-5', oai('gpt-5-mini'), 3);
      out.oaiNoField = await ask('openai', 'gpt-5', b => b.stream
        ? new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } })
        : json({ choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }));
      const anth = (model, blocks) => () => json({ id: 'm', type: 'message', role: 'assistant', model, content: blocks, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      out.anthSame = await ask('anthropic', 'claude-fable-5-2', anth('claude-fable-5-2', [{ type: 'text', text }]));
      out.anthFallback = await ask('anthropic', 'claude-fable-5-2', anth('claude-opus-4-8', [{ type: 'fallback', from: { model: 'claude-fable-5-2' }, to: { model: 'claude-opus-4-8' } }, { type: 'text', text }]));
      out.anthSticky = await ask('anthropic', 'claude-fable-5-2', anth('claude-opus-4-8', [{ type: 'text', text }]));
      const gem = modelVersion => () => json({ modelVersion, candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
      out.gemSame = await ask('gemini', 'gemini-3-pro', gem('gemini-3-pro-preview-0325'));
      out.gemSwapped = await ask('gemini', 'gemini-3-pro', gem('gemini-3-flash'));
      Render.log = realLog;
      return out;
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    assert.deepEqual(r.same, r.same.map(() => true), `${file}: 同一模型的不同写法被当成不一致 ${JSON.stringify(r.same)}`);
    assert.deepEqual(r.diff, r.diff.map(() => false), `${file}: 不同的模型被当成一致 ${JSON.stringify(r.diff)}`);
    for (const k of ['oaiSame', 'oaiNoField', 'anthSame', 'gemSame']) {
      assert.deepEqual(r[k].lines, [], `${file} ${k}: 不应提醒 ${JSON.stringify(r[k].lines)}`);
      assert.ok(/我先听听/.test(r[k].game || ''), `${file} ${k}: 发言应照常返回`);
    }
    assert.equal(r.oaiSwapped.lines.length, 1, `${file}: 同一种替换一局只在日志里说一次 ${JSON.stringify(r.oaiSwapped.lines)}`);
    assert.ok(r.oaiSwapped.lines[0].includes('gpt-5') && r.oaiSwapped.lines[0].includes('gpt-5-mini'), `${file}: 提醒里要有请求的和实际的模型名`);
    assert.ok(/我先听听/.test(r.oaiSwapped.game || ''), `${file}: 被换模型的回答照常使用，不拦截`);
    assert.equal(r.anthFallback.lines.length, 1, `${file}: Claude fallback 块要提醒`);
    assert.ok(r.anthFallback.lines[0].includes('claude-fable-5-2') && r.anthFallback.lines[0].includes('claude-opus-4-8'), `${file}: fallback 提醒要写明谁没答、谁代答`);
    assert.equal(r.anthSticky.lines.length, 1, `${file}: 没有 fallback 块但 model 不同（粘性路由）也要提醒`);
    assert.equal(r.gemSwapped.lines.length, 1, `${file}: Gemini modelVersion 不一致要提醒`);
    for (const k of Object.keys(r)) if (r[k] && typeof r[k] === 'object' && 'hasFallbacks' in r[k]) assert.equal(r[k].hasFallbacks, false, `${file} ${k}: 请求里不应带 fallbacks`);
    assert.equal(r.anthFallback.sentModel, 'claude-fable-5-2', `${file}: 请求的模型名不被改动`);
    console.log(`${file}: served-model notices on OpenAI-compatible, Anthropic and Gemini paths`);
  });
}
console.log('served model reporting OK');
