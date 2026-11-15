// ⏳ 思考过久提醒：真实页面里走一遍 callAI。
//   fetch 被替换成"挂着不回"的桩；阈值压到 1 秒。期望：
//   1. 对局日志出现实时等待说明，角落出现「不等了」；
//   2. 按「不等了」后（手动重试关、无备用）callAI 返回 (请求失败) 占位而不是空对象，日志写明"你停止了等待"；
//   3. 手动重试开着时，「不等了」直接弹出三选一对话框，原因带"用户停止等待"；选「重试主 API」后用正常响应收尾。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

const PAGES = [
  { file: 'index.html', banner: '已思考', stopped: '你停止了等待', waiting: '会一直等到它回复', limited: '仍在等模型回复', reason: '用户停止等待' },
  { file: 'en/index.html', banner: 'thinking for', stopped: 'You stopped waiting', waiting: 'will keep waiting until it replies', limited: 'has not replied yet', reason: '用户停止等待' }
];

await withOfflinePage(async (page, origin) => {
  for (const cfg of PAGES) {
    await page.goto(origin + '/' + cfg.file);
    await page.waitForFunction(() => typeof callAI === 'function' && typeof AIWait === 'object' && typeof ALL_ROLES === 'object');
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.evaluate(() => {
      window.alert = () => {};
      S.players = ['villager', 'werewolf', 'witch', 'seer', 'hunter', 'guard'].map((key, id) =>
        ({ id, name: 'Seat' + id, role: ALL_ROLES[key], alive: true, memory: [] }));
      Object.assign(S, { playerId: -1, pureAI: true, directorMode: false, gameOver: false, round: 1, phase: 'day', sheriff: -1, history: [] });
      $('g-url').value = 'http://127.0.0.1:9/v1'; $('g-key').value = 'test-key'; $('g-model').value = 'test-model';
      if ($('g-apitype')) $('g-apitype').value = 'custom';
      if ($('fb-url')) $('fb-url').value = ''; if ($('fb-key')) $('fb-key').value = '';
      if (typeof extraFallbacks !== 'undefined') extraFallbacks.length = 0;
      $('m-manual-retry').checked = false;
      $('t-slow').value = '1';
      $('gl').innerHTML = '';
      // fetch 桩：mode=hang 挂到被 abort 为止；mode=ok 立刻返回一份合法回复
      window.__fetchMode = 'hang';
      window.fetch = (url, init) => new Promise((resolve, reject) => {
        if (window.__fetchMode === 'ok') {
          resolve(new Response(JSON.stringify({ choices: [{ message: { content: '<thinking>先看票型。</thinking><game>我是好人，今天先听前置位怎么说，再决定票投给谁。</game><action>None</action>' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          return;
        }
        const sig = init && init.signal;
        if (sig) sig.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
      });
    });

    // ── 场景 1：手动重试关、无备用 ──
    await page.evaluate(() => { window.__r1 = callAI(S.players[0], '【发言】说点什么。', {}); });
    await page.waitForFunction(() => { const b = document.getElementById('ai-wait-banner'); return b && b.style.display !== 'none' && b.textContent.length > 0; }, null, { timeout: 15000 });
    const bannerText = await page.$eval('#ai-wait-banner', b => b.textContent);
    assert.ok(bannerText.includes(cfg.banner), `${cfg.file}: 角标文字不对：${bannerText}`);
    const logs1 = await page.$$eval('#gl .le.system', els => els.map(e => e.textContent));
    assert.ok(logs1.some(t => t.includes(cfg.waiting)), `${cfg.file}: 对局日志没有等待说明：${logs1.join(' | ')}`);
    await page.click('#ai-wait-banner [data-stop]');
    const r1 = await page.evaluate(() => window.__r1);
    assert.equal(r1 && r1.game, '(请求失败)', `${cfg.file}: 叫停后应返回 (请求失败) 占位，实际 ${JSON.stringify(r1)}`);
    const logs1b = await page.$$eval('#gl .le.system', els => els.map(e => e.textContent));
    assert.ok(logs1b.some(t => t.includes(cfg.stopped)), `${cfg.file}: 日志没有"你停止了等待"：${logs1b.join(' | ')}`);
    assert.ok(await page.$eval('#ai-wait-banner', b => b.style.display === 'none' || !b.textContent), `${cfg.file}: 叫停后角标没有收起`);

    // ── 场景 2：手动重试开 → 叫停直接弹对话框 → 重试主 API 成功 ──
    await page.evaluate(() => { $('m-manual-retry').checked = true; window.__fetchMode = 'hang'; window.__r2 = callAI(S.players[1], '【发言】说点什么。', {}); });
    await page.waitForFunction(() => { const b = document.getElementById('ai-wait-banner'); return b && b.style.display !== 'none' && b.querySelector('[data-stop]'); }, null, { timeout: 15000 });
    await page.click('#ai-wait-banner [data-stop]');
    await page.waitForFunction(() => !!document.querySelector('button[data-v="retry-main"]'), null, { timeout: 5000 });
    const dialogText = await page.evaluate(() => document.querySelector('button[data-v="retry-main"]').parentElement.parentElement.textContent);
    assert.ok(dialogText.includes(cfg.reason), `${cfg.file}: 对话框原因没写用户停止等待：${dialogText}`);
    await page.evaluate(() => { window.__fetchMode = 'ok'; });
    await page.click('button[data-v="retry-main"]');
    const r2 = await page.evaluate(() => window.__r2);
    assert.ok(r2 && r2.game && r2.game.includes('我是好人'), `${cfg.file}: 重试主 API 后应拿到正常发言，实际 ${JSON.stringify(r2)}`);

    // ── 场景 3：游戏自己的超时路径（以前这里会 ReferenceError，整个发言悄悄消失）──
    await page.evaluate(() => { $('m-manual-retry').checked = false; window.__fetchMode = 'hang'; $('gl').innerHTML = ''; window.__r3 = callAI(S.players[2], '【发言】说点什么。', { timeoutMs: 1500, maxRetries: 1 }); });
    const r3 = await page.evaluate(() => window.__r3);
    assert.equal(r3 && r3.game, '(请求失败)', `${cfg.file}: 超时后应返回 (请求失败) 占位，实际 ${JSON.stringify(r3)}`);
    const logs3 = await page.$$eval('#gl .le.system', els => els.map(e => e.textContent));
    assert.ok(logs3.some(t => /请求超时|timed out|被掐断|connection cut/.test(t)), `${cfg.file}: 超时没有写进对局日志：${logs3.join(' | ')}`);

    // ── 场景 4：不限时等待（默认）——过了「单次请求上限」也不掐，一直等到模型回复 ──
    const s4 = await page.evaluate(async () => {
      const out = { checked: $('t-nolimit').checked, singleDisabled: $('t-single').disabled };
      $('m-manual-retry').checked = true; $('t-single').value = '1'; window.__fetchMode = 'hang'; $('gl').innerHTML = '';
      // 桩改成"晚回"：4 秒后才给回复（远超 1 秒的上限）
      const keep = window.fetch;
      window.fetch = () => new Promise(resolve => setTimeout(() => resolve(new Response(JSON.stringify({ choices: [{ message: { content: '<thinking>想了很久。</thinking><game>我想好了，今天投前置位。</game><action>None</action>' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })), 4000));
      const t0 = Date.now();
      const r = await callAI(S.players[3], '【发言】说点什么。', {});
      out.game = r && r.game; out.waited = Date.now() - t0;
      out.dialog = !!document.querySelector('button[data-v="retry-main"]');
      out.logs = [...document.querySelectorAll('#gl .le.system')].map(e => e.textContent);
      // 关掉不限时：同样的慢回复，到 1 秒上限就掐，交给手动重试对话框
      $('t-nolimit').checked = false; syncNoLimitUI(); out.singleEnabled = !$('t-single').disabled;
      $('gl').innerHTML = '';
      window.fetch = keep; window.__fetchMode = 'hang';
      window.__r5 = callAI(S.players[4], '【发言】说点什么。', {});
      return out;
    });
    assert.ok(s4.checked && s4.singleDisabled, `${cfg.file}: 「不限时等待」应默认勾选，并把单次请求上限置灰`);
    assert.ok(s4.game && /想好了|投前置位/.test(s4.game) && s4.waited >= 3500, `${cfg.file}: 不限时等待下应等到慢回复，实际 ${JSON.stringify(s4)}`);
    assert.ok(!s4.dialog, `${cfg.file}: 不限时等待下不应弹重试对话框`);
    assert.ok(!s4.logs.some(t => /请求超时|timed out/.test(t)), `${cfg.file}: 不限时等待下不应报超时：${s4.logs.join(' | ')}`);
    assert.ok(s4.singleEnabled, `${cfg.file}: 取消勾选后单次请求上限应恢复可填`);
    await page.waitForFunction(() => !!document.querySelector('button[data-v="retry-main"]'), null, { timeout: 8000 });
    const logs5 = await page.$$eval('#gl .le.system', els => els.map(e => e.textContent));
    assert.ok(logs5.some(t => /请求超时|timed out/.test(t)), `${cfg.file}: 关掉不限时后应按上限报超时：${logs5.join(' | ')}`);
    await page.evaluate(() => { window.__fetchMode = 'ok'; });
    await page.click('button[data-v="retry-main"]');
    const r5 = await page.evaluate(() => window.__r5);
    assert.ok(r5 && r5.game && r5.game.includes('我是好人'), `${cfg.file}: 超时后重试应拿到发言，实际 ${JSON.stringify(r5)}`);
    await page.evaluate(() => { $('t-nolimit').checked = true; syncNoLimitUI(); $('t-single').value = '600'; });

    const bad = errors.filter(e => !/favicon|ERR_FAILED|supabase/i.test(e));
    assert.equal(bad.length, 0, `${cfg.file}: 页面报错：${bad.join('\n')}`);
    console.log(cfg.file + ': slow notice, stop waiting, manual-retry dialog and retry all OK');
  }
});
