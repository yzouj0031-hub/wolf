// 警长竞选"循环重复一次"：
// 竞选进行中发生 重开 / 读档 / 对局回溯 / 云端续玩，S.players 被整批换新，但正在 await 的旧竞选
// 不会停——旧 callAI 只返回空结果，旧流程继续跑，把退选、当选、日志和记录写进新对局；新对局再跑
// 一遍，屏幕上"退出竞选""当选为警长"各出现两次。修复：旧流程拿着旧玩家对象调用 callAI /
// waitInput / waitChoice 时就地停住；同一回合竞选重跑时先清掉上一次的半截记录。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withOfflinePage} from './lib/offline-browser.mjs';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("  if (guarded && isStaleActor(p)) return haltStaleRun('callAI', p);\n  const r = await _callAIImpl(p, prompt, opts);\n  if (guarded && isStaleActor(p)) return haltStaleRun('callAI·返回时', p);"),
    `${file}: callAI 没有在发请求前、返回时两处做过期阶段熔断`);
  assert.ok(src.includes("function waitInput(ctx, hint, currentPlayer) {\n  if (isStaleActor(currentPlayer)) return haltStaleRun('waitInput', currentPlayer);\n  return _waitInputImpl("),
    `${file}: waitInput 没有过期阶段熔断`);
  if (src.includes('function waitChoice(ctx, hint, opts, choiceMeta) {'))
    assert.ok(src.includes("  if (isStaleActor(actor)) return haltStaleRun('waitChoice', actor);\n  return _waitChoiceImpl("),
      `${file}: waitChoice 没有过期阶段熔断`);
  assert.ok(src.includes("r.type === 'sheriff_roster' && r.stage === 'signup' && r.round === S.round"), `${file}: 竞选重跑没有清掉上一次的半截记录`);
}

await withOfflinePage(async (page, origin) => {
  for (const path of ['/index.html', '/en/index.html']) {
    const errors = [];
    page.removeAllListeners('pageerror'); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + path); await page.waitForTimeout(1000);
    const result = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      // 假 AI：只替换内层实现 _callAIImpl，外层真实的 callAI（发出前 / 返回时两道熔断）原样生效
      window._callAIImpl = async (p, prompt, opts) => {
        await sleep(5);
        let action = 'None';
        if (/YES或NO/.test(prompt)) action = p.id === 0 ? 'YES' : 'NO';   // 只有一人报名 → 自动当选，走最短流程
        else if (/STAY或QUIT/.test(prompt)) action = p.id % 2 ? 'QUIT' : 'STAY';
        else if (/投谁当警长|再投一次/.test(prompt)) { const m = prompt.match(/(?:候选人|选择)：([^。\n]+)/); action = m ? m[1].split('、')[0].trim() : 'PASS'; }
        return {thinking:'想', game:'我是好人，这一轮我先听完所有人的发言再下判断，暂时不点具体的人。希望跳身份的玩家把逐夜记录完整交出来，谁的记录前后对不上、谁的票型和发言立场不一致，我会重点盘他。今天我倾向于跟着有具体证据的一方投票。', action};
      };
      if (window.TTS) TTS.speak = async () => {};
      window.getSpd = () => 3;                                                    // 打字机最快档
      window.sleep = ms => new Promise(r => setTimeout(r, Math.min(ms, 5)));      // 压短游戏内部的停顿
      const setup = () => {
        const roles = MODE_CONFIGS.standard.roles;
        S.players = roles.map((r, i) => ({id:i, name:curNames[i] || ('P'+(i+1)), alive:true, isPlayer:false, role:ALL_ROLES[r], memory:[], mbti:null, revealed:false}));
        S.round = 1; S.phase = 'sheriff'; S.nightData = {_pendingResolve:false}; S._lastNightDeaths = []; S.auto = false;
        gameRecord.push({type:'system', text:'开局'});
      };
      // 截获翻译前的原始日志：英文页屏幕上显示的是译文，这里统一按原文计数
      window.__raw = [];
      const _log = Render.log;
      Render.log = function (type, html) { window.__raw.push(String(html || '')); return _log.apply(this, arguments); };
      const logs = () => window.__raw.slice();
      const waitDay = async () => { for (let i = 0; i < 900 && !(S.phase === 'day' && !S.running); i++) await sleep(100); };
      selectMode('standard', true);

      // ① 竞选进行中重开
      setup(); nextStep();
      for (let i = 0; i < 200 && !logs().some(t => t.includes('谁要竞选警长')); i++) await sleep(20);
      await sleep(60);
      forceReset(); window.__raw.length = 0; setup(); nextStep();   // 只统计重开之后的日志
      await waitDay(); await sleep(800);   // 给旧流程充分时间——修复前它会在这段时间里把当选再写一遍
      const reset = {
        elected: logs().filter(t => t.includes('当选为警长')).length,
        signupLogs: logs().filter(t => t.includes('谁要竞选警长')).length,
        roster: gameRecord.filter(r => r.type === 'sheriff_roster' && r.stage === 'signup').length,
        phase: S.phase, running: S.running, tail: logs().slice(-8),
      };

      // ② 同一回合重跑：上一次留下了半截记录
      forceReset(); window.__raw.length = 0; setup();
      gameRecord.push({type:'sheriff_roster', stage:'signup', round:1, candidates:['旧'], nonCandidates:[], text:'警长报名：旧'});
      gameRecord.push({type:'system', round:1, phase:'sheriff', text:'旧 退出警长竞选'});
      S.history.push({round:1, phase:'sheriff', name:'旧', text:'旧的竞选发言'});
      S.players.forEach(p => p.memory.push({role:'system', content:'【警长竞选·参选名单】旧'}));
      nextStep(); await waitDay();
      const rerun = {
        roster: gameRecord.filter(r => r.type === 'sheriff_roster' && r.stage === 'signup').length,
        staleRecords: gameRecord.filter(r => /旧/.test(r.text || '')).length,
        staleHistory: S.history.filter(h => h.text === '旧的竞选发言').length,
        staleMemory: S.players.reduce((n, p) => n + p.memory.filter(m => m.content === '【警长竞选·参选名单】旧').length, 0),
        notice: logs().some(t => t.includes('警长竞选从头重新开始')),
      };
      return {reset, rerun};
    });
    assert.deepEqual(errors, [], `${path}: 页面报错`);
    assert.equal(result.reset.phase, 'day', `${path}: 重开后的竞选没有正常结束 ${JSON.stringify(result.reset)}`);
    assert.equal(result.reset.elected, 1, `${path}: 竞选中途重开后"当选"出现了 ${result.reset.elected} 次（旧竞选没有停下）`);
    assert.equal(result.reset.signupLogs, 1, `${path}: 竞选中途重开后报名出现了 ${result.reset.signupLogs} 次`);
    assert.equal(result.reset.roster, 1, `${path}: 新对局里有 ${result.reset.roster} 份报名记录`);
    assert.equal(result.rerun.roster, 1, `${path}: 同一回合重跑后报名记录有 ${result.rerun.roster} 份`);
    assert.equal(result.rerun.staleRecords, 0, `${path}: 上一次竞选的半截记录没清掉`);
    assert.equal(result.rerun.staleHistory, 0, `${path}: 上一次竞选的发言没清掉`);
    assert.equal(result.rerun.staleMemory, 0, `${path}: 上一次的参选名单还留在 AI 记忆里`);
    assert.ok(result.rerun.notice, `${path}: 重跑时没有提示"从头重新开始"`);
  }
});

console.log('sheriff rerun: a stale election halts after reset/load, and a same-round rerun starts clean (one roster, one winner)');
