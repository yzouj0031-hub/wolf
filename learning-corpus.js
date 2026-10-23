/* 🧠 AI 学习语料
 * 局后由玩家自愿把本局上传到云端（Supabase），供 AI 学习；管理员审核后用模型把一局
 * 提炼成一条「别人打过的牌」案例，所有客户端启动时拉取已通过的案例，混进经验库注入提示词。
 *
 * 上传的是对局殿堂同一套脱敏快照（没有提示词、思维链、API 配置、记忆、头像），默认再把
 * 玩家名匿名成座位号。玩家上传的原始对局只有管理员能读；进入所有人提示词的只有管理员
 * 审过的那条案例文本，玩家写的备注不会直接进入任何人的提示词。
 */
(function (global) {
  'use strict';

  const EN = /\/en(?:\/|$)/.test(String(global.location?.pathname || ''));
  const MATCH_TABLE = 'learning_matches';
  const CASE_TABLE = 'learning_cases';
  const CACHE_KEY = 'wolf_learning_cases_v1';
  const CACHE_TTL_MS = 6 * 3600 * 1000;
  const MAX_SNAPSHOT_BYTES = 900000;
  const MAX_REMOTE_CASES = 80;
  const PHASES = ['day', 'pk', 'sheriff', 'lastwords', 'wolfnight'];
  const TAGS = ['early', 'late', 'counterclaim', 'accused', 'noinfo'];
  const JARGON = /账本|标尺|排他性|暂认|证据等级|S级|A级|零成本|目标函数|时点|信息差|视角关|名义刀|落点/;

  const copy = EN ? {
    donate: 'Donate this match for AI learning', donateShort: 'Donate for AI learning', close: 'Close', cancel: 'Cancel',
    intro: 'The full omniscient record of this match (roles, night actions, wolf chats, speeches, votes) is uploaded to the project cloud. Your own model then distils it into a short case; after automatic checks it goes live, and every player\'s AI reads it before speaking, so the AIs learn from real games instead of hand-written rules.',
    anonymize: 'Replace player names with seat numbers (recommended)',
    noteLabel: 'Where did the AI play strangely in this match? (optional, up to 600 characters)',
    consent: 'I confirm the match has ended and agree to upload it for AI learning. API keys, prompts, private AI reasoning, memories and avatars are never uploaded.',
    send: 'Upload', sending: 'Uploading…', sent: 'Uploaded. Thank you! The AIs will learn from it after review.',
    distillingUpload: 'Uploaded. Your model is distilling this match into a case…', sentAuto: 'Uploaded and distilled. Every AI will read this case within a few hours.',
    sentNoApi: 'Uploaded. No model is configured here, so an administrator will distil it later.', sentDistilFailed: 'Uploaded. The case could not be distilled automatically, so an administrator will do it later.',
    autoCase: 'Auto-distilled case', retire: 'Retire this case', retired: 'Retired.',
    fill: 'Please accept the upload notice first.', endedOnly: 'Only a completed Werewolf match can be donated.',
    blindBlocked: 'Turn off blind post-game review before donating an omniscient record.',
    tooLarge: 'This record is too large to upload.', unavailable: 'The learning service is unavailable. Apply the latest Supabase migration and check the network.',
    admin: 'Learning corpus review', refresh: 'Refresh', pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    loading: 'Loading…', empty: 'Nothing to review.', distil: '✨ Distil into a case with AI', distilling: 'Distilling…',
    caseText: 'Case text (what happened, what the player did, how it ended; 40–320 characters, plain words)',
    needs: 'Roles the case mentions (ids, comma separated)', team: 'Who should read it', phases: 'Phases', tags: 'Situation tags',
    approve: 'Approve and add the case', reject: 'Reject', approvedMsg: 'Case added. Every client will pick it up within a few hours.', rejectedMsg: 'Rejected.',
    adminNeeded: 'Sign in with the administrator account to review donations.', needApi: 'Configure a global or host API first.',
    badCase: 'The case does not pass the checks: ', remoteLoaded: n => `${n} cloud cases loaded into the experience library.`
  } : {
    donate: '上传本局供 AI 学习', donateShort: '🧠 上传供 AI 学习', close: '关闭', cancel: '取消',
    intro: '会把本局完整的上帝视角记录（身份、夜间行动、狼队密谈、发言、投票）上传到项目云端，然后用你自己配的模型把它提炼成一条短案例，过了自动检查就直接入库，所有玩家的 AI 在发言前都会读到，让 AI 从真实对局里学，而不是靠手写规则。',
    anonymize: '把玩家名换成座位号（推荐）',
    noteLabel: '你觉得这局 AI 哪里打得怪？（可选，600 字以内）',
    consent: '我确认对局已经结束，并同意上传供 AI 学习。系统不会上传 API 密钥、提示词、AI 私密思维、永久记忆或头像。',
    send: '上传', sending: '正在上传…', sent: '已上传，谢谢！审核后 AI 就会从这局里学。',
    distillingUpload: '已上传。正在用你的模型把这局提炼成案例…', sentAuto: '已上传并提炼成案例，几小时内所有 AI 都会读到这一局。',
    sentNoApi: '已上传。本机没配模型，案例留给管理员提炼。', sentDistilFailed: '已上传。自动提炼没通过检查，案例留给管理员提炼。',
    autoCase: '自动提炼的案例', retire: '撤下这条案例', retired: '已撤下。',
    fill: '请先勾选上传说明。', endedOnly: '只有已经结束的狼人杀对局可以上传。',
    blindBlocked: '请先关闭终局盲复盘，再上传完整的上帝视角记录。',
    tooLarge: '本局记录体积过大，无法上传。', unavailable: '学习语料服务暂不可用。请先执行最新 Supabase 迁移，并检查网络连接。',
    admin: '学习语料审核', refresh: '刷新', pending: '待审', approved: '已入库', rejected: '已驳回',
    loading: '正在读取…', empty: '没有待审的对局。', distil: '✨ 用 AI 提炼成案例', distilling: '正在提炼…',
    caseText: '案例文本（局面、当事人怎么做、后来怎么收场；40–320 字，说人话）',
    needs: '案例提到的角色（id，逗号分隔）', team: '给谁看', phases: '阶段', tags: '局面标签',
    approve: '通过并入库', reject: '驳回', approvedMsg: '案例已入库，各客户端几小时内会拉到。', rejectedMsg: '已驳回。',
    adminNeeded: '请先登录管理员账号再审核。', needApi: '请先配置全局或主持人 API。',
    badCase: '案例没通过检查：', remoteLoaded: n => `已从云端载入 ${n} 条案例进经验库。`
  };

  const byId = id => global.document?.getElementById(id) || null;
  const cleanText = (value, max = 4000) => String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
  // 任何来自云端的字段进 innerHTML 前都要转义：备注、模式名、模型名都是别人填的
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bytes = value => {
    const text = JSON.stringify(value);
    return global.TextEncoder ? new TextEncoder().encode(text).length : unescape(encodeURIComponent(text)).length;
  };
  function client() { return global.CloudSave?.getClient?.() || null; }
  function currentUser() { return global.CloudSave?.getUser?.() || null; }
  async function waitForClient(timeoutMs = 6000) {
    const started = Date.now();
    while (!client() && Date.now() - started < timeoutMs) await new Promise(resolve => setTimeout(resolve, 120));
    return client();
  }
  function randomUuid() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    const data = new Uint8Array(16);
    if (global.crypto?.getRandomValues) global.crypto.getRandomValues(data);
    else for (let i = 0; i < data.length; i++) data[i] = Math.floor(Math.random() * 256);
    data[6] = (data[6] & 15) | 64; data[8] = (data[8] & 63) | 128;
    const h = [...data].map(v => v.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ── 匿名化：玩家名 → P座位号，连事件文本和结构化字段里的名字一起换，长名先换以免被短名截断 ──
  function anonymize(snapshot) {
    const out = JSON.parse(JSON.stringify(snapshot));
    const map = new Map();
    for (const p of out.players || []) {
      const seat = 'P' + (Number(p.id) + 1);
      if (p.name && p.name !== seat) map.set(p.name, seat);
      p.name = seat;
    }
    const names = [...map.keys()].sort((a, b) => b.length - a.length);
    if (!names.length) return out;
    const re = new RegExp(names.map(escapeRe).join('|'), 'g');
    const swap = s => s.replace(re, m => map.get(m) || m);
    const walk = v => {
      if (typeof v === 'string') return swap(v);
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[swap(k)] = walk(v[k]); return o; }
      return v;
    };
    out.events = walk(out.events || []);
    return out;
  }

  function currentSnapshot() {
    if (typeof S === 'undefined' || !S?.gameOver || !Array.isArray(S.players)) throw new Error(copy.endedOnly);
    if (typeof blindReviewOn === 'function' && blindReviewOn()) throw new Error(copy.blindBlocked);
    const build = global.CommunityMatches?._test?.buildSnapshot;
    if (typeof build !== 'function') throw new Error(copy.unavailable);
    const snapshot = build(S,
      typeof gameRecord !== 'undefined' ? gameRecord : [],
      typeof playerConfigs !== 'undefined' ? playerConfigs : {},
      typeof MODE_CONFIGS !== 'undefined' ? MODE_CONFIGS : {});
    if (bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error(copy.tooLarge);
    return snapshot;
  }

  function buildPayload(snapshot, { note = '', anonymized = true, user = null } = {}) {
    const snap = anonymized ? anonymize(snapshot) : snapshot;
    return {
      client_submission_id: randomUuid(),
      submitter_id: user?.id || null,
      note: cleanText(note, 600),
      anonymized: !!anonymized,
      mode_id: cleanText(snap.mode_id, 40),
      mode_name: cleanText(snap.mode_name, 80),
      winner: cleanText(snap.winner, 60),
      rounds: Math.max(0, Math.min(200, Number(snap.rounds || 0))),
      player_count: Math.max(1, Math.min(24, (snap.players || []).length)),
      roles: (snap.players || []).map(p => cleanText(p.role?.name || p.role?.id || '?', 50)),
      models: [...new Set((snap.players || []).map(p => cleanText(p.model, 60)).filter(Boolean))],
      snapshot: snap,
      client_created_at: new Date().toISOString(),
      status: 'pending'
    };
  }

  // ── 案例校验：和内置经验库同一套门槛 ──
  function validateCase(c, roleIds) {
    const errors = [];
    const text = cleanText(c?.text, 400);
    if (text.length < 40 || text.length > 320) errors.push(EN ? 'text must be 40–320 characters' : '文本要在 40 到 320 字之间');
    if (JARGON.test(text)) errors.push(EN ? 'text contains internal jargon' : '文本里有规则书术语（账本/标尺/排他性/落点…）');
    if (/最高优先级|忽略.{0,8}(?:规则|指令)|system prompt|<[a-zA-Z/]|【|】/.test(text)) errors.push(EN ? 'text looks like an instruction or contains tags' : '文本像指令或带标签（【】/<>/最高优先级…）');
    const needs = Array.isArray(c?.needs) ? c.needs.map(x => cleanText(x, 40)).filter(Boolean) : [];
    if (roleIds && roleIds.size) for (const r of needs) if (!roleIds.has(r)) errors.push((EN ? 'unknown role id: ' : '未知角色 id：') + r);
    for (const [word, rid] of [['预言家', 'seer'], ['女巫', 'witch'], ['守卫', 'guard'], ['猎人', 'hunter'], ['骑士', 'knight'], ['魔术师', 'magician'], ['狼美人', 'wolfbeauty'], ['白狼王', 'whitewolf'], ['狼王', 'wolfking']]) {
      if (text.includes(word) && !needs.includes(rid)) errors.push((EN ? 'text mentions a role missing from needs: ' : '文本提到了角色但 needs 没声明：') + word);
    }
    const team = ['good', 'bad', 'any'].includes(c?.team) ? c.team : '';
    if (!team) errors.push(EN ? 'team must be good/bad/any' : 'team 只能是 good/bad/any');
    const phases = Array.isArray(c?.phases) ? c.phases.filter(p => PHASES.includes(p)) : [];
    if (!phases.length) errors.push(EN ? 'at least one valid phase' : '至少一个合法阶段');
    const tags = Array.isArray(c?.tags) ? c.tags.filter(t => TAGS.includes(t)) : [];
    return { ok: !errors.length, errors, value: { text, needs, team: team || 'any', phases, tags } };
  }

  function parseCaseJson(raw) {
    const s = String(raw || '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/\[草稿\][\s\S]*?\[\/草稿\]/g, '');
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (_) {
      try { return JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (__) { return null; }
    }
  }

  // ── 把快照渲染成模型可读的战报文本 ──
  function renderMatchText(row) {
    const snap = row?.snapshot || row || {};
    const lines = [];
    lines.push(`模式：${snap.mode_name || snap.mode_id || '?'}　回合：${snap.rounds || 0}　胜方：${snap.winner || '?'}`);
    lines.push('玩家：' + (snap.players || []).map(p => `${p.name}（${p.role?.name || p.role?.id || '?'}${p.model ? '·' + p.model : ''}）`).join('、'));
    let last = '';
    for (const ev of (snap.events || []).slice(0, 600)) {
      const key = `${ev.round}|${ev.phase}`;
      if (key !== last) { lines.push(`\n── 第${ev.round}回合 · ${ev.phase} ──`); last = key; }
      // 胜方 / 败方感言之类的标签要带上，提炼模型才分得清哪些是赛后复盘、哪些是桌上的话
      lines.push((ev.label ? '【' + cleanText(ev.label, 50) + '】' : '') + (ev.name ? ev.name + '：' : '') + cleanText(ev.text, 1200));
    }
    if (row?.note) lines.push('\n【上传者备注】' + cleanText(row.note, 600));
    return lines.join('\n').slice(0, 60000);
  }

  function distilPrompt(row) {
    const roleIds = [...new Set(((row?.snapshot?.players) || []).map(p => cleanText(p.role?.id, 40)).filter(Boolean))];
    const sys = '你是狼人杀教练，要把一局真实对局提炼成一条给 AI 玩家看的"别人打过的牌"。只输出一个 JSON 对象，不要别的文字。'
      + '\n要求：text 用 150 到 300 字讲一个具体局面：当事人（用座位号）当时怎么选、怎么说、后来怎么收场，像讲故事，带结果，不下结论、不总结道理、不用"应该"。'
      + '\n禁用这些词：账本、标尺、排他性、暂认、证据等级、零成本、目标函数、时点、信息差、名义刀、落点。'
      + '\nneeds 填 text 里提到的角色 id（只能从本局角色里选：' + roleIds.join(', ') + '）；team 填 good/bad/any（这条经验给好人看、给狼看、还是都能看）；'
      + 'phases 从 ' + PHASES.join('/') + ' 里选（day 白天发言、pk 平票自救、sheriff 竞选、lastwords 遗言、wolfnight 狼队密谈）；tags 从 ' + TAGS.join('/') + ' 里选（early 首日、late 残局、counterclaim 有对跳、accused 被查杀或点名、noinfo 没信息的民牌）。'
      + '\n格式：{"text":"…","needs":["seer"],"team":"good","phases":["day"],"tags":["counterclaim"]}';
    const user = '下面是这局的上帝视角记录。挑这局里最值得别的 AI 看到的一个瞬间（往往是输赢分岔的那一步，或者上传者备注提到的那一处），提炼成案例。记录末尾带【胜方感言】【败方感言】的是游戏结束后各人的复盘：输家自己点出的分岔点往往就是最值得提炼的瞬间，但案例要写当时桌上发生了什么，不要抄复盘的话。\n\n' + renderMatchText(row);
    return { sys, user };
  }

  function hostApi() {
    try {
      const api = typeof getHostAPI === 'function' ? getHostAPI() : null;
      if (!api || !api.url || !api.model) return null;
      api.type = typeof inferApiType === 'function' ? inferApiType(api.url) : 'openai';
      return api;
    } catch (_) { return null; }
  }

  // ── 云端案例 → 经验库 ──
  function readCache() {
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && Array.isArray(c.rows) ? c : null; } catch (_) { return null; }
  }
  function writeCache(rows) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows })); } catch (_) {} }
  function applyRemote(rows) {
    if (!global.WolfExperience?.setRemoteCases) return 0;
    const mapped = (rows || []).map(r => ({ id: 'cloud_' + r.id, needs: r.needs || [], team: r.team || 'any', when: r.phases || ['day'], tags: r.tags || [], text: r.text || '' }));
    return global.WolfExperience.setRemoteCases(mapped);
  }
  async function loadRemoteCases(force = false) {
    const cached = readCache();
    if (cached) applyRemote(cached.rows);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.rows.length;
    const c = await waitForClient(8000);
    if (!c) return cached ? cached.rows.length : 0;
    try {
      const { data, error } = await c.from(CASE_TABLE).select('id,text,needs,team,phases,tags').eq('status', 'approved').order('created_at', { ascending: false }).limit(MAX_REMOTE_CASES);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      writeCache(rows);
      return applyRemote(rows);
    } catch (e) {
      console.warn('[学习语料] 拉取云端案例失败', e);
      return cached ? cached.rows.length : 0;
    }
  }

  // ── UI ──
  let uiReady = false;
  let submittedMatchId = '';
  let isAdmin = false;
  let reviewRows = [];
  let activeRow = null;
  let activeDraft = null;

  function injectStyles() {
    if (byId('learning-corpus-styles')) return;
    const style = document.createElement('style');
    style.id = 'learning-corpus-styles';
    style.textContent = `
      .lc-overlay{position:fixed;inset:0;z-index:1185;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(3,3,10,.84);backdrop-filter:blur(12px)}
      .lc-overlay.show{display:flex}
      .lc-panel{width:min(760px,96vw);max-height:94vh;overflow:auto;display:flex;flex-direction:column;border:1px solid rgba(120,190,170,.4);border-radius:16px;background:linear-gradient(160deg,rgba(14,24,26,.98),rgba(8,12,16,.96));color:#d6e6dc;box-shadow:0 30px 80px rgba(0,0,0,.6)}
      .lc-head{display:flex;align-items:center;gap:10px;padding:14px 17px;border-bottom:1px solid rgba(120,190,170,.18)}
      .lc-head h2{margin:0;flex:1;color:#9fe0c6;font-size:1.02rem;letter-spacing:.1em}
      .lc-body{padding:14px 17px;display:flex;flex-direction:column;gap:10px;font-size:.84em;line-height:1.55}
      .lc-btn{width:auto!important;padding:7px 12px!important;border:1px solid rgba(120,190,170,.4);border-radius:9px;background:rgba(120,190,170,.08);color:#bfe8d6;cursor:pointer;font-size:.82em}
      .lc-btn.primary{border-color:#5fbf98;color:#e0fff0;background:rgba(95,191,152,.16)}
      .lc-btn.danger{border-color:rgba(220,90,110,.35);color:#e8a8b5}
      .lc-btn:disabled{opacity:.5;cursor:default}
      .lc-note{font-size:.76em;color:#8ea89c}
      .lc-status{min-height:1.3em;font-size:.78em;color:#9ab8ac}.lc-status.bad{color:#e8a0a0}
      .lc-body textarea,.lc-body input[type=text],.lc-body select{width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);border:1px solid rgba(120,190,170,.25);color:#d8ece2;border-radius:8px;padding:6px 8px;font-size:.9em;font-family:inherit}
      .lc-list{display:flex;flex-direction:column;gap:8px}
      .lc-card{border:1px solid rgba(120,190,170,.2);border-radius:10px;padding:10px;background:rgba(255,255,255,.03);cursor:pointer}
      .lc-card:hover{border-color:rgba(120,190,170,.5)}
      .lc-card small{color:#8ea89c}
      .lc-match{white-space:pre-wrap;max-height:280px;overflow:auto;font-size:.8em;line-height:1.5;background:rgba(0,0,0,.28);border-radius:8px;padding:8px;color:#c6d8ce}
      .lc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .lc-row label{display:flex;gap:4px;align-items:center;font-size:.8em}
      @media(max-width:620px){.lc-overlay{padding:4px}.lc-panel{width:100%;max-height:98vh;border-radius:11px}}
    `;
    document.head.appendChild(style);
  }

  function createUi() {
    if (uiReady || !global.document) return;
    uiReady = true;
    injectStyles();
    const donate = document.createElement('div');
    donate.id = 'lc-donate'; donate.className = 'lc-overlay';
    donate.innerHTML = `<section class="lc-panel" style="max-width:560px" role="dialog" aria-modal="true">
      <header class="lc-head"><h2>🧠 ${copy.donate}</h2><button type="button" class="lc-btn" id="lc-donate-close">${copy.close}</button></header>
      <div class="lc-body">
        <div>${copy.intro}</div>
        <label class="lc-row"><input type="checkbox" id="lc-anon" checked> ${copy.anonymize}</label>
        <div class="lc-note">${copy.noteLabel}</div>
        <textarea id="lc-note" maxlength="600" rows="4"></textarea>
        <label class="lc-row"><input type="checkbox" id="lc-consent"> <span>${copy.consent}</span></label>
        <div class="lc-row"><button type="button" class="lc-btn primary" id="lc-send">${copy.send}</button><button type="button" class="lc-btn" id="lc-donate-cancel">${copy.cancel}</button></div>
        <div class="lc-status" id="lc-donate-status" role="status"></div>
      </div></section>`;
    document.body.appendChild(donate);

    const admin = document.createElement('div');
    admin.id = 'lc-admin'; admin.className = 'lc-overlay';
    admin.innerHTML = `<section class="lc-panel" role="dialog" aria-modal="true">
      <header class="lc-head"><h2>🧠 ${copy.admin}</h2><button type="button" class="lc-btn" id="lc-admin-refresh">${copy.refresh}</button><button type="button" class="lc-btn" id="lc-admin-close">${copy.close}</button></header>
      <div class="lc-body">
        <div class="lc-status" id="lc-admin-status" role="status"></div>
        <div class="lc-list" id="lc-admin-list"></div>
        <div id="lc-admin-detail" style="display:none">
          <button type="button" class="lc-btn" id="lc-admin-back">← ${copy.pending}</button>
          <div class="lc-match" id="lc-admin-match"></div>
          <div id="lc-auto-case" style="display:none"><div class="lc-note">🤖 ${copy.autoCase}</div><div class="lc-match" id="lc-auto-text" style="max-height:160px"></div><div class="lc-row"><button type="button" class="lc-btn danger" id="lc-retire">${copy.retire}</button></div></div>
          <div class="lc-row"><button type="button" class="lc-btn primary" id="lc-distil">${copy.distil}</button><span class="lc-note" id="lc-distil-note"></span></div>
          <div class="lc-note">${copy.caseText}</div>
          <textarea id="lc-case-text" maxlength="320" rows="5"></textarea>
          <div class="lc-note">${copy.needs}</div>
          <input type="text" id="lc-case-needs">
          <div class="lc-row"><span class="lc-note">${copy.team}</span><select id="lc-case-team"><option value="good">good</option><option value="bad">bad</option><option value="any">any</option></select></div>
          <div class="lc-row"><span class="lc-note">${copy.phases}</span>${PHASES.map(p => `<label><input type="checkbox" data-phase="${p}"> ${p}</label>`).join('')}</div>
          <div class="lc-row"><span class="lc-note">${copy.tags}</span>${TAGS.map(t => `<label><input type="checkbox" data-tag="${t}"> ${t}</label>`).join('')}</div>
          <div class="lc-row"><button type="button" class="lc-btn primary" id="lc-approve">${copy.approve}</button><button type="button" class="lc-btn danger" id="lc-reject">${copy.reject}</button></div>
          <div class="lc-status" id="lc-review-status" role="status"></div>
        </div>
      </div></section>`;
    document.body.appendChild(admin);

    byId('lc-donate-close').onclick = closeDonate; byId('lc-donate-cancel').onclick = closeDonate; byId('lc-send').onclick = submitDonation;
    donate.addEventListener('click', e => { if (e.target === donate) closeDonate(); });
    byId('lc-admin-close').onclick = () => admin.classList.remove('show'); byId('lc-admin-refresh').onclick = loadReview;
    byId('lc-admin-back').onclick = showList; byId('lc-distil').onclick = distil; byId('lc-approve').onclick = approve; byId('lc-reject').onclick = reject; byId('lc-retire').onclick = retire;
    admin.addEventListener('click', e => { if (e.target === admin) admin.classList.remove('show'); });
  }

  const setStatus = (id, text, bad = false) => { const n = byId(id); if (!n) return; n.textContent = text || ''; n.classList.toggle('bad', !!bad); };

  function openDonate() {
    createUi();
    try { currentSnapshot(); } catch (e) { alert(e.message || copy.endedOnly); return; }
    byId('lc-consent').checked = false;
    setStatus('lc-donate-status', '');
    const matchId = cleanText(typeof S !== 'undefined' ? (S._matchUid || S.gameId) : '', 100);
    byId('lc-send').disabled = !!matchId && submittedMatchId === matchId;
    byId('lc-donate').classList.add('show');
  }
  function closeDonate() { byId('lc-donate')?.classList.remove('show'); }

  async function submitDonation() {
    let snapshot;
    try { snapshot = currentSnapshot(); } catch (e) { setStatus('lc-donate-status', e.message, true); return; }
    if (!byId('lc-consent')?.checked) { setStatus('lc-donate-status', copy.fill, true); return; }
    if (submittedMatchId && submittedMatchId === snapshot.match_id) { setStatus('lc-donate-status', copy.sent); return; }
    const c = await waitForClient();
    if (!c) { setStatus('lc-donate-status', copy.unavailable, true); return; }
    const button = byId('lc-send'); button.disabled = true; setStatus('lc-donate-status', copy.sending);
    const payload = buildPayload(snapshot, { note: byId('lc-note')?.value, anonymized: !!byId('lc-anon')?.checked, user: currentUser() });
    try {
      const { error } = await c.from(MATCH_TABLE).insert(payload);
      if (error) throw error;
      submittedMatchId = snapshot.match_id;
      const pg = byId('pg-learning-submit'); if (pg) { pg.disabled = true; pg.textContent = '✅ ' + copy.sent.split(/[。.]/)[0]; }
      setStatus('lc-donate-status', copy.distillingUpload);
      const result = await autoDistil(c, payload);
      setStatus('lc-donate-status', result === 'ok' ? copy.sentAuto : result === 'noapi' ? copy.sentNoApi : copy.sentDistilFailed, false);
    } catch (e) {
      console.warn('[学习语料] 上传失败', e);
      setStatus('lc-donate-status', copy.unavailable + ' ' + cleanText(e?.message, 160), true);
      button.disabled = false;
    }
  }

  // ── 自动提炼：上传者自己的模型 → 机械检查 → 直接入库（一局一条，靠 source_submission_id 绑定） ──
  async function autoDistil(c, payload) {
    const api = hostApi();
    const request = global.AuxGameAPI?.request;
    if (!api || typeof request !== 'function') return 'noapi';
    try {
      const { sys, user } = distilPrompt({ snapshot: payload.snapshot, note: payload.note });
      const raw = await request(api, sys, user, undefined, 2000);
      const draft = parseCaseJson(raw);
      const roleIds = new Set((payload.snapshot?.players || []).map(p => p.role?.id).filter(Boolean));
      const v = validateCase(draft, roleIds);
      if (!v.ok) { console.warn('[学习语料] 自动案例没通过检查', v.errors); return 'invalid'; }
      const { error } = await c.from(CASE_TABLE).insert({ source_submission_id: payload.client_submission_id, author_id: currentUser()?.id || null, source: 'auto', status: 'approved', text: v.value.text, needs: v.value.needs, team: v.value.team, phases: v.value.phases, tags: v.value.tags });
      if (error) throw error;
      return 'ok';
    } catch (e) { console.warn('[学习语料] 自动提炼失败', e); return 'failed'; }
  }

  // ── 管理员审核：看待审对局、撤下自动案例、给没提炼出来的对局手动提炼 ──
  let autoCases = new Map();   // source_submission_id → case row
  async function checkAdmin() {
    isAdmin = false;
    const button = byId('learning-admin-open'); if (button) button.style.display = 'none';
    const c = client(); if (!c || !currentUser()) return false;
    try { const { data, error } = await c.rpc('is_feedback_admin'); isAdmin = !error && data === true; } catch (_) { isAdmin = false; }
    if (button) button.style.display = isAdmin ? '' : 'none';
    return isAdmin;
  }
  async function openAdmin() {
    createUi();
    byId('lc-admin').classList.add('show');
    showList();
    if (!(await checkAdmin())) { setStatus('lc-admin-status', copy.adminNeeded, true); return; }
    loadReview();
  }
  function showList() { byId('lc-admin-detail').style.display = 'none'; byId('lc-admin-list').style.display = ''; activeRow = null; }
  async function loadReview() {
    const c = client(); if (!c) { setStatus('lc-admin-status', copy.unavailable, true); return; }
    setStatus('lc-admin-status', copy.loading);
    try {
      const { data, error } = await c.from(MATCH_TABLE).select('id,client_submission_id,note,anonymized,mode_name,winner,rounds,player_count,roles,models,snapshot,status,created_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(50);
      if (error) throw error;
      reviewRows = Array.isArray(data) ? data : [];
      autoCases = new Map();
      try {
        const cases = await c.from(CASE_TABLE).select('id,source_submission_id,text,status').eq('source', 'auto').eq('status', 'approved').order('created_at', { ascending: false }).limit(200);
        for (const row of (cases.data || [])) if (row.source_submission_id) autoCases.set(row.source_submission_id, row);
      } catch (_) {}
      renderList(); setStatus('lc-admin-status', reviewRows.length ? '' : copy.empty);
    } catch (e) { setStatus('lc-admin-status', copy.unavailable + ' ' + cleanText(e?.message, 160), true); }
  }
  function renderList() {
    const list = byId('lc-admin-list'); if (!list) return;
    list.innerHTML = '';
    for (const row of reviewRows) {
      const card = document.createElement('div'); card.className = 'lc-card';
      const auto = autoCases.get(row.client_submission_id);
      card.innerHTML = `<div><strong>${esc(cleanText(row.mode_name, 80))}</strong> · ${esc(row.player_count)}${EN ? ' players' : '人'} · ${esc(row.rounds)}${EN ? ' rounds' : '回合'} · ${esc(cleanText(row.winner, 60))}${auto ? ' · 🤖 ' + esc(copy.autoCase) : ''}</div><small>${esc((row.models || []).join(', '))}${row.note ? ' · 📝 ' + esc(cleanText(row.note, 80)) : ''} · ${esc(cleanText(row.created_at, 19).replace('T', ' '))}</small>`;
      card.onclick = () => openDetail(row);
      list.appendChild(card);
    }
  }
  function openDetail(row) {
    activeRow = row; activeDraft = null;
    byId('lc-admin-list').style.display = 'none'; byId('lc-admin-detail').style.display = '';
    byId('lc-admin-match').textContent = renderMatchText(row);
    const auto = autoCases.get(row.client_submission_id);
    const autoBox = byId('lc-auto-case');
    if (autoBox) { autoBox.style.display = auto ? '' : 'none'; byId('lc-auto-text').textContent = auto ? auto.text : ''; byId('lc-retire').dataset.caseId = auto ? auto.id : ''; }
    byId('lc-case-text').value = ''; byId('lc-case-needs').value = ''; byId('lc-case-team').value = 'any';
    document.querySelectorAll('#lc-admin-detail [data-phase]').forEach(x => { x.checked = x.dataset.phase === 'day'; });
    document.querySelectorAll('#lc-admin-detail [data-tag]').forEach(x => { x.checked = false; });
    setStatus('lc-review-status', ''); byId('lc-distil-note').textContent = '';
  }
  function fillDraft(draft) {
    byId('lc-case-text').value = cleanText(draft.text, 320);
    byId('lc-case-needs').value = (Array.isArray(draft.needs) ? draft.needs : []).join(', ');
    byId('lc-case-team').value = ['good', 'bad', 'any'].includes(draft.team) ? draft.team : 'any';
    const phases = Array.isArray(draft.phases) ? draft.phases : ['day'];
    document.querySelectorAll('#lc-admin-detail [data-phase]').forEach(x => { x.checked = phases.includes(x.dataset.phase); });
    const tags = Array.isArray(draft.tags) ? draft.tags : [];
    document.querySelectorAll('#lc-admin-detail [data-tag]').forEach(x => { x.checked = tags.includes(x.dataset.tag); });
  }
  function readForm() {
    return {
      text: byId('lc-case-text')?.value,
      needs: String(byId('lc-case-needs')?.value || '').split(/[,，\s]+/).filter(Boolean),
      team: byId('lc-case-team')?.value,
      phases: [...document.querySelectorAll('#lc-admin-detail [data-phase]')].filter(x => x.checked).map(x => x.dataset.phase),
      tags: [...document.querySelectorAll('#lc-admin-detail [data-tag]')].filter(x => x.checked).map(x => x.dataset.tag)
    };
  }
  async function distil() {
    if (!activeRow) return;
    const api = hostApi(); if (!api) { setStatus('lc-review-status', copy.needApi, true); return; }
    const request = global.AuxGameAPI?.request; if (typeof request !== 'function') { setStatus('lc-review-status', copy.unavailable, true); return; }
    const button = byId('lc-distil'); button.disabled = true; byId('lc-distil-note').textContent = copy.distilling;
    try {
      const { sys, user } = distilPrompt(activeRow);
      const raw = await request(api, sys, user, undefined, 2000);
      const draft = parseCaseJson(raw);
      if (!draft) throw new Error(EN ? 'the model did not return JSON' : '模型没有返回 JSON');
      activeDraft = draft; fillDraft(draft);
      const roleIds = new Set((activeRow.snapshot?.players || []).map(p => p.role?.id).filter(Boolean));
      const v = validateCase(draft, roleIds);
      byId('lc-distil-note').textContent = v.ok ? '✓' : copy.badCase + v.errors.join('；');
    } catch (e) {
      byId('lc-distil-note').textContent = cleanText(e?.message, 200);
    } finally { button.disabled = false; }
  }
  async function approve() {
    if (!activeRow) return;
    const roleIds = new Set((activeRow.snapshot?.players || []).map(p => p.role?.id).filter(Boolean));
    const v = validateCase(readForm(), roleIds);
    if (!v.ok) { setStatus('lc-review-status', copy.badCase + v.errors.join('；'), true); return; }
    const c = client(); const user = currentUser(); if (!c || !user) { setStatus('lc-review-status', copy.adminNeeded, true); return; }
    try {
      const { error } = await c.from(CASE_TABLE).insert({ source_match_id: activeRow.id, author_id: user.id, source: 'admin', text: v.value.text, needs: v.value.needs, team: v.value.team, phases: v.value.phases, tags: v.value.tags, status: 'approved' });
      if (error) throw error;
      const upd = await c.from(MATCH_TABLE).update({ status: 'approved', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', activeRow.id);
      if (upd.error) throw upd.error;
      setStatus('lc-review-status', copy.approvedMsg);
      reviewRows = reviewRows.filter(r => r.id !== activeRow.id); renderList();
      loadRemoteCases(true);
    } catch (e) { setStatus('lc-review-status', copy.unavailable + ' ' + cleanText(e?.message, 160), true); }
  }
  async function retire() {
    const id = byId('lc-retire')?.dataset.caseId; const c = client(); if (!id || !c) return;
    try {
      const { error } = await c.from(CASE_TABLE).update({ status: 'retired', updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setStatus('lc-review-status', copy.retired); byId('lc-auto-case').style.display = 'none';
      for (const [k, v] of autoCases) if (v.id === id) autoCases.delete(k);
      renderList(); loadRemoteCases(true);
    } catch (e) { setStatus('lc-review-status', copy.unavailable + ' ' + cleanText(e?.message, 160), true); }
  }
  async function reject() {
    if (!activeRow) return;
    const c = client(); if (!c) return;
    try {
      const { error } = await c.from(MATCH_TABLE).update({ status: 'rejected', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', activeRow.id);
      if (error) throw error;
      setStatus('lc-review-status', copy.rejectedMsg);
      reviewRows = reviewRows.filter(r => r.id !== activeRow.id); renderList(); showList();
    } catch (e) { setStatus('lc-review-status', copy.unavailable + ' ' + cleanText(e?.message, 160), true); }
  }

  function init() {
    if (!global.document) return;
    byId('pg-learning-submit')?.addEventListener('click', openDonate);
    byId('learning-admin-open')?.addEventListener('click', openAdmin);
    loadRemoteCases(false);
  }

  const api = {
    init, openDonate, openAdmin, authChanged: checkAdmin, loadRemoteCases,
    _test: { anonymize, buildPayload, validateCase, parseCaseJson, renderMatchText, distilPrompt, applyRemote, autoDistil, PHASES, TAGS, MAX_SNAPSHOT_BYTES, CACHE_KEY }
  };
  global.WolfLearning = api;
  if (global.document) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init(); }
})(typeof window !== 'undefined' ? window : globalThis);
