// 🚀 太空狼人杀 · 引擎（spacewolf-engine.js）
// 纯逻辑，不碰 DOM：地图与走廊、寻路、连续移动、房间视野、任务、击杀冷却与目击规则、尸体、
// 紧急按钮、会议开始 / 投票结算 / 放逐、胜负判定、脚本小人策略、给提示词用的描述助手、回放帧。
// 界面层（spacewolf.js）每帧调用 step()，把"模型的意图"用 setIntent() 喂进来；
// 引擎把"需要有人做决定"的时刻放进 G.pending，由界面层交给模型或脚本小人。
// 同一份代码在 node 里直接 require，用脚本小人跑整局做回归测试。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpaceWolfEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ================================================================
   *  § 颜色、地图、任务
   * ================================================================ */
  const COLORS = [
    { id: 'red',    name: '红',   hex: '#c51111' },
    { id: 'blue',   name: '蓝',   hex: '#1b3fd8' },
    { id: 'green',  name: '绿',   hex: '#15923a' },
    { id: 'pink',   name: '粉',   hex: '#ed54ba' },
    { id: 'orange', name: '橙',   hex: '#f07d16' },
    { id: 'yellow', name: '黄',   hex: '#f5e14a' },
    { id: 'black',  name: '黑',   hex: '#4a535c' },
    { id: 'white',  name: '白',   hex: '#dde6f5' },
    { id: 'purple', name: '紫',   hex: '#7a3fd4' },
    { id: 'brown',  name: '棕',   hex: '#8a5a2b' },
    { id: 'cyan',   name: '青',   hex: '#3ee8d8' },
    { id: 'lime',   name: '黄绿', hex: '#7be34a' }
  ];

  // 布局按经典飞船的大致位置，坐标是 1160×660 画布上的中心点与尺寸
  const ROOMS = [
    { id: 'upperEngine',    name: '上引擎室', cx: 150,  cy: 150, w: 170, h: 140 },
    { id: 'reactor',        name: '反应堆',   cx: 70,   cy: 335, w: 110, h: 170 },
    { id: 'security',       name: '安保室',   cx: 235,  cy: 335, w: 110, h: 100 },
    { id: 'lowerEngine',    name: '下引擎室', cx: 150,  cy: 520, w: 170, h: 140 },
    { id: 'medbay',         name: '医疗室',   cx: 365,  cy: 200, w: 150, h: 150 },
    { id: 'electrical',     name: '电力室',   cx: 385,  cy: 480, w: 160, h: 150 },
    { id: 'cafeteria',      name: '食堂',     cx: 600,  cy: 160, w: 240, h: 200, button: true },
    { id: 'admin',          name: '管理室',   cx: 640,  cy: 380, w: 140, h: 110 },
    { id: 'storage',        name: '仓库',     cx: 560,  cy: 545, w: 190, h: 150 },
    { id: 'weapons',        name: '武器室',   cx: 860,  cy: 130, w: 150, h: 130 },
    { id: 'o2',             name: '氧气室',   cx: 830,  cy: 300, w: 120, h: 100 },
    { id: 'navigation',     name: '导航室',   cx: 1060, cy: 300, w: 130, h: 140 },
    { id: 'shields',        name: '护盾室',   cx: 880,  cy: 455, w: 150, h: 120 },
    { id: 'communications', name: '通讯室',   cx: 760,  cy: 585, w: 150, h: 100 }
  ];
  const EDGES = [
    ['upperEngine', 'medbay'], ['upperEngine', 'reactor'], ['upperEngine', 'security'], ['upperEngine', 'cafeteria'],
    ['reactor', 'security'], ['reactor', 'lowerEngine'],
    ['security', 'lowerEngine'],
    ['lowerEngine', 'electrical'], ['lowerEngine', 'storage'],
    ['medbay', 'cafeteria'],
    ['cafeteria', 'admin'], ['cafeteria', 'weapons'], ['cafeteria', 'storage'],
    ['admin', 'storage'],
    ['storage', 'electrical'], ['storage', 'communications'], ['storage', 'shields'],
    ['weapons', 'o2'], ['weapons', 'navigation'],
    ['o2', 'navigation'], ['o2', 'shields'],
    ['navigation', 'shields'],
    ['shields', 'communications']
  ];
  // 任务：visual=true 是"视觉任务"，同房间的人能看见动画，内鬼做不了，所以看见等于洗白
  const TASK_DEFS = [
    { id: 'caf_trash',   room: 'cafeteria',      name: '倒垃圾',         sec: 6 },
    { id: 'caf_wires',   room: 'cafeteria',      name: '修复配线',       sec: 8 },
    { id: 'wea_ast',     room: 'weapons',        name: '清理小行星',     sec: 10, visual: true },
    { id: 'nav_course',  room: 'navigation',     name: '校准航向',       sec: 7 },
    { id: 'nav_down',    room: 'navigation',     name: '下载数据',       sec: 6 },
    { id: 'o2_filter',   room: 'o2',             name: '清理氧气过滤器', sec: 7 },
    { id: 'o2_water',    room: 'o2',             name: '给植物浇水',     sec: 6 },
    { id: 'shi_prime',   room: 'shields',        name: '启动护盾',       sec: 8, visual: true },
    { id: 'com_down',    room: 'communications', name: '下载数据',       sec: 6 },
    { id: 'sto_fuel',    room: 'storage',        name: '加注燃料',       sec: 9 },
    { id: 'sto_trash',   room: 'storage',        name: '倒垃圾',         sec: 6 },
    { id: 'adm_card',    room: 'admin',          name: '刷卡',           sec: 5 },
    { id: 'adm_up',      room: 'admin',          name: '上传数据',       sec: 6 },
    { id: 'ele_wires',   room: 'electrical',     name: '接线',           sec: 8 },
    { id: 'ele_cal',     room: 'electrical',     name: '校准配电',       sec: 7 },
    { id: 'ele_down',    room: 'electrical',     name: '下载数据',       sec: 6 },
    { id: 'low_align',   room: 'lowerEngine',    name: '校准引擎',       sec: 7 },
    { id: 'low_fuel',    room: 'lowerEngine',    name: '加注燃料',       sec: 8 },
    { id: 'upp_align',   room: 'upperEngine',    name: '校准引擎',       sec: 7 },
    { id: 'upp_fuel',    room: 'upperEngine',    name: '加注燃料',       sec: 8 },
    { id: 'rea_start',   room: 'reactor',        name: '启动反应堆',     sec: 10 },
    { id: 'rea_manual',  room: 'reactor',        name: '解锁手动模式',   sec: 7 },
    { id: 'sec_wires',   room: 'security',       name: '修复配线',       sec: 8 },
    { id: 'med_scan',    room: 'medbay',         name: '医疗扫描',       sec: 12, visual: true },
    { id: 'med_sample',  room: 'medbay',         name: '检查样本',       sec: 9 }
  ];

  const ROOM = Object.fromEntries(ROOMS.map(r => [r.id, r]));
  const ADJ = Object.fromEntries(ROOMS.map(r => [r.id, []]));
  EDGES.forEach(([a, b]) => { ADJ[a].push(b); ADJ[b].push(a); });
  const dist = (a, b) => Math.hypot(ROOM[a].cx - ROOM[b].cx, ROOM[a].cy - ROOM[b].cy);

  // 全源最短路（14 个房间，Floyd 足够），NEXT[a][b] 是从 a 去 b 的下一站
  const IDS = ROOMS.map(r => r.id);
  const DIST = {}, NEXT = {};
  IDS.forEach(a => { DIST[a] = {}; NEXT[a] = {}; IDS.forEach(b => { DIST[a][b] = a === b ? 0 : Infinity; NEXT[a][b] = null; }); });
  EDGES.forEach(([a, b]) => { const d = dist(a, b); DIST[a][b] = d; DIST[b][a] = d; NEXT[a][b] = b; NEXT[b][a] = a; });
  IDS.forEach(k => IDS.forEach(i => IDS.forEach(j => {
    if (DIST[i][k] + DIST[k][j] < DIST[i][j]) { DIST[i][j] = DIST[i][k] + DIST[k][j]; NEXT[i][j] = NEXT[i][k]; }
  })));
  function pathBetween(a, b) {
    if (!ROOM[a] || !ROOM[b] || a === b) return [];
    const out = []; let cur = a;
    while (cur !== b) { cur = NEXT[cur][b]; if (!cur) return []; out.push(cur); }
    return out;
  }

  /* ================================================================
   *  § 工具
   * ================================================================ */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pad2 = n => String(n).padStart(2, '0');
  const fmtTime = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60); };
  const roomName = id => (ROOM[id] && ROOM[id].name) || (id || '走廊');
  const DEFAULTS = {
    players: 8, impostors: 2, tasksPerCrew: 6, killCooldownSec: 45, buttonsPerPlayer: 1, buttonCooldownSec: 15,
    // 节奏按原作校：单个任务二三十秒、全部任务四到六分钟，内鬼才有两三次出手的机会。
    //   之前 taskTimeScale 1.8 / 85 px/s 是为了演示局快点跑完，真打起来船员两分钟就靠任务赢了。
    //   击杀冷却 45 秒是原作默认；开局首刀 20 秒。脚本小人不会推理，脚本局只是任务和刀口的赛跑，真正的平衡看 API 局。
    speedPxPerSec: 65, taskTimeScale: 4, crewRestSec: 6, firstKillCooldownSec: 20,
    confirmEjects: false, discussionRounds: 1, ghostTaskSec: 25, seed: null, names: null
  };

  // 每个人在每个房间有一个固定的站位，避免全挤在房间中心
  function slotPos(roomId, playerId) {
    const r = ROOM[roomId];
    const ang = playerId * 2.399963 + 0.7;     // 黄金角分散
    const rad = Math.min(r.w, r.h) * 0.28;
    return { x: r.cx + Math.cos(ang) * rad, y: r.cy + Math.sin(ang) * rad * 0.8 };
  }

  /* ================================================================
   *  § 开局
   * ================================================================ */
  function createGame(cfgIn) {
    const cfg = Object.assign({}, DEFAULTS, cfgIn || {});
    cfg.players = Math.max(4, Math.min(12, cfg.players | 0));
    cfg.impostors = Math.max(1, Math.min(cfg.players <= 6 ? 1 : 3, cfg.impostors | 0));
    const rng = mulberry32(cfg.seed == null ? (Date.now() ^ (Math.random() * 1e9)) : cfg.seed);
    const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

    const colorIdx = shuffle(COLORS.map((_, i) => i)).slice(0, cfg.players).sort((a, b) => a - b);
    const roleBag = shuffle(Array.from({ length: cfg.players }, (_, i) => i < cfg.impostors ? 'impostor' : 'crew'));
    const players = colorIdx.map((ci, id) => {
      const color = COLORS[ci];
      const name = (cfg.names && cfg.names[id]) || color.name;
      return {
        id, colorId: color.id, color: color.name, hex: color.hex, name,
        role: roleBag[id], alive: true, ejected: false, deathT: null,
        room: 'cafeteria', pos: slotPos('cafeteria', id), moving: null, path: [],
        intent: null, intentDone: true, intentSetAt: 0, tasking: null, fakeUntil: 0, waitUntil: 0,
        killCooldown: Math.min(cfg.killCooldownSec, cfg.firstKillCooldownSec || cfg.killCooldownSec) * 1000, buttonsLeft: cfg.buttonsPerPlayer,
        restUntil: 0,
        tasks: [], timeline: [], seenBodies: {}, witnessed: [], lastVisible: [], roomEnteredAt: 0, ghostTaskAt: 0,
        brain: 'bot', stats: { kills: 0, tasksDone: 0, votesCast: 0, meetingsCalled: 0, reports: 0 }
      };
    });
    // 船员任务：不同房间各一项
    const crew = players.filter(p => p.role === 'crew');
    crew.forEach(p => {
      const defs = shuffle(TASK_DEFS.slice());
      const used = new Set();
      for (const d of defs) {
        if (p.tasks.length >= cfg.tasksPerCrew) break;
        if (used.has(d.room)) continue;
        used.add(d.room);
        p.tasks.push({ id: d.id, room: d.room, name: d.name, sec: Math.round(d.sec * cfg.taskTimeScale), visual: !!d.visual, progress: 0, done: false });
      }
    });
    // 内鬼也发一份"假任务"清单，用来装样子（不计入进度）
    players.filter(p => p.role === 'impostor').forEach(p => {
      const defs = shuffle(TASK_DEFS.slice()); const used = new Set();
      for (const d of defs) { if (p.tasks.length >= cfg.tasksPerCrew) break; if (used.has(d.room) || d.visual) continue; used.add(d.room); p.tasks.push({ id: d.id, room: d.room, name: d.name, sec: Math.round(d.sec * cfg.taskTimeScale), visual: false, progress: 0, done: false, fake: true }); }
    });
    const taskTotal = crew.reduce((n, p) => n + p.tasks.length, 0);

    const G = {
      cfg, rng, t: 0, phase: 'action', players, bodies: [], meetings: [], meeting: null, events: [], pending: [],
      taskTotal, taskDone: 0, winner: null, winReason: '', lastMeetingEnd: -Infinity, nextBodyId: 1, nextEventId: 1, frames: []
    };
    players.forEach(p => {
      const mates = players.filter(x => x.role === 'impostor' && x.id !== p.id).map(x => x.color);
      obs(G, p, p.role === 'impostor'
        ? `开局：你是内鬼。${mates.length ? '你的同伙是 ' + mates.join('、') + '。' : '你是唯一的内鬼。'}击杀冷却 ${cfg.killCooldownSec} 秒。`
        : `开局：你是船员。你的任务：${p.tasks.map(t => roomName(t.room) + '·' + t.name).join('、')}。`, { type: 'start' });
    });
    event(G, { type: 'start', text: `开局：${players.length} 人，${cfg.impostors} 名内鬼，船员任务共 ${taskTotal} 项。` });
    return G;
  }

  /* ================================================================
   *  § 记录：上帝事件 与 每个人的私密时间线
   * ================================================================ */
  function event(G, e) {
    e.id = G.nextEventId++; e.t = G.t;
    G.events.push(e);
    return e;
  }
  function obs(G, p, text, data) {
    p.timeline.push(Object.assign({ t: G.t, text }, data || {}));
  }
  const alive = G => G.players.filter(p => p.alive);
  const byId = (G, id) => G.players[id];
  const occupants = (G, roomId) => alive(G).filter(p => p.room === roomId && !p.moving);
  const listNames = ps => ps.length ? ps.map(p => p.color).join('、') : '没有人';

  /* ================================================================
   *  § 意图
   *  plan: task | fake | move | follow | hunt | avoid | report | button | wait
   * ================================================================ */
  const PLANS = ['task', 'fake', 'move', 'follow', 'hunt', 'avoid', 'report', 'button', 'wait'];
  function resolveRoomId(x) {
    if (!x) return null;
    const s = String(x).trim();
    if (ROOM[s]) return s;
    const byName = ROOMS.find(r => r.name === s || s.includes(r.name));
    return byName ? byName.id : null;
  }
  function resolvePlayer(G, x) {
    if (x == null) return null;
    if (typeof x === 'number') return G.players[x] || null;
    const s = String(x).trim();
    return G.players.find(p => p.color === s || p.colorId === s || p.name === s || s.includes(p.color) || (p.name && s.includes(p.name))) || null;
  }
  function setIntent(G, p, raw, source) {
    raw = raw || {};
    let plan = PLANS.includes(raw.plan) ? raw.plan : 'move';
    let room = resolveRoomId(raw.room);
    const target = resolvePlayer(G, raw.target);
    if (p.role !== 'impostor' && (plan === 'hunt' || plan === 'fake')) plan = 'task';
    if ((plan === 'follow' || plan === 'hunt' || plan === 'avoid') && (!target || target.id === p.id || !target.alive)) plan = p.role === 'impostor' ? 'fake' : 'task';
    if (plan === 'task') {
      const pending = p.tasks.filter(t => !t.done);
      if (!pending.length) plan = 'move';
      else if (!room || !pending.some(t => t.room === room)) room = nearestTaskRoom(G, p);
    }
    if (plan === 'fake' && !room) room = p.tasks.filter(t => !t.done).map(t => t.room)[0] || randomRoom(G, p.room);
    if (plan === 'move' && !room) room = randomRoom(G, p.room);
    if (plan === 'button') room = 'cafeteria';
    if (plan === 'report') {
      const known = Object.keys(p.seenBodies).map(id => G.bodies.find(b => b.id === +id)).filter(b => b && !b.reported);
      if (!known.length) plan = p.role === 'impostor' ? 'fake' : 'task';
      else room = known[0].room;
    }
    const intent = {
      plan, room, target: target ? target.id : null,
      kill: p.role === 'impostor' ? {
        target: raw.kill && raw.kill.target != null ? (resolvePlayer(G, raw.kill.target) || {}).id ?? null : (plan === 'hunt' && target ? target.id : null),
        allowWitness: !!(raw.kill && raw.kill.allowWitness),
        enabled: p.role === 'impostor' && (plan === 'hunt' || !!(raw.kill && raw.kill.enabled !== false && raw.kill.target != null) || !!(raw.kill && raw.kill.enabled))
      } : null,
      seconds: Math.max(2, Math.min(90, Number(raw.seconds) || (plan === 'wait' ? 8 : 40))),
      note: String(raw.note || '').slice(0, 80), source: source || 'brain', setAt: G.t
    };
    if (p.role === 'impostor' && intent.kill && raw.kill === undefined && plan !== 'hunt') intent.kill.enabled = false;
    p.intent = intent; p.intentDone = false; p.intentSetAt = G.t;
    p.waitUntil = plan === 'wait' ? G.t + intent.seconds * 1000 : 0;
    p.tasking = null;
    replan(G, p);
    return intent;
  }
  function nearestTaskRoom(G, p) {
    const pending = p.tasks.filter(t => !t.done);
    if (!pending.length) return null;
    const from = p.room || (p.moving && p.moving.to) || 'cafeteria';
    pending.sort((a, b) => DIST[from][a.room] - DIST[from][b.room]);
    return pending[0].room;
  }
  function randomRoom(G, except) {
    const pool = IDS.filter(id => id !== except);
    return pool[Math.floor(G.rng() * pool.length)];
  }
  // 根据意图算当前要去的房间，并铺路
  function replan(G, p) {
    const it = p.intent; if (!it) return;
    let dest = it.room;
    if (it.plan === 'follow' || it.plan === 'hunt') {
      const t = byId(G, it.target);
      dest = t && t.alive ? (t.room || (t.moving && t.moving.to) || null) : null;
    }
    if (it.plan === 'avoid') {
      const t = byId(G, it.target);
      const here = p.room || (p.moving && p.moving.to);
      const tRoom = t && (t.room || (t.moving && t.moving.to));
      if (here && tRoom === here) {
        const options = ADJ[here].filter(r => occupants(G, r).every(x => x.id !== it.target));
        dest = options.length ? options[Math.floor(G.rng() * options.length)] : randomRoom(G, here);
        it.room = dest;
      } else dest = it.room || here;
    }
    const from = p.room || (p.moving && p.moving.to);
    if (!dest || !from) return;
    const want = pathBetween(from, dest);
    // 正在走廊里：保留当前这段，后面接新路
    p.path = p.moving ? want : want;
  }

  /* ================================================================
   *  § 每帧推进
   * ================================================================ */
  function step(G, dtMs) {
    if (G.phase !== 'action') return;
    const dt = Math.max(0, Math.min(250, dtMs));
    G.t += dt;
    const speed = G.cfg.speedPxPerSec * dt / 1000;
    for (const p of alive(G)) {
      if (p.role === 'impostor') p.killCooldown = Math.max(0, p.killCooldown - dt);
      if (!p.intent || p.intentDone) {
        if (p.brain === 'bot' && p.restUntil > G.t) { /* 脚本船员做完任务歇一会儿，别像流水线 */ }
        else if (p.brain === 'bot') setIntent(G, p, botIntent(G, p), 'bot');
        else if (!p.intent) setIntent(G, p, botIntent(G, p), 'fallback');
        else { /* 等界面层给新意图；期间原地等 */ }
      }
      // 跟随类意图：目标换房间就重新铺路
      if (p.intent && (p.intent.plan === 'follow' || p.intent.plan === 'hunt')) {
        const t = byId(G, p.intent.target);
        if (!t || !t.alive) { finishIntent(G, p, '目标已不在'); }
        else {
          const tRoom = t.room || (t.moving && t.moving.to);
          const myDest = p.path.length ? p.path[p.path.length - 1] : (p.moving ? p.moving.to : p.room);
          if (tRoom && myDest !== tRoom && !(p.room === tRoom && !p.moving)) replan(G, p);
        }
        if (p.intent && G.t - p.intentSetAt > p.intent.seconds * 1000) finishIntent(G, p, '跟随时间到');
      }
      if (p.intent && p.intent.plan === 'avoid') {
        const t = byId(G, p.intent.target);
        if (t && t.alive && !p.moving && p.room && t.room === p.room && !p.path.length) replan(G, p);
        if (G.t - p.intentSetAt > p.intent.seconds * 1000) finishIntent(G, p, '躲避时间到');
      }
      // 移动
      if (p.moving) {
        const m = p.moving;
        m.done += speed;
        if (m.done >= m.dist) { p.pos = { x: m.to_x, y: m.to_y }; p.room = m.to; p.moving = null; arrive(G, p); }
        else { const k = m.done / m.dist; p.pos = { x: m.from_x + (m.to_x - m.from_x) * k, y: m.from_y + (m.to_y - m.from_y) * k }; }
        continue;
      }
      if (p.path.length) {
        const next = p.path.shift();
        const to = slotPos(next, p.id);
        leave(G, p);
        p.moving = { from: p.room, to: next, from_x: p.pos.x, from_y: p.pos.y, to_x: to.x, to_y: to.y, dist: Math.max(1, Math.hypot(to.x - p.pos.x, to.y - p.pos.y)), done: 0 };
        p.room = null;
        continue;
      }
      inRoom(G, p, dt);
      if (G.phase !== 'action') return;
    }
    perceive(G);
    ghosts(G, dt);
    checkWin(G);
  }

  function finishIntent(G, p, why) {
    if (!p.intent || p.intentDone) return;
    p.intentDone = true; p.tasking = null;
    if (p.brain !== 'bot') G.pending.push({ type: 'decide', playerId: p.id, reason: why || '意图完成', t: G.t });
  }

  // 站在房间里时执行意图：做任务 / 装任务 / 等待 / 按按钮 / 报告 / 击杀
  function inRoom(G, p, dt) {
    const it = p.intent; if (!it || p.intentDone) return;
    if (p.role === 'impostor') tryKill(G, p);
    if (G.phase !== 'action') return;
    switch (it.plan) {
      case 'task': {
        if (p.room !== it.room) { replan(G, p); if (!p.path.length) finishIntent(G, p, '任务房间不可达'); return; }
        const task = p.tasks.find(t => !t.done && t.room === p.room);
        if (!task) { finishIntent(G, p, '这里没有待做任务'); return; }
        if (!p.tasking || p.tasking.id !== task.id) { p.tasking = { id: task.id, startedAt: G.t }; obs(G, p, `在${roomName(p.room)}开始做任务「${task.name}」`, { type: 'taskStart', room: p.room }); }
        task.progress += dt / 1000;
        if (task.progress >= task.sec) {
          task.done = true; p.tasking = null; p.stats.tasksDone++;
          if (p.role === 'crew') { G.taskDone++; p.restUntil = G.t + (1 + G.rng() * Math.max(0, G.cfg.crewRestSec || 0)) * 1000; }
          obs(G, p, `完成任务「${task.name}」（${roomName(p.room)}）`, { type: 'taskDone', room: p.room });
          event(G, { type: 'task', playerId: p.id, room: p.room, text: `${p.color} 在${roomName(p.room)}完成「${task.name}」（${G.taskDone}/${G.taskTotal}）` });
          finishIntent(G, p, '任务完成');
        }
        return;
      }
      case 'fake': {
        if (p.room !== it.room) { replan(G, p); if (!p.path.length) finishIntent(G, p, '房间不可达'); return; }
        if (!p.fakeUntil || p.fakeUntil < p.intentSetAt) p.fakeUntil = G.t + (6 + G.rng() * 5) * 1000;
        if (G.t >= p.fakeUntil) { finishIntent(G, p, '装完任务'); }
        return;
      }
      case 'move': {
        if (p.room === it.room) finishIntent(G, p, '到达'); else { replan(G, p); if (!p.path.length) finishIntent(G, p, '不可达'); }
        return;
      }
      case 'wait': if (G.t >= p.waitUntil) finishIntent(G, p, '等待结束'); return;
      case 'button': {
        if (p.room !== 'cafeteria') { replan(G, p); return; }
        if (canPressButton(G, p)) { startMeeting(G, p, { type: 'button' }); }
        else finishIntent(G, p, '现在不能按按钮');
        return;
      }
      case 'report': {
        const body = G.bodies.find(b => !b.reported && b.room === p.room);
        if (body) { startMeeting(G, p, { type: 'body', bodyId: body.id }); return; }
        if (p.room !== it.room) { replan(G, p); if (!p.path.length) finishIntent(G, p, '不可达'); return; }
        finishIntent(G, p, '尸体已不在');
        return;
      }
      default: return;
    }
  }
  function canPressButton(G, p) {
    return p.alive && p.buttonsLeft > 0 && G.t - G.lastMeetingEnd >= G.cfg.buttonCooldownSec * 1000 && G.t >= G.cfg.buttonCooldownSec * 1000;
  }

  // 到达房间：记一笔"进入"，看见谁、有没有尸体
  function arrive(G, p) {
    p.roomEnteredAt = G.t;
    const others = occupants(G, p.room).filter(x => x.id !== p.id);
    p.lastVisible = others.map(x => x.id);
    obs(G, p, `进入${roomName(p.room)}，房间里${others.length ? '有：' + listNames(others) : '没有人'}`, { type: 'enter', room: p.room, saw: others.map(x => x.id) });
    for (const o of others) {
      obs(G, o, `${p.color} 进入了${roomName(p.room)}`, { type: 'seeEnter', room: p.room, who: p.id });
      o.lastVisible.push(p.id);
    }
    noticeBodies(G, p);
    if (p.intent && (p.intent.plan === 'follow' || p.intent.plan === 'hunt')) { /* 到了就守着 */ }
  }
  function leave(G, p) {
    if (!p.room) return;
    const others = occupants(G, p.room).filter(x => x.id !== p.id);
    for (const o of others) {
      obs(G, o, `${p.color} 离开了${roomName(p.room)}`, { type: 'seeLeave', room: p.room, who: p.id });
      o.lastVisible = o.lastVisible.filter(id => id !== p.id);
    }
    obs(G, p, `离开${roomName(p.room)}${others.length ? '（留下：' + listNames(others) + '）' : ''}`, { type: 'leave', room: p.room, left: others.map(x => x.id) });
  }
  function noticeBodies(G, p) {
    for (const b of G.bodies) {
      if (b.reported || b.room !== p.room || p.seenBodies[b.id]) continue;
      p.seenBodies[b.id] = G.t;
      const victim = byId(G, b.victim);
      obs(G, p, `在${roomName(b.room)}发现了 ${victim.color} 的尸体`, { type: 'body', room: b.room, bodyId: b.id, victim: b.victim });
      event(G, { type: 'bodySeen', playerId: p.id, bodyId: b.id, room: b.room, text: `${p.color} 在${roomName(b.room)}看到了 ${victim.color} 的尸体` });
      if (p.brain === 'bot') { if (botBodyDecision(G, p, b) === 'report') { startMeeting(G, p, { type: 'body', bodyId: b.id }); return; } }
      else G.pending.push({ type: 'body', playerId: p.id, bodyId: b.id, room: b.room, t: G.t });
    }
  }
  // 每帧：看见别人做视觉任务
  function perceive(G) {
    for (const p of alive(G)) {
      if (!p.room || p.moving) continue;
      for (const o of occupants(G, p.room)) {
        if (o.id === p.id || !o.tasking) continue;
        const task = o.tasks.find(t => t.id === o.tasking.id);
        if (!task || !task.visual || task.fake) continue;
        const key = 'v' + o.id + ':' + task.id;
        if (p.seenBodies[key]) continue;
        p.seenBodies[key] = G.t;
        obs(G, p, `看见 ${o.color} 在${roomName(p.room)}做「${task.name}」（视觉任务，内鬼做不了）`, { type: 'visual', room: p.room, who: o.id });
      }
    }
  }
  // 死掉的船员像原版幽灵一样慢慢把剩余任务做完
  function ghosts(G, dt) {
    for (const p of G.players) {
      if (p.alive || p.role !== 'crew') continue;
      const left = p.tasks.filter(t => !t.done);
      if (!left.length) continue;
      if (!p.ghostTaskAt) p.ghostTaskAt = G.t;
      if (G.t - p.ghostTaskAt >= G.cfg.ghostTaskSec * 1000) {
        left[0].done = true; G.taskDone++; p.ghostTaskAt = G.t;
        event(G, { type: 'task', playerId: p.id, room: left[0].room, ghost: true, text: `${p.color}（幽灵）完成「${left[0].name}」（${G.taskDone}/${G.taskTotal}）` });
      }
    }
  }

  /* ================================================================
   *  § 击杀与尸体
   * ================================================================ */
  function tryKill(G, k) {
    if (k.killCooldown > 0 || !k.room || k.moving || !k.intent || !k.intent.kill || !k.intent.kill.enabled) return false;
    const here = occupants(G, k.room).filter(x => x.id !== k.id);
    const crew = here.filter(x => x.role !== 'impostor');
    let victim = null;
    if (k.intent.kill.target != null) victim = crew.find(x => x.id === k.intent.kill.target) || null;
    else victim = crew[0] || null;
    if (!victim) return false;
    const witnesses = here.filter(x => x.id !== victim.id && x.role !== 'impostor');
    if (witnesses.length && !k.intent.kill.allowWitness) return false;
    doKill(G, k, victim, witnesses);
    return true;
  }
  function doKill(G, k, v, witnesses) {
    v.alive = false; v.deathT = G.t; v.tasking = null; v.path = []; v.moving = null; v.intent = null;
    k.killCooldown = G.cfg.killCooldownSec * 1000; k.stats.kills++;
    const body = { id: G.nextBodyId++, victim: v.id, killer: k.id, room: k.room, t: G.t, pos: { x: v.pos.x, y: v.pos.y }, reported: false };
    G.bodies.push(body);
    const mates = alive(G).filter(x => x.role === 'impostor' && x.id !== k.id && x.room === k.room);
    obs(G, k, `你在${roomName(k.room)}杀死了 ${v.color}${witnesses.length ? '（有目击者：' + listNames(witnesses) + '！）' : '（无人看见）'}`, { type: 'kill', room: k.room, victim: v.id });
    obs(G, v, `你在${roomName(k.room)}被 ${k.color} 杀死了`, { type: 'killed', room: k.room, killer: k.id });
    witnesses.forEach(w => { obs(G, w, `你亲眼看见 ${k.color} 在${roomName(k.room)}杀死了 ${v.color}！`, { type: 'witness', room: k.room, killer: k.id, victim: v.id }); w.witnessed.push({ killer: k.id, victim: v.id, t: G.t }); });
    mates.forEach(m => obs(G, m, `同伙 ${k.color} 在${roomName(k.room)}杀死了 ${v.color}`, { type: 'mateKill', room: k.room, killer: k.id, victim: v.id }));
    event(G, { type: 'kill', killer: k.id, victim: v.id, room: k.room, witnesses: witnesses.map(w => w.id), text: `${k.color} 在${roomName(k.room)}杀死了 ${v.color}${witnesses.length ? '，目击者：' + listNames(witnesses) : ''}` });
    finishIntent(G, k, '已击杀');
    // 内鬼击杀后默认先离开现场；界面层随后会要一条新意图
    if (k.brain !== 'bot') setIntent(G, k, { plan: 'move', room: randomRoom(G, k.room), note: '离开现场' }, 'auto');
    // 目击者当场知道有尸体
    witnesses.forEach(w => noticeBodies(G, w));
  }

  /* ================================================================
   *  § 会议
   * ================================================================ */
  function startMeeting(G, caller, how) {
    if (G.phase !== 'action') return null;
    const body = how.type === 'body' ? G.bodies.find(b => b.id === how.bodyId) : null;
    if (how.type === 'button') { caller.buttonsLeft--; caller.stats.meetingsCalled++; }
    else caller.stats.reports++;
    const m = {
      id: G.meetings.length + 1, t: G.t, callerId: caller.id, type: how.type,
      bodyId: body ? body.id : null, victimId: body ? body.victim : null, room: body ? body.room : caller.room,
      deadRevealed: G.players.filter(p => !p.alive && !p.ejected && p.deathT != null).map(p => p.id),
      speeches: [], votes: {}, result: null, claims: []
    };
    G.bodies.forEach(b => { b.reported = true; });
    G.meeting = m; G.meetings.push(m); G.phase = 'meeting';
    alive(G).forEach(p => {
      p.moving = null; p.path = []; p.tasking = null; p.room = 'cafeteria'; p.pos = slotPos('cafeteria', p.id);
      p.intent = null; p.intentDone = true; p.lastVisible = [];
      obs(G, p, how.type === 'body'
        ? `${caller.id === p.id ? '你' : caller.color} 报告了 ${byId(G, body.victim).color} 的尸体（在${roomName(body.room)}），召开紧急会议`
        : `${caller.id === p.id ? '你' : caller.color} 按下了紧急按钮，召开紧急会议`, { type: 'meeting', meetingId: m.id });
    });
    event(G, { type: 'meeting', meetingId: m.id, callerId: caller.id, how: how.type, text: how.type === 'body'
      ? `${caller.color} 在${roomName(body.room)}报告了 ${byId(G, body.victim).color} 的尸体，召开会议`
      : `${caller.color} 按下紧急按钮，召开会议` });
    G.pending.length = 0;
    return m;
  }
  function addSpeech(G, p, text, extra) {
    const m = G.meeting; if (!m) return;
    const sp = Object.assign({ playerId: p.id, color: p.color, text: String(text || ''), t: G.t }, extra || {});
    m.speeches.push(sp);
    alive(G).forEach(x => obs(G, x, `${p.id === x.id ? '你' : p.color}（会议发言）：${sp.text}`, { type: 'speech', meetingId: m.id, who: p.id }));
    return sp;
  }
  // votes: { voterId: targetId | 'skip' }
  function resolveMeeting(G, votes) {
    const m = G.meeting; if (!m) return null;
    const tally = {}; let skip = 0;
    for (const voter of alive(G)) {
      const v = votes[voter.id];
      voter.stats.votesCast++;
      if (v == null || v === 'skip') { skip++; m.votes[voter.id] = 'skip'; continue; }
      const t = byId(G, +v);
      if (!t || !t.alive) { skip++; m.votes[voter.id] = 'skip'; continue; }
      m.votes[voter.id] = t.id; tally[t.id] = (tally[t.id] || 0) + 1;
    }
    const entries = Object.entries(tally).map(([id, n]) => ({ id: +id, n })).sort((a, b) => b.n - a.n);
    let ejected = null, reason = '';
    if (!entries.length) reason = '全员弃票';
    else if (entries[0].n <= skip) reason = '弃票数不少于最高票';
    else if (entries.length > 1 && entries[1].n === entries[0].n) reason = '平票';
    else ejected = byId(G, entries[0].id);
    if (ejected) {
      ejected.alive = false; ejected.ejected = true; ejected.deathT = G.t; ejected.intent = null;
      obs(G, ejected, '你被投票放逐了', { type: 'ejected' });
    }
    m.result = { ejectedId: ejected ? ejected.id : null, reason, tally, skip, revealed: !!(ejected && G.cfg.confirmEjects), ejectedRole: ejected && G.cfg.confirmEjects ? ejected.role : null };
    const voteText = alive(G).concat(ejected ? [ejected] : []).map(v => `${v.color}→${m.votes[v.id] === 'skip' ? '弃票' : (byId(G, m.votes[v.id]) || {}).color}`).join('，');
    const resultText = ejected
      ? `${ejected.color} 被放逐${m.result.revealed ? (ejected.role === 'impostor' ? '，是内鬼' : '，不是内鬼') : ''}`
      : `无人被放逐（${reason}）`;
    alive(G).forEach(p => obs(G, p, `投票结果：${voteText}。${resultText}`, { type: 'voteResult', meetingId: m.id }));
    event(G, { type: 'vote', meetingId: m.id, votes: Object.assign({}, m.votes), ejectedId: ejected ? ejected.id : null, text: `投票：${voteText}。${resultText}` });
    // 会议结束：冷却重置，大家从食堂重新出发
    G.phase = 'action'; G.lastMeetingEnd = G.t; G.meeting = null;
    alive(G).forEach(p => { if (p.role === 'impostor') p.killCooldown = G.cfg.killCooldownSec * 1000; p.intent = null; p.intentDone = true; });
    checkWin(G);
    return m.result;
  }

  /* ================================================================
   *  § 胜负
   * ================================================================ */
  function checkWin(G) {
    if (G.phase === 'ended') return G.winner;
    const imps = alive(G).filter(p => p.role === 'impostor').length;
    const crew = alive(G).filter(p => p.role === 'crew').length;
    let winner = null, reason = '';
    if (imps === 0) { winner = 'crew'; reason = '所有内鬼都被放逐'; }
    else if (G.taskDone >= G.taskTotal) { winner = 'crew'; reason = '船员完成了全部任务'; }
    else if (imps >= crew) { winner = 'impostor'; reason = '内鬼人数不少于船员'; }
    if (winner) {
      G.phase = 'ended'; G.winner = winner; G.winReason = reason; G.endedAt = G.t;
      event(G, { type: 'end', winner, text: `游戏结束：${winner === 'crew' ? '船员' : '内鬼'}获胜（${reason}）` });
    }
    return winner;
  }

  /* ================================================================
   *  § 脚本小人（无 API 演示 / 模型超时时的兜底）
   * ================================================================ */
  function botIntent(G, p) {
    const here = p.room || (p.moving && p.moving.to) || 'cafeteria';
    if (p.role === 'crew') {
      const known = Object.keys(p.seenBodies).filter(k => !k.startsWith('v')).map(id => G.bodies.find(b => b.id === +id)).filter(b => b && !b.reported);
      if (known.length) return { plan: 'report', room: known[0].room, note: '去报告尸体' };
      if (p.witnessed.length && canPressButton(G, p)) return { plan: 'button', note: '我看见凶手了，开会' };
      const room = nearestTaskRoom(G, p);
      if (room) return { plan: 'task', room, note: '去做任务' };
      return { plan: 'move', room: G.rng() < 0.5 ? 'cafeteria' : randomRoom(G, here), note: '闲逛' };
    }
    // 内鬼：冷却好了就找落单的人；否则装任务
    if (p.killCooldown <= 0) {
      const crew = alive(G).filter(x => x.role === 'crew');
      const loners = crew.filter(x => x.room && occupants(G, x.room).filter(y => y.role === 'crew').length === 1);
      const pick = (loners.length ? loners : crew).sort((a, b) => ((a.tasking ? 0 : 1) - (b.tasking ? 0 : 1)) || (DIST[here][a.room || here] - DIST[here][b.room || here]))[0];
      if (pick) return { plan: 'hunt', target: pick.id, kill: { target: pick.id, allowWitness: false }, seconds: 30, note: '盯着落单的人' };
    }
    const fakeRoom = p.tasks.filter(t => !t.done)[Math.floor(G.rng() * Math.max(1, p.tasks.filter(t => !t.done).length))];
    return { plan: 'fake', room: fakeRoom ? fakeRoom.room : randomRoom(G, here), note: '装作做任务' };
  }
  function botBodyDecision(G, p, body) {
    if (p.role === 'crew') return 'report';
    return G.rng() < 0.25 ? 'report' : 'leave';
  }
  function botVote(G, p) {
    const others = alive(G).filter(x => x.id !== p.id);
    if (p.role === 'crew') {
      const w = p.witnessed.find(w => byId(G, w.killer).alive);
      if (w) return w.killer;
      // 没证据：跟最近一次会议里被点名最多的人，否则弃票
      const m = G.meeting; const counts = {};
      if (m) m.speeches.forEach(s => (s.accuse || []).forEach(id => { if (id !== p.id) counts[id] = (counts[id] || 0) + 1; }));
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top && +top[1] >= 2 && byId(G, +top[0]).alive) return +top[0];
      return G.rng() < 0.35 ? others[Math.floor(G.rng() * others.length)].id : 'skip';
    }
    const crew = others.filter(x => x.role === 'crew');
    const accused = crew.filter(x => (G.meeting ? G.meeting.speeches.some(s => (s.accuse || []).includes(x.id)) : false));
    const pool = accused.length ? accused : crew;
    return pool.length ? pool[Math.floor(G.rng() * pool.length)].id : 'skip';
  }
  // 脚本小人的会议发言：把自己的轨迹和看到的东西用模板说出来，内鬼会撒一个谎
  function botSpeech(G, p) {
    const m = G.meeting; const since = m ? (G.meetings.length > 1 ? G.meetings[G.meetings.length - 2].t : 0) : 0;
    const visits = p.timeline.filter(e => e.type === 'enter' && e.t >= since).map(e => roomName(e.room));
    const rooms = [...new Set(visits)].slice(-4);
    const seen = p.timeline.filter(e => (e.type === 'enter' || e.type === 'seeEnter') && e.t >= since && (e.saw ? e.saw.length : e.who != null)).slice(-3)
      .map(e => e.type === 'enter' ? `在${roomName(e.room)}看到${listNames(e.saw.map(id => byId(G, id)))}` : `在${roomName(e.room)}看到 ${byId(G, e.who).color} 进来`);
    const accuse = [];
    let text;
    if (p.role === 'crew') {
      const w = p.witnessed.find(w => byId(G, w.killer).alive);
      if (w) { accuse.push(w.killer); text = `我亲眼看见 ${byId(G, w.killer).color} 在${roomName(w.t != null ? (p.timeline.find(e => e.type === 'witness' && e.killer === w.killer) || {}).room : null)}杀了 ${byId(G, w.victim).color}，投他。`; }
      else text = `我这段时间在${rooms.join('、') || '食堂'}做任务。${seen.join('；') || '没遇到什么人'}。${m && m.callerId === p.id && m.type === 'body' ? '尸体是我发现的，发现时房间里没有别人。' : ''}`;
    } else {
      const lieRoom = randomRoom(G, null);
      const scapegoat = alive(G).filter(x => x.role === 'crew' && x.id !== p.id)[0];
      if (scapegoat && G.rng() < 0.5) accuse.push(scapegoat.id);
      text = `我一直在${roomName(lieRoom)}和${rooms[0] || '食堂'}之间做任务。${scapegoat && accuse.length ? `我觉得 ${scapegoat.color} 走位很奇怪，他一直在躲人。` : '我没看到可疑的人。'}`;
    }
    return { text, accuse };
  }

  /* ================================================================
   *  § 给提示词用的描述
   * ================================================================ */
  function mapBrief() {
    return ROOMS.map(r => `${r.name}${r.button ? '（紧急按钮）' : ''} ↔ ` + ADJ[r.id].map(n => `${roomName(n)}(${Math.round(DIST[r.id][n] / DEFAULTS.speedPxPerSec)}秒)`).join('、')).join('\n');
  }
  function timelineText(G, p, opts) {
    opts = opts || {};
    const since = opts.since != null ? opts.since : 0;
    let items = p.timeline.filter(e => e.t >= since && (!opts.types || opts.types.includes(e.type)));
    if (opts.limit && items.length > opts.limit) items = items.slice(-opts.limit);
    return items.map(e => `[${fmtTime(e.t)}] ${e.text}`).join('\n') || '（暂无）';
  }
  function whereText(G, p) {
    if (p.moving) return `正在从${roomName(p.moving.from)}走向${roomName(p.moving.to)}`;
    const others = occupants(G, p.room).filter(x => x.id !== p.id);
    return `在${roomName(p.room)}，同房间：${listNames(others)}`;
  }
  function publicStatus(G) {
    const a = alive(G).map(p => p.color);
    const dead = G.players.filter(p => !p.alive).map(p => p.color + (p.ejected ? '（被放逐）' : '（死亡）'));
    return `存活：${a.join('、')}；已出局：${dead.join('、') || '无'}；任务进度 ${G.taskDone}/${G.taskTotal}；时间 ${fmtTime(G.t)}`;
  }
  // 把会议发言里的"口供"和真实轨迹对一遍：声称去过的房间、声称看见的人
  function verifyClaims(G, p, claims, since) {
    const out = [];
    const visited = new Set(p.timeline.filter(e => e.type === 'enter' && e.t >= since).map(e => e.room));
    if (p.room) visited.add(p.room);
    for (const r of (claims.rooms || [])) {
      const id = resolveRoomId(r);
      if (!id) continue;
      out.push({ kind: 'room', claim: roomName(id), ok: visited.has(id) });
    }
    const seen = new Set();
    p.timeline.filter(e => e.t >= since).forEach(e => {
      if (e.type === 'enter') (e.saw || []).forEach(id => seen.add(id + '@' + e.room));
      if (e.type === 'seeEnter' || e.type === 'visual') seen.add(e.who + '@' + e.room);
      if (e.type === 'leave') (e.left || []).forEach(id => seen.add(id + '@' + e.room));
    });
    for (const s of (claims.seen || [])) {
      const who = resolvePlayer(G, s.who || s.player || s.color);
      const room = resolveRoomId(s.room);
      if (!who) continue;
      const okAny = [...seen].some(k => k.startsWith(who.id + '@'));
      const ok = room ? seen.has(who.id + '@' + room) : okAny;
      out.push({ kind: 'seen', claim: `看见 ${who.color}${room ? ' 在' + roomName(room) : ''}`, ok });
    }
    return out;
  }
  function frame(G) {
    return {
      t: G.t, phase: G.phase, taskDone: G.taskDone,
      players: G.players.map(p => ({ id: p.id, x: Math.round(p.pos.x), y: Math.round(p.pos.y), alive: p.alive, room: p.room, tasking: !!p.tasking })),
      bodies: G.bodies.filter(b => !b.reported).map(b => ({ id: b.id, victim: b.victim, x: Math.round(b.pos.x), y: Math.round(b.pos.y) }))
    };
  }

  return Object.freeze({
    COLORS, ROOMS, EDGES, TASK_DEFS, ROOM, ADJ, DIST, DEFAULTS, PLANS,
    createGame, step, setIntent, startMeeting, addSpeech, resolveMeeting, checkWin,
    botIntent, botBodyDecision, botVote, botSpeech,
    pathBetween, occupants, alive, roomName, fmtTime, mapBrief, timelineText, whereText, publicStatus, verifyClaims, frame,
    resolveRoomId, resolvePlayer, canPressButton, slotPos
  });
});
