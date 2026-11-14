// 被拒绝后自动退一步：任何渠道的模型拒绝回答时，游戏记下这个 (地址|模型)，之后不再向它要思考过程
//   （题目里的思考占位、历史里的思考回放、Claude 的思考摘要参数），并自动重问；思考栏可能为空，但对局不卡在反复拒绝上。
//   与思考无关的拒绝类别不走这一步；别的模型不受影响。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const setup = (type, model) => {
        MODE_CONFIGS.rsb = { name: 'r', count: 6, roles: ['werewolf', 'werewolf', 'villager', 'villager', 'seer', 'villager'] };
        for (const k in playerConfigs) delete playerConfigs[k];
        for (let i = 0; i < 6; i++) playerConfigs[i] = { role: MODE_CONFIGS.rsb.roles[i] };
        $('g-url').value = type === 'anthropic' ? 'https://api.anthropic.com' : type === 'gemini' ? 'https://generativelanguage.googleapis.com' : 'https://api.example.test/v1';
        $('g-key').value = 'k'; $('g-model').value = model; if ($('g-apitype')) $('g-apitype').value = type;
        if ($('m-manual-retry')) $('m-manual-retry').checked = false;
        window.__DEMO__ = true; S.mode = 'rsb'; S.pureAI = true; startGame(); window.__DEMO__ = false; S.round = 1; S.phase = 'night';
        window.sleep = async () => {};
        return S.players[0];
      };
      const prompt = '【狼队夜聊·第二轮】\n可刀目标:A,B\n\n<thinking>你的分析</thinking>\n<game>你对队友说的话</game>\n<action>你最终支持的刀口名字 或 PASS（空刀）</action>\n<interrupt>yes 或 no</interrupt>';
      const flat = b => JSON.stringify(b.messages || b.contents || '') + JSON.stringify(b.system || b.systemInstruction || '');
      const run = async (type, model, respond, calls = 1) => {
        const p = setup(type, model);
        p.memory.push({ role: 'user', content: '【狼队夜聊·第1夜】\n<thinking>你的分析</thinking>\n<game>说给队友的话</game>', isTaskPrompt: true, round: 1, phase: 'night' },
                      { role: 'assistant', content: '<game>刀第三个人。</game>\n<action>P3</action>', thinking: '先刀第三个人，他像神。', round: 1, phase: 'night' });
        const sys = []; const realLog = Render.log;
        Render.log = (k, t) => { if (k === 'system') sys.push(String(t)); return realLog.apply(Render, [k, t]); };
        const bodies = []; let last;
        window.fetch = async (url, init) => { const b = JSON.parse(init.body || '{}'); bodies.push(b); return respond(b, bodies.length); };
        for (let i = 0; i < calls; i++) {
          const done = callAI(p, prompt, { wolfOnly: true, noMemory: true });
          last = await Promise.race([done, new Promise(z => setTimeout(() => z({ timeout: true }), 15000))]);
        }
        Render.log = realLog;
        return { n: bodies.length, asksThinking: bodies.map(b => /<thinking>|私密思考|先刀第三个人，他像神/.test(flat(b))), thinkingParam: bodies.map(b => !!b.thinking), game: last && last.game, timeout: !!(last && last.timeout),
          notice: sys.filter(t => /🧩/.test(t)).length, sys };
      };
      const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
      const okText = '<game>刀第三个人。</game>\n<action>P3</action>\n<interrupt>no</interrupt>';
      const claudeOk = b => json({ id: 'm', type: 'message', role: 'assistant', model: b.model, content: [{ type: 'text', text: okText }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      const claudeRefuse = cat => b => json({ id: 'm', type: 'message', role: 'assistant', model: b.model, content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: cat }, usage: { input_tokens: 1, output_tokens: 0 } });
      const out = {};
      // Claude：带思考摘要参数时被拒（reasoning_extraction），撤掉后放行
      out.claude = await run('anthropic', 'claude-fable-5-2', (b, n) => b.thinking ? claudeRefuse('reasoning_extraction')(b) : claudeOk(b), 2);
      // Claude：与思考无关的类别，不走"不要思考"这一步
      out.claudeCyber = await run('anthropic', 'claude-opus-5-5', claudeRefuse('cyber'));
      out.claudeCyberPlain = PLAIN_REASONING_ENDPOINTS.has('https://api.anthropic.com|claude-opus-5-5');
      // OpenAI 兼容：带"写出思考"要求时 content_filter，去掉后放行
      const oai = (b, n) => {
        const asks = /<thinking>/.test(JSON.stringify(b.messages));
        const choice = asks ? { delta: {}, message: { role: 'assistant', content: '' }, finish_reason: 'content_filter' } : { delta: { content: okText }, message: { role: 'assistant', content: okText }, finish_reason: 'stop' };
        if (b.stream) return new Response('data: ' + JSON.stringify({ choices: [{ delta: choice.delta, finish_reason: choice.finish_reason }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        return json({ choices: [{ message: choice.message, finish_reason: choice.finish_reason }] });
      };
      out.oai = await run('openai', 'strict-model-x', oai, 2);
      out.oaiOther = await run('openai', 'easy-model-y', (b) => b.stream
        ? new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: okText }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } })
        : json({ choices: [{ message: { role: 'assistant', content: okText }, finish_reason: 'stop' }] }));
      // Gemini：带"写出思考"要求时被安全拦截，去掉后放行
      out.gem = await run('gemini', 'gemini-strict-z', (b) => /<thinking>/.test(flat(b))
        ? json({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] })
        : json({ candidates: [{ content: { parts: [{ text: okText }] }, finishReason: 'STOP' }] }), 2);
      // 去掉之后仍被拒：不再重复退一步，交给原有流程
      out.oaiAlways = await run('openai', 'always-refuse-w', (b) => b.stream
        ? new Response('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'content_filter' }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } })
        : json({ choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'content_filter' }] }));
      return out;
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    const c = r.claude;
    assert.ok(!c.timeout && /刀第三个人/.test(c.game || ''), `${file}: Claude 被拒后应自动重问并拿到回答 ${JSON.stringify(c)}`);
    assert.deepEqual(c.thinkingParam, [true, false, false], `${file}: 第一次带思考摘要参数，被拒后撤掉，之后的请求也不再带 ${JSON.stringify(c.thinkingParam)}`);
    assert.equal(c.notice, 1, `${file}: 退一步只在日志里说一次 ${JSON.stringify(c.sys)}`);
    assert.ok(!r.claudeCyberPlain, `${file}: 与思考无关的拒绝类别不应切换`);
    assert.ok(!/刀第三个人/.test(r.claudeCyber.game || '') && r.claudeCyber.notice === 0, `${file}: cyber 类别照旧处理`);
    const o = r.oai;
    assert.ok(!o.timeout && /刀第三个人/.test(o.game || ''), `${file}: OpenAI 兼容渠道 content_filter 后应自动重问并拿到回答 ${JSON.stringify(o)}`);
    assert.deepEqual(o.asksThinking, [true, false, false], `${file}: 第一次带思考要求，被拒后去掉，之后也不再带 ${JSON.stringify(o.asksThinking)}`);
    assert.equal(o.notice, 1, `${file}: OpenAI 兼容渠道同样只提醒一次`);
    assert.deepEqual(r.oaiOther.asksThinking, [true], `${file}: 没拒绝过的模型照常要思考`);
    const g = r.gem;
    assert.ok(!g.timeout && /刀第三个人/.test(g.game || ''), `${file}: Gemini 被安全拦截后应自动重问并拿到回答 ${JSON.stringify(g)}`);
    assert.deepEqual(g.asksThinking, [true, false, false], `${file}: Gemini 同样退一步 ${JSON.stringify(g.asksThinking)}`);
    const a = r.oaiAlways;
    assert.ok(!a.timeout, `${file}: 一直拒绝也不能卡死`);
    assert.equal(a.notice, 1, `${file}: 一直拒绝时只退一步一次`);
    assert.ok(a.n <= 4 && !/刀第三个人/.test(a.game || ''), `${file}: 去掉后仍被拒就交给原有流程，不无限重试（请求 ${a.n} 次）`);
    console.log(`${file}: after a refusal the game stops asking that model for reasoning and retries (Claude, OpenAI-compatible, Gemini)`);
  });
}
console.log('refusal step-back OK');
