/* Community Match Gallery
 * Public browsing + moderated post-game submissions. Uploaded snapshots deliberately
 * exclude prompts, chain-of-thought, API configuration, memories and avatars.
 */
(function (global) {
  'use strict';

  const EN = /\/en(?:\/|$)/.test(String(global.location?.pathname || ''));
  const ASSET_ROOT = EN ? '../' : './';
  const TABLE = 'community_matches';
  const MAX_EVENTS = 600;
  const MAX_SNAPSHOT_BYTES = 900000;
  const SAFE_EVENT_TYPES = new Set([
    'system','speech','death','vote','duel','shoot','bite','whitewolf_explode',
    'trial','sheriff_transfer','foolImmune','reprieve','skillConsumed',
    'night_action','speak_order','spectator'
  ]);
  const copy = EN ? {
    gallery:'Match Hall', submit:'Submit this match', close:'Close', refresh:'Refresh',
    publicTab:'Published', reviewTab:'Pending review', search:'Search title, role or author',
    loading:'Loading matches…', empty:'No published matches yet.', view:'View report',
    back:'Back to list', publish:'Publish', reject:'Reject', pending:'Pending review',
    title:'Match title', author:'Display name', summary:'Why is this match worth watching?',
    consent:'I confirm the match has ended and agree to publish player names, roles, actions and speeches. API keys, prompts, private AI reasoning, memories and avatars are never uploaded.',
    send:'Submit for review', sending:'Uploading…', sent:'Submitted. It will appear after review.',
    unavailable:'The Match Hall service is unavailable. Apply the latest Supabase migration and check the network.',
    endedOnly:'Only a completed Werewolf match can be submitted.', blindBlocked:'Turn off blind post-game review before publishing an omniscient replay.',
    tooLarge:'This replay is too large to upload. Export it locally instead.', fill:'Please enter a title and accept the publishing notice.',
    roster:'Players', timeline:'Full report', winner:'Winner', rounds:'rounds', players:'players',
    theater:'Omniscient replay desk', previous:'Previous phase', play:'Play', pause:'Pause', next:'Next phase',
    chapters:'Match phases', event:'Event', noEvents:'No replay events were recorded for this match.',
    adminNeeded:'Sign in with the administrator account to review submissions.', approved:'Published.', rejected:'Rejected.'
  } : {
    gallery:'对局殿堂', submit:'投稿本局', close:'关闭', refresh:'刷新',
    publicTab:'已发布', reviewTab:'待审投稿', search:'搜索标题、角色或投稿人',
    loading:'正在读取对局…', empty:'暂时还没有公开对局。', view:'查看战报',
    back:'返回列表', publish:'发布', reject:'驳回', pending:'等待审核',
    title:'给这局起个标题', author:'投稿人显示名', summary:'这局为什么值得看？',
    consent:'我确认对局已经结束，并同意公开玩家名称、真实身份、夜间行动与发言。系统不会上传 API 密钥、提示词、AI 私密思维、永久记忆或头像。',
    send:'提交审核', sending:'正在上传…', sent:'投稿成功，审核发布后会出现在对局殿堂。',
    unavailable:'对局殿堂暂不可用。请先执行最新 Supabase 迁移，并检查网络连接。',
    endedOnly:'只有已经结束的狼人杀对局可以投稿。', blindBlocked:'请先关闭终局盲复盘，再投稿完整的上帝视角战报。',
    tooLarge:'本局战报体积过大，无法上传；可以先使用本地复盘导出。', fill:'请填写标题，并确认公开说明。',
    roster:'本局席位', timeline:'完整战报', winner:'胜方', rounds:'回合', players:'人',
    theater:'上帝视角复盘台', previous:'上一阶段', play:'播放', pause:'暂停', next:'下一阶段',
    chapters:'对局阶段', event:'事件', noEvents:'这局没有留下可播放的战报事件。',
    adminNeeded:'请先登录管理员账号再审核投稿。', approved:'已发布。', rejected:'已驳回。'
  };

  let publicRows = [];
  let reviewRows = [];
  let currentMode = 'public';
  let isAdmin = false;
  let initialized = false;
  let submittedMatchId = '';
  let observer = null;

  const ACTION_ART = {
    seer:'seer-divination-v1.webp', werewolf:'werewolf-awakening-v1.webp', witch:'witch-potions-v1.webp',
    hunter:'hunter-shot-v1.webp', guard:'guard-protection-v1.webp', knight:'knight-oath-v1.webp',
    magician:'magician-illusion-v1.webp', wolfbeauty:'wolf-beauty-glamour-v1.webp',
    wolfking:'wolf-king-death-bite-v1.webp', whitewolf:'white-wolf-king-awakening-v1.webp',
    fox:'fox-cub-charm-v1.webp', dreamwalker:'dreamwalker-protection-v1.webp',
    gargoyle:'gargoyle-scry-v1.webp', gravekeeper:'gravekeeper-revelation-v1.webp',
    alchemist:'alchemist-serpent-v1.webp', soulwarden:'soulwarden-sanctuary-v1.webp',
    serialkiller:'serial-killer-hunt-v1.webp', imitator:'imitator-memory-copy-v1.webp',
    mechwolf:'mechanical-wolf-copy-v1.webp', cupid:'cupid-bond-v1.webp', jester:'jester-exile-v1.webp',
    whitecat:'whitecat-delayed-death-v1.webp', merchant:'traveling-merchant-gift-v1.webp'
  };

  const byId = id => global.document?.getElementById(id) || null;
  const cleanText = (value, max = 4000) => String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
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
    else for (let i=0;i<data.length;i++) data[i]=Math.floor(Math.random()*256);
    data[6]=(data[6]&15)|64; data[8]=(data[8]&63)|128;
    const h=[...data].map(value=>value.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  function status(text, bad = false) {
    const node = byId('cm-status');
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('bad', !!bad);
  }
  function submissionStatus(text, bad = false) {
    const node = byId('cm-submit-status');
    if (!node) return;
    node.textContent = text || '';
    node.classList.toggle('bad', !!bad);
  }
  function roleName(role) { return cleanText(role?.name || role?.id || '?', 50); }
  function winnerLabel(value) {
    const raw = cleanText(value, 60);
    if (/good|好人/i.test(raw)) return EN ? 'Good team' : '好人阵营';
    if (/wolf|狼人/i.test(raw)) return EN ? 'Wolf team' : '狼人阵营';
    if (/third|第三|lover|情侣|jester|小丑|serial/i.test(raw)) return raw || (EN ? 'Third party' : '第三阵营');
    return raw || (EN ? 'Unknown' : '未知');
  }
  function safeRoleId(value) { return cleanText(value, 40).replace(/[^a-z0-9_-]/gi, ''); }
  function rolePortrait(roleId) { const id=safeRoleId(roleId); return id ? `${ASSET_ROOT}icons/roles/${encodeURIComponent(id)}.jpg` : ''; }
  function eventActor(ev,snap) {
    const name=cleanText(ev?.name,60).toLowerCase();
    return (snap?.players||[]).find(player=>cleanText(player.name,60).toLowerCase()===name)||null;
  }
  function eventArt(ev,snap) {
    const fixed={shoot:'hunter-shot-v1.webp',bite:'wolf-king-death-bite-v1.webp',whitewolf_explode:'white-wolf-king-awakening-v1.webp',duel:'knight-oath-v1.webp'}[ev?.type];
    if(fixed)return `${ASSET_ROOT}assets/action-cg/${fixed}`;
    const actor=eventActor(ev,snap), roleId=safeRoleId(actor?.role?.id);
    if(ev?.type==='night_action'&&ACTION_ART[roleId])return `${ASSET_ROOT}assets/action-cg/${ACTION_ART[roleId]}`;
    return rolePortrait(roleId)||`${ASSET_ROOT}icons/lobby/gothic-lobby.webp`;
  }
  function phaseLabel(ev) {
    const raw=cleanText(ev?.phase,20).toLowerCase();
    const phases=EN
      ? {night:'Night',day:'Day',sheriff:'Sheriff election',vote:'Vote',speech:'Discussion',postgame:'Finale'}
      : {night:'夜幕',day:'白昼',sheriff:'警长竞选',vote:'放逐投票',speech:'发言轮',postgame:'终局'};
    if(phases[raw])return phases[raw];
    if(ev?.type==='night_action')return EN?'Night action':'夜间行动';
    if(ev?.type==='speech')return EN?'Discussion':'发言';
    if(ev?.type==='vote')return EN?'Vote':'投票';
    if(ev?.type==='death')return EN?'Death report':'死亡结算';
    return EN?'Match event':'对局事件';
  }
  function safeStringArray(value,limit=24) {
    return Array.isArray(value)?value.slice(0,limit).map(item=>cleanText(item,80)).filter(Boolean):[];
  }
  function safeNameMap(value) {
    const out={};
    if(!value||typeof value!=='object'||Array.isArray(value))return out;
    for(const [rawKey,rawValue] of Object.entries(value).slice(0,24)){
      const key=cleanText(rawKey,80);
      if(!key||key==='__proto__'||key==='constructor'||key==='prototype')continue;
      out[key]=safeStringArray(rawValue,24);
    }
    return out;
  }
  function safeEventData(ev) {
    const data={};
    const strings=['subtype','target','actualTarget','saved','poisoned','actualPoisoned','result','role','roleName','cause','team','from','to','knight','hunter','wolfking','exploder','reporter','requester','ability','source','reason','custom','gift','shooterRole'];
    const booleans=['reflected','blocked','empty','crossTeam','passed'];
    const arrays=['targets','lovers','names','abstains','technicalAbstains','guiltyVoters','innocentVoters','technicalVoters'];
    strings.forEach(key=>{if(ev?.[key]!=null){const value=cleanText(ev[key],160);if(value)data[key]=value;}});
    booleans.forEach(key=>{if(typeof ev?.[key]==='boolean')data[key]=ev[key];});
    arrays.forEach(key=>{const value=safeStringArray(ev?.[key]);if(value.length)data[key]=value;});
    for(const key of ['votes','voters']){const value=safeNameMap(ev?.[key]);if(Object.keys(value).length)data[key]=value;}
    return data;
  }
  function formatEvent(ev) {
    if (!ev || !SAFE_EVENT_TYPES.has(ev.type)) return '';
    if (ev.type === 'system') {
      const text = cleanText(ev.text, 4000);
      if (/HTTP\s*\d+|max_tokens|reasoning_effort|thinking模型|API(?:请求|调用|错误|失败)/i.test(text)) return '';
      return text;
    }
    if (ev.type === 'speech') return cleanText(ev.game || ev.text, 4000);
    try {
      if (ev.type === 'death' && typeof _formatPublicDeathCause === 'function') return cleanText(`${ev.name || ''} — ${_formatPublicDeathCause(ev,{compact:false,hiddenNight:false,canSeePrivateNight:true})}`);
      if (ev.type === 'vote' && typeof _formatPublicVoteEvent === 'function') return cleanText(_formatPublicVoteEvent(ev));
      if (ev.type === 'duel' && typeof _formatPublicDuelEvent === 'function') return cleanText(_formatPublicDuelEvent(ev));
      if (ev.type === 'shoot' && typeof _formatPublicShootEvent === 'function') return cleanText(_formatPublicShootEvent(ev));
      if (ev.type === 'bite' && typeof _formatPublicBiteEvent === 'function') return cleanText(_formatPublicBiteEvent(ev));
      if (ev.type === 'whitewolf_explode' && typeof _formatPublicWhitewolfExplodeEvent === 'function') return cleanText(_formatPublicWhitewolfExplodeEvent(ev));
      if (ev.type === 'trial' && typeof _formatPublicTrialEvent === 'function') return cleanText(_formatPublicTrialEvent(ev));
      if (ev.type === 'sheriff_transfer' && typeof _formatPublicSheriffTransfer === 'function') return cleanText(_formatPublicSheriffTransfer(ev));
      if (/^(foolImmune|reprieve|skillConsumed)$/.test(ev.type) && typeof _formatPublicRevealEvent === 'function') return cleanText(_formatPublicRevealEvent(ev));
      if (ev.type === 'night_action') {
        const custom = typeof _formatCustomNightAction === 'function' ? _formatCustomNightAction(ev) : '';
        return cleanText(custom || `${ev.name ? ev.name + ' · ' : ''}${ev.role || (EN ? 'Night action' : '夜间行动')} → ${ev.target ?? ev.saved ?? ev.poisoned ?? (EN ? 'None' : '无')}`);
      }
    } catch (_) {}
    if (ev.type === 'speak_order') return cleanText(`${ev.title || (EN ? 'Speaking order' : '发言顺序')}：${Array.isArray(ev.names) ? ev.names.join(' → ') : ''}`);
    if (ev.type === 'spectator') return cleanText(`${ev.name || (EN ? 'Spectator' : '观众')}：${ev.text || ''}`);
    return cleanText(ev.text || ev.game || `${ev.name || ''} ${ev.type}`, 4000);
  }

  function buildSnapshot(state, records, configs, modeConfigs) {
    const players = Array.isArray(state?.players) ? state.players.slice(0, 24).map((p, index) => {
      const cfg = configs && configs[p.id] ? configs[p.id] : {};
      return {
        id:Number.isInteger(p.id) ? p.id : index,
        name:cleanText(p.name || `P${index + 1}`, 60),
        role:{id:cleanText(p.role?.id, 40), name:roleName(p.role), team:cleanText(p.role?.team, 16)},
        model:cleanText(cfg.model, 60),
        alive:!!p.alive,
        deathRound:Number(p.deathRound || 0),
        deathCause:cleanText(p.deathCause, 40)
      };
    }) : [];
    const events = [];
    let inferredRound=0,inferredPhase='opening';
    for (const ev of (Array.isArray(records) ? records : [])) {
      if (events.length >= MAX_EVENTS || !SAFE_EVENT_TYPES.has(ev?.type)) break;
      const text = formatEvent(ev);
      if (!text) continue;
      const marker=text.match(/第\s*(\d+)\s*(夜|天)/);
      if(marker){inferredRound=Number(marker[1]);inferredPhase=marker[2]==='夜'?'night':'day';}
      const eventRound=Math.max(0,Number(ev.round||inferredRound||0));
      let eventPhase=cleanText(ev.phase,20)||inferredPhase;
      if(ev.type==='night_action')eventPhase='night';
      else if(ev.type==='vote'&&/sheriff/i.test(ev.subtype||''))eventPhase='sheriff';
      else if(ev.type==='vote')eventPhase='vote';
      else if(ev.type==='speech'&&eventPhase!=='sheriff')eventPhase='speech';
      inferredRound=eventRound||inferredRound;inferredPhase=eventPhase||inferredPhase;
      events.push({
        type:ev.type,
        name:cleanText(ev.name, 60),
        label:cleanText(ev.label, 50),
        round:eventRound,
        phase:eventPhase,
        text,
        data:safeEventData(ev)
      });
    }
    const modeId = cleanText(state?.mode, 40);
    const snapshot = {
      version:2,
      match_id:cleanText(state?._matchUid || state?.gameId, 100),
      mode_id:modeId,
      mode_name:cleanText(modeConfigs?.[modeId]?.name || modeId || (EN ? 'Custom' : '自定义'), 80),
      winner:winnerLabel(state?._winType),
      rounds:Math.max(0, Number(state?.round || 0)),
      sheriff:Number.isInteger(state?.sheriff) ? state.sheriff : null,
      players,
      events
    };
    return snapshot;
  }

  function currentSnapshot() {
    if (typeof S === 'undefined' || !S?.gameOver || !Array.isArray(S.players)) throw new Error(copy.endedOnly);
    if (typeof blindReviewOn === 'function' && blindReviewOn()) throw new Error(copy.blindBlocked);
    const snapshot = buildSnapshot(
      S,
      typeof gameRecord !== 'undefined' ? gameRecord : [],
      typeof playerConfigs !== 'undefined' ? playerConfigs : {},
      typeof MODE_CONFIGS !== 'undefined' ? MODE_CONFIGS : {}
    );
    if (bytes(snapshot) > MAX_SNAPSHOT_BYTES) throw new Error(copy.tooLarge);
    return snapshot;
  }

  function injectStyles() {
    if (byId('community-match-styles')) return;
    const style = document.createElement('style');
    style.id = 'community-match-styles';
    style.textContent = `
      .cm-overlay{position:fixed;inset:0;z-index:1180;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(3,3,10,.84);backdrop-filter:blur(12px)}
      .cm-overlay.show{display:flex}.cm-panel{width:min(920px,96vw);max-height:94vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(213,174,103,.38);border-radius:16px;background:linear-gradient(160deg,rgba(20,17,31,.98),rgba(8,9,18,.99));box-shadow:0 24px 90px rgba(0,0,0,.65),0 0 40px rgba(119,77,154,.15);transition:width .25s ease}.cm-panel.theater-mode{width:min(1220px,98vw)}
      .cm-head{display:flex;align-items:center;gap:10px;padding:15px 17px;border-bottom:1px solid rgba(213,174,103,.16)}.cm-head h2{margin:0;flex:1;color:#e0c98d;font-size:1.05rem;letter-spacing:.12em}.cm-btn{width:auto!important;padding:7px 12px!important;border:1px solid rgba(213,174,103,.26)!important;border-radius:8px!important;background:rgba(213,174,103,.07)!important;color:#cfc1a1!important;cursor:pointer}.cm-btn.primary{border-color:#b99654!important;color:#ecd38e!important;background:rgba(185,150,84,.15)!important}.cm-btn.danger{border-color:rgba(190,78,94,.45)!important;color:#dc8b98!important;background:rgba(190,78,94,.1)!important}
      .cm-tools{display:flex;gap:8px;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.06)}.cm-tools input{flex:1;min-width:0}.cm-tabs{display:flex;gap:6px}.cm-tab.active{border-color:#b99654!important;color:#ecd38e!important}.cm-status{padding:8px 17px;min-height:34px;color:#8f897d;font-size:.74rem}.cm-status.bad{color:#de8f93}
      .cm-list{padding:0 16px 18px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}.cm-card{display:flex;flex-direction:column;gap:7px;padding:13px;border:1px solid rgba(199,169,111,.16);border-radius:11px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(89,67,116,.035))}.cm-card h3{margin:0;color:#e1d6c4;font-size:.92rem}.cm-meta{color:#8c8398;font-size:.69rem;line-height:1.5}.cm-summary{color:#b9b0a7;font-size:.76rem;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.cm-roles{display:flex;flex-wrap:wrap;gap:4px}.cm-chip{padding:2px 6px;border:1px solid rgba(141,118,174,.24);border-radius:999px;color:#aaa0bc;font-size:.63rem}.cm-actions{display:flex;gap:6px;margin-top:auto;padding-top:4px}
      .cm-detail{display:none;padding:0 17px 18px;overflow:auto;scrollbar-color:#5b4965 #0b0a13}.cm-detail.show{display:block}.cm-detail>.cm-btn{margin:0 0 9px}.cm-theater{position:relative;isolation:isolate;overflow:hidden;height:min(740px,calc(94vh - 115px));min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid rgba(213,174,103,.24);border-radius:16px;background:#090913}.cm-theater::before{content:"";position:absolute;inset:0;z-index:-3;background:linear-gradient(90deg,rgba(7,6,14,.98),rgba(10,8,18,.76) 32%,rgba(10,8,18,.7) 68%,rgba(7,6,14,.98)),url('${ASSET_ROOT}icons/lobby/gothic-lobby.webp') center/cover;filter:saturate(.72)}.cm-theater::after{content:"";position:absolute;inset:0;z-index:-2;background:radial-gradient(circle at 50% 40%,transparent 0 18%,rgba(3,3,9,.52) 65%,rgba(2,2,7,.92) 100%);pointer-events:none}.cm-theater-head{display:flex;align-items:flex-start;gap:16px;padding:18px 22px 15px;border-bottom:1px solid rgba(220,184,112,.16);background:linear-gradient(180deg,rgba(8,7,15,.78),rgba(8,7,15,.32))}.cm-theater-title{min-width:0;flex:1}.cm-theater-kicker{color:#a98b59;font-size:.62rem;letter-spacing:.28em;text-transform:uppercase}.cm-detail-title{color:#f0d89b;margin:5px 0 6px;font-family:Georgia,'Noto Serif SC',serif;font-size:1.3rem;letter-spacing:.05em}.cm-theater-summary{max-width:720px;color:#aaa1ab;font-size:.72rem;line-height:1.55;white-space:pre-wrap}.cm-theater-result{flex:0 0 auto;padding:9px 13px;border:1px solid rgba(219,184,107,.34);border-radius:10px;background:rgba(194,151,78,.1);color:#e7ca87;text-align:right;font-size:.72rem}.cm-theater-grid{display:grid;grid-template-columns:210px minmax(0,1fr) 180px;min-height:0}.cm-seat-rail,.cm-chapters{padding:14px 12px;background:rgba(5,5,12,.54);overflow:auto;scrollbar-width:thin;scrollbar-color:#4f405a transparent}.cm-seat-rail{border-right:1px solid rgba(255,255,255,.07)}.cm-chapters{border-left:1px solid rgba(255,255,255,.07)}.cm-rail-title{margin:0 0 9px;color:#9d8ba1;font-size:.61rem;letter-spacing:.16em;text-transform:uppercase}.cm-roster{display:grid;grid-template-columns:1fr;gap:6px}.cm-player{position:relative;overflow:hidden;min-height:48px;padding:7px 8px 7px 53px;border:1px solid rgba(255,255,255,.09);border-radius:8px;background:linear-gradient(90deg,rgba(22,19,31,.9),rgba(10,10,18,.88));transition:.2s}.cm-player::before{content:"";position:absolute;inset:0 auto 0 0;width:44px;background:var(--portrait) center/cover no-repeat;filter:saturate(.72);opacity:.82}.cm-player.active{border-color:rgba(221,181,101,.72);box-shadow:0 0 20px rgba(190,139,62,.12);transform:translateX(2px)}.cm-player.dead{opacity:.48;filter:grayscale(.7)}.cm-player strong{display:block;color:#ddd2d9;font-size:.69rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cm-player span{display:block;color:#887f8f;font-size:.59rem;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cm-stage{position:relative;display:flex;align-items:stretch;justify-content:center;min-width:0;min-height:0;overflow:hidden}.cm-stage-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.54;filter:saturate(.76) contrast(1.08);transition:opacity .28s ease,transform 5s linear;transform:scale(1.02)}.cm-stage.is-playing .cm-stage-art{transform:scale(1.08)}.cm-stage-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,6,13,.15),rgba(7,6,13,.58) 54%,rgba(6,5,12,.96)),linear-gradient(90deg,rgba(7,6,13,.5),transparent 35%,transparent 65%,rgba(7,6,13,.5))}.cm-scene{position:relative;z-index:1;align-self:flex-end;width:min(760px,92%);margin:0 auto 20px;padding:20px 24px;border-top:1px solid rgba(231,194,118,.42);background:linear-gradient(180deg,rgba(8,7,15,.08),rgba(8,7,15,.74) 24%,rgba(8,7,15,.92));text-shadow:0 2px 6px #000}.cm-scene-meta{display:flex;gap:8px;align-items:center;color:#b99d68;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase}.cm-scene-name{margin:8px 0 6px;color:#f1e0c8;font-family:Georgia,'Noto Serif SC',serif;font-size:1.2rem}.cm-scene-text{max-height:145px;overflow:auto;color:#e0d9df;font-size:.86rem;line-height:1.68;white-space:pre-wrap;overflow-wrap:anywhere}.cm-chapter{display:block;width:100%;margin:0 0 5px;padding:7px 8px;border:1px solid transparent;border-radius:7px;background:transparent;color:#807887;text-align:left;font-size:.61rem;cursor:pointer}.cm-chapter:hover{background:rgba(255,255,255,.035)}.cm-chapter.active{border-color:rgba(190,151,82,.3);background:rgba(190,151,82,.1);color:#dfc986}.cm-controls{display:grid;grid-template-columns:auto minmax(120px,1fr) auto;gap:12px;align-items:center;padding:10px 16px 12px;border-top:1px solid rgba(255,255,255,.07);background:rgba(5,5,12,.76)}.cm-control-buttons{display:flex;gap:6px}.cm-progress-wrap{min-width:0}.cm-progress{width:100%;accent-color:#b28c4d;cursor:pointer}.cm-counter{color:#8d8391;font-size:.63rem;text-align:center;margin-top:3px}.cm-controls-label{color:#b7a987;font-size:.64rem;white-space:nowrap}.cm-transcript{margin-top:12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.018)}.cm-transcript summary{padding:11px 13px;color:#b8a787;font-size:.7rem;cursor:pointer}.cm-timeline{max-height:360px;overflow:auto;padding:0 11px 11px;display:flex;flex-direction:column;gap:5px}.cm-event{padding:7px 9px;border-left:2px solid rgba(143,121,180,.42);background:rgba(255,255,255,.027);border-radius:4px;color:#aaa3ae;font-size:.68rem;line-height:1.55;white-space:pre-wrap;cursor:pointer}.cm-event.current{border-left-color:#d2aa60;background:rgba(210,170,96,.09);color:#e0d4bd}.cm-event-name{color:#d8c2d0;font-weight:700;margin-right:7px}
      .cm-observer{position:relative;isolation:isolate;overflow:hidden;min-height:650px;height:min(780px,calc(94vh - 115px));display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;border:1px solid rgba(213,174,103,.24);border-radius:16px;background:#090913}.cm-observer::before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,rgba(7,6,14,.985),rgba(12,9,20,.93) 48%,rgba(7,6,14,.985)),url('${ASSET_ROOT}icons/lobby/gothic-lobby.webp') center/cover;filter:saturate(.55)}.cm-observer-head{display:flex;align-items:flex-start;gap:18px;padding:16px 20px 13px;border-bottom:1px solid rgba(220,184,112,.16)}.cm-observer-heading{min-width:0;flex:1}.cm-observer-kicker{color:#b4955e;font-size:.61rem;letter-spacing:.24em}.cm-observer-result{flex:0 0 auto;min-width:110px;padding:8px 12px;border:1px solid rgba(219,184,107,.34);border-radius:9px;background:rgba(194,151,78,.1);color:#e7ca87;text-align:center;font-size:.71rem;white-space:pre-line}.cm-phase-nav{display:flex;gap:6px;overflow-x:auto;padding:8px 11px;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(4,4,11,.6);scrollbar-width:thin}.cm-phase-tab{flex:0 0 auto;padding:6px 10px;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:rgba(255,255,255,.025);color:#817889;font-size:.63rem;cursor:pointer}.cm-phase-tab.active{border-color:rgba(213,174,103,.48);background:rgba(186,142,72,.12);color:#e3ca91}.cm-observer-grid{display:grid;grid-template-columns:230px minmax(360px,1fr) 280px;min-height:0}.cm-state-pane,.cm-resolution-pane{padding:13px;overflow:auto;background:rgba(5,5,12,.5);scrollbar-width:thin;scrollbar-color:#4f405a transparent}.cm-state-pane{border-right:1px solid rgba(255,255,255,.07)}.cm-resolution-pane{border-left:1px solid rgba(255,255,255,.07)}.cm-pane-title{margin:0 0 9px;color:#a99aaf;font-size:.62rem;letter-spacing:.15em}.cm-state-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:10px}.cm-stat{padding:7px 8px;border:1px solid rgba(255,255,255,.075);border-radius:7px;background:rgba(255,255,255,.025)}.cm-stat b{display:block;color:#e2d5c4;font-size:.83rem}.cm-stat span{display:block;margin-top:2px;color:#817886;font-size:.57rem}.cm-board-roster{display:grid;gap:5px}.cm-board-player{position:relative;overflow:hidden;min-height:45px;padding:6px 7px 6px 49px;border:1px solid rgba(255,255,255,.08);border-left:2px solid #71677c;border-radius:7px;background:rgba(17,15,25,.86)}.cm-board-player::before{content:"";position:absolute;inset:0 auto 0 0;width:41px;background:var(--portrait) center/cover no-repeat;opacity:.72}.cm-board-player.team-wolf{border-left-color:#b34c5c}.cm-board-player.team-good{border-left-color:#5f87b6}.cm-board-player.team-third{border-left-color:#9a73bd}.cm-board-player.dead{opacity:.42;filter:grayscale(.75)}.cm-board-player.dead::after{content:"OUT";position:absolute;right:6px;top:5px;color:#b06f76;font-size:.48rem;letter-spacing:.12em}.cm-board-player strong,.cm-board-player span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cm-board-player strong{color:#ded3da;font-size:.66rem}.cm-board-player span{margin-top:3px;color:#8c8291;font-size:.57rem}.cm-board-player.sheriff{box-shadow:inset 0 0 0 1px rgba(220,177,88,.35)}.cm-board-player.sheriff strong::after{content:" · 警长";color:#d6ac5a}.cm-phase-feed{min-width:0;overflow:auto;padding:15px 17px;scrollbar-width:thin;scrollbar-color:#4f405a transparent}.cm-phase-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(213,174,103,.18)}.cm-phase-heading h3{margin:0;color:#ead8af;font-family:Georgia,'Noto Serif SC',serif;font-size:1.08rem}.cm-phase-heading span{color:#827a88;font-size:.62rem}.cm-phase-events{display:flex;flex-direction:column;gap:8px}.cm-phase-event{position:relative;overflow:hidden;min-height:42px;padding:10px 12px 10px 15px;border-left:2px solid rgba(132,111,158,.6);border-radius:5px;background:rgba(255,255,255,.028)}.cm-phase-event.key{padding-right:88px;border-left-color:#c59a55;background:linear-gradient(90deg,rgba(197,154,85,.1),rgba(255,255,255,.025))}.cm-phase-event img{position:absolute;right:0;top:0;width:80px;height:100%;object-fit:cover;opacity:.36;mask-image:linear-gradient(90deg,transparent,#000 45%)}.cm-event-meta{position:relative;z-index:1;margin-bottom:4px;color:#c5aa77;font-size:.59rem;letter-spacing:.06em}.cm-event-copy{position:relative;z-index:1;color:#c7c0c8;font-size:.72rem;line-height:1.58;white-space:pre-wrap;overflow-wrap:anywhere}.cm-event-copy.speech{color:#ddd4dc;font-size:.76rem}.cm-resolution-section{margin-bottom:12px;padding:9px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:rgba(255,255,255,.022)}.cm-resolution-title{margin-bottom:7px;color:#c5aa78;font-size:.61rem;letter-spacing:.08em}.cm-resolution-empty{color:#756e79;font-size:.63rem;line-height:1.5}.cm-resolution-item{padding:5px 0;border-top:1px solid rgba(255,255,255,.055);color:#b3abb6;font-size:.64rem;line-height:1.48;white-space:pre-wrap;overflow-wrap:anywhere}.cm-resolution-item:first-of-type{border-top:0}.cm-vote-row{margin-top:7px}.cm-vote-row-head{display:flex;justify-content:space-between;gap:8px;color:#d3c3cb;font-size:.63rem}.cm-vote-bar{height:3px;margin:4px 0;background:rgba(255,255,255,.06);border-radius:9px;overflow:hidden}.cm-vote-bar i{display:block;height:100%;background:linear-gradient(90deg,#725c91,#c09357)}.cm-vote-voters{color:#77707d;font-size:.56rem;line-height:1.4}.cm-legacy-note{margin-bottom:10px;padding:8px 9px;border:1px solid rgba(190,150,83,.18);border-radius:7px;background:rgba(190,150,83,.055);color:#a99169;font-size:.6rem;line-height:1.45}.cm-observer-foot{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid rgba(255,255,255,.07);background:rgba(4,4,10,.76)}.cm-phase-counter{text-align:center;color:#908694;font-size:.63rem}.cm-form{padding:15px 17px 18px;overflow:auto}.cm-form label{display:block;color:#a79bac;font-size:.74rem;margin:8px 0 4px}.cm-form input,.cm-form textarea{width:100%;box-sizing:border-box}.cm-consent{display:flex!important;align-items:flex-start;gap:7px;line-height:1.55;margin:12px 0!important}.cm-consent input{width:auto;flex:0 0 auto;margin-top:3px}.cm-submit-note{font-size:.68rem;color:#82798a;line-height:1.5}.cm-form-actions{display:flex;gap:8px;margin-top:12px}
      @media(max-width:820px){.cm-theater{height:calc(94vh - 110px)}.cm-theater-grid{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.cm-seat-rail{border:0;border-bottom:1px solid rgba(255,255,255,.07);padding:8px}.cm-roster{grid-template-columns:repeat(4,minmax(110px,1fr));overflow:auto}.cm-player{min-height:40px;padding-left:46px}.cm-chapters{display:none}.cm-theater-head{padding:12px 14px}.cm-theater-result{display:none}}
      @media(max-width:1000px){.cm-observer-grid{grid-template-columns:200px minmax(320px,1fr) 235px}.cm-resolution-pane{padding:10px}.cm-state-pane{padding:10px}}
      @media(max-width:820px){.cm-observer{height:calc(94vh - 110px)}.cm-observer-grid{display:block;overflow:auto;overflow-x:hidden}.cm-state-pane,.cm-resolution-pane{min-width:0}.cm-state-pane{overflow:visible;border:0;border-bottom:1px solid rgba(255,255,255,.07)}.cm-state-stats{grid-template-columns:repeat(4,minmax(0,1fr))}.cm-board-roster{display:flex;max-width:100%;overflow-x:auto}.cm-board-player{flex:0 0 125px}.cm-phase-feed{overflow:visible}.cm-resolution-pane{overflow:visible;border:0;border-top:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cm-resolution-pane>.cm-pane-title{grid-column:1/-1}.cm-resolution-section{min-width:0;margin:0}.cm-observer-head{padding:11px 13px}.cm-observer-result{display:none}}
      @media(max-width:620px){.cm-overlay{padding:4px}.cm-panel,.cm-panel.theater-mode{width:100%;max-height:98vh;border-radius:11px}.cm-head{padding:10px}.cm-tools{flex-wrap:wrap;padding:9px 12px}.cm-tools input{flex-basis:100%}.cm-list{padding:0 9px 12px;grid-template-columns:1fr}.cm-head h2{font-size:.88rem}.cm-detail{padding:0 5px 7px}.cm-observer{height:calc(98vh - 102px);min-height:0;border-radius:9px}.cm-observer-head{padding:8px 10px}.cm-detail-title{font-size:.96rem}.cm-theater-summary{display:none}.cm-phase-nav{padding:6px}.cm-state-pane{padding:7px}.cm-state-stats{gap:4px}.cm-stat{padding:5px 6px}.cm-board-player{flex-basis:116px}.cm-phase-feed{padding:11px 9px}.cm-phase-heading h3{font-size:.92rem}.cm-resolution-pane{padding:8px;grid-template-columns:1fr}.cm-observer-foot{grid-template-columns:1fr 1fr}.cm-phase-counter{grid-column:1/-1;grid-row:1}.cm-observer-foot .cm-btn{width:100%!important}}`;
    style.textContent += `.cm-phase-nav::-webkit-scrollbar,.cm-observer-grid::-webkit-scrollbar,.cm-board-roster::-webkit-scrollbar{width:5px;height:5px}.cm-phase-nav::-webkit-scrollbar-track,.cm-observer-grid::-webkit-scrollbar-track,.cm-board-roster::-webkit-scrollbar-track{background:transparent}.cm-phase-nav::-webkit-scrollbar-thumb,.cm-observer-grid::-webkit-scrollbar-thumb,.cm-board-roster::-webkit-scrollbar-thumb{border-radius:9px;background:#4a3b54}`;
    document.head.appendChild(style);
  }

  function makeButton(text, className = '') {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `cm-btn ${className}`.trim(); button.textContent = text;
    return button;
  }
  function createUi() {
    if (byId('cm-gallery')) return;
    injectStyles();
    const gallery = document.createElement('div'); gallery.id='cm-gallery'; gallery.className='cm-overlay';
    gallery.innerHTML = `<section class="cm-panel" role="dialog" aria-modal="true"><header class="cm-head"><h2>${copy.gallery}</h2><button type="button" class="cm-btn" id="cm-refresh">${copy.refresh}</button><button type="button" class="cm-btn" id="cm-close">${copy.close}</button></header><div id="cm-list-view"><div class="cm-tools"><input id="cm-search" maxlength="80" placeholder="${copy.search}"><div class="cm-tabs"><button type="button" class="cm-btn cm-tab active" id="cm-public-tab">${copy.publicTab}</button><button type="button" class="cm-btn cm-tab" id="cm-review-tab" hidden>${copy.reviewTab}</button></div></div><div class="cm-status" id="cm-status" role="status"></div><div class="cm-list" id="cm-list"></div></div><div class="cm-detail" id="cm-detail"><button type="button" class="cm-btn" id="cm-back">${copy.back}</button><div id="cm-detail-body"></div></div></section>`;
    document.body.appendChild(gallery);

    const submit = document.createElement('div'); submit.id='cm-submit'; submit.className='cm-overlay';
    submit.innerHTML = `<section class="cm-panel" style="max-width:560px" role="dialog" aria-modal="true"><header class="cm-head"><h2>${copy.submit}</h2><button type="button" class="cm-btn" id="cm-submit-close">${copy.close}</button></header><div class="cm-form"><label for="cm-title">${copy.title}</label><input id="cm-title" maxlength="80"><label for="cm-author">${copy.author}</label><input id="cm-author" maxlength="40"><label for="cm-summary">${copy.summary}</label><textarea id="cm-summary" maxlength="600" rows="5"></textarea><label class="cm-consent"><input type="checkbox" id="cm-consent"><span>${copy.consent}</span></label><div class="cm-submit-note">${EN ? 'New submissions are private until an administrator publishes them.' : '新投稿在管理员审核发布前不会被其他玩家看到。'}</div><div class="cm-status" id="cm-submit-status" role="status"></div><div class="cm-form-actions"><button type="button" class="cm-btn primary" id="cm-send">${copy.send}</button><button type="button" class="cm-btn" id="cm-submit-cancel">${copy.close}</button></div></div></section>`;
    document.body.appendChild(submit);

    byId('cm-close').onclick=closeGallery; byId('cm-submit-close').onclick=closeSubmit; byId('cm-submit-cancel').onclick=closeSubmit;
    byId('cm-refresh').onclick=loadCurrent; byId('cm-public-tab').onclick=()=>switchMode('public'); byId('cm-review-tab').onclick=()=>switchMode('review');
    byId('cm-back').onclick=showList; byId('cm-search').addEventListener('input',renderList); byId('cm-send').onclick=submitMatch;
    gallery.addEventListener('click',event=>{if(event.target===gallery)closeGallery();}); submit.addEventListener('click',event=>{if(event.target===submit)closeSubmit();});
  }

  async function checkAdmin() {
    isAdmin = false;
    const c = client(), user = currentUser();
    if (c && user) {
      const {data,error} = await c.rpc('is_feedback_admin');
      isAdmin = !error && data === true;
    }
    const tab=byId('cm-review-tab'); if(tab)tab.hidden=!isAdmin;
    if(!isAdmin && currentMode==='review')currentMode='public';
    return isAdmin;
  }
  async function loadPublic() {
    const c=await waitForClient(); if(!c)throw new Error(copy.unavailable);
    const {data,error}=await c.from(TABLE).select('id,title,author_name,summary,mode_name,winner,rounds,player_count,roles,status,created_at,published_at').eq('status','published').order('published_at',{ascending:false}).limit(60);
    if(error)throw error; publicRows=Array.isArray(data)?data:[];
  }
  async function loadReview() {
    if(!isAdmin)throw new Error(copy.adminNeeded);
    const {data,error}=await client().from(TABLE).select('id,title,author_name,summary,mode_name,winner,rounds,player_count,roles,status,created_at,published_at').eq('status','pending').order('created_at',{ascending:true}).limit(100);
    if(error)throw error; reviewRows=Array.isArray(data)?data:[];
  }
  async function loadCurrent() {
    status(copy.loading); byId('cm-list').replaceChildren();
    try { if(currentMode==='review')await loadReview();else await loadPublic(); renderList(); }
    catch(error){console.warn('[对局殿堂] 读取失败',error);status(copy.unavailable+' '+cleanText(error?.message,160),true);}
  }
  function switchMode(mode) {
    if(mode==='review'&&!isAdmin)return;
    currentMode=mode;
    byId('cm-public-tab').classList.toggle('active',mode==='public'); byId('cm-review-tab').classList.toggle('active',mode==='review');
    loadCurrent();
  }
  function appendLine(parent,text,className) { const node=document.createElement('div');node.className=className||'';node.textContent=text;parent.appendChild(node);return node; }
  function renderList() {
    const list=byId('cm-list'); if(!list)return; list.replaceChildren();
    const q=cleanText(byId('cm-search')?.value,80).toLowerCase();
    const source=(currentMode==='review'?reviewRows:publicRows).filter(row=>!q||[row.title,row.author_name,row.summary,row.mode_name,row.winner,...(row.roles||[])].join(' ').toLowerCase().includes(q));
    status(source.length ? `${source.length} ${EN?'matches':'局对局'}` : copy.empty);
    source.forEach(row=>{
      const card=document.createElement('article');card.className='cm-card';
      const title=document.createElement('h3');title.textContent=row.title||copy.gallery;card.appendChild(title);
      appendLine(card,`${row.mode_name||''} · ${row.player_count||0}${copy.players} · ${row.rounds||0}${copy.rounds} · ${copy.winner} ${winnerLabel(row.winner)}`,'cm-meta');
      appendLine(card,`${row.author_name|| (EN?'Anonymous':'匿名')} · ${new Date(row.published_at||row.created_at).toLocaleDateString()}`,'cm-meta');
      if(row.summary)appendLine(card,row.summary,'cm-summary');
      const roles=document.createElement('div');roles.className='cm-roles';(row.roles||[]).slice(0,24).forEach(role=>appendLine(roles,role,'cm-chip'));card.appendChild(roles);
      const actions=document.createElement('div');actions.className='cm-actions';const view=makeButton(copy.view,'primary');view.onclick=()=>openDetail(row.id);actions.appendChild(view);
      if(currentMode==='review'&&isAdmin){const approve=makeButton(copy.publish,'primary');approve.onclick=()=>moderate(row.id,'published');const reject=makeButton(copy.reject,'danger');reject.onclick=()=>moderate(row.id,'rejected');actions.append(approve,reject);}
      card.appendChild(actions);list.appendChild(card);
    });
  }
  async function openDetail(id) {
    status(copy.loading);
    try {
      const {data,error}=await client().from(TABLE).select('id,title,author_name,summary,mode_name,winner,rounds,player_count,roles,status,created_at,published_at,replay_data').eq('id',id).maybeSingle();
      if(error||!data)throw error||new Error('not_found');
      renderDetail(data); byId('cm-list-view').style.display='none';byId('cm-detail').classList.add('show');byId('cm-gallery')?.querySelector('.cm-panel')?.classList.add('theater-mode');
    } catch(error){status(copy.unavailable+' '+cleanText(error?.message,160),true);}
  }
  function chapterKey(ev) { return `${Math.max(0,Number(ev?.round||0))}|${cleanText(ev?.phase,20)||ev?.type||'event'}`; }
  function sceneTitle(ev) {
    if(ev?.name)return `${ev.name}${ev.label?' · '+ev.label:''}`;
    const labels=EN
      ? {system:'System',death:'Death report',vote:'Vote result',night_action:'Night action',speak_order:'Speaking order'}
      : {system:'系统播报',death:'死亡战报',vote:'投票结果',night_action:'夜间行动',speak_order:'发言顺序'};
    return labels[ev?.type]||copy.event;
  }
  function buildChapters(events) {
    const chapters=[];
    (events||[]).forEach((event,eventIndex)=>{
      const key=chapterKey(event), previous=chapters[chapters.length-1];
      if(!previous||previous.key!==key){
        chapters.push({key,round:Math.max(0,Number(event?.round||0)),phase:cleanText(event?.phase,20)||event?.type||'event',start:eventIndex,end:eventIndex,events:[event]});
      }else{previous.end=eventIndex;previous.events.push(event);}
    });
    return chapters;
  }
  function chapterLabel(chapter) {
    const sample=chapter?.events?.[0]||{phase:chapter?.phase};
    const round=Math.max(0,Number(chapter?.round||0));
    return `${round?(EN?`Round ${round}`:`第 ${round} 回合`):(EN?'Opening':'开局')} · ${phaseLabel(sample)}`;
  }
  function nameKey(value){return cleanText(value,80).toLowerCase();}
  function isEmptyResult(value){return /^(?:|无|平票|none|tie|no sheriff|撕毁警徽)$/i.test(cleanText(value,80));}
  function teamBucket(team) {
    const value=cleanText(team,30).toLowerCase();
    if(/wolf|狼人|bad/.test(value))return 'wolf';
    if(/good|好人|villager/.test(value))return 'good';
    return 'third';
  }
  function deriveBoardState(snapshot,chapters,chapterIndex) {
    const players=Array.isArray(snapshot?.players)?snapshot.players:[];
    const alive=new Map(players.map(player=>[nameKey(player.name),true]));
    let sheriff='';
    const current=Math.max(0,Math.min(chapters.length-1,Number(chapterIndex)||0));
    const recordedDeaths=new Set(chapters.flatMap(chapter=>chapter.events||[]).filter(event=>event?.type==='death').map(event=>nameKey(event.name||event.data?.target)).filter(Boolean));
    for(let i=0;i<=current;i++){
      for(const event of chapters[i]?.events||[]){
        const data=event?.data||{};
        if(event?.type==='death'){
          const dead=nameKey(event.name||data.target);
          if(dead)alive.set(dead,false);
          if(dead&&dead===nameKey(sheriff))sheriff='';
        }
        if(event?.type==='vote'&&/sheriff/i.test(data.subtype||'')&&!isEmptyResult(data.result))sheriff=cleanText(data.result,80);
        if(event?.type==='sheriff_transfer')sheriff=isEmptyResult(data.to)?'':cleanText(data.to,80);
      }
    }
    const currentRound=Math.max(0,Number(chapters[current]?.round||0));
    players.forEach(player=>{
      const key=nameKey(player.name), deathRound=Math.max(0,Number(player.deathRound||0));
      if(!player.alive&&deathRound&&currentRound>=deathRound&&!recordedDeaths.has(key))alive.set(key,false);
    });
    if(!sheriff&&current===chapters.length-1&&Number.isInteger(snapshot?.sheriff)){
      sheriff=cleanText(players.find(player=>player.id===snapshot.sheriff)?.name,80);
    }
    const counts={alive:0,good:0,wolf:0,third:0};
    players.forEach(player=>{if(alive.get(nameKey(player.name))!==false){counts.alive++;counts[teamBucket(player.role?.team)]++;}});
    return {alive,sheriff,counts};
  }
  function addResolutionSection(parent,title,items,emptyText) {
    const section=document.createElement('section');section.className='cm-resolution-section';parent.appendChild(section);
    appendLine(section,title,'cm-resolution-title');
    if(!items.length)appendLine(section,emptyText,'cm-resolution-empty');
    else items.forEach(text=>appendLine(section,text,'cm-resolution-item'));
    return section;
  }
  function renderVoteSection(parent,voteEvents) {
    const section=document.createElement('section');section.className='cm-resolution-section';parent.appendChild(section);
    appendLine(section,EN?'Vote map':'本阶段票型','cm-resolution-title');
    if(!voteEvents.length){appendLine(section,EN?'No vote in this phase.':'本阶段没有投票。','cm-resolution-empty');return;}
    voteEvents.forEach(event=>{
      const data=event.data||{}, votes=data.votes&&typeof data.votes==='object'?data.votes:{};
      const entries=Object.entries(votes), max=Math.max(1,...entries.map(([,voters])=>Array.isArray(voters)?voters.length:0));
      if(!entries.length){appendLine(section,event.text,'cm-resolution-item');return;}
      entries.sort((a,b)=>(b[1]?.length||0)-(a[1]?.length||0)).forEach(([target,voters])=>{
        const row=document.createElement('div');row.className='cm-vote-row';section.appendChild(row);
        const head=document.createElement('div');head.className='cm-vote-row-head';row.appendChild(head);
        appendLine(head,target);appendLine(head,String(voters.length));
        const bar=document.createElement('div');bar.className='cm-vote-bar';const fill=document.createElement('i');fill.style.width=`${Math.max(4,voters.length/max*100)}%`;bar.appendChild(fill);row.appendChild(bar);
        appendLine(row,voters.join('、'),'cm-vote-voters');
      });
      const extras=[];
      if(data.abstains?.length)extras.push(`${EN?'Abstained':'弃票'}：${data.abstains.join('、')}`);
      if(data.technicalAbstains?.length)extras.push(`${EN?'No valid vote':'未有效投票'}：${data.technicalAbstains.join('、')}`);
      if(data.result)extras.push(`${EN?'Result':'结果'}：${data.result}`);
      extras.forEach(text=>appendLine(section,text,'cm-resolution-item'));
    });
  }
  function renderObserverState() {
    if(!observer||!observer.chapters.length)return;
    const index=Math.max(0,Math.min(observer.chapters.length-1,observer.index));
    observer.index=index;
    const chapter=observer.chapters[index], state=deriveBoardState(observer.snap,observer.chapters,index);
    observer.phaseButtons.forEach((button,buttonIndex)=>button.classList.toggle('active',buttonIndex===index));
    observer.previous.disabled=index===0;observer.next.disabled=index===observer.chapters.length-1;
    observer.counter.textContent=`${chapterLabel(chapter)} · ${index+1}/${observer.chapters.length}`;

    observer.statePane.replaceChildren();
    appendLine(observer.statePane,EN?'Board state after this phase':'本阶段结束后的场上局势','cm-pane-title');
    const stats=document.createElement('div');stats.className='cm-state-stats';observer.statePane.appendChild(stats);
    const statRows=EN
      ? [[`${state.counts.alive}/${observer.snap.players?.length||0}`,'Alive'],[state.counts.good,'Good'],[state.counts.wolf,'Wolves'],[state.sheriff||'—','Sheriff']]
      : [[`${state.counts.alive}/${observer.snap.players?.length||0}`,'存活'],[state.counts.good,'好人存活'],[state.counts.wolf,'狼人存活'],[state.sheriff||'无','当前警长']];
    if(state.counts.third)statRows.splice(3,0,[state.counts.third,EN?'Third party':'第三阵营']);
    statRows.forEach(([value,label])=>{const node=document.createElement('div');node.className='cm-stat';const strong=document.createElement('b');strong.textContent=String(value);const caption=document.createElement('span');caption.textContent=label;node.append(strong,caption);stats.appendChild(node);});
    const roster=document.createElement('div');roster.className='cm-board-roster';observer.statePane.appendChild(roster);
    (observer.snap.players||[]).forEach((player,playerIndex)=>{
      const card=document.createElement('div');const bucket=teamBucket(player.role?.team);card.className=`cm-board-player team-${bucket}`;
      const alive=state.alive.get(nameKey(player.name))!==false;card.classList.toggle('dead',!alive);card.classList.toggle('sheriff',!!state.sheriff&&nameKey(state.sheriff)===nameKey(player.name));
      const portrait=rolePortrait(player.role?.id)||`${ASSET_ROOT}icons/lobby/gothic-lobby.webp`;card.style.setProperty('--portrait',`url("${portrait}")`);
      const who=document.createElement('strong');who.textContent=`P${Number(player.id??playerIndex)+1} · ${player.name||''}`;card.appendChild(who);
      const role=document.createElement('span');role.textContent=`${roleName(player.role)} · ${bucket==='wolf'?(EN?'Wolf':'狼人阵营'):bucket==='good'?(EN?'Good':'好人阵营'):(EN?'Third':'第三阵营')}`;card.appendChild(role);roster.appendChild(card);
    });

    observer.feed.replaceChildren();
    const heading=document.createElement('div');heading.className='cm-phase-heading';observer.feed.appendChild(heading);
    const h3=document.createElement('h3');h3.textContent=chapterLabel(chapter);const eventCount=document.createElement('span');eventCount.textContent=`${chapter.events.length} ${EN?'events':'条记录'}`;heading.append(h3,eventCount);
    if(Number(observer.snap.version||1)<2)appendLine(observer.feed,EN?'This is an older replay. Its transcript is complete, but some vote and action fields were not stored.':'这是旧版投稿：发言与播报仍可阅读，但当时没有保存完整票型和技能目标。','cm-legacy-note');
    const eventList=document.createElement('div');eventList.className='cm-phase-events';observer.feed.appendChild(eventList);
    chapter.events.forEach(event=>{
      const key=/^(?:night_action|death|vote|shoot|bite|duel|whitewolf_explode|sheriff_transfer)$/.test(event.type);
      const card=document.createElement('article');card.className=`cm-phase-event${key?' key':''}`;eventList.appendChild(card);
      appendLine(card,`${sceneTitle(event)} · ${phaseLabel(event)}`,'cm-event-meta');
      appendLine(card,event.text||copy.noEvents,`cm-event-copy${event.type==='speech'?' speech':''}`);
      if(key){const art=document.createElement('img');art.loading='lazy';art.alt='';art.src=eventArt(event,observer.snap);art.onerror=()=>art.remove();card.appendChild(art);}
    });

    observer.resolution.replaceChildren();
    appendLine(observer.resolution,EN?'Phase resolution':'本阶段结算','cm-pane-title');
    const deaths=chapter.events.filter(event=>event.type==='death').map(event=>event.text);
    const actions=chapter.events.filter(event=>event.type==='night_action').map(event=>event.text);
    const sheriffChanges=chapter.events.filter(event=>event.type==='sheriff_transfer'||(event.type==='vote'&&/sheriff/i.test(event.data?.subtype||''))).map(event=>event.text);
    addResolutionSection(observer.resolution,EN?'Deaths':'死亡与出局',deaths,EN?'No deaths in this phase.':'本阶段无人出局。');
    if(actions.length||chapter.phase==='night')addResolutionSection(observer.resolution,EN?'Night actions':'夜间行动',actions,EN?'No stored night-action details.':'没有保存到夜间行动明细。');
    renderVoteSection(observer.resolution,chapter.events.filter(event=>event.type==='vote'));
    if(sheriffChanges.length||chapter.phase==='sheriff')addResolutionSection(observer.resolution,EN?'Sheriff changes':'警长变化',sheriffChanges,EN?'No sheriff change.':'本阶段警长未发生变化。');
  }
  function setObserverChapter(value) {
    if(!observer)return;
    observer.index=Math.max(0,Math.min(observer.chapters.length-1,Number(value)||0));
    renderObserverState();
  }
  function renderDetail(row) {
    const body=byId('cm-detail-body');body.replaceChildren();const snap=row.replay_data||{};
    const rawEvents=Array.isArray(snap.events)?snap.events:[];
    const events=rawEvents.length?rawEvents:[{type:'system',name:'',label:'',round:0,phase:'',text:copy.noEvents}];
    const chapters=buildChapters(events);
    const shell=document.createElement('section');shell.className='cm-observer';body.appendChild(shell);
    const head=document.createElement('header');head.className='cm-observer-head';shell.appendChild(head);
    const titleWrap=document.createElement('div');titleWrap.className='cm-observer-heading';head.appendChild(titleWrap);
    appendLine(titleWrap,copy.theater,'cm-observer-kicker');
    const title=document.createElement('h2');title.className='cm-detail-title';title.textContent=row.title||copy.gallery;titleWrap.appendChild(title);
    appendLine(titleWrap,`${row.mode_name||snap.mode_name||''} · ${row.player_count||snap.players?.length||0}${copy.players} · ${row.rounds||snap.rounds||0}${copy.rounds} · ${row.author_name||(EN?'Anonymous':'匿名投稿')}`,'cm-meta');
    if(row.summary)appendLine(titleWrap,row.summary,'cm-theater-summary');
    appendLine(head,`${copy.winner}\n${winnerLabel(row.winner||snap.winner)}`,'cm-observer-result');
    const phaseNav=document.createElement('nav');phaseNav.className='cm-phase-nav';phaseNav.setAttribute('aria-label',copy.chapters);shell.appendChild(phaseNav);
    const phaseButtons=chapters.map((chapter,index)=>{const button=document.createElement('button');button.type='button';button.className='cm-phase-tab';button.textContent=chapterLabel(chapter);button.onclick=()=>setObserverChapter(index);phaseNav.appendChild(button);return button;});
    const grid=document.createElement('div');grid.className='cm-observer-grid';shell.appendChild(grid);
    const statePane=document.createElement('aside');statePane.className='cm-state-pane';grid.appendChild(statePane);
    const feed=document.createElement('main');feed.className='cm-phase-feed';grid.appendChild(feed);
    const resolution=document.createElement('aside');resolution.className='cm-resolution-pane';grid.appendChild(resolution);
    const foot=document.createElement('footer');foot.className='cm-observer-foot';shell.appendChild(foot);
    const previous=makeButton(copy.previous);const next=makeButton(copy.next,'primary');const counter=appendLine(foot,'','cm-phase-counter');foot.prepend(previous);foot.appendChild(next);
    observer={row,snap,events,chapters,index:0,phaseButtons,statePane,feed,resolution,previous,next,counter};
    previous.onclick=()=>setObserverChapter(observer.index-1);next.onclick=()=>setObserverChapter(observer.index+1);
    renderObserverState();
  }
  function showList(){observer=null;byId('cm-detail').classList.remove('show');byId('cm-list-view').style.display='';byId('cm-detail-body').replaceChildren();byId('cm-gallery')?.querySelector('.cm-panel')?.classList.remove('theater-mode');}
  async function moderate(id,nextStatus){
    if(!isAdmin)return;
    status(nextStatus==='published'?(EN?'Publishing…':'正在发布…'):(EN?'Rejecting…':'正在驳回…'));
    const patch={status:nextStatus,updated_at:new Date().toISOString(),published_at:nextStatus==='published'?new Date().toISOString():null};
    const {error}=await client().from(TABLE).update(patch).eq('id',id);
    if(error){status(cleanText(error.message,180),true);return;}
    status(nextStatus==='published'?copy.approved:copy.rejected);await loadReview();renderList();
  }
  async function openGallery(){createUi();showList();byId('cm-gallery').classList.add('show');await checkAdmin();await loadCurrent();}
  function closeGallery(){byId('cm-gallery')?.classList.remove('show');showList();}
  function defaultTitle(snapshot){return `${snapshot.mode_name} · ${snapshot.players.length}${copy.players} · ${snapshot.rounds}${copy.rounds}`;}
  function openSubmit(){
    createUi();submissionStatus('');
    try{const snapshot=currentSnapshot();byId('cm-title').value=defaultTitle(snapshot);try{byId('cm-author').value=localStorage.getItem('wolf_community_author_v1')||'';}catch(_){byId('cm-author').value='';}byId('cm-consent').checked=false;const button=byId('cm-send');button.disabled=submittedMatchId===snapshot.match_id;button.textContent=button.disabled?copy.pending:copy.send;byId('cm-submit').classList.add('show');}
    catch(error){alert(error.message||copy.endedOnly);}
  }
  function closeSubmit(){byId('cm-submit')?.classList.remove('show');}
  async function submitMatch(){
    let snapshot;try{snapshot=currentSnapshot();}catch(error){submissionStatus(error.message,true);return;}
    const title=cleanText(byId('cm-title')?.value,80),author=cleanText(byId('cm-author')?.value,40),summary=cleanText(byId('cm-summary')?.value,600);
    if(!title||!byId('cm-consent')?.checked){submissionStatus(copy.fill,true);return;}
    if(submittedMatchId&&submittedMatchId===snapshot.match_id){submissionStatus(copy.sent);return;}
    const c=await waitForClient();if(!c){submissionStatus(copy.unavailable,true);return;}
    const button=byId('cm-send');button.disabled=true;submissionStatus(copy.sending);
    const user=currentUser();const payload={
      client_submission_id:randomUuid(),
      submitter_id:user?.id||null,title,author_name:author,summary,
      mode_id:snapshot.mode_id,mode_name:snapshot.mode_name,winner:snapshot.winner,
      rounds:snapshot.rounds,player_count:snapshot.players.length,roles:snapshot.players.map(p=>roleName(p.role)),
      replay_data:snapshot,client_created_at:new Date().toISOString(),status:'pending'
    };
    try{
      const {error}=await c.from(TABLE).insert(payload);if(error)throw error;
      try{localStorage.setItem('wolf_community_author_v1',author);}catch(_){}
      submittedMatchId=snapshot.match_id;submissionStatus(copy.sent);button.textContent=copy.pending;
    }catch(error){console.warn('[对局投稿] 上传失败',error);submissionStatus(copy.unavailable+' '+cleanText(error?.message,160),true);}
    finally{button.disabled=submittedMatchId===snapshot.match_id;}
  }
  function init(){
    if(initialized||!global.document)return;initialized=true;createUi();
    byId('community-gallery-open')?.addEventListener('click',openGallery);
    byId('pg-community-submit')?.addEventListener('click',openSubmit);
  }

  const api={init,openGallery,openSubmit,authChanged:checkAdmin,_test:{buildSnapshot,formatEvent,bytes,randomUuid,buildChapters,deriveBoardState,renderDetail,setObserverChapter,MAX_SNAPSHOT_BYTES}};
  global.CommunityMatches=api;
  if(global.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})(globalThis);
