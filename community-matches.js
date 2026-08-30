/* Community Match Gallery
 * Public browsing + moderated post-game submissions. Uploaded snapshots deliberately
 * exclude prompts, chain-of-thought, API configuration, memories and avatars.
 */
(function (global) {
  'use strict';

  const EN = /\/en(?:\/|$)/.test(String(global.location?.pathname || ''));
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
    roster:'Players', timeline:'Match timeline', winner:'Winner', rounds:'rounds', players:'players',
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
    roster:'本局阵容', timeline:'对局时间线', winner:'胜方', rounds:'回合', players:'人',
    adminNeeded:'请先登录管理员账号再审核投稿。', approved:'已发布。', rejected:'已驳回。'
  };

  let publicRows = [];
  let reviewRows = [];
  let currentMode = 'public';
  let isAdmin = false;
  let initialized = false;
  let submittedMatchId = '';

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
    for (const ev of (Array.isArray(records) ? records : [])) {
      if (events.length >= MAX_EVENTS || !SAFE_EVENT_TYPES.has(ev?.type)) break;
      const text = formatEvent(ev);
      if (!text) continue;
      events.push({
        type:ev.type,
        name:cleanText(ev.name, 60),
        label:cleanText(ev.label, 50),
        round:Math.max(0, Number(ev.round || 0)),
        phase:cleanText(ev.phase, 20),
        text
      });
    }
    const modeId = cleanText(state?.mode, 40);
    const snapshot = {
      version:1,
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
      .cm-overlay.show{display:flex}.cm-panel{width:min(920px,96vw);max-height:94vh;overflow:hidden;display:flex;flex-direction:column;border:1px solid rgba(213,174,103,.38);border-radius:16px;background:linear-gradient(160deg,rgba(20,17,31,.98),rgba(8,9,18,.99));box-shadow:0 24px 90px rgba(0,0,0,.65),0 0 40px rgba(119,77,154,.15)}
      .cm-head{display:flex;align-items:center;gap:10px;padding:15px 17px;border-bottom:1px solid rgba(213,174,103,.16)}.cm-head h2{margin:0;flex:1;color:#e0c98d;font-size:1.05rem;letter-spacing:.12em}.cm-btn{width:auto!important;padding:7px 12px!important;border:1px solid rgba(213,174,103,.26)!important;border-radius:8px!important;background:rgba(213,174,103,.07)!important;color:#cfc1a1!important;cursor:pointer}.cm-btn.primary{border-color:#b99654!important;color:#ecd38e!important;background:rgba(185,150,84,.15)!important}.cm-btn.danger{border-color:rgba(190,78,94,.45)!important;color:#dc8b98!important;background:rgba(190,78,94,.1)!important}
      .cm-tools{display:flex;gap:8px;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.06)}.cm-tools input{flex:1;min-width:0}.cm-tabs{display:flex;gap:6px}.cm-tab.active{border-color:#b99654!important;color:#ecd38e!important}.cm-status{padding:8px 17px;min-height:34px;color:#8f897d;font-size:.74rem}.cm-status.bad{color:#de8f93}
      .cm-list{padding:0 16px 18px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}.cm-card{display:flex;flex-direction:column;gap:7px;padding:13px;border:1px solid rgba(199,169,111,.16);border-radius:11px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(89,67,116,.035))}.cm-card h3{margin:0;color:#e1d6c4;font-size:.92rem}.cm-meta{color:#8c8398;font-size:.69rem;line-height:1.5}.cm-summary{color:#b9b0a7;font-size:.76rem;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.cm-roles{display:flex;flex-wrap:wrap;gap:4px}.cm-chip{padding:2px 6px;border:1px solid rgba(141,118,174,.24);border-radius:999px;color:#aaa0bc;font-size:.63rem}.cm-actions{display:flex;gap:6px;margin-top:auto;padding-top:4px}
      .cm-detail{display:none;padding:0 17px 18px;overflow:auto}.cm-detail.show{display:block}.cm-detail-title{color:#e4cf96;margin:4px 0 5px}.cm-roster{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:7px;margin:12px 0 18px}.cm-player{padding:8px 9px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.025)}.cm-player b{display:block;color:#d5cadd;font-size:.76rem}.cm-player span{display:block;color:#8f8498;font-size:.65rem;margin-top:2px}.cm-timeline{display:flex;flex-direction:column;gap:6px}.cm-event{padding:8px 10px;border-left:2px solid rgba(143,121,180,.42);background:rgba(255,255,255,.027);border-radius:4px;color:#b9b2bd;font-size:.74rem;line-height:1.6;white-space:pre-wrap}.cm-event.speech{border-left-color:#b78aa6;background:rgba(183,138,166,.055)}.cm-event.system{border-left-color:#9d844f;color:#c4b894}.cm-event-name{color:#e0cad8;font-weight:700;margin-right:7px}
      .cm-form{padding:15px 17px 18px;overflow:auto}.cm-form label{display:block;color:#a79bac;font-size:.74rem;margin:8px 0 4px}.cm-form input,.cm-form textarea{width:100%;box-sizing:border-box}.cm-consent{display:flex!important;align-items:flex-start;gap:7px;line-height:1.55;margin:12px 0!important}.cm-consent input{width:auto;flex:0 0 auto;margin-top:3px}.cm-submit-note{font-size:.68rem;color:#82798a;line-height:1.5}.cm-form-actions{display:flex;gap:8px;margin-top:12px}
      @media(max-width:620px){.cm-overlay{padding:6px}.cm-panel{width:100%;max-height:97vh;border-radius:12px}.cm-head{padding:12px}.cm-tools{flex-wrap:wrap;padding:9px 12px}.cm-tools input{flex-basis:100%}.cm-list{padding:0 11px 13px;grid-template-columns:1fr}.cm-head h2{font-size:.92rem}.cm-roster{grid-template-columns:repeat(2,1fr)}}`;
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
      renderDetail(data); byId('cm-list-view').style.display='none';byId('cm-detail').classList.add('show');
    } catch(error){status(copy.unavailable+' '+cleanText(error?.message,160),true);}
  }
  function renderDetail(row) {
    const body=byId('cm-detail-body');body.replaceChildren();const snap=row.replay_data||{};
    const title=document.createElement('h2');title.className='cm-detail-title';title.textContent=row.title||copy.gallery;body.appendChild(title);
    appendLine(body,`${row.mode_name||snap.mode_name||''} · ${row.player_count||snap.players?.length||0}${copy.players} · ${row.rounds||snap.rounds||0}${copy.rounds} · ${copy.winner} ${winnerLabel(row.winner||snap.winner)}`,'cm-meta');
    if(row.summary)appendLine(body,row.summary,'cm-summary');
    const rosterTitle=document.createElement('h3');rosterTitle.textContent=copy.roster;body.appendChild(rosterTitle);
    const roster=document.createElement('div');roster.className='cm-roster';(snap.players||[]).forEach((p,index)=>{const card=document.createElement('div');card.className='cm-player';appendLine(card,`P${Number(p.id??index)+1} · ${p.name||''}`,'');appendLine(card,`${roleName(p.role)}${p.model?' · '+p.model:''}`,'');roster.appendChild(card);});body.appendChild(roster);
    const timelineTitle=document.createElement('h3');timelineTitle.textContent=copy.timeline;body.appendChild(timelineTitle);
    const timeline=document.createElement('div');timeline.className='cm-timeline';(snap.events||[]).forEach(ev=>{const item=document.createElement('div');item.className=`cm-event ${ev.type==='speech'?'speech':ev.type==='system'?'system':''}`;if(ev.type==='speech'&&ev.name){const who=document.createElement('span');who.className='cm-event-name';who.textContent=`${ev.name}${ev.label?' · '+ev.label:''}`;item.appendChild(who);}item.appendChild(document.createTextNode(ev.text||''));timeline.appendChild(item);});body.appendChild(timeline);
  }
  function showList(){byId('cm-detail').classList.remove('show');byId('cm-list-view').style.display='';byId('cm-detail-body').replaceChildren();}
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

  const api={init,openGallery,openSubmit,authChanged:checkAdmin,_test:{buildSnapshot,formatEvent,bytes,randomUuid,MAX_SNAPSHOT_BYTES}};
  global.CommunityMatches=api;
  if(global.document){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})(globalThis);
