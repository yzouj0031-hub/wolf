// 「🔥 全力推理（不计成本）」：所有 AI、所有环节一律最高思考档，覆盖全局与座位设置；
// 重试不降档；单次请求与狼盟提案/投票最多等 30 分钟；输出上限至少 65536，
// 端点明确拒绝时记住该 (地址|模型) 并退回用户设置重试一次。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withOfflinePage} from './lib/offline-browser.mjs';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('id="g-full-reasoning"'), `${file}: 没有「全力推理」开关`);
  assert.ok(src.includes("if (fullReasoningOn()) return ReasoningControl.resolveMode({globalMode: 'max', playerMode: 'inherit', prompt, opts});"),
    `${file}: 全力推理没有把思考档接管为最高`);
  assert.ok(src.includes('const reasoning = (!fullReasoningOn() && att > 1 && _degradeReasoning('), `${file}: 全力推理下重试仍会降档`);
  assert.ok(src.includes('Math.max(opts.timeoutMs || 0, defaultTimeout, FULL_REASONING_TIMEOUT_MS)'), `${file}: 单次请求超时没有放大`);
  assert.equal((src.match(/fullReasoningOn\(\) \? FULL_REASONING_TIMEOUT_MS : (?:240000|90000)/g) || []).length, 2, `${file}: 狼盟提案/投票整体等待没有放大`);
  assert.ok(src.includes('maxTk = Math.max(maxTk, FULL_REASONING_MAX_TOKENS);'), `${file}: 输出上限没有放大`);
  assert.ok(src.includes("fullReasoning:$('g-full-reasoning')?$('g-full-reasoning').checked:false,"), `${file}: 开关没有随配置保存`);
}

await withOfflinePage(async (page, origin) => {
  for (const path of ['/index.html', '/en/index.html']) {
    const errors = [];
    page.removeAllListeners('pageerror'); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + path); await page.waitForTimeout(1000);
    const r = await page.evaluate(async () => {
      selectMode('super', true);
      const roles = MODE_CONFIGS.super.roles;
      S.players = roles.map((rid, i) => ({id:i, name:'P'+(i+1), alive:true, isPlayer:false, role:ALL_ROLES[rid], memory:[], mbti:null}));
      S.round = 1; S.phase = 'night';
      const p = S.players[3];
      playerConfigs[p.id] = Object.assign({}, playerConfigs[p.id] || {}, {reasoningMode: 'low'});   // 座位单独设成"低"
      const box = $('g-full-reasoning'); const sel = $('g-reasoning-mode');
      sel.value = 'smart';
      box.checked = false; syncFullReasoningUI();
      const offVote = resolveAIReasoning(p, '【选警长投票】投谁', {skillConfirm: true}).effective;
      box.checked = true; syncFullReasoningUI();
      const onVote = resolveAIReasoning(p, '【选警长投票】投谁', {skillConfirm: true}).effective;
      const onSpeech = resolveAIReasoning(p, '【白天发言】', {}).effective;
      const selDisabled = sel.disabled, hintShown = $('g-full-reasoning-hint').style.display !== 'none';

      // 保存 / 读取
      saveCfg(); box.checked = false; loadCfg();
      const persisted = box.checked;

      // 真实请求：输出上限与"拒绝后退回"
      $('g-url').value = 'http://127.0.0.1:9/v1'; $('g-key').value = 'k'; $('g-model').value = 'gpt-5.4';
      if ($('g-apitype')) $('g-apitype').value = 'openai';
      if ($('g-maxtk')) $('g-maxtk').value = '16384';
      if ($('m-manual-retry')) $('m-manual-retry').checked = false;
      const bodies = [];
      window.fetch = async (url, init) => {
        let b = {}; try { b = JSON.parse(init.body); } catch (e) {}
        bodies.push({max: b.max_tokens || b.max_completion_tokens, effort: b.reasoning_effort || (b.reasoning && b.reasoning.effort) || null});
        if (bodies.length === 1) return new Response('{"error":{"message":"max_tokens is too large: 65536. This model supports at most 32768 completion tokens"}}', {status: 400});
        return new Response('{"error":{"message":"boom"}}', {status: 500});
      };
      await Promise.race([
        callAI(p, '【白天发言】请发言', {maxRetries: 1}).catch(() => null),
        new Promise(res => setTimeout(res, 15000)),
      ]);
      return {offVote, onVote, onSpeech, selDisabled, hintShown, persisted, bodies,
        rejected: _fullReasoningTkRejected.has('http://127.0.0.1:9/v1|gpt-5.4')};
    });
    assert.deepEqual(errors, [], `${path}: 页面报错`);
    assert.notEqual(r.offVote, 'max', `${path}: 关闭时投票不该是最高档（对照组）`);
    assert.equal(r.onVote, 'max', `${path}: 全力推理下投票（操作类）没有用最高档`);
    assert.equal(r.onSpeech, 'max', `${path}: 全力推理下发言没有用最高档`);
    assert.ok(r.selDisabled && r.hintShown, `${path}: 打开后没有显示说明 / 没把思考强度下拉框变灰`);
    assert.ok(r.persisted, `${path}: 开关状态没有保存下来`);
    assert.ok(r.bodies.length >= 2, `${path}: 输出上限被拒后没有立即重试（请求 ${r.bodies.length} 次）`);
    assert.ok(r.bodies[0].max >= 65536, `${path}: 第一次请求的输出上限是 ${r.bodies[0].max}，不是至少 65536`);
    assert.ok(r.bodies[1].max < 65536, `${path}: 被拒后没有退回用户设置（第二次仍是 ${r.bodies[1].max}）`);
    assert.ok(r.rejected, `${path}: 没有记住拒绝过 65536 的模型`);
  }
});

console.log('full reasoning: every call uses the highest effort (overriding seat settings), output limit ≥65536 with a remembered fallback, and the switch persists');
