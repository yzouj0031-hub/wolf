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
        yes: [t('我以骑士身份，向7号黑羽快斗发起决斗。'), t('我决斗夜神月！'), t('现在决斗，目标4号。'), t('综合以上三点，我判断他是狼。我发动决斗，目标是Near'), t('黑羽快斗，我决斗你。'), t('我是骑士，决定对4号夜神月使用决斗。')],
        no: [t('如果7号出局，他是狼，我会决斗夜神月'), t('骑士，7号喊你去决斗4号，别听'), t('建议骑士决斗黑羽快斗'), t('我暂时不决斗'), t('明天我决斗夜神月'), t('出不出剑你自己定，决斗黑羽快斗也行'), t('我的放逐票：如果7号在决斗中出局，我跟警长归票'), t('要不要决斗夜神月，我再想想'), t('我目前倾向对 4号 发起决斗'), t('骑士，对夜神月使用决斗吧')],
      };
    });
    assert.deepEqual(parsed.yes, ['黑羽快斗', '夜神月', '夜神月', 'Near', '黑羽快斗', '夜神月'], `${file}: 明确宣布没识别出来 ${JSON.stringify(parsed.yes)}`);
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
        if (/技能确认|格式纠正/.test(String(prompt))) { confirmAsked++; return { thinking: '', game: '', action: 'PASS' }; }
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
      // 不合格式的自然语言回答（"我不决斗X"）会被要求改写成固定格式；改写成 PASS 就不决斗
      window.callAI = async (p, prompt) => /格式纠正/.test(String(prompt))
        ? { thinking: '', game: '', action: 'PASS' }
        : /技能确认/.test(String(prompt))
          ? { thinking: '', game: `我不决斗${wolf.name}，证据还不够。`, action: '' }
          : { thinking: '', game: '我是骑士，今天先听听大家的。', action: '' };
      const done = proc([knight], () => '【第1天·白天发言】这是第1天投票前唯一的一次发言。', '发言', {});
      await Promise.race([done, new Promise(res => setTimeout(res, 20000))]);
      return { duelUsed: !!S._duelUsed, wolfAlive: wolf.alive, knightAlive: knight.alive };
    });
    assert.deepEqual(neg, { duelUsed: false, wolfAlive: true, knightAlive: true }, `${file}: "我不决斗X"被当成了决斗 ${JSON.stringify(neg)}`);
    // 实际对局复现：发言里有"把票投出去"，解析器从发言里抽出 action「出去」。
    //   以前只要 action 非空就认为"已经有行动"，宣布的决斗和另问的确认都被跳过，骑士只喊不打。
    const junk = await page.evaluate(async () => {
      const run = async (speech, confirmReply) => {
        MODE_CONFIGS.simKnight3 = { name: 'sim', count: 6, roles: ['knight', 'werewolf', 'villager', 'villager', 'villager', 'werewolf'] };
        for (const k in playerConfigs) delete playerConfigs[k];
        for (let i = 0; i < 6; i++) playerConfigs[i] = { role: MODE_CONFIGS.simKnight3.roles[i] };
        S.mode = 'simKnight3'; S._duelUsed = false; S._duelRound = -1; S.duelLog = []; startGame(); S.round = 1; S.phase = 'day';
        const knight = S.players.find(x => x.role.id === 'knight'), wolf = S.players[1];
        let asked = 0;
        window.callAI = async (p, prompt) => /技能确认|格式纠正/.test(String(prompt))
          ? (asked++, { thinking: '', game: '', action: confirmReply(wolf) })
          : { thinking: '', game: speech(wolf), action: '出去' };
        const done = proc([knight], () => '【第1天·白天发言】这是第1天投票前唯一的一次发言。', '发言', {});
        await Promise.race([done, new Promise(res => setTimeout(res, 20000))]);
        return { duelUsed: !!S._duelUsed, wolfAlive: wolf.alive, asked };
      };
      return {
        declared: await run(w => `如果让八个人凭感觉把票投出去，一旦投错代价太大。我以骑士身份，向${w.name}发起决斗。`, () => 'PASS'),
        confirmed: await run(() => '如果让八个人凭感觉把票投出去，一旦投错代价太大。我是骑士，先听听。', w => `DUEL:P${w.id + 1}`),
      };
    });
    // 确认题里 <action> 只写了目标名字（没带"决斗"两个字），也算回答了决斗谁
    const bareName = await page.evaluate(async () => {
      MODE_CONFIGS.simKnight4 = { name: 'sim', count: 6, roles: ['knight', 'werewolf', 'villager', 'villager', 'villager', 'werewolf'] };
      for (const k in playerConfigs) delete playerConfigs[k];
      for (let i = 0; i < 6; i++) playerConfigs[i] = { role: MODE_CONFIGS.simKnight4.roles[i] };
      S.mode = 'simKnight4'; S._duelUsed = false; S._duelRound = -1; S.duelLog = []; startGame(); S.round = 1; S.phase = 'day';
      const knight = S.players.find(x => x.role.id === 'knight'), wolf = S.players[1];
      window.callAI = async (p, prompt) => /技能确认|格式纠正/.test(String(prompt))
        ? { thinking: '', game: '', action: wolf.name }
        : { thinking: '', game: '我是骑士，今天先听听大家的。', action: '' };
      const done = proc([knight], () => '【第1天·白天发言】这是第1天投票前唯一的一次发言。', '发言', {});
      await Promise.race([done, new Promise(res => setTimeout(res, 20000))]);
      return { duelUsed: !!S._duelUsed, wolfAlive: wolf.alive };
    });
    assert.deepEqual(bareName, { duelUsed: true, wolfAlive: false }, `${file}: 确认题只填了目标名字时没有决斗 ${JSON.stringify(bareName)}`);
    assert.deepEqual(junk.declared, { duelUsed: true, wolfAlive: false, asked: 0 }, `${file}: 发言里抽出了无关 action 时，宣布的决斗仍要执行 ${JSON.stringify(junk.declared)}`);
    assert.deepEqual(junk.confirmed, { duelUsed: true, wolfAlive: false, asked: 1 }, `${file}: 发言里抽出了无关 action 时，仍要另问决斗确认 ${JSON.stringify(junk.confirmed)}`);
    // 白狼王：发言后单独提交固定格式；用自然语言回答时会被要求改写成 EXPLODE:P数字
    const ww = await page.evaluate(async () => {
      MODE_CONFIGS.simWW = { name: 'sim', count: 6, roles: ['whitewolf', 'seer', 'villager', 'villager', 'villager', 'werewolf'] };
      for (const k in playerConfigs) delete playerConfigs[k];
      for (let i = 0; i < 6; i++) playerConfigs[i] = { role: MODE_CONFIGS.simWW.roles[i] };
      S.mode = 'simWW'; S._whitewolfUsed = false; startGame(); S.round = 1; S.phase = 'day';
      const ww = S.players.find(x => x.role.id === 'whitewolf'), seer = S.players.find(x => x.role.id === 'seer');
      const asked = [];
      window.callAI = async (p, prompt) => {
        const t = String(prompt);
        if (/格式纠正/.test(t)) { asked.push('fix'); return { thinking: '', game: '', action: `EXPLODE:P${seer.id + 1}` }; }
        if (/技能确认/.test(t)) { asked.push('ask'); return { thinking: '', game: `我自爆，带走${seer.name}。`, action: '' }; }
        return { thinking: '', game: '我是村民，先听听。', action: '' };
      };
      const res = await Promise.race([proc([ww], () => '【第1天·白天发言】这是第1天投票前唯一的一次发言。', '发言', {}), new Promise(r => setTimeout(() => r('TIMEOUT'), 20000))]);
      return { res, used: !!S._whitewolfUsed, seerAlive: seer.alive, asked };
    });
    assert.equal(ww.seerAlive, false, `${file}: 白狼王确认自爆后应带走目标 ${JSON.stringify(ww)}`);
    assert.deepEqual(ww.asked, ['ask', 'fix'], `${file}: 白狼王应先问一次固定格式、自然语言回答再要求改写 ${JSON.stringify(ww)}`);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${file}: declared duel parsed and executed; refusal respected; white wolf explode confirmed in fixed format`);
  });
}
console.log('knight declared duel: parser and flow OK');
