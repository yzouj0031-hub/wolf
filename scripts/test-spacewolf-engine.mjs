// 🚀 太空狼人杀引擎：用脚本小人跑整局，检查地图、结算规则和终局。
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../spacewolf-engine.js');

// ── 地图：连通、任务房间存在、走廊两端存在 ──
for (const [a, b] of E.EDGES) assert.ok(E.ROOM[a] && E.ROOM[b], `走廊两端不存在：${a}-${b}`);
for (const t of E.TASK_DEFS) assert.ok(E.ROOM[t.room], `任务房间不存在：${t.room}`);
for (const a of E.ROOMS) for (const b of E.ROOMS) {
  assert.ok(Number.isFinite(E.DIST[a.id][b.id]), `房间不连通：${a.id} → ${b.id}`);
  if (a.id !== b.id) { const p = E.pathBetween(a.id, b.id); assert.equal(p[p.length - 1], b.id); }
}
assert.ok(E.mapBrief().includes('食堂（紧急按钮）'));

// ── 会议结算：平票、弃票过半不放逐；多数票放逐 ──
{
  const G = E.createGame({ players: 6, impostors: 1, seed: 7 });
  const caller = E.alive(G)[0];
  G.cfg.buttonCooldownSec = 0; G.t = 1000;
  const m = E.startMeeting(G, caller, { type: 'button' });
  assert.equal(G.phase, 'meeting'); assert.equal(m.type, 'button'); assert.equal(caller.buttonsLeft, 0);
  const ids = E.alive(G).map(p => p.id);
  // 3 票 A、3 票 B → 平票
  let r = E.resolveMeeting(G, { [ids[0]]: ids[1], [ids[2]]: ids[1], [ids[3]]: ids[1], [ids[1]]: ids[0], [ids[4]]: ids[0], [ids[5]]: ids[0] });
  assert.equal(r.ejectedId, null); assert.equal(r.reason, '平票'); assert.equal(G.phase, 'action');
  E.startMeeting(G, E.alive(G)[1], { type: 'button' });
  // 2 票 A、4 弃票 → 弃票不少于最高票
  r = E.resolveMeeting(G, { [ids[0]]: ids[1], [ids[2]]: ids[1] });
  assert.equal(r.ejectedId, null); assert.ok(r.reason.includes('弃票'));
  E.startMeeting(G, E.alive(G)[2], { type: 'button' });
  r = E.resolveMeeting(G, { [ids[0]]: ids[1], [ids[2]]: ids[1], [ids[3]]: ids[1], [ids[4]]: ids[1] });
  assert.equal(r.ejectedId, ids[1]); assert.equal(G.players[ids[1]].alive, false); assert.equal(G.players[ids[1]].ejected, true);
}

// ── 意图归一：中文房间名、颜色都能解析；船员不能 hunt；report 没尸体时回落 ──
{
  const G = E.createGame({ players: 8, impostors: 2, seed: 3 });
  const crew = G.players.find(p => p.role === 'crew'), imp = G.players.find(p => p.role === 'impostor');
  let it = E.setIntent(G, crew, { plan: 'move', room: '电力室' });
  assert.equal(it.plan, 'move'); assert.equal(it.room, 'electrical'); assert.ok(crew.path.length > 0);
  it = E.setIntent(G, crew, { plan: 'hunt', target: imp.color });
  assert.notEqual(it.plan, 'hunt', '船员不能有击杀意图');
  it = E.setIntent(G, imp, { plan: 'hunt', target: crew.color });
  assert.equal(it.plan, 'hunt'); assert.equal(it.kill.target, crew.id); assert.equal(it.kill.allowWitness, false); assert.equal(it.kill.enabled, true);
  it = E.setIntent(G, imp, { plan: 'fake', room: '仓库' });
  assert.equal(it.kill.enabled, false, '没要求击杀时不应顺手杀人');
  it = E.setIntent(G, crew, { plan: 'report' });
  assert.notEqual(it.plan, 'report');
}

