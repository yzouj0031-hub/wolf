// 名字整词匹配：默认名字池里有玩家叫「L」，而 DUEL / EXPLODE / KILL / LEARN / LINK 这些指令词里都有字母 L。
//   以前按子串找名字，「DUEL:P3」被读成同时指了 L 和 P3，判成格式错误，骑士怎么答都决斗不出去（弹"技术故障"）。
//   英文页的 Light Yagami、Levi Ackerman 同理。这里固定：指令词里的字母不算点名；P1 不被 P12 误中；
//   名字里碰巧有 NOW / PASS 的玩家可以被决斗；桌上有 L 时骑士和白狼王的技能确认照常执行。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      const out = {};
      const pool = NAME_POOL.cn.map((name, id) => ({ id, name, alive: true }));
      out.hasL = pool.some(x => x.name === 'L');
      const ids = (text, c) => _extractMachineTargets(text, c || pool, (c || pool).length).map(x => x.id + 1);
      out.cmds = {};
      for (const kw of ['DUEL', 'EXPLODE', 'KILL', 'LEARN', 'LINK', 'VOTE', 'SHOOT', 'POISON']) for (const sep of [':', '|']) out.cmds[kw + sep + 'P3'] = ids(kw + sep + 'P3');
      out.toL = [ids('DUEL:L'), ids('KILL|L'), ids('L'), ids('DUEL:P2')];
      out.twoTargets = ids('LINK|P3|P5');
      out.eachName = pool.map(x => ids('DUEL:' + x.name));
      out.p12 = ids('DUEL:P12');
      // 一个名字整个落在另一个更长的名字里
      const nested = [{ id: 0, name: '李明', alive: true }, { id: 1, name: '李明珠', alive: true }, { id: 2, name: 'L', alive: true }];
      out.nested = [ids('VOTE|李明珠', nested), ids('VOTE|李明', nested), ids('李明珠', nested)];
      out.appears = [nameAppearsIn('DUEL:P3', 'L'), nameAppearsIn('DUEL:L', 'L'), nameAppearsIn('Light Yagami', 'L'), nameAppearsIn('我投L。', 'L'), nameAppearsIn('刀Mello', 'Mello'), nameAppearsIn('Mellow', 'Mello')];
      out.mentions = [textMentionsPlayer('DUEL:P12', { id: 0, name: 'A' }), textMentionsPlayer('DUEL:P12', { id: 11, name: 'B' }), textMentionsPlayer('DUEL:玩家7', { id: 1, name: 'L' })];
      out.decline = ['PASS', 'DUEL:PASS', 'DUEL NOW', 'NONE', 'DUEL:名字 或 PASS'].map(actionHasDeclineWord).concat(['DUEL:Snow', 'DUEL:Nowak', 'DUEL:Passat', 'DUEL:P3'].map(actionHasDeclineWord));
      out.find = [findPlayer('Levi', [{ id: 1, name: 'L' }, { id: 9, name: 'Levi Ackerman' }]), findPlayer('P10 Levi Ackerman', [{ id: 1, name: 'L' }, { id: 9, name: 'Levi Ackerman' }]), findPlayer('L', [{ id: 1, name: 'L' }, { id: 9, name: 'Levi Ackerman' }]), findPlayer('艾伦', [{ id: 1, name: 'L' }, { id: 8, name: '艾伦·耶格尔' }])].map(x => x && x.name);

      // 真实发言流程：桌上有一个叫 L 的旁观者，模型按题目要求的格式回答
      const flow = async (role, kw, reply, targetName) => {
        window.__DEMO__ = true;
        MODE_CONFIGS.shortName = { name: 'sn', count: 6, roles: [role, 'werewolf', 'villager', 'villager', 'villager', 'werewolf'] };
        for (const k in playerConfigs) delete playerConfigs[k];
        S.mode = 'shortName'; S.pureAI = true; startGame(); S.round = 1; S.phase = 'day';
        S._duelUsed = false; S._duelRound = -1; S.duelLog = []; S._whitewolfUsed = false;
        const actor = S.players.find(x => x.role.id === role);
        const target = S.players.find(x => x.id !== actor.id && x.role.id === (role === 'knight' ? 'werewolf' : 'villager'));
        const base = NAME_POOL.cn.filter(n => n !== 'L');
        S.players.forEach((p, i) => { p.name = base[i]; });
        S.players.find(x => x.id !== actor.id && x.id !== target.id).name = 'L';
        if (targetName) target.name = targetName;
        let asked = 0, popup = 0;
        window.askTechnicalAction = async () => { popup++; return 'skip'; };
        window.callAI = async (p, prompt) => {
          if (/技能确认|格式纠正/.test(String(prompt))) { asked++; return { thinking: '', game: '', action: reply(target) }; }
          return { thinking: '', game: role === 'knight' ? '我是骑士，今天先听听大家怎么说。' : '我先听听后面的人怎么说。', action: '' };
        };
        const done = proc([actor], () => '【第1天·白天发言】这是第1天投票前唯一的一次发言。', '发言', {});
        const t = await Promise.race([done.then(() => 'done'), new Promise(res => setTimeout(() => res('timeout'), 20000))]);
        return { t, asked, popup, targetAlive: target.alive, lAlive: S.players.find(x => x.name === 'L').alive, used: role === 'knight' ? !!S._duelUsed : !!S._whitewolfUsed };
      };
      out.knightSeat = await flow('knight', 'DUEL', t => `DUEL:P${t.id + 1}`);
      out.knightName = await flow('knight', 'DUEL', t => `DUEL:${t.name}`);
      out.knightSnow = await flow('knight', 'DUEL', t => `DUEL:P${t.id + 1}`, 'Snow');
      out.whitewolf = await flow('whitewolf', 'EXPLODE', t => `EXPLODE:P${t.id + 1}`);
      return out;
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    assert.ok(r.hasL, `${file}: 默认名字池里应有「L」（本测试针对的就是它）`);
    for (const [cmd, got] of Object.entries(r.cmds)) assert.deepEqual(got, [3], `${file}: ${cmd} 应只指向 P3，实际 ${JSON.stringify(got)}`);
    assert.deepEqual(r.toL, [[2], [2], [2], [2]], `${file}: 真的指向 L 时要能认出来 ${JSON.stringify(r.toL)}`);
    assert.deepEqual(r.twoTargets, [3, 5], `${file}: LINK|P3|P5 应是两个目标`);
    r.eachName.forEach((got, i) => assert.deepEqual(got, [i + 1], `${file}: DUEL:<第${i + 1}个名字> 应只指向他本人，实际 ${JSON.stringify(got)}`));
    assert.deepEqual(r.p12, [12], `${file}: P12 不应同时命中 P1`);
    assert.deepEqual(r.nested, [[2], [1], [2]], `${file}: 短名字落在长名字里时只算长名字 ${JSON.stringify(r.nested)}`);
    assert.deepEqual(r.appears, [false, true, false, true, true, false], `${file}: nameAppearsIn ${JSON.stringify(r.appears)}`);
    assert.deepEqual(r.mentions, [false, true, false], `${file}: textMentionsPlayer ${JSON.stringify(r.mentions)}`);
    assert.deepEqual(r.decline, [true, true, true, true, true, false, false, false, false], `${file}: actionHasDeclineWord ${JSON.stringify(r.decline)}`);
    assert.deepEqual(r.find, ['Levi Ackerman', 'Levi Ackerman', 'L', '艾伦·耶格尔'], `${file}: findPlayer ${JSON.stringify(r.find)}`);
    for (const k of ['knightSeat', 'knightName', 'knightSnow', 'whitewolf']) {
      const f = r[k];
      assert.equal(f.t, 'done', `${file} ${k}: 流程超时`);
      assert.equal(f.popup, 0, `${file} ${k}: 不应弹技术故障 ${JSON.stringify(f)}`);
      assert.equal(f.asked, 1, `${file} ${k}: 回答合格，不应再要求格式纠正 ${JSON.stringify(f)}`);
      assert.ok(f.used && !f.targetAlive, `${file} ${k}: 技能应执行并带走目标 ${JSON.stringify(f)}`);
      assert.ok(f.lAlive, `${file} ${k}: 旁观的 L 不应被牵连`);
    }
    console.log(`${file}: command words never name a player; knight and white wolf act with L at the table`);
  });
}
console.log('short-name target matching OK');
