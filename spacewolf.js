// 🚀 太空狼人杀 · 界面与大脑（spacewolf.js）
// 模型是指挥官，引擎是身体：世界按真实时间连续跑（spacewolf-engine.js），模型只在需要时给一条"意图"，
// 引擎连续执行到完成或出事再问。两颗脑：行动脑（快模型、几十字 JSON、事件驱动节流）与会议脑（主力模型、发言投票）。
// 没有 API 也能看：纯脚本小人演示。独立于狼人杀主引擎，只复用多渠道请求层 AuxGameAPI。
const SpaceWolf = (() => {
  'use strict';
  const E = () => window.SpaceWolfEngine;
  const q = id => document.getElementById(id);
  const h = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kit = () => window.AuxGameAPI || null;
  const STORAGE = 'wg_spacewolf_v1';

  /* ================================================================
   *  § 配置
   * ================================================================ */
  const DEFAULT_CFG = {
    players: 8, impostors: 2, tasksPerCrew: 4, killCooldownSec: 25, confirmEjects: false, discussionRounds: 1,
    speed: 2, demo: false,
    actionMinIntervalSec: 10, actionMaxConcurrent: 3, actionTimeoutSec: 25, meetingTimeoutSec: 600,
    api: { default: null, action: null, actionSeparate: false }
  };
  let CFG = null;
  function loadCfg() {
    if (CFG) return CFG;
    let saved = null; try { saved = JSON.parse(localStorage.getItem(STORAGE) || 'null'); } catch (_) {}
    CFG = Object.assign({}, DEFAULT_CFG, saved || {});
    CFG.api = Object.assign({ default: null, action: null, actionSeparate: false }, (saved && saved.api) || {});
    return CFG;
  }
  function saveCfg() { try { localStorage.setItem(STORAGE, JSON.stringify(CFG)); } catch (_) {} }
  function readMainApi() {
    const type = q('g-apitype'), url = q('g-url'), key = q('g-key'), model = q('g-model');
    const k = kit();
    const provider = (type && type.value) || (k ? k.inferProvider(url && url.value) : 'custom');
    return { provider, url: String(url && url.value || '').trim(), key: String(key && key.value || '').trim(), model: String(model && model.value || '').trim() };
  }
  function apiFor(kind) {
    const c = loadCfg();
    let a = kind === 'action' && c.api.actionSeparate && c.api.action ? c.api.action : c.api.default;
    if (!a || !a.url) a = readMainApi();
    const k = kit();
    const meta = k ? k.provider(a.provider) : null;
    return { url: a.url, key: a.key, model: a.model, provider: a.provider, type: (meta && meta.type) || (a.provider === 'anthropic' || a.provider === 'gemini' ? a.provider : 'openai') };
  }

  /* ================================================================
   *  § 状态
   * ================================================================ */
  const V = {
    G: null, raf: 0, lastTs: 0, paused: false, runId: 0, tab: 'log', god: true,
    frames: [], lastFrameT: -1, replay: null, logIdx: 0, busy: 0, lastCall: {}, inflight: new Map(), waiting: {},
    meetingTask: null, ended: false, abort: null, stats: { calls: 0, fails: 0 }
  };
  const alive = () => E().alive(V.G);

  /* ================================================================
   *  § 视图骨架
   * ================================================================ */
  function ensureView() {
    if (q('sw-view')) return;
    const el = document.createElement('div');
    el.id = 'sw-view'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
<div class="sw-top">
  <button class="sw-btn ghost" id="sw-back">← 返回</button>
  <span class="sw-title">🚀 太空狼人杀</span>
  <span class="sw-chip" id="sw-chip-time">⏱ <b>00:00</b></span>
  <span class="sw-chip" id="sw-chip-phase"><b>设置</b></span>
  <div class="sw-taskbar" id="sw-taskbar" title="船员任务进度"><i></i><span>任务 0/0</span></div>
  <span class="sw-spacer"></span>
  <span class="sw-wait" id="sw-wait"></span>
  <div class="sw-speed" id="sw-speed"><button data-s="1">1×</button><button data-s="2" class="on">2×</button><button data-s="4">4×</button><button data-s="8">8×</button></div>
  <button class="sw-btn ghost" id="sw-pause">⏸ 暂停</button>
  <button class="sw-btn ghost on" id="sw-god" title="关掉后隐藏身份、击杀和模型的盘算，只看公开信息">👁 上帝视角</button>
  <button class="sw-btn ghost" id="sw-restart">重新设置</button>
</div>
<div class="sw-setup" id="sw-setup"></div>
<div class="sw-game" id="sw-game" style="display:none">
  <div class="sw-mapwrap">
    <svg class="sw-map" id="sw-map" viewBox="0 0 1160 660" preserveAspectRatio="xMidYMid meet"></svg>
    <div class="sw-overlay" id="sw-overlay"></div>
  </div>
  <div class="sw-side">
    <div class="sw-tabs" id="sw-tabs">
      <button data-tab="log" class="on">上帝日志</button><button data-tab="crew">船员</button><button data-tab="meeting">会议</button><button data-tab="end">终局</button>
    </div>
    <div class="sw-pane on" data-pane="log" id="sw-log"></div>
    <div class="sw-pane" data-pane="crew" id="sw-crew"></div>
    <div class="sw-pane" data-pane="meeting" id="sw-meeting"><div class="sw-muted">还没有开过会。</div></div>
    <div class="sw-pane" data-pane="end" id="sw-end"><div class="sw-muted">对局结束后这里显示结果、身份和统计。</div></div>
    <div class="sw-replay" id="sw-replay" style="display:none"><button class="sw-btn ghost" id="sw-replay-play">▶ 回放</button><input type="range" id="sw-replay-range" min="0" max="0" value="0"><span id="sw-replay-time">00:00</span><button class="sw-btn ghost" id="sw-export">导出 JSON</button></div>
  </div>
</div>`;
    document.body.appendChild(el);
    q('sw-back').onclick = close;
    q('sw-restart').onclick = () => { stopGame(); showSetup(); };
    q('sw-pause').onclick = () => { V.paused = !V.paused; q('sw-pause').textContent = V.paused ? '▶ 继续' : '⏸ 暂停'; q('sw-pause').classList.toggle('on', V.paused); };
    q('sw-god').onclick = () => { V.god = !V.god; q('sw-god').classList.toggle('on', V.god); V.logIdx = 0; q('sw-log').innerHTML = ''; renderLog(); renderCrew(); renderMapStatic(); };
    q('sw-speed').querySelectorAll('button').forEach(b => b.onclick = () => { loadCfg().speed = +b.dataset.s; saveCfg(); syncSpeedUI(); });
    q('sw-tabs').querySelectorAll('button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
    q('sw-replay-range').oninput = () => replaySeek(+q('sw-replay-range').value);
    q('sw-replay-play').onclick = replayToggle;
    q('sw-export').onclick = exportJson;
    window.WolfExitGuard && window.WolfExitGuard.register && window.WolfExitGuard.register('spacewolf', {
      label: '太空狼人杀', isActive: () => !!(q('sw-view') && q('sw-view').classList.contains('on') && V.G && V.G.phase !== 'ended'), onExit: stopGame
    });
  }
  function showTab(tab) {
    V.tab = tab;
    q('sw-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    q('sw-view').querySelectorAll('.sw-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === tab));
  }
  function syncSpeedUI() { const s = loadCfg().speed; q('sw-speed').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.s === s)); }
  function open() {
    ensureView();
    const mm = q('mm'); if (mm) mm.style.display = 'none';
    q('sw-view').classList.add('on'); q('sw-view').setAttribute('aria-hidden', 'false');
    syncSpeedUI();
    if (!V.G) showSetup();
  }
  function close() {
    stopGame();
    if (q('sw-view')) { q('sw-view').classList.remove('on'); q('sw-view').setAttribute('aria-hidden', 'true'); }
    const mm = q('mm'); if (mm) mm.style.display = '';
  }

  /* ================================================================
   *  § 设置页
   * ================================================================ */
  function showSetup() {
    const c = loadCfg();
    q('sw-game').style.display = 'none'; q('sw-setup').style.display = '';
    q('sw-chip-phase').innerHTML = '<b>设置</b>';
    const k = kit();
    const provs = k ? k.providers() : [];
    const main = readMainApi();
    const d = c.api.default || main; const a = c.api.action || Object.assign({}, main);
    const provOpts = sel => provs.map(p => `<option value="${h(p.id)}"${p.id === sel ? ' selected' : ''}>${h(p.name)}</option>`).join('');
    q('sw-setup').innerHTML = `
<div class="sw-shell">
  <div class="sw-panel">
    <h3>玩法</h3>
    <div class="sw-muted">经典飞船地图，所有人同时在船上连续活动。船员做任务，内鬼趁没人时下手；发现尸体或按食堂的紧急按钮就开会、发言、投票。模型不是逐帧操作：它给一条意图（去哪、做什么、盯谁），引擎连续执行，直到完成或出事再问它。</div>
    <div class="sw-grid">
      <label>人数 <input type="number" id="sw-c-players" min="5" max="12" value="${c.players}"></label>
      <label>内鬼数 <input type="number" id="sw-c-imps" min="1" max="3" value="${c.impostors}"></label>
      <label>每位船员任务数 <input type="number" id="sw-c-tasks" min="2" max="6" value="${c.tasksPerCrew}"></label>
      <label>击杀冷却（秒） <input type="number" id="sw-c-cd" min="10" max="60" value="${c.killCooldownSec}"></label>
      <label>会议发言轮数 <select id="sw-c-rounds"><option value="1"${c.discussionRounds === 1 ? ' selected' : ''}>1 轮</option><option value="2"${c.discussionRounds === 2 ? ' selected' : ''}>2 轮</option></select></label>
      <label class="row"><input type="checkbox" id="sw-c-confirm"${c.confirmEjects ? ' checked' : ''}> 放逐后公布是不是内鬼</label>
      <label class="row"><input type="checkbox" id="sw-c-demo"${c.demo ? ' checked' : ''}> 纯脚本小人演示（不用 API，先看看节奏）</label>
    </div>
  </div>
  <div class="sw-panel" id="sw-api-panel">
    <h3>两颗脑</h3>
    <div class="sw-muted">会议脑用主力模型发言投票；行动脑每隔十几秒要为每个人决定一次走位，必须用快模型（Flash / Haiku 这一档），否则一局要等几小时。留空则使用狼人杀的全局 API 设置。</div>
    <div class="sw-api-row">
      <label>会议脑渠道 <select id="sw-a-prov">${provOpts(d.provider)}</select></label>
      <label>地址 <input id="sw-a-url" value="${h(d.url || '')}" placeholder="OpenAI 兼容格式末尾带 /v1"></label>
      <label>密钥 <input id="sw-a-key" type="password" value="${h(d.key || '')}"></label>
      <label>模型 <input id="sw-a-model" value="${h(d.model || '')}"></label>
    </div>
    <div class="sw-api-actions">
      <button class="sw-btn ghost" id="sw-a-import">导入狼人杀全局 API</button>
      <button class="sw-btn ghost" id="sw-a-models">拉取模型列表</button>
      <button class="sw-btn ghost" id="sw-a-test">测试</button>
      <label class="sw-muted" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="sw-b-sep" style="width:auto;min-width:auto"${c.api.actionSeparate ? ' checked' : ''}> 行动脑单独配快模型</label>
    </div>
    <div id="sw-b-wrap" style="${c.api.actionSeparate ? '' : 'display:none'}">
      <div class="sw-api-row">
        <label>行动脑渠道 <select id="sw-b-prov">${provOpts(a.provider)}</select></label>
        <label>地址 <input id="sw-b-url" value="${h(a.url || '')}"></label>
        <label>密钥 <input id="sw-b-key" type="password" value="${h(a.key || '')}"></label>
        <label>模型 <input id="sw-b-model" value="${h(a.model || '')}" placeholder="例如 gemini-2.5-flash / claude-haiku-4-5"></label>
      </div>
      <div class="sw-api-actions"><button class="sw-btn ghost" id="sw-b-models">拉取模型列表</button><button class="sw-btn ghost" id="sw-b-test">测试</button></div>
    </div>
    <div class="sw-grid">
      <label>行动脑最短间隔（秒） <input type="number" id="sw-c-interval" min="4" max="60" value="${c.actionMinIntervalSec}"></label>
      <label>行动脑并发上限 <input type="number" id="sw-c-conc" min="1" max="8" value="${c.actionMaxConcurrent}"></label>
      <label>行动脑超时（秒） <input type="number" id="sw-c-atimeout" min="8" max="120" value="${c.actionTimeoutSec}"></label>
      <label>会议发言超时（秒） <input type="number" id="sw-c-mtimeout" min="30" max="1800" value="${c.meetingTimeoutSec}"></label>
    </div>
    <div class="sw-api-out" id="sw-api-out"></div>
  </div>
  <div class="sw-panel">
    <div class="sw-start-row">
      <button class="sw-btn primary" id="sw-start">▶ 开局</button>
      <span class="sw-muted">开局后右上角可以调倍速、暂停；「上帝视角」关掉就只看公开信息。</span>
    </div>
  </div>
</div>`;
    const readForm = () => {
      c.players = clamp(+q('sw-c-players').value, 5, 12); c.impostors = clamp(+q('sw-c-imps').value, 1, 3);
      c.tasksPerCrew = clamp(+q('sw-c-tasks').value, 2, 6); c.killCooldownSec = clamp(+q('sw-c-cd').value, 10, 60);
      c.discussionRounds = +q('sw-c-rounds').value; c.confirmEjects = q('sw-c-confirm').checked; c.demo = q('sw-c-demo').checked;
      c.actionMinIntervalSec = clamp(+q('sw-c-interval').value, 4, 60); c.actionMaxConcurrent = clamp(+q('sw-c-conc').value, 1, 8);
      c.actionTimeoutSec = clamp(+q('sw-c-atimeout').value, 8, 120); c.meetingTimeoutSec = clamp(+q('sw-c-mtimeout').value, 30, 1800);
      c.api.default = { provider: q('sw-a-prov').value, url: q('sw-a-url').value.trim(), key: q('sw-a-key').value.trim(), model: q('sw-a-model').value.trim() };
      c.api.actionSeparate = q('sw-b-sep').checked;
      c.api.action = { provider: q('sw-b-prov').value, url: q('sw-b-url').value.trim(), key: q('sw-b-key').value.trim(), model: q('sw-b-model').value.trim() };
      saveCfg();
    };
    q('sw-setup').querySelectorAll('input,select').forEach(el => el.addEventListener('change', readForm));
    q('sw-b-sep').addEventListener('change', () => { q('sw-b-wrap').style.display = q('sw-b-sep').checked ? '' : 'none'; });
    q('sw-a-import').onclick = () => { const m = readMainApi(); q('sw-a-prov').value = m.provider; q('sw-a-url').value = m.url; q('sw-a-key').value = m.key; q('sw-a-model').value = m.model; readForm(); out('已导入狼人杀全局 API 设置。'); };
    const out = t => { q('sw-api-out').textContent = t; };
    const fetchModels = async (prefix) => {
      readForm(); const api = formApi(prefix); if (!kit()) return out('多渠道请求层未加载');
      out('正在拉取模型列表…');
      try { const models = await kit().listModels(api, AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined); const picked = await kit().chooseModel(models, '选择模型'); if (picked) { q(prefix + '-model').value = picked; readForm(); } out(`已拉取 ${models.length} 个模型${picked ? '，已选择 ' + picked : ''}。`); }
      catch (e) { out('拉取失败：' + (e && e.message || e)); }
    };
    const testApi = async (prefix) => {
      readForm(); const api = formApi(prefix); if (!kit()) return out('多渠道请求层未加载');
      out('测试中…'); const t0 = Date.now();
      try { const raw = await kit().request(api, '你是测试。', '只回复 OK。', AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined, 64); out(`✅ ${api.model} 回复（${Math.round((Date.now() - t0) / 1000)} 秒）：${String(raw).slice(0, 60)}`); }
      catch (e) { out('❌ ' + (e && e.message || e)); }
    };
    const formApi = prefix => { const p = q(prefix + '-prov').value; const meta = kit() ? kit().provider(p) : null; return { provider: p, type: (meta && meta.type) || 'openai', url: q(prefix + '-url').value.trim(), key: q(prefix + '-key').value.trim(), model: q(prefix + '-model').value.trim() }; };
    q('sw-a-models').onclick = () => fetchModels('sw-a'); q('sw-b-models').onclick = () => fetchModels('sw-b');
    q('sw-a-test').onclick = () => testApi('sw-a'); q('sw-b-test').onclick = () => testApi('sw-b');
    q('sw-start').onclick = () => { readForm(); startGame(); };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, isFinite(v) ? v : lo));

  /* ================================================================
   *  § 开局 / 主循环
   * ================================================================ */
  function startGame() {
    const c = loadCfg();
    if (!c.demo) {
      const api = apiFor('meeting');
      if (!api.url || !api.model || (!api.key && kit() && kit().needsKey(api))) { alert('请先填好会议脑的 API（或勾选"纯脚本小人演示"）'); return; }
    }
    stopGame();
    V.runId++; V.frames = []; V.lastFrameT = -1; V.logIdx = 0; V.ended = false; V.paused = false; V.replay = null; V.inflight.clear(); V.lastCall = {}; V.waiting = {}; V.busy = 0; V.stats = { calls: 0, fails: 0 };
    V.abort = new AbortController();
    const G = E().createGame({ players: c.players, impostors: c.impostors, tasksPerCrew: c.tasksPerCrew, killCooldownSec: c.killCooldownSec, confirmEjects: c.confirmEjects, discussionRounds: c.discussionRounds });
    G.players.forEach(p => { p.brain = c.demo ? 'bot' : 'api'; });
    V.G = G;
    q('sw-setup').style.display = 'none'; q('sw-game').style.display = '';
    q('sw-log').innerHTML = ''; q('sw-meeting').innerHTML = '<div class="sw-muted">还没有开过会。</div>'; q('sw-end').innerHTML = '<div class="sw-muted">对局进行中。</div>';
    q('sw-replay').style.display = 'none'; q('sw-pause').textContent = '⏸ 暂停'; q('sw-pause').classList.remove('on');
    buildMap(); renderMapStatic(); renderCrew(); renderLog(); showTab('log');
    V.lastTs = performance.now();
    V.raf = requestAnimationFrame(loop);
  }
  function stopGame() {
    if (V.raf) cancelAnimationFrame(V.raf); V.raf = 0;
    if (V.abort) { try { V.abort.abort(); } catch (_) {} }
    V.abort = null; V.meetingTask = null; V.inflight.clear(); V.busy = 0;
    if (V.replay) { clearInterval(V.replay.timer); V.replay = null; }
  }
  function loop(ts) {
    const G = V.G; if (!G) return;
    const runId = V.runId;
    const real = Math.min(100, ts - V.lastTs); V.lastTs = ts;
    const speed = loadCfg().speed;
    if (!V.paused && G.phase === 'action') {
      const dt = real * speed;
      // 引擎单步最多 250ms；倍速高时拆成几小步，走位才不会穿墙式跳跃
      let left = dt; while (left > 0 && G.phase === 'action') { const s = Math.min(250, left); E().step(G, s); left -= s; }
      drainPending();
      scheduleBrains();
      if (G.t - V.lastFrameT >= 250) { V.frames.push(E().frame(G)); V.lastFrameT = G.t; }
    }
    if (G.phase === 'meeting' && !V.meetingTask) {
      V.meetingTask = runMeeting(G.meeting).catch(e => console.error('[太空狼人杀] 会议流程异常', e)).finally(() => { if (V.runId === runId) V.meetingTask = null; });
    }
    if (G.phase === 'ended' && !V.ended) { V.ended = true; onGameEnd(); }
    renderFrame(); renderLog(); renderTop();
    if (ts - (V.lastCrewTs || 0) > 1000 || V._crewDirty) { renderCrew(); V._crewDirty = false; V.lastCrewTs = ts; }
    V.raf = requestAnimationFrame(loop);
  }

  /* ================================================================
   *  § 行动脑：事件驱动 + 节流
   * ================================================================ */
  function drainPending() {
    const G = V.G;
    while (G.pending.length) {
      const ev = G.pending.shift();
      const p = G.players[ev.playerId];
      if (!p || !p.alive || p.brain !== 'api') continue;
      if (ev.type === 'body') {
        const body = G.bodies.find(b => b.id === ev.bodyId);
        if (!body || body.reported) continue;
        if (p.role === 'crew') { E().setIntent(G, p, { plan: 'report', note: '发现尸体，报告' }, 'auto'); logBrain(p, '发现尸体，立刻报告'); }
        else if (!V.inflight.has(p.id)) requestIntent(p, `你刚在${E().roomName(ev.room)}看到了 ${G.players[body.victim].color} 的尸体。要不要由你来报告（自首式报告能洗嫌疑，也可能引火烧身），还是离开？`, { urgent: true, bodyId: ev.bodyId });
      } else if (ev.type === 'decide') {
        V.waiting[p.id] = { reason: ev.reason, since: G.t };
      }
    }
  }
  function scheduleBrains() {
    const G = V.G, c = loadCfg();
    if (G.phase !== 'action') return;
    for (const p of alive()) {
      if (p.brain !== 'api' || V.inflight.has(p.id)) continue;
      const idle = !p.intent || p.intentDone;
      const stale = p.intent && !p.intentDone && G.t - p.intentSetAt > 45000 && p.intent.source === 'brain';
      if (!idle && !stale) continue;
      const since = V.lastCall[p.id] == null ? Infinity : G.t - V.lastCall[p.id];
      // 脑子还没到最短间隔，但人不能一直傻站：先用脚本策略垫一步
      if (idle && since < c.actionMinIntervalSec * 1000) { if (!p.intent || (p.intentDone && G.t - p.intentSetAt > 4000)) E().setIntent(G, p, E().botIntent(G, p), 'fallback'); continue; }
      if (V.busy >= c.actionMaxConcurrent) { if (idle && (!p.intent || p.intentDone) && G.t - (p.intentSetAt || 0) > 4000) E().setIntent(G, p, E().botIntent(G, p), 'fallback'); continue; }
      const w = V.waiting[p.id];
      requestIntent(p, w ? `上一条意图结束：${w.reason}` : (stale ? '上一条意图执行了 45 秒以上，确认或更换' : '开局，决定第一步'), {});
      delete V.waiting[p.id];
    }
  }
  async function requestIntent(p, reason, opt) {
    const G = V.G, c = loadCfg(), runId = V.runId, t0 = Date.now(), askedAt = G.t;
    V.inflight.set(p.id, { reason, since: G.t }); V.lastCall[p.id] = G.t; V.busy++; V._crewDirty = true;
    const api = apiFor('action');
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort(); V.abort && V.abort.signal.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ctrl.abort(), c.actionTimeoutSec * 1000);
    let intent = null, raw = '', err = null;
    try {
      V.stats.calls++;
      raw = await kit().request(api, actionSystem(p), actionUser(p, reason), ctrl.signal, 600);
      intent = parseJson(raw);
    } catch (e) { err = e; }
    clearTimeout(timer); V.abort && V.abort.signal.removeEventListener('abort', onAbort);
    V.busy = Math.max(0, V.busy - 1); V.inflight.delete(p.id); V._crewDirty = true;
    if (V.runId !== runId || !V.G || V.G !== G || !p.alive || G.phase !== 'action') return;
    if (!intent) {
      V.stats.fails++;
      const why = err ? (err.name === 'AbortError' ? `超时（${c.actionTimeoutSec} 秒）` : (err.message || String(err))) : '没有解析出 JSON';
      logBrain(p, `行动脑没有给出有效意图（${why}），先按脚本策略行动`, 'warn');
      if (!p.intent || p.intentDone || G.t - askedAt > 2000) E().setIntent(G, p, E().botIntent(G, p), 'fallback');
      return;
    }
    const it = E().setIntent(G, p, intent, 'brain');
    p.lastNote = it.note || '';
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    logBrain(p, `${describeIntent(G, it)}${it.note ? '：' + it.note : ''}（${secs}s）`);
    V._crewDirty = true;
  }
  function describeIntent(G, it) {
    const r = it.room ? E().roomName(it.room) : '';
    const t = it.target != null ? G.players[it.target].color : '';
    return ({ task: `去${r}做任务`, fake: `去${r}装任务`, move: `去${r}`, follow: `跟着 ${t}`, hunt: `盯住 ${t}${it.kill && it.kill.allowWitness ? '（有人看着也动手）' : ''}`, avoid: `躲开 ${t}`, report: `去${r}报告尸体`, button: '去按紧急按钮', wait: `原地等 ${it.seconds} 秒` })[it.plan] || it.plan;
  }
  function parseJson(raw) {
    const s = String(raw || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
    const m = s.match(/\{[\s\S]*\}/g);
    if (!m) return null;
    for (let i = m.length - 1; i >= 0; i--) {
      try { const o = JSON.parse(m[i].replace(/[“”]/g, '"')); if (o && typeof o === 'object' && o.plan) return o; } catch (_) {}
      // 常见小错误：尾逗号
      try { const o = JSON.parse(m[i].replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); if (o && o.plan) return o; } catch (_) {}
    }
    return null;
  }
  function actionSystem(p) {
    const G = V.G;
    const mates = G.players.filter(x => x.role === 'impostor' && x.id !== p.id).map(x => x.color);
    const imp = p.role === 'impostor';
    return `你在玩太空狼人杀（Among Us）的文字实时版。你是${p.color}，身份：${imp ? '内鬼' : '船员'}。${imp ? (mates.length ? '同伙：' + mates.join('、') + '。' : '你是唯一的内鬼。') : ''}
${imp ? '内鬼目标：趁没人看见时击杀船员，直到内鬼人数不少于船员；在会议上别被投出去。' : '船员目标：做完全部任务，或者在会议上把内鬼全部投出去；别落单。'}
地图（房间 ↔ 相邻房间(步行秒数)）：
${E().mapBrief()}
规则要点：
- 你只能看见同一房间里的人；走廊里看不见也不被看见。会议时才有发言，平时不能说话。
- 内鬼击杀需要和目标在同一房间且冷却完毕；房间里有第三个人时动手会被目击。
- 任何人进入有尸体的房间都可能报告；报告或在食堂按紧急按钮会立刻召开会议，所有人回食堂。
- 视觉任务（医疗扫描、清理小行星、启动护盾）只有船员能做，被人看见等于洗白。
- 内鬼做不了任务，只能站在任务房间装样子。
你不是逐帧操作，而是给一条"意图"，引擎会连续执行它直到完成或发生新情况再问你。
可用意图：
- task：去某个房间做你的任务（room 可省略，默认最近的）
- move：去某个房间
- follow：跟着某个人（target），持续 seconds 秒
- avoid：躲开某个人（target），持续 seconds 秒
- report：去报告你知道的尸体
- button：去食堂按紧急按钮（剩余次数有限）
- wait：原地等 seconds 秒${imp ? `
- fake：去某个房间假装做任务
- hunt：盯住 target，和他独处且冷却完毕就击杀；kill.allowWitness 为 true 表示有人看着也动手（几乎必败，极少这么做）` : ''}
只回复一个 JSON，不要解释、不要写思考：
{"plan":"意图名","room":"房间名","target":"颜色","kill":{"target":"颜色","allowWitness":false},"seconds":30,"note":"一句话说明你的打算"}`;
  }
  function actionUser(p, reason) {
    const G = V.G, c = loadCfg();
    const pend = p.tasks.filter(t => !t.done);
    const bodies = G.bodies.filter(b => !b.reported && p.seenBodies[b.id]).map(b => `${G.players[b.victim].color} 在${E().roomName(b.room)}`);
    const last = p.intent ? `${describeIntent(G, p.intent)}${p.intent.note ? '（' + p.intent.note + '）' : ''}${p.intent.source !== 'brain' ? '［引擎代为决定］' : ''}` : '（无）';
    return `【时间】${E().fmtTime(G.t)}　【任务进度】${G.taskDone}/${G.taskTotal}　【存活】${alive().map(x => x.color).join('、')}
【你现在】${E().whereText(G, p)}
【你的${p.role === 'impostor' ? '假任务清单（装样子用）' : '未完成任务'}】${pend.length ? pend.map(t => E().roomName(t.room) + '·' + t.name + (t.visual ? '（视觉）' : '')).join('、') : '（已全部完成）'}
${p.role === 'impostor' ? `【击杀冷却】${p.killCooldown > 0 ? '还有 ' + Math.ceil(p.killCooldown / 1000) + ' 秒' : '已就绪'}` : ''}
【紧急按钮】剩 ${p.buttonsLeft} 次${E().canPressButton(G, p) ? '' : '（现在不能按）'}
【你知道的未报告尸体】${bodies.join('；') || '无'}
【最近你看到的】
${E().timelineText(G, p, { since: Math.max(0, G.t - 90000), limit: 14 })}
【上一条意图】${last}
【为什么现在问你】${reason}
给出下一条意图（只回 JSON）。`;
  }
  function logBrain(p, text, level) {
    const G = V.G;
    G.events.push({ id: G.nextEventId++, t: G.t, type: 'brain', playerId: p.id, level: level || 'info', text: `🧠 ${p.color}：${text}` });
  }

  /* ================================================================
   *  § 会议
   * ================================================================ */
  async function runMeeting(m) {
    const G = V.G, c = loadCfg(), runId = V.runId;
    const alivePs = alive();
    const order = [];
    const callerIdx = alivePs.findIndex(x => x.id === m.callerId);
    for (let i = 0; i < alivePs.length; i++) order.push(alivePs[(callerIdx + i) % alivePs.length]);
    showTab('meeting'); renderMeeting(m, { phase: 'speech' });
    const sinceT = G.meetings.length > 1 ? G.meetings[G.meetings.length - 2].t : 0;
    for (let round = 1; round <= c.discussionRounds; round++) {
      for (const p of order) {
        if (V.runId !== runId || !p.alive) continue;
        setWait(`${p.color} 正在想怎么说…`);
        renderMeeting(m, { phase: 'speech', speaking: p.id });
        let sp;
        if (p.brain === 'bot') { const s = E().botSpeech(G, p); sp = { text: s.text, accuse: s.accuse, claims: null, thinking: '' }; }
        else sp = await meetingSpeech(p, m, round, sinceT);
        if (V.runId !== runId) return;
        const entry = E().addSpeech(G, p, sp.text, { round, accuse: sp.accuse || [], thinking: sp.thinking || '', claims: sp.claims || null });
        if (sp.claims) {
          const v = E().verifyClaims(G, p, sp.claims, sinceT);
          entry.verify = v;
          const bad = v.filter(x => !x.ok);
          if (v.length) G.events.push({ id: G.nextEventId++, t: G.t, type: 'verify', playerId: p.id, text: `🔍 口供核验 ${p.color}：${v.map(x => (x.ok ? '✓ ' : '✗ ') + x.claim).join('，')}${bad.length ? `（${bad.length} 处与事实不符）` : ''}` });
        }
        renderMeeting(m, { phase: 'speech' });
      }
    }
    setWait('大家正在投票…');
    renderMeeting(m, { phase: 'vote' });
    const votes = {};
    const voters = alive();
    const results = await Promise.allSettled(voters.map(async p => {
      if (p.brain === 'bot') { votes[p.id] = E().botVote(G, p); return; }
      votes[p.id] = await meetingVote(p, m);
    }));
    if (V.runId !== runId) return;
    results.forEach((r, i) => { if (r.status === 'rejected') votes[voters[i].id] = 'skip'; });
    const res = E().resolveMeeting(G, votes);
    setWait('');
    renderMeeting(m, { phase: 'done' });
    renderCrew(); renderMapStatic();
    if (G.phase === 'action') await sleep(2500 / Math.max(1, loadCfg().speed / 2));
  }
  function meetingSystem(p) {
    const G = V.G;
    const mates = G.players.filter(x => x.role === 'impostor' && x.id !== p.id).map(x => x.color);
    const imp = p.role === 'impostor';
    return `你在玩太空狼人杀（Among Us）。你是${p.color}，身份：${imp ? '内鬼' : '船员'}。${imp ? (mates.length ? '同伙：' + mates.join('、') + '。' : '你是唯一的内鬼。') : ''}
现在是紧急会议。所有活人轮流发言，然后投票；得票最多且超过弃票数的人被放逐${G.cfg.confirmEjects ? '，并公布是不是内鬼' : '，不公布身份'}。
${imp ? '你可以编造自己的路线和见闻，但要和别人可能看到的事实对得上：有人和你同过房间就知道你当时在哪。被当场目击击杀基本没救，只能转移话题。' : '你只有自己的所见所闻。说清你这段时间走过哪里、看到了谁、谁和你同过房间；用别人口供里对不上的地方抓内鬼。视觉任务被人看见等于洗白。'}
发言像真人说话，80 到 200 字。先在 <thinking> 里盘算，然后：
<say>当众说的话</say>
<claims>{"rooms":["你当众声称去过的房间名"],"seen":[{"who":"颜色","room":"房间名"}]}</claims>
claims 必须如实对应你 say 里公开声称的内容（内鬼撒的谎也写进去），引擎只用它做记录。`;
  }
  function meetingUser(p, m, round, sinceT) {
    const G = V.G;
    const caller = G.players[m.callerId];
    const cause = m.type === 'body' ? `${caller.color} 在${E().roomName(m.room)}报告了 ${G.players[m.victimId].color} 的尸体` : `${caller.color} 按下了紧急按钮`;
    const prev = G.meetings.filter(x => x.id !== m.id && x.result).map(x => `第 ${x.id} 次会议：${x.result.ejectedId != null ? G.players[x.result.ejectedId].color + ' 被放逐' + (x.result.revealed ? (x.result.ejectedRole === 'impostor' ? '（是内鬼）' : '（不是内鬼）') : '') : '无人被放逐'}`).join('\n');
    const said = m.speeches.map(s => `${s.color}：${s.text}`).join('\n');
    return `【会议原因】${cause}
【公开状态】${E().publicStatus(G)}
【本次会议前已死亡的人】${m.deadRevealed.map(id => G.players[id].color).join('、') || '无'}
${prev ? '【之前的会议】\n' + prev + '\n' : ''}【你自上次会议以来的私密时间线（只有你知道）】
${E().timelineText(G, p, { since: sinceT })}
【本次会议到目前为止的发言】
${said || '（你是第一个发言的）'}
现在轮到你（第 ${round} 轮）发言。`;
  }
  async function meetingSpeech(p, m, round, sinceT) {
    const G = V.G, c = loadCfg(), runId = V.runId;
    while (true) {
      const t0 = Date.now();
      try {
        const raw = await askWithWait(apiFor('meeting'), meetingSystem(p), meetingUser(p, m, round, sinceT), c.meetingTimeoutSec * 1000, 4096, p, '发言');
        const say = tagOf(raw, 'say') || stripTags(raw);
        if (!say.trim()) throw new Error('没有解析出发言');
        let claims = null;
        const cm = tagOf(raw, 'claims');
        if (cm) { try { claims = JSON.parse(cm.replace(/[“”]/g, '"')); } catch (_) { claims = null; } }
        const accuse = alive().filter(x => x.id !== p.id && say.includes(x.color) && /怀疑|投|可疑|不对劲|有问题|撒谎|说谎|杀/.test(say)).map(x => x.id);
        G.events.push({ id: G.nextEventId++, t: G.t, type: 'brain', playerId: p.id, text: `🧠 ${p.color} 会议发言用时 ${((Date.now() - t0) / 1000).toFixed(1)}s` });
        return { text: say.trim(), claims, accuse, thinking: tagOf(raw, 'thinking') };
      } catch (e) {
        if (V.runId !== runId) return { text: '', accuse: [] };
        const choice = await swAsk(`${p.color} 的会议发言没有生成`, `原因：${e && e.name === 'AbortError' ? '超时或被停止' : (e && e.message || e)}\n当前模型：${apiFor('meeting').model}\n\n流程已暂停，不会自动跳过。`, [
          { label: '重试', value: 'retry' }, { label: '用脚本模板代替这次发言', value: 'bot' }, { label: '确认跳过这次发言', value: 'skip', danger: true }
        ]);
        if (choice === 'bot') { const s = E().botSpeech(G, p); return { text: s.text, accuse: s.accuse, claims: null, thinking: '' }; }
        if (choice === 'skip') return { text: '（沉默）', accuse: [], claims: null, thinking: '' };
      }
    }
  }
  async function meetingVote(p, m) {
    const G = V.G, c = loadCfg(), runId = V.runId;
    const said = m.speeches.map(s => `${s.color}：${s.text}`).join('\n');
    const user = `【会议原因与公开状态】${E().publicStatus(G)}
【本次会议全部发言】
${said}
【你的私密时间线（自上次会议以来）】
${E().timelineText(G, p, { since: G.meetings.length > 1 ? G.meetings[G.meetings.length - 2].t : 0, limit: 30 })}
现在投票。可投的人：${alive().filter(x => x.id !== p.id).map(x => x.color).join('、')}，或弃票。
先 <thinking> 简短盘算，然后只输出 <vote>颜色</vote> 或 <vote>skip</vote>。`;
    while (true) {
      try {
        const raw = await askWithWait(apiFor('meeting'), meetingSystem(p), user, c.meetingTimeoutSec * 1000, 1024, p, '投票');
        const v = tagOf(raw, 'vote') || stripTags(raw).slice(-30);
        if (/skip|弃票|弃权|不投/i.test(v)) return 'skip';
        const t = E().resolvePlayer(G, v);
        if (t && t.alive && t.id !== p.id) return t.id;
        throw new Error('没有解析出投票对象：' + v.slice(0, 40));
      } catch (e) {
        if (V.runId !== runId) return 'skip';
        const choice = await swAsk(`${p.color} 的投票没有生成`, `原因：${e && e.name === 'AbortError' ? '超时或被停止' : (e && e.message || e)}\n\n流程已暂停，不会自动按弃票处理。`, [
          { label: '重试', value: 'retry' }, { label: '用脚本策略代投', value: 'bot' }, { label: '确认按弃票处理', value: 'skip', danger: true }
        ]);
        if (choice === 'bot') return E().botVote(G, p);
        if (choice === 'skip') return 'skip';
      }
    }
  }
  // 会议请求：顶栏显示谁在想、想了多久；超时按会议发言超时
  async function askWithWait(api, sys, user, timeoutMs, maxTokens, p, what) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort(); V.abort && V.abort.signal.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = Date.now();
    const tick = setInterval(() => setWait(`${p.color} 正在想${what}… ${Math.round((Date.now() - t0) / 1000)}s`), 1000);
    try { V.stats.calls++; return await kit().request(api, sys, user, ctrl.signal, maxTokens); }
    finally { clearTimeout(timer); clearInterval(tick); V.abort && V.abort.signal.removeEventListener('abort', onAbort); }
  }
  const tagOf = (raw, tag) => { const m = String(raw || '').match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i')); return m ? m[1].trim() : ''; };
  const stripTags = raw => String(raw || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/<claims>[\s\S]*?<\/claims>/gi, '').replace(/<\/?[a-z]+>/gi, '').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function setWait(t) { const el = q('sw-wait'); if (el) el.textContent = t || ''; }
  function swAsk(title, text, buttons) {
    return new Promise(resolve => {
      const ov = q('sw-overlay');
      ov.innerHTML = `<div class="sw-dialog"><h3>${h(title)}</h3><p>${h(text)}</p><div class="btns">${buttons.map((b, i) => `<button data-i="${i}"${b.danger ? ' class="danger"' : ''}>${h(b.label)}</button>`).join('')}</div></div>`;
      ov.classList.add('on');
      ov.querySelectorAll('button').forEach(b => b.onclick = () => { ov.classList.remove('on'); ov.innerHTML = ''; resolve(buttons[+b.dataset.i].value); });
    });
  }

  /* ================================================================
   *  § 地图渲染
   * ================================================================ */
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); if (parent) parent.appendChild(el); return el; };
  function buildMap() {
    const svg = q('sw-map'); svg.innerHTML = '';
    const Eng = E();
    const gCorr = mk('g', { id: 'sw-g-corr' }, svg), gRooms = mk('g', { id: 'sw-g-rooms' }, svg), gBodies = mk('g', { id: 'sw-g-bodies' }, svg), gAv = mk('g', { id: 'sw-g-av' }, svg);
    Eng.EDGES.forEach(([a, b]) => { const A = Eng.ROOM[a], B = Eng.ROOM[b]; mk('line', { x1: A.cx, y1: A.cy, x2: B.cx, y2: B.cy, class: 'sw-corridor' }, gCorr); mk('line', { x1: A.cx, y1: A.cy, x2: B.cx, y2: B.cy, class: 'sw-corridor-inner' }, gCorr); });
    Eng.ROOMS.forEach(r => {
      mk('rect', { x: r.cx - r.w / 2, y: r.cy - r.h / 2, width: r.w, height: r.h, rx: 14, class: 'sw-room' + (r.button ? ' button' : '') }, gRooms);
      mk('text', { x: r.cx - r.w / 2 + 10, y: r.cy - r.h / 2 + 20, class: 'sw-room-label' }, gRooms).textContent = r.name + (r.button ? ' ⏺' : '');
    });
    V.G.players.forEach(p => {
      const g = mk('g', { class: 'sw-av', 'data-id': p.id }, gAv);
      mk('rect', { x: -11, y: -16, width: 22, height: 30, rx: 10, fill: p.hex, stroke: '#000', 'stroke-width': 1.5 }, g);
      mk('rect', { x: -16, y: -8, width: 7, height: 16, rx: 3, fill: p.hex, stroke: '#000', 'stroke-width': 1.2, opacity: .85 }, g);
      mk('ellipse', { cx: 4, cy: -8, rx: 9, ry: 5.5, fill: '#bfe7ff', stroke: '#2a4a7a', 'stroke-width': 1 }, g);
      mk('circle', { r: 17, cx: 0, cy: -1, class: 'sw-task-ring', 'stroke-dasharray': '0 200' }, g);
      mk('text', { x: 0, y: 28 }, g).textContent = p.color;
      mk('text', { x: 0, y: -22, class: 'sw-av-tag', 'text-anchor': 'middle' }, g).textContent = '内鬼';
    });
  }
  function renderMapStatic() {
    if (!V.G) return;
    q('sw-map').querySelectorAll('.sw-av').forEach(g => { const p = V.G.players[+g.dataset.id]; g.classList.toggle('imp-mark', V.god && p.role === 'impostor'); });
  }
  function renderFrame(fr) {
    const G = V.G; if (!G) return;
    const f = fr || null;
    const svg = q('sw-map');
    const gB = svg.querySelector('#sw-g-bodies');
    svg.querySelectorAll('.sw-av').forEach(g => {
      const p = G.players[+g.dataset.id];
      const src = f ? f.players[p.id] : null;
      const x = src ? src.x : p.pos.x, y = src ? src.y : p.pos.y, isAlive = src ? src.alive : p.alive;
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      g.classList.toggle('dead', !isAlive);
      const ring = g.querySelector('.sw-task-ring');
      if (!f && p.tasking) { const t = p.tasks.find(x => x.id === p.tasking.id); const frac = t ? Math.min(1, t.progress / t.sec) : 0; ring.setAttribute('stroke-dasharray', `${(frac * 106.8).toFixed(1)} 200`); }
      else ring.setAttribute('stroke-dasharray', '0 200');
    });
    const bodies = f ? f.bodies : G.bodies.filter(b => !b.reported);
    const want = new Set(bodies.map(b => 'b' + b.id));
    gB.querySelectorAll('g').forEach(g => { if (!want.has(g.dataset.key)) g.remove(); });
    bodies.forEach(b => {
      let g = gB.querySelector(`g[data-key="b${b.id}"]`);
      const victim = G.players[b.victim];
      if (!g) {
        g = mk('g', { class: 'sw-body', 'data-key': 'b' + b.id }, gB);
        mk('rect', { x: -14, y: -6, width: 24, height: 12, rx: 6, fill: victim.hex, stroke: '#000', 'stroke-width': 1.2, transform: 'rotate(-20)' }, g);
        mk('path', { d: 'M 6 -2 l 8 -6 M 8 -8 a 3 3 0 1 1 4 2', stroke: '#eee', 'stroke-width': 2, fill: 'none' }, g);
        mk('text', { x: 0, y: 20, 'text-anchor': 'middle', fill: '#ff9a9a', 'font-size': 11, 'paint-order': 'stroke', stroke: '#000', 'stroke-width': 3 }, g).textContent = victim.color + ' 的尸体';
      }
      g.setAttribute('transform', `translate(${b.x != null ? b.x : b.pos.x} ${b.y != null ? b.y : b.pos.y})`);
    });
  }
  function renderTop() {
    const G = V.G; if (!G) return;
    q('sw-chip-time').innerHTML = `⏱ <b>${E().fmtTime(G.t)}</b>`;
    const ph = { action: '行动中', meeting: '会议中', ended: '已结束' }[G.phase] || G.phase;
    q('sw-chip-phase').innerHTML = `<b>${ph}</b>${V.inflight.size ? ` · 🧠${V.inflight.size}` : ''}`;
    const bar = q('sw-taskbar'); bar.querySelector('i').style.width = (G.taskTotal ? G.taskDone / G.taskTotal * 100 : 0) + '%'; bar.querySelector('span').textContent = `任务 ${G.taskDone}/${G.taskTotal}`;
    if (G.phase === 'action' && !V.inflight.size) setWait('');
  }

  /* ================================================================
   *  § 日志、船员卡、会议面板
   * ================================================================ */
  const PUBLIC_TYPES = new Set(['start', 'meeting', 'vote', 'end', 'task']);
  function renderLog() {
    const G = V.G; if (!G) return;
    const box = q('sw-log');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    for (; V.logIdx < G.events.length; V.logIdx++) {
      const e = G.events[V.logIdx];
      if (!V.god && !PUBLIC_TYPES.has(e.type)) continue;
      if (!V.god && e.type === 'task' && e.ghost) continue;
      const d = document.createElement('div');
      d.className = 'sw-log-line ' + e.type + (e.level === 'warn' ? ' warn' : '');
      d.innerHTML = `<time>${E().fmtTime(e.t)}</time>${h(e.text)}`;
      box.appendChild(d);
    }
    if (box.children.length > 600) { while (box.children.length > 500) box.removeChild(box.firstChild); }
    if (atBottom) box.scrollTop = box.scrollHeight;
  }
  function renderCrew() {
    const G = V.G; if (!G) return;
    q('sw-crew').innerHTML = `<div class="sw-cards">` + G.players.map(p => {
      const inflight = V.inflight.get(p.id);
      const where = p.alive ? (p.moving ? `→ ${E().roomName(p.moving.to)}` : E().roomName(p.room)) : (p.ejected ? '已放逐' : '已死亡');
      const tasks = p.role === 'crew' ? `任务 ${p.tasks.filter(t => t.done).length}/${p.tasks.length}` : (V.god ? `击杀 ${p.stats.kills}` : '');
      return `<div class="sw-card${p.alive ? '' : ' dead'}"><div><span class="sw-sw" style="background:${p.hex}"></span><b>${h(p.color)}</b> ${V.god ? `<span class="role ${p.role}">${p.role === 'impostor' ? '内鬼' : '船员'}</span>` : ''}</div>
        <div>${h(where)} · ${h(tasks)}</div>
        ${V.god && p.alive && p.intent ? `<div class="sw-note">${h(describeIntent(G, p.intent))}${p.intent.note ? '：' + h(p.intent.note) : ''}${p.intent.source !== 'brain' ? '（脚本垫步）' : ''}</div>` : ''}
        ${inflight ? `<div class="sw-think">🧠 思考中 ${Math.round((G.t - inflight.since) / 1000)}s</div>` : ''}</div>`;
    }).join('') + '</div>';
  }
  function renderMeeting(m, st) {
    const G = V.G, box = q('sw-meeting');
    const caller = G.players[m.callerId];
    const cause = m.type === 'body' ? `${caller.color} 在${E().roomName(m.room)}报告了 ${G.players[m.victimId].color} 的尸体` : `${caller.color} 按下了紧急按钮`;
    let html = `<div class="sw-meeting-head">第 ${m.id} 次会议 · ${h(cause)}<br><span class="sw-muted">存活：${alive().map(x => x.color).join('、')}</span></div>`;
    html += m.speeches.map(s => {
      const p = G.players[s.playerId];
      const vr = s.verify && s.verify.length ? `<div class="claims">口供核验：${s.verify.map(x => `<span class="${x.ok ? 'ok' : 'bad'}">${x.ok ? '✓' : '✗'} ${h(x.claim)}</span>`).join(' ')}</div>` : '';
      return `<div class="sw-speech"><span class="sw-sw" style="background:${p.hex}"></span><div><span class="who">${h(p.color)}</span><span class="text">${h(s.text)}</span>${V.god ? vr : ''}${V.god && s.thinking ? `<details><summary class="sw-muted" style="cursor:pointer">盘算</summary><div class="sw-muted">${h(s.thinking)}</div></details>` : ''}</div></div>`;
    }).join('');
    if (st.speaking != null) { const p = G.players[st.speaking]; html += `<div class="sw-speech thinking"><span class="sw-sw" style="background:${p.hex}"></span><div><span class="who">${h(p.color)}</span><span class="text">…</span></div></div>`; }
    if (st.phase === 'vote') html += `<div class="sw-votes">投票中…</div>`;
    if (st.phase === 'done' && m.result) {
      const lines = Object.entries(m.votes).map(([vid, t]) => `${G.players[+vid].color} → ${t === 'skip' ? '弃票' : G.players[t].color}`).join('，');
      const ej = m.result.ejectedId != null ? G.players[m.result.ejectedId] : null;
      html += `<div class="sw-votes">${h(lines)}</div><div class="sw-result">${ej ? `${ej.color} 被放逐${m.result.revealed ? (m.result.ejectedRole === 'impostor' ? '，是内鬼' : '，不是内鬼') : ''}${V.god && !m.result.revealed ? `（上帝视角：${ej.role === 'impostor' ? '内鬼' : '船员'}）` : ''}` : `无人被放逐（${h(m.result.reason)}）`}</div>`;
    }
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
  }

  /* ================================================================
   *  § 终局、回放、导出
   * ================================================================ */
  function onGameEnd() {
    const G = V.G;
    V.frames.push(E().frame(G));
    setWait('');
    const falseClaims = {}; const totalClaims = {};
    G.meetings.forEach(m => m.speeches.forEach(s => { if (!s.verify) return; totalClaims[s.playerId] = (totalClaims[s.playerId] || 0) + s.verify.length; falseClaims[s.playerId] = (falseClaims[s.playerId] || 0) + s.verify.filter(x => !x.ok).length; }));
    const rows = G.players.map(p => `<tr><td><span class="sw-sw" style="background:${p.hex};display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px"></span>${h(p.color)}</td><td><span class="sw-badge ${p.role === 'impostor' ? 'imp' : 'crew'}">${p.role === 'impostor' ? '内鬼' : '船员'}</span></td><td>${p.alive ? '存活' : (p.ejected ? '被放逐' : '被杀')}</td><td>${p.role === 'impostor' ? p.stats.kills : p.tasks.filter(t => t.done).length + '/' + p.tasks.length}</td><td>${totalClaims[p.id] ? `${falseClaims[p.id] || 0}/${totalClaims[p.id]}` : '—'}</td></tr>`).join('');
    q('sw-end').innerHTML = `<div class="sw-result" style="font-size:1em">${G.winner === 'crew' ? '🛠 船员获胜' : '🔪 内鬼获胜'} · ${h(G.winReason)} · 用时 ${E().fmtTime(G.t)}</div>
      <table class="sw-end-table"><thead><tr><th>玩家</th><th>身份</th><th>结局</th><th>击杀 / 任务</th><th>口供不符 / 声称数</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sw-muted" style="margin-top:8px">会议 ${G.meetings.length} 次 · 模型请求 ${V.stats.calls} 次（失败 ${V.stats.fails}）。"口供不符"是模型在会议上声称去过的房间、看见的人与真实轨迹对不上的次数。</div>`;
    q('sw-replay').style.display = '';
    q('sw-replay-range').max = Math.max(0, V.frames.length - 1); q('sw-replay-range').value = q('sw-replay-range').max;
    showTab('end');
    renderMapStatic(); renderCrew();
  }
  function replaySeek(i) {
    const f = V.frames[i]; if (!f) return;
    renderFrame(f); q('sw-replay-time').textContent = E().fmtTime(f.t);
  }
  function replayToggle() {
    if (V.replay) { clearInterval(V.replay.timer); V.replay = null; q('sw-replay-play').textContent = '▶ 回放'; return; }
    let i = +q('sw-replay-range').value; if (i >= V.frames.length - 1) i = 0;
    q('sw-replay-play').textContent = '⏸ 停止';
    V.replay = { timer: setInterval(() => { i += Math.max(1, Math.round(loadCfg().speed)); if (i >= V.frames.length) { i = V.frames.length - 1; clearInterval(V.replay.timer); V.replay = null; q('sw-replay-play').textContent = '▶ 回放'; } q('sw-replay-range').value = i; replaySeek(i); }, 250) };
  }
  function exportJson() {
    const G = V.G; if (!G) return;
    const data = { game: 'spacewolf', cfg: G.cfg, winner: G.winner, winReason: G.winReason, duration: G.t,
      players: G.players.map(p => ({ id: p.id, color: p.color, role: p.role, alive: p.alive, ejected: p.ejected, stats: p.stats, tasks: p.tasks, timeline: p.timeline })),
      events: G.events, meetings: G.meetings, frames: V.frames };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'spacewolf-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  return { open, close, startGame, stopGame, _state: V, _cfg: loadCfg, _parseJson: parseJson, _tag: tagOf };
})();
function openSpaceWolf() { SpaceWolf.open(); }
if (typeof window !== 'undefined') window.SpaceWolf = SpaceWolf;
