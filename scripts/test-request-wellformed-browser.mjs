// 一条坏消息不该让一个座位此后每次请求都被接口 400 退回：
//   ① 落单的半个表情符号（按固定长度截断时刀口落在表情中间）发出去前去掉；
//   ② Claude 原生接口：内容不能为空、第一条必须是 user；
//   ③ 400 的原因要进日志——以前判断"是不是思考强度的问题"时把响应正文读掉了，日志只剩"HTTP 400"。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
      const setup = (apitype, model) => {
        MODE_CONFIGS.wf = { name: 'wf', count: 6, roles: ['villager', 'werewolf', 'villager', 'villager', 'seer', 'werewolf'] };
        for (const k in playerConfigs) delete playerConfigs[k];
        $('g-url').value = apitype === 'anthropic' ? 'https://api.example.test' : 'https://api.example.test/v1'; $('g-key').value = 'k'; $('g-model').value = model;
        if ($('g-apitype')) $('g-apitype').value = apitype;
        if ($('m-manual-retry')) $('m-manual-retry').checked = false;
        if ($('g-reasoning-mode')) $('g-reasoning-mode').value = 'high';
        TeachingWorldbooks.load({ mode: 'live', liteMigrated: true, bareMigrated: true });
        window.__DEMO__ = true; S.mode = 'wf'; S.pureAI = true; startGame(); window.__DEMO__ = false; S.round = 2; S.phase = 'day';
        window.sleep = async () => {};
        return S.players.find(x => x.role.id === 'villager');
      };
      const half = '我投他💖'.slice(0, -1);            // 末尾留下半个表情
      const tailHalf = '💖听我说'.slice(1);            // 开头留下半个表情
      const out = { helper: [wellFormedText(half), wellFormedText(tailHalf), wellFormedText('好的💖没问题')] };

      // ── Claude 原生接口：坏消息都在这个座位的对话里 ──
      let p = setup('anthropic', 'claude-fable-5-2');
      p.memory = [
        { role: 'assistant', content: '我先说两句。' },                       // 第一条不是 user
        { role: 'user', content: '' },                                        // 空内容
        { role: 'system', content: '【公告】' + half },
        { role: 'user', content: '【第1天·白天发言】轮到你发言。' },
        { role: 'assistant', content: '<thinking>只有思考</thinking>' },      // 去掉思考后为空
      ];
      let bodies = [];
      window.fetch = async (url, init) => { bodies.push(String(init.body)); return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'claude-fable-5-2', content: [{ type: 'text', text: '<game>我先听听。</game>' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 5 } }), { status: 200, headers: { 'content-type': 'application/json' } }); };
      const a = await callAI(p, '【第2天·白天发言】轮到你发言。原公开结论：' + tailHalf, { noMemory: true });
      const body = JSON.parse(bodies[0] || '{}');
      out.claude = { game: a && a.game, n: bodies.length, lone: lone.test(JSON.stringify(body.messages) ? JSON.parse(bodies[0]).messages.map(m => m.content).join('\n') : ''), first: body.messages && body.messages[0].role, empty: (body.messages || []).filter(m => typeof m.content !== 'string' || !m.content.trim()).length, kept: (body.messages || []).some(m => /我投他/.test(m.content)) && (body.messages || []).some(m => /听我说/.test(m.content)) };

      // ── 400 的原因要看得见（带思考强度参数、但报错与思考强度无关）──
      p = setup('anthropic', 'claude-fable-5-2');
      const dev = []; const realDev = Render.devLog; Render.devLog = (k, t) => { dev.push(String(t)); return realDev.apply(Render, [k, t]); };
      let calls400 = 0; let hadEffort = false;
      window.fetch = async (url, init) => { calls400++; if (JSON.parse(init.body).output_config) hadEffort = true; return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'messages.3.content.0.text: no low surrogate in string' } }), { status: 400, headers: { 'content-type': 'application/json' } }); };
      const b = await callAI(p, '【第2天·白天发言】轮到你发言。', { noMemory: true, maxRetries: 1 });
      Render.devLog = realDev;
      out.err = { game: b && b.game, calls: calls400, hadEffort, shown: dev.some(t => /HTTP 400/.test(t) && /no low surrogate in string/.test(t)), dev: dev.filter(t => /HTTP 400/.test(t)).slice(0, 2) };

      // ── 其他渠道同样不带半个表情 ──
      p = setup('openai', 'm');
      p.memory = [{ role: 'user', content: '【第1天·白天发言】轮到你发言。' }, { role: 'assistant', content: half }];
      bodies = [];
      window.fetch = async (url, init) => { bodies.push(String(init.body)); const content = '<game>我先听听。</game>'; const bd = JSON.parse(init.body);
        if (bd.stream) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } }); };
      const c = await callAI(p, '【第2天·白天发言】轮到你发言。' + tailHalf, { noMemory: true });
      const ob = JSON.parse(bodies[0] || '{}');
      out.openai = { game: c && c.game, lone: lone.test((ob.messages || []).map(m => m.content).join('\n')), kept: (ob.messages || []).some(m => /我投他/.test(m.content)) };
      return out;
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    assert.deepEqual(r.helper, ['我投他', '听我说', '好的💖没问题'], `${file}: 只去掉落单的半个表情，完整的表情保留`);
    assert.ok(/我先听听/.test(r.claude.game || ''), `${file}: Claude 请求应成功 ${JSON.stringify(r.claude)}`);
    assert.equal(r.claude.lone, false, `${file}: 发给 Claude 的消息里还有落单的半个表情`);
    assert.equal(r.claude.first, 'user', `${file}: 发给 Claude 的第一条消息必须是 user`);
    assert.equal(r.claude.empty, 0, `${file}: 发给 Claude 的消息不能有空内容`);
    assert.ok(r.claude.kept, `${file}: 去掉半个表情后其余文字要保留`);
    assert.ok(r.err.hadEffort, `${file}: 这个场景应带着思考强度参数（否则没测到正文被读掉的那条路）`);
    assert.ok(r.err.shown, `${file}: 400 的原因没有进日志：${JSON.stringify(r.err.dev)}`);
    assert.equal(r.openai.lone, false, `${file}: 发给 OpenAI 兼容接口的消息里还有落单的半个表情`);
    assert.ok(r.openai.kept && /我先听听/.test(r.openai.game || ''), `${file}: OpenAI 兼容接口照常工作`);
    console.log(`${file}: lone surrogates stripped, Claude message guards, 400 detail visible OK`);
  });
}
