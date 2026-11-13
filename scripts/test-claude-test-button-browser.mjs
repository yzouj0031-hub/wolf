// 座位的「测试」按钮读 Claude 回复：思考常开的模型第一块是 thinking，没有 text。
//   以前只读 content[0].text，得到 undefined 后 .slice 抛错，显示成"网络错误：Cannot read properties of undefined"，
//   而请求其实是成功的。现在读 text 块；没有正文时说明原因（拒绝 / 输出额度被思考用完）。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      window.__DEMO__ = true;
      MODE_CONFIGS.tbtn = { name: 't', count: 6, roles: ['villager', 'werewolf', 'villager', 'villager', 'seer', 'werewolf'] };
      S.mode = 'tbtn'; S.pureAI = true; startGame(); window.__DEMO__ = false;
      const click = async (reply, status = 200) => {
        openPCfg(1);
        $('pcu').value = 'https://api.anthropic.com'; $('pck').value = 'k'; $('pcm').value = 'claude-fable-5-2';
        let sent = null;
        window.fetch = async (url, init) => { sent = { url: String(url), body: JSON.parse(init.body || '{}') }; return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } }); };
        $('pc-test-api').click();
        for (let i = 0; i < 60; i++) { await new Promise(z => setTimeout(z, 50)); if (!/测试中|Testing/.test($('pc-test-result').textContent) && !$('pc-test-api').disabled) break; }
        return { text: $('pc-test-result').textContent, sent };
      };
      const base = { id: 'm', type: 'message', role: 'assistant', model: 'claude-fable-5-2', usage: { input_tokens: 1, output_tokens: 1 } };
      return {
        thinkingFirst: await click({ ...base, content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: 'pong-7391' }], stop_reason: 'end_turn' }),
        onlyThinking: await click({ ...base, content: [{ type: 'thinking', thinking: '', signature: 's' }], stop_reason: 'max_tokens' }),
        refusal: await click({ ...base, content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' } }),
        plain: await click({ ...base, content: [{ type: 'text', text: 'pong-7391' }], stop_reason: 'end_turn' }),
        httpError: await click({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401),
        helper: [anthropicTestReply({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }), anthropicTestReply({}), anthropicTestReply(null)],
      };
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    for (const k of ['thinkingFirst', 'onlyThinking', 'refusal', 'plain']) {
      assert.ok(!/Cannot read properties|网络错误|Network error/i.test(r[k].text), `${file} ${k}: 请求成功不应显示成网络错误：${r[k].text}`);
      assert.ok(/✅/.test(r[k].text), `${file} ${k}: 接口返回 200 应显示连通成功：${r[k].text}`);
    }
    assert.ok(r.thinkingFirst.text.includes('pong-7391') && r.plain.text.includes('pong-7391'), `${file}: 要读出 text 块里的回复：${JSON.stringify([r.thinkingFirst.text, r.plain.text])}`);
    // 英文页会把界面文字自动翻译，中文措辞只在中文页核对
    if (file === 'index.html') assert.ok(/输出额度被思考用完/.test(r.onlyThinking.text), `${file}: 只有思考没有正文时要说明：${r.onlyThinking.text}`);
    assert.ok(/refusal/.test(r.refusal.text) && /cyber/.test(r.refusal.text), `${file}: 拒绝时要说明并带类别：${r.refusal.text}`);
    if (file === 'index.html') assert.ok(/拒绝回答/.test(r.refusal.text), `${file}: 拒绝时要用中文说明：${r.refusal.text}`);
    assert.ok(/401/.test(r.httpError.text) && /invalid x-api-key/.test(r.httpError.text), `${file}: 真正的接口报错照常显示：${r.httpError.text}`);
    assert.ok(r.plain.sent.url.endsWith('/v1/messages') && r.plain.sent.body.max_tokens >= 1024, `${file}: 测试请求要给思考常开的模型留够输出额度`);
    assert.equal(r.helper[0], 'ab', `${file}: 多个 text 块要拼起来`);
    assert.ok(/没有正文/.test(r.helper[1]) && /没有正文/.test(r.helper[2]), `${file}: 空回复不抛错`);
    console.log(`${file}: seat test button reads thinking-first Claude replies and explains empty ones`);
  });
}
console.log('claude test button OK');
