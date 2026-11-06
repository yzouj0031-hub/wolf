// 骑士在发言里当众宣布决斗 → 引擎直接执行，不因为另问时答"不决斗"而只喊不打；条件句、建议、否定都不算宣布
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const parsed = await page.evaluate(() => {
      const c = [{ id: 3, name: '夜神月' }, { id: 6, name: '黑羽快斗' }, { id: 0, name: 'Near' }];
      const t = s => { const r = parseDeclaredDuel(s, c); return r ? r.name : null; };
      return {
        yes: [t('我以骑士身份，向7号黑羽快斗发起决斗。'), t('我决斗夜神月！'), t('现在决斗，目标4号。'), t('综合以上三点，我判断他是狼。我发动决斗，目标是Near'), t('黑羽快斗，我决斗你。')],
        no: [t('如果7号出局，他是狼，我会决斗夜神月'), t('骑士，7号喊你去决斗4号，别听'), t('建议骑士决斗黑羽快斗'), t('我暂时不决斗'), t('明天我决斗夜神月'), t('出不出剑你自己定，决斗黑羽快斗也行'), t('我的放逐票：如果7号在决斗中出局，我跟警长归票'), t('要不要决斗夜神月，我再想想')],
      };
    });
    assert.deepEqual(parsed.yes, ['黑羽快斗', '夜神月', '夜神月', 'Near', '黑羽快斗'], `${file}: 明确宣布没识别出来 ${JSON.stringify(parsed.yes)}`);
    assert.deepEqual(parsed.no, parsed.no.map(() => null), `${file}: 条件 / 建议 / 否定被当成宣布 ${JSON.stringify(parsed.no)}`);
    // 走一遍真实发言流程：发言里宣布决斗，另问时答"不决斗"
    const flow = await page.evaluate(async () => {
      window.__DEMO__ = true;
      MODE_CONFIGS.simKnight = { name: 'sim', count: 6, roles: ['knight', 'werewolf', 'villager', 'villager', 'villager', 'werewolf'] };
      for (const k in playerConfigs) delete playerConfigs[k];
      for (let i = 0; i < 6; i++) playerConfigs[i] = { role: MODE_CONFIGS.simKnight.roles[i] };
      S.mode = 'simKnight'; S.pureAI = true; startGame(); S.round = 1; S.phase = 'day';
      const knight = S.players.find(x => x.role.id === 'knight'), wolf = S.players[1];
      let confirmAsked = 0;
      window.callAI = async (p, prompt) => {
        if (/决斗确认/.test(String(prompt))) { confirmAsked++; return { thinking: '', game: '我先不决斗，再听听。', action: '' }; }
        return { thinking: '', game: `我是骑士。我以骑士身份，向${wolf.name}发起决斗。`, action: '' };
      };
      const done = proc([knight], () => '【第1天·白天发言】这是第1天投票前唯一的一次发言。', '发言', {});
      const out = await Promise.race([done.then(r => ({ r })), new Promise(res => setTimeout(() => res({ timeout: true }), 20000))]);
      return { ...out, duelUsed: !!S._duelUsed, wolfAlive: wolf.alive, knightAlive: knight.alive, confirmAsked, log: (S.duelLog || []).length };
    });
    assert.ok(!flow.timeout, `${file}: 发言流程超时`);
    assert.equal(flow.confirmAsked, 0, `${file}: 已经宣布了还另问一遍`);
    assert.ok(flow.duelUsed, `${file}: 骑士宣布了决斗却没打 ${JSON.stringify(flow)}`);
    assert.equal(flow.wolfAlive, false, `${file}: 决斗狼人应该带走狼`);
    assert.equal(flow.knightAlive, true, `${file}: 决斗成功骑士应该活着`);
    // 另问时回答"不决斗某某"不能被当成要决斗（以前只对自爆做了否定判断）
    const neg = await page.evaluate(async () => {
      MODE_CONFIGS.simKnight2 = { name: 'sim', count: 6, roles: ['knight', 'werewolf', 'villager', 'villager', 'villager', 'werewolf'] };
      for (const k in playerConfigs) delete playerConfigs[k];
      for (let i = 0; i < 6; i++) playerConfigs[i] = { role: MODE_CONFIGS.simKnight2.roles[i] };
      S.mode = 'simKnight2'; S._duelUsed = false; startGame(); S.round = 1; S.phase = 'day';
      const knight = S.players.find(x => x.role.id === 'knight'), wolf = S.players[1];
      window.callAI = async (p, prompt) => /决斗确认/.test(String(prompt))
        ? { thinking: '', game: `我不决斗${wolf.name}，证据还不够。`, action: '' }
        : { thinking: '', game: '我是骑士，今天先听听大家的。', action: '' };
      const done = proc([knight], () => '【第1天·白天发言】这是第1天投票前唯一的一次发言。', '发言', {});
      await Promise.race([done, new Promise(res => setTimeout(res, 20000))]);
      return { duelUsed: !!S._duelUsed, wolfAlive: wolf.alive, knightAlive: knight.alive };
    });
    assert.deepEqual(neg, { duelUsed: false, wolfAlive: true, knightAlive: true }, `${file}: "我不决斗X"被当成了决斗 ${JSON.stringify(neg)}`);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${file}: declared duel parsed and executed; refusal respected`);
  });
}
console.log('knight declared duel: parser and flow OK');
