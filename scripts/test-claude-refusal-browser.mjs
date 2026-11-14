// Claude 的安全分类器在开口之前拒绝（HTTP 200、content 为空、stop_reason=refusal）：
//   如实说明是拒绝，重问一次；仍被拒就按"内容过滤拒绝"交给既有的备用 / 询问流程。
//   以前这种情况被报成"无有效响应内容"，重试时去降思考档位，三次全败，用户看不出原因。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const run = async (replies) => {
        MODE_CONFIGS.refusal = { name: 'r', count: 6, roles: ['villager', 'werewolf', 'villager', 'villager', 'seer', 'werewolf'] };
        for (const k in playerConfigs) delete playerConfigs[k];
        $('g-url').value = 'https://api.example.test'; $('g-key').value = 'k'; $('g-model').value = 'claude-fable-5-2';
        if ($('g-apitype')) $('g-apitype').value = 'anthropic';
        if ($('m-manual-retry')) $('m-manual-retry').checked = false;
        window.__DEMO__ = true; S.mode = 'refusal'; S.pureAI = true; startGame(); window.__DEMO__ = false; S.round = 1; S.phase = 'day';
        const p = S.players.find(x => x.role.id === 'villager');
        const sys = [], dev = [];
        const realLog = Render.log, realDev = Render.devLog;
        Render.log = (k, t) => { if (k === 'system') sys.push(String(t)); return realLog.apply(Render, [k, t]); };
        Render.devLog = (k, t) => { dev.push(String(t)); return realDev.apply(Render, [k, t]); };
        window.sleep = async () => {};
        let calls = 0;
        window.fetch = async () => {
          const body = replies[Math.min(calls, replies.length - 1)]; calls++;
          return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
        };
        const done = callAI(p, '【第1天·白天发言】这是第1天投票前唯一的一次发言。', { noMemory: true });
        const res = await Promise.race([done.then(x => ({ x })), new Promise(z => setTimeout(() => z({ timeout: true }), 15000))]);
        Render.log = realLog; Render.devLog = realDev;
        return { calls, sys, dev, game: res.x && res.x.game, timeout: !!res.timeout };
      };
      const refused = { id: 'm', type: 'message', role: 'assistant', model: 'claude-fable-5-2', content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' }, usage: { input_tokens: 1, output_tokens: 0 } };
      const ok = { id: 'm', type: 'message', role: 'assistant', model: 'claude-fable-5-2', content: [{ type: 'text', text: '<game>我先听听大家怎么说。</game>' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 5 } };
      const wrapped = { type: 'error', error: { type: 'permission_error', message: 'This credit balance cannot be used with claude-fable-5-2' } };
      return { once: await run([refused, ok]), always: await run([refused]), wrapped: await run([wrapped]) };
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    const once = r.once, always = r.always;
    assert.ok(!once.timeout, `${file}: 拒绝一次后应能继续`);
    assert.equal(once.calls, 2, `${file}: 拒绝后重问一次`);
    assert.ok(/我先听听/.test(once.game || ''), `${file}: 重问成功后照常返回发言`);
    assert.ok(once.sys.some(t => /安全分类器拒绝回答这一条/.test(t) && /cyber/.test(t)), `${file}: 日志要写明是安全分类器拒绝和类别 ${JSON.stringify(once.sys)}`);
    assert.ok(once.dev.some(t => /stop_reason=refusal/.test(t)), `${file}: 开发日志要有 stop_reason`);
    assert.ok(!once.dev.some(t => /无有效响应内容/.test(t)) && !once.sys.some(t => /无有效响应内容/.test(t)), `${file}: 不应再报成"无有效响应内容"`);
    assert.equal(always.calls, 2, `${file}: 连续被拒只重问一次，不白白重试三次（实际 ${always.calls} 次）`);
    assert.ok(always.sys.some(t => /再次拒绝回答这一条/.test(t)), `${file}: 第二次被拒要说明 ${JSON.stringify(always.sys)}`);
    assert.ok(!/我先听听/.test(always.game || ''), `${file}: 一直被拒不应凭空产生发言`);
    assert.ok(r.wrapped.sys.some(x => /接口返回了错误而不是回答/.test(x) && /cannot be used with claude-fable-5-2/.test(x)), `${file}: 包在 200 里的接口报错要原样显示 ${JSON.stringify(r.wrapped.sys)}`);
    assert.ok(!r.wrapped.sys.some(x => /安全分类器/.test(x)), `${file}: 接口报错不应被说成安全分类器拒绝`);
    console.log(`${file}: pre-output Claude refusal is reported as a refusal, retried once, then handed off`);
  });
}
console.log('claude refusal handling OK');
