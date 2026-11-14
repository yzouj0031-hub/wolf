// Claude 原生接口不再要求模型把思考写进回复：题目里的 <thinking> 占位、草稿说明被拿掉，
//   历史里 assistant 回合不再回放思考；思考默认开启的型号改用官方思考摘要（thinking.display=summarized），
//   不认这个参数的就撤掉重发。其他渠道（OpenAI 兼容）不受影响。
//   背景：Fable 5.2 的安全分类器会以 reasoning_extraction 连续拒绝带这些内容的请求。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const out = {};
      out.text = [
        claudeNativeText('【狼队夜聊·第1夜】只有狼队能看到。\n\n<thinking>你的分析</thinking>\n<game>说给队友的话</game>\n<action>目标完整名字 或 PASS（空刀）</action>\n<interrupt>no</interrupt>', 'user'),
        claudeNativeText('<thinking>【第1夜·你自己当时的私密思考，仅供参考，不是当前结论】\n先刀工藤。</thinking>\n<game>刀工藤新一。</game>\n<action>工藤新一</action>', 'assistant'),
        claudeNativeText('<thinking>只有思考</thinking>', 'assistant'),
        claudeNativeText('直接用第一人称说出你要对大家说的话。想先打草稿，就写在 [草稿] 和 [/草稿] 之间（别人看不到），说出口的话写在 [/草稿] 之后。\n说完以后，可以在 [笔记] 和 [/笔记] 之间给自己记几句。', 'user'),
        claudeNativeText('说清你主张刀谁、为什么；thinking 里比较当前可行方案，用完整结算结果而非未验证假设。\n- <thinking>里想，<game>里只说最重要的判断。\n<draft>可选的私密草稿；只保留当前决策真正需要的比较</draft>\n<plan>可选</plan>', 'system'),
      ];
      out.wants = ['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'].map(claudeWantsThinkingSummary);
      const setup = (type, model) => {
        MODE_CONFIGS.cnt = { name: 'c', count: 6, roles: ['werewolf', 'werewolf', 'villager', 'villager', 'seer', 'villager'] };
        for (const k in playerConfigs) delete playerConfigs[k];
        for (let i = 0; i < 6; i++) playerConfigs[i] = { role: MODE_CONFIGS.cnt.roles[i] };
        $('g-url').value = type === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.example.test/v1'; $('g-key').value = 'k'; $('g-model').value = model;
        if ($('g-apitype')) $('g-apitype').value = type;
        window.__DEMO__ = true; S.mode = 'cnt'; S.pureAI = true; startGame(); window.__DEMO__ = false; S.round = 1; S.phase = 'night';
        window.sleep = async () => {};
        return S.players[0];
      };
      const wolfPrompt = '【狼队夜聊·第二轮】\n可刀目标:A,B\n\n<thinking>你的分析</thinking>\n<game>你对队友说的话</game>\n<action>你最终支持的刀口名字 或 PASS（空刀）</action>\n<interrupt>yes 或 no</interrupt>';
      const run = async (type, model, respond) => {
        const p = setup(type, model);
        p.memory.push({ role: 'user', content: '【狼队夜聊·第1夜】只有狼队能看到。\n<thinking>你的分析</thinking>\n<game>说给队友的话</game>', isTaskPrompt: true, round: 1, phase: 'night' },
                      { role: 'assistant', content: '<game>刀第三个人。</game>\n<action>P3</action>', thinking: '先刀第三个人，他像神。', round: 1, phase: 'night' });
        const bodies = [];
        window.fetch = async (url, init) => { const b = JSON.parse(init.body || '{}'); bodies.push(b); return respond(b, bodies.length); };
        const res = await callAI(p, wolfPrompt, { wolfOnly: true, noMemory: true });
        const flat = b => JSON.stringify(b.messages) + JSON.stringify(b.system || '');
        return { n: bodies.length, thinking: bodies.map(b => b.thinking || null), hasTag: bodies.map(b => /<thinking>|<draft>/.test(flat(b))), hasReplay: bodies.map(b => /私密思考|先刀第三个人，他像神/.test(flat(b))), keepsFormat: bodies.map(b => /<game>你对队友说的话<\/game>/.test(flat(b)) && /<action>/.test(flat(b))), game: res && res.game, shown: res && res.thinking };
      };
      const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
      const okClaude = b => json({ id: 'm', type: 'message', role: 'assistant', model: b.model, content: [{ type: 'thinking', thinking: '摘要：倾向刀第三个人。', signature: 's' }, { type: 'text', text: '<game>刀第三个人。</game>\n<action>P3</action>\n<interrupt>no</interrupt>' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      out.fable = await run('anthropic', 'claude-fable-5-2', okClaude);
      out.opus48 = await run('anthropic', 'claude-opus-4-8', okClaude);
      out.rejects = await run('anthropic', 'claude-sonnet-5-5', (b, n) => b.thinking ? json({ type: 'error', error: { type: 'invalid_request_error', message: 'thinking.display: unsupported' } }, 400) : okClaude(b));
      out.rejectsAgain = await run('anthropic', 'claude-sonnet-5-5', okClaude);
      const text = '<thinking>想</thinking>\n<game>刀第三个人。</game>\n<action>P3</action>\n<interrupt>no</interrupt>';
      out.openai = await run('openai', 'gpt-5', b => b.stream
        ? new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } })
        : json({ choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }));
      return out;
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    assert.ok(!/<thinking>/.test(r.text[0]) && /<game>说给队友的话<\/game>/.test(r.text[0]) && /<action>/.test(r.text[0]), `${file}: 题目里的思考占位要拿掉、其余格式保留：${r.text[0]}`);
    assert.equal(r.text[1], '<game>刀工藤新一。</game>\n<action>工藤新一</action>', `${file}: 历史里的 assistant 回合不回放思考`);
    assert.equal(r.text[2], '（已提交）', `${file}: 只剩思考的历史回合留一个占位，不能变成空消息`);
    assert.ok(!/草稿/.test(r.text[3]) && /\[笔记\]/.test(r.text[3]), `${file}: 草稿说明拿掉、笔记保留：${r.text[3]}`);
    assert.ok(!/thinking|<draft>/i.test(r.text[4]) && /<plan>可选<\/plan>/.test(r.text[4]) && /说清你主张刀谁、为什么/.test(r.text[4]), `${file}: 系统提示里要思考的句子拿掉：${r.text[4]}`);
    assert.deepEqual(r.wants, [true, true, true, true, true, false, false, false], `${file}: 只有思考默认开启的型号要摘要 ${JSON.stringify(r.wants)}`);
    assert.deepEqual(r.fable.thinking, [{ type: 'adaptive', display: 'summarized' }], `${file}: Fable 请求思考摘要`);
    assert.deepEqual([r.fable.hasTag, r.fable.hasReplay, r.fable.keepsFormat], [[false], [false], [true]], `${file}: Claude 请求里不应再有思考占位和思考回放 ${JSON.stringify(r.fable)}`);
    assert.ok(/刀第三个人/.test(r.fable.game || ''), `${file}: 发言照常解析`);
    assert.ok(/摘要：倾向刀第三个人/.test(r.fable.shown || ''), `${file}: 思考栏显示官方摘要：${r.fable.shown}`);
    assert.deepEqual(r.opus48.thinking, [null], `${file}: 思考默认关闭的型号不替它打开`);
    assert.deepEqual(r.opus48.hasTag, [false], `${file}: 老型号同样不再要思考占位`);
    assert.equal(r.rejects.n, 2, `${file}: 参数被拒后撤掉重发一次`);
    assert.deepEqual(r.rejects.thinking, [{ type: 'adaptive', display: 'summarized' }, null], `${file}: 重发时不带 thinking`);
    assert.ok(/刀第三个人/.test(r.rejects.game || ''), `${file}: 重发后照常返回`);
    assert.deepEqual(r.rejectsAgain.thinking, [null], `${file}: 被拒过的 (地址|模型) 之后不再带这个参数`);
    assert.deepEqual([r.openai.hasTag, r.openai.thinking], [[true], [null]], `${file}: OpenAI 兼容渠道不受影响 ${JSON.stringify(r.openai)}`);
    console.log(`${file}: Claude native requests no longer ask for written-out reasoning; thinking summary requested where supported`);
  });
}
console.log('claude native thinking OK');
