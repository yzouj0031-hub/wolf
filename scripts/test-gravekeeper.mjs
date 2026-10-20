// ⚰️ 守墓人：白天放逐（phase 记成 'vote'）、平票 PK、审判处决都要能在当晚读到阵营；夜里死的不算；同一人不重复报。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

await withOfflinePage(async (page, origin) => {
  for (const file of ['index.html', 'en/index.html']) {
    await page.goto(origin + '/' + file);
    await page.waitForFunction(() => typeof NightActions === 'object' && typeof ALL_ROLES === 'object');
    const r = await page.evaluate(async () => {
      const keys = ['gravekeeper', 'villager', 'werewolf', 'werewolf', 'seer', 'jester'];
      S.players = keys.map((key, id) => ({ id, name: 'N' + id, role: ALL_ROLES[key], alive: true, memory: [], isPlayer: false }));
      Object.assign(S, { playerId: -1, pureAI: true, gameOver: false, round: 2, phase: 'night', history: [] });
      const gk = S.players[0];
      const alive = () => S.players.filter(p => p.alive);
      const results = () => gameRecord.filter(x => x.type === 'night_action' && x.role === 'gravekeeper').map(x => x.target + ':' + x.result);
      // 第 1 天：N2（狼）被投票放逐，阶段按真实流程记成 'vote'
      gameRecord.length = 0;
      S.players[2].alive = false;
      gameRecord.push({ type: 'death', name: 'N2', role: '狼人', team: 'bad', cause: 'vote', round: 1, phase: 'vote', suffix: ' [5票]' });
      await NightActions.gravekeeper(alive());
      const afterVote = results();
      const mem1 = gk.memory.map(m => m.content).join('\n');
      // 同一晚再跑一次不重复
      await NightActions.gravekeeper(alive());
      const noDup = results().length;
      // 第 2 夜狼刀 N4：夜里死的不算；守墓人没有新结果
      S.round = 3; S.players[4].alive = false;
      gameRecord.push({ type: 'death', name: 'N4', role: '预言家', team: 'good', cause: 'kill', round: 2, phase: 'night', suffix: '' });
      await NightActions.gravekeeper(alive());
      const afterKill = results();
      // 第 3 天：N5（第三方）PK 放逐；第 4 天：N1 审判处决（phase 为 'day'）
      S.players[5].alive = false;
      gameRecord.push({ type: 'death', name: 'N5', role: '小丑', team: 'third', cause: 'vote', round: 3, phase: 'vote', suffix: ' [PK 3票]' });
      S.round = 4; await NightActions.gravekeeper(alive());
      S.players[1].alive = false;
      gameRecord.push({ type: 'death', name: 'N1', role: '村民', team: 'good', cause: 'trial', round: 4, phase: 'day', suffix: ' [被审判定罪处决]' });
      S.round = 5; await NightActions.gravekeeper(alive());
      const beforeDayKills = results().length;
      // 第 5 天：白天里的非放逐死亡（白狼王投票阶段自爆带人、自爆者本人、猎人开枪、骑士决斗、狼美人被放逐时连带殉情的被魅惑者、恋人殉情）都不算放逐
      for (const [name, cause, phase] of [['N3', 'explode', 'vote'], ['N3x', 'selfexplode', 'vote'], ['N3y', 'shoot', 'day'], ['N3z', 'duel', 'day'], ['N3c', 'charm', 'vote'], ['N3l', 'loversick', 'vote']]) {
        gameRecord.push({ type: 'death', name, role: '?', team: 'bad', cause, round: 5, phase, suffix: '' });
      }
      S.round = 6; await NightActions.gravekeeper(alive());
      const dayKillsIgnored = results().length === beforeDayKills;
      return { afterVote, mem1, noDup, afterKill, final: results(), dayKillsIgnored };
    });
    assert.deepEqual(r.afterVote, ['N2:狼人阵营'], `${file}: 放逐（phase=vote）当晚没读到阵营`);
    assert.ok(r.mem1.includes('【守墓人私密结果】') && r.mem1.includes('N2') && r.mem1.includes('狼人阵营'), `${file}: 私密结果没进记忆`);
    assert.equal(r.noDup, 1, `${file}: 同一放逐者重复报了`);
    assert.deepEqual(r.afterKill, ['N2:狼人阵营'], `${file}: 夜里被刀的人不该被守墓人读到`);
    assert.deepEqual(r.final, ['N2:狼人阵营', 'N5:第三方阵营', 'N1:好人阵营'], `${file}: PK 放逐 / 审判处决没读到`);
    assert.ok(r.dayKillsIgnored, `${file}: 白天的自爆带走 / 开枪 / 决斗被当成了放逐`);
    console.log(file, 'ok');
  }
});
