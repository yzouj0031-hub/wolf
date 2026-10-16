// 🛑 技术故障绝不自动跳过：在真实页面里把几条询问流程走一遍。
//   纯 AI 视角（弹框允许）；callAI 换成"永远答不出有效 action"的桩，逼出两次纠正失败。
//   期望：发言故障能"照用原话"/"确认跳过"/"重试"；投票、枚举技能、女巫用药都能弹框并由用户手动代劳或再问一次；
//   匿名真人视角下夜间技能故障不弹框。
//   英文页会在显示时把中文词典翻译掉，所以按钮一律按顺序点，不按文字找。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

const buttons = page => page.$$eval('#cp-grid button', bs => bs.map(b => b.textContent));
const clickAt = async (page, idx, expectCount) => {
  await page.waitForSelector('#ocp.show', { timeout: 8000 });
  const labels = await buttons(page);
  if (expectCount != null) assert.equal(labels.length, expectCount, `弹框按钮数量不对：${labels.join(' | ')}`);
  assert.ok(labels[idx] != null, `弹框没有第 ${idx} 个按钮：${labels.join(' | ')}`);
  await page.evaluate(i => document.querySelectorAll('#cp-grid button')[i].click(), idx);
};
const title = page => page.$eval('#cp-title', e => e.textContent);