// ── 整局：脚本小人，多种子，检查不变量 ──
let ends = { crew: 0, impostor: 0, timeout: 0 }, meetings = 0, kills = 0, witnessKills = 0;
for (let seed = 1; seed <= 24; seed++) {
  // 脚本小人不会推理，脚本局只是任务和刀口的赛跑；这组参数下两边都能赢，用来守不变量
  const G = E.createGame({ players: 8, impostors: 2, seed, tasksPerCrew: 3, killCooldownSec: 45, taskTimeScale: 3 });
  G.players.forEach(p => { p.brain = 'bot'; });
  let guard = 0;
  while (G.phase !== 'ended' && G.t < 25 * 60 * 1000 && guard++ < 200000) {
    if (G.phase === 'meeting') {
      // 脚本会议：每人一句模板发言，然后投票
      for (const p of E.alive(G)) { const s = E.botSpeech(G, p); E.addSpeech(G, p, s.text, { accuse: s.accuse }); }
      const votes = {}; for (const p of E.alive(G)) votes[p.id] = E.botVote(G, p);
      E.resolveMeeting(G, votes);
      continue;
    }
    E.step(G, 100);
    for (const p of G.players) {
      assert.ok(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y), `坐标出现 NaN（种子 ${seed}）`);
      if (p.alive && !p.moving) assert.ok(E.ROOM[p.room], `活人既不在房间也不在走廊（种子 ${seed}）`);
    }
  }
  assert.notEqual(G.phase, 'meeting');
  if (G.phase === 'ended') ends[G.winner]++; else ends.timeout++;
  for (const e of G.events) {
    if (e.type === 'kill') {
      kills++;
      if (e.witnesses.length) witnessKills++;
      const k = G.players[e.killer], v = G.players[e.victim];
      assert.equal(k.role, 'impostor'); assert.equal(v.role, 'crew', '内鬼不能杀内鬼');
      assert.equal(e.witnesses.length, 0, '脚本内鬼不允许有目击者时不该当众动手');
    }
    if (e.type === 'meeting') meetings++;
  }
  // 任务计数一致
  const doneCount = G.players.filter(p => p.role === 'crew').reduce((n, p) => n + p.tasks.filter(t => t.done).length, 0);
  assert.equal(doneCount, G.taskDone, `任务计数不一致（种子 ${seed}）`);
  assert.ok(G.taskDone <= G.taskTotal);
  // 每个人的时间线都有开局与进入房间的记录
  for (const p of G.players) assert.ok(p.timeline.length >= 2 && p.timeline[0].type === 'start');
  // 回放帧可序列化
  JSON.stringify(E.frame(G));
}
console.log('endings:', ends, 'meetings:', meetings, 'kills:', kills);
assert.equal(ends.timeout, 0, '有对局 25 分钟内没有结束');
assert.ok(kills > 0 && meetings > 0, '脚本局里应当出现击杀与会议');
assert.ok(ends.crew > 0 && ends.impostor > 0, '24 局里两边都该赢过');

// ── 口供核验 ──
{
  const G = E.createGame({ players: 6, impostors: 1, seed: 11 });
  const p = E.alive(G)[0];
  E.setIntent(G, p, { plan: 'move', room: 'medbay' });
  for (let i = 0; i < 400 && (p.room !== 'medbay' || p.moving); i++) E.step(G, 100);
  assert.equal(p.room, 'medbay');
  const v = E.verifyClaims(G, p, { rooms: ['医疗室', '反应堆'], seen: [] }, 0);
  assert.deepEqual(v.map(x => [x.claim, x.ok]), [['医疗室', true], ['反应堆', false]]);
  // 时间线文本与公开状态
  assert.ok(E.timelineText(G, p).includes('进入医疗室'));
  assert.ok(E.publicStatus(G).includes('任务进度'));
  assert.ok(E.whereText(G, p).includes('医疗室'));
}

// ── 节奏：默认值按原作校；首个击杀冷却缩短；脚本船员做完任务会歇一会儿；默认配置下整局不会两分钟就被任务结束 ──
{
  const D = E.DEFAULTS;
  assert.equal(D.tasksPerCrew, 6); assert.equal(D.killCooldownSec, 45); assert.equal(D.taskTimeScale, 4); assert.equal(D.speedPxPerSec, 65);
  assert.ok(D.crewRestSec >= 3 && D.firstKillCooldownSec <= 20, '缺少船员歇息 / 首刀冷却');
  const G = E.createGame({ players: 8, impostors: 2, seed: 7 });
  G.players.forEach(p => { p.brain = 'bot'; });
  const imp = G.players.find(p => p.role === 'impostor');
  assert.equal(imp.killCooldown, 20000, '开局首个击杀冷却应为 20 秒');
  const crew = G.players.find(p => p.role === 'crew');
  assert.ok(crew.tasks.every(t => t.sec >= 20), '标准节奏下单个任务不该短于 20 秒：' + crew.tasks.map(t => t.sec).join());
  let rested = false, guard = 0, firstTaskDoneAt = null;
  while (G.phase !== 'ended' && G.t < 15 * 60 * 1000 && guard++ < 200000) {
    if (G.phase === 'meeting') {
      for (const p of E.alive(G)) { const s = E.botSpeech(G, p); E.addSpeech(G, p, s.text, { accuse: s.accuse }); }
      const votes = {}; for (const p of E.alive(G)) votes[p.id] = E.botVote(G, p);
      E.resolveMeeting(G, votes); continue;
    }
    E.step(G, 100);
    if (firstTaskDoneAt == null && G.taskDone > 0) firstTaskDoneAt = G.t;
    if (G.players.some(p => p.role === 'crew' && p.alive && p.restUntil > G.t && (!p.intent || p.intentDone))) rested = true;
  }
  assert.ok(firstTaskDoneAt == null || firstTaskDoneAt >= 20000, '第一个任务完成得太早：' + firstTaskDoneAt);
  assert.ok(rested, '脚本船员做完任务后应歇一会儿');
  assert.ok(!(G.winner === 'crew' && G.t < 150000), '默认节奏下船员不该在两分半内靠任务赢：' + G.winner + ' ' + G.t);
}

console.log('spacewolf engine: map, meetings, intents, 24 scripted games, claim verification and pacing OK');