await withOfflinePage(async (page, origin) => {
  for (const file of ['index.html', 'en/index.html']) {
    const zh = file === 'index.html';
    await page.goto(origin + '/' + file);
    await page.waitForFunction(() => typeof recoverTechnicalSpeechFor === 'function' && typeof resolveAIAction3 === 'function' && typeof ALL_ROLES === 'object');
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluate(() => {
      window.alert = () => {};
      S.players = ['villager', 'werewolf', 'witch', 'seer', 'hunter', 'guard'].map((key, id) =>
        ({ id, name: 'Seat' + id, role: ALL_ROLES[key], alive: true, memory: [] }));
      Object.assign(S, { playerId: -1, pureAI: true, directorMode: false, gameOver: false, round: 2, phase: 'vote', sheriff: -1, history: [] });
      $('g-url').value = 'http://127.0.0.1:9/v1'; $('g-key').value = 'k'; $('g-model').value = 'stub-model';
      callAI = async () => ({ thinking: '', game: '', action: '' });   // 桩：永远答不出有效 action
    });
    assert.ok(await page.evaluate(() => technicalDialogAllowed()), `${file}: 纯 AI 视角应允许弹框`);

    // ── 发言故障：有原文 → 五个选择 + 先看看；第 3 个是"照用原话" ──
    await page.evaluate(() => { window.__s1 = recoverTechnicalSpeechFor(S.players[0], { thinking: '', game: '', action: '', _technicalFailure: true, _technicalReason: '测试', _rawCandidate: '我是预言家，昨晚验了 P2 是狼。' }, () => 'prompt', {}, '发言'); });
    await page.waitForSelector('#ocp.show');
    assert.ok((await title(page)).includes('生成故障'), `${file}: 发言故障弹框标题不对：${await title(page)}`);
    const labels1 = await buttons(page);
    if (zh) assert.deepEqual(labels1, ['切换模型 / API 后重试', '使用当前模型重试', '手写代替（你来替它说）', '照用它最后一次的原话（不再审核）', '确认跳过本次发言', '⬅️ 先看看']);
    await clickAt(page, 3, 6);
    const s1 = await page.evaluate(() => window.__s1);
    assert.equal(s1.game, '我是预言家，昨晚验了 P2 是狼。');
    assert.equal(s1._technicalFailure, false);

    // ── 发言故障：没有原文 → 四个选择 + 先看看；最后一个选择是"确认跳过"，只有它才跳过 ──
    await page.evaluate(() => { window.__s2 = recoverTechnicalSpeechFor(S.players[0], { thinking: '', game: '', action: '', _technicalFailure: true, _technicalReason: '测试' }, () => 'prompt', {}, '发言'); });
    await clickAt(page, 3, 5);
    const s2 = await page.evaluate(() => window.__s2);
    assert.equal(s2._technicalFailure, true);

    // ── 发言故障：使用当前模型重试（第 2 个按钮）拿到了有效发言 ──
    await page.evaluate(() => { callAI = async () => ({ thinking: '', game: '重试后我说话了，今天先出 P3。', action: 'None' }); window.__s3 = recoverTechnicalSpeechFor(S.players[0], { thinking: '', game: '', action: '', _technicalFailure: true, _technicalReason: '测试' }, () => 'prompt', {}, '发言'); });
    await clickAt(page, 1, 5);
    const s3 = await page.evaluate(() => window.__s3);
    assert.ok(s3.game.includes('重试后我说话了') && s3._technicalFailure === false, `${file}: 重试结果不对 ${JSON.stringify(s3)}`);

    // ── 投票解析：两次纠正失败 → 弹框（再问 / 切换 / 手动 / 确认故障 + 先看看）→ 手动 → 选 P3 ──
    const voteCfg = () => ({ label: '白天投票', candidates: S.players.filter(x => x.id !== 0), targetCount: 1, allowPass: true, formatHint: 'VOTE|P数字 或 PASS' });
    await page.evaluate(() => { callAI = async () => ({ thinking: '', game: '', action: '' }); window.__v1 = resolveAIAction3(S.players[0], { thinking: '', game: '', action: '' }, { label: '白天投票', candidates: S.players.filter(x => x.id !== 0), targetCount: 1, allowPass: true, formatHint: 'VOTE|P数字 或 PASS' }); });
    await page.waitForSelector('#ocp.show');
    assert.ok((await title(page)).includes('解析故障'), `${file}: 投票故障弹框标题不对：${await title(page)}`);
    const labelsV = await buttons(page);
    if (zh) assert.deepEqual(labelsV, ['再问一次模型', '切换模型 / API 后再问', '我来替它选择', '确认按技术故障处理（不执行）', '⬅️ 先看看']);
    await clickAt(page, 2, 5);
    // 手动指定目标：P2..P6（5 个）+ 不行动/弃权 + 取消 + 先看看 = 8；P3 Seat2 是第 2 个
    await page.waitForFunction(() => document.getElementById('cp-title').textContent.includes('目标') || document.getElementById('cp-title').textContent.toLowerCase().includes('target'));
    const labelsT = await buttons(page);
    assert.ok(labelsT[1].includes('P3 Seat2'), `${file}: 手动目标列表不对：${labelsT.join(' | ')}`);
    await clickAt(page, 1, 8);
    const v1 = await page.evaluate(() => window.__v1.then(x => ({ status: x.status, source: x.source, ids: x.targets.map(t => t.id) })));
    assert.deepEqual(v1, { status: 'execute', source: 'manual', ids: [2] });

    // ── 投票解析：再问一次模型（第 1 个按钮），这次模型答对了 ──
    await page.evaluate(() => { window.__v2 = resolveAIAction3(S.players[0], { thinking: '', game: '', action: '' }, { label: '白天投票', candidates: S.players.filter(x => x.id !== 0), targetCount: 1, allowPass: true, formatHint: 'VOTE|P数字 或 PASS' }); });
    await page.waitForSelector('#ocp.show');
    await page.evaluate(() => { callAI = async () => ({ thinking: '', game: '', action: 'VOTE|P4' }); });
    await clickAt(page, 0, 5);
    const v2 = await page.evaluate(() => window.__v2.then(x => ({ status: x.status, source: x.source, ids: x.targets.map(t => t.id) })));
    assert.deepEqual(v2, { status: 'execute', source: 'correction', ids: [3] });

    // ── 枚举技能：手动选项（SHOOT / NO_SHOOT / 取消 + 先看看）→ 选 NO_SHOOT ──
    await page.evaluate(() => { callAI = async () => ({ thinking: '', game: '', action: '' }); window.__e1 = resolveAIEnumAction(S.players[4], { action: '' }, { label: '猎人开枪', options: ['SHOOT', 'NO_SHOOT'] }); });
    await clickAt(page, 2, 5);
    const labelsE = await buttons(page);
    assert.equal(labelsE[1], 'NO_SHOOT', `${file}: 枚举手动列表不对：${labelsE.join(' | ')}`);
    await clickAt(page, 1, 4);
    const e1 = await page.evaluate(() => window.__e1.then(x => ({ status: x.status, value: x.value, source: x.source })));
    assert.deepEqual(e1, { status: 'execute', value: 'NO_SHOOT', source: 'manual' });

    // ── 女巫：手动用药（救人 / 毒 P4 / 毒 P6 / 不用药 / 取消 + 先看看）→ 毒 P4 ──
    await page.evaluate(() => { window.__w1 = resolveAIWitchAction(S.players[2], { action: '' }, { canSave: true, canPoison: true, poisonPool: [S.players[3], S.players[5]] }); });
    await clickAt(page, 2, 5);
    const labelsW = await buttons(page);
    assert.ok(labelsW[1].includes('P4 Seat3'), `${file}: 女巫手动列表不对：${labelsW.join(' | ')}`);
    await clickAt(page, 1, 6);
    const w1 = await page.evaluate(() => window.__w1.then(x => ({ status: x.status, kind: x.kind, target: x.target && x.target.id, source: x.source })));
    assert.deepEqual(w1, { status: 'execute', kind: 'poison', target: 3, source: 'manual' });

    // ── 确认按故障处理（第 4 个按钮）：返回 invalid，由调用方记录 ──
    await page.evaluate(() => { window.__v3 = resolveAIAction3(S.players[0], { action: '' }, { label: '预言家查验', candidates: S.players.slice(1), targetCount: 1, allowPass: false, formatHint: 'CHECK|P数字' }); });
    await clickAt(page, 3, 5);
    const v3 = await page.evaluate(() => window.__v3.then(x => x.status));
    assert.equal(v3, 'invalid');

    // ── 视角不允许时（匿名 + 非纯 AI）：不弹框，直接按原静默逻辑 ──
    await page.evaluate(() => { S.pureAI = false; $('m-anon').checked = true; });
    assert.equal(await page.evaluate(() => technicalDialogAllowed()), false);
    const v4 = await page.evaluate(() => resolveAIAction3(S.players[0], { action: '' }, { label: '预言家查验', candidates: S.players.slice(1), targetCount: 1, allowPass: false, formatHint: 'CHECK|P数字' }).then(x => x.status));
    assert.equal(v4, 'invalid');
    assert.ok(!(await page.$eval('#ocp', e => e.classList.contains('show'))), `${file}: 匿名真人视角下不该弹夜间技能故障框`);
    await page.evaluate(() => { $('m-anon').checked = false; });

    const bad = errors.filter(e => !/favicon|ERR_FAILED|supabase/i.test(e));
    assert.equal(bad.length, 0, `${file}: 页面报错：${bad.join('\n')}`);
    console.log(file + ': speech recovery, vote/enum/witch manual and retry dialogs, explicit skip and anon guard all OK');
  }
});
