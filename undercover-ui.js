(function(){
  'use strict';
  if (!window.Undercover) return;

  const UC = window.Undercover;
  const EN = /\/en(?:\/|$)/.test(location.pathname);
  const ROOT = EN ? '..' : '.';
  const FALLBACK_PORTRAITS = ['seer','wolfbeauty','magician','knight','witch','fox','merchant','hunter'];
  const tx = (zh,en) => EN ? en : zh;
  const esc = value => typeof escapeHtml === 'function' ? escapeHtml(String(value == null ? '' : value)) : String(value == null ? '' : value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const configOf = id => (typeof playerConfigs !== 'undefined' && playerConfigs[id]) || {};
  const apiOf = id => { try { return getAPI(id) || {}; } catch(_) { return {}; } };
  const portraitOf = id => {
    const avatar = String(configOf(id).avatar || '').trim();
    if (/^(?:https?:|data:image\/|blob:|\.\.?\/)/i.test(avatar)) return avatar;
    return `${ROOT}/icons/roles/${FALLBACK_PORTRAITS[id % FALLBACK_PORTRAITS.length]}.jpg`;
  };
  const namesFromWerewolf = () => {
    let names = [];
    try { names = buildNames(8); } catch(_) {}
    return Array.from({length:8},(_,i)=>configOf(i).name || UC._lobbyNames?.[i] || names[i] || `P${i+1}`);
  };

  UC._lobbyNames = null;
  UC._godView = true;

  UC.openUI = function(){
    if (!this._ui) this._buildPremiumUI();
    this._pageScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add('uc-page-locked');
    document.body.classList.add('uc-page-locked');
    document.body.style.setProperty('--uc-page-scroll', `-${this._pageScrollY}px`);
    this._ui.classList.add('show');
    this._lobbyNames = namesFromWerewolf();
    this._renderLobby();
  };

  UC.closeUI = function(){
    if (this._running) return;
    this._ui?.classList.remove('show');
    document.documentElement.classList.remove('uc-page-locked');
    document.body.classList.remove('uc-page-locked');
    document.body.style.removeProperty('--uc-page-scroll');
    window.scrollTo(0, this._pageScrollY || 0);
  };

  UC._buildPremiumUI = function(){
    const el = document.createElement('section');
    el.id = 'uc-view';
    el.setAttribute('aria-label',tx('谁是卧底','Undercover'));
    el.innerHTML = `
      <header class="uc-top">
        <div class="uc-brand"><div class="uc-seal"><span>◐</span></div><div><div class="uc-title">${tx('谁是卧底','UNDERCOVER')}</div><div class="uc-kicker">THE MASKED SALON</div></div></div>
        <div class="uc-status"><i class="uc-status-dot"></i><span id="uc-status">${tx('候场 · 8席','Lobby · 8 seats')}</span></div>
        <div class="uc-actions">
          <button class="uc-btn secondary" id="uc-sync">↻ ${tx('同步狼人杀配置','Sync Werewolf')}</button>
          <button class="uc-btn uc-roster-toggle" id="uc-roster-toggle">♙ ${tx('八席','Seats')}</button>
          <button class="uc-btn primary" id="uc-start">▶ ${tx('开始观战','Start')}</button>
          <button class="uc-btn" id="uc-close">✕ ${tx('退出','Exit')}</button>
        </div>
      </header>
      <main class="uc-layout">
        <aside class="uc-panel uc-hero">
          <img class="uc-hero-art" src="${ROOT}/icons/modes/undercover.jpg" alt=""><i class="uc-hero-shade"></i>
          <div class="uc-hero-copy"><div class="uc-round-label">CURRENT CHAPTER</div><div class="uc-round-value" id="uc-round">${tx('等待入席','Awaiting players')}</div><div class="uc-hero-rule">${tx('同词者彼此试探，异词者藏入人群。每一句描述，都可能暴露真正的阵营。','Shared words form trust; one different word hides among them. Every clue can betray its speaker.')}</div><div class="uc-word-pair" id="uc-words">${tx('词面将在开局后揭晓给观众。','The word pair is revealed to spectators after the game starts.')}</div></div>
        </aside>
        <section class="uc-panel uc-feed-panel"><div class="uc-panel-head"><div><div class="uc-panel-title">${tx('沙龙记录','SALON TRANSCRIPT')}</div><div class="uc-panel-sub">${tx('描述 · 观察 · 投票','Clues · Reads · Votes')}</div></div></div><div class="uc-feed" id="uc-feed"></div></section>
        <aside class="uc-panel uc-roster"><div class="uc-panel-head"><div><div class="uc-panel-title">${tx('八席名册','EIGHT SEATS')}</div><div class="uc-panel-sub">${tx('点击席位设置姓名、头像、人格与 API','Click a seat to edit name, avatar, persona and API')}</div></div><span class="uc-config-hint">${tx('与狼人杀共用','Shared config')}</span></div><div class="uc-seats" id="uc-seats"></div></aside>
      </main>`;
    document.body.appendChild(el);
    this._ui = el;
    el.querySelector('#uc-close').onclick = () => this.closeUI();
    el.querySelector('#uc-start').onclick = () => this.startSpectate();
    el.querySelector('#uc-sync').onclick = () => { this._lobbyNames = namesFromWerewolf(); this._renderLobby(); this._system(tx('已同步狼人杀的玩家名称、头像、人格和 API 配置。','Werewolf player names, portraits, personas and API settings synced.'),true); };
    el.querySelector('#uc-roster-toggle').onclick = () => el.querySelector('.uc-roster').classList.toggle('mobile-open');
    el.querySelector('#uc-seats').onclick = e => {
      const seat = e.target.closest('.uc-seat');
      if (!seat || this._running) return;
      this._openSharedConfig(Number(seat.dataset.id));
    };
    this._system(tx('点击右侧任意席位即可设置玩家。所有配置会与狼人杀双向共用。','Click any seat to configure it. Settings are shared with Werewolf in both directions.'),true);
  };

  UC._openSharedConfig = function(id){
    if (typeof openPCfg !== 'function') return;
    document.body.classList.add('uc-configuring');
    try { if (typeof curNames !== 'undefined') curNames[id] = this._lobbyNames[id]; } catch(_) {}
    openPCfg(id);
    const finish = () => {
      setTimeout(()=>{
        const pop = document.getElementById('pcpop');
        if (pop && pop.classList.contains('show')) return;
        document.body.classList.remove('uc-configuring');
        this._lobbyNames = namesFromWerewolf();
        this._renderLobby();
      },20);
    };
    document.getElementById('pcsave')?.addEventListener('click',finish,{once:true});
    document.getElementById('pccancel')?.addEventListener('click',finish,{once:true});
  };

  UC._renderLobby = function(){
    const box = this._ui?.querySelector('#uc-seats');
    if (!box) return;
    const statePlayers = this.state?.players || [];
    box.innerHTML = Array.from({length:8},(_,id)=>{
      const cfg = configOf(id), api = apiOf(id), pl = statePlayers[id];
      const name = pl?.name || this._lobbyNames?.[id] || cfg.name || `P${id+1}`;
      const dead = pl && !pl.alive;
      const word = pl && this._godView ? `<div class="uc-seat-word">「${esc(pl.word)}」</div>` : '';
      const badge = dead ? (pl.isSpy ? tx('卧底','SPY') : tx('平民','CIVILIAN')) : '';
      return `<article class="uc-seat${dead?' dead':''}" data-id="${id}"><img class="uc-seat-avatar" src="${esc(portraitOf(id))}" alt="" onerror="this.src='${ROOT}/icons/roles/villager.jpg'"><div class="uc-seat-copy"><div class="uc-seat-top"><span class="uc-seat-name">${esc(name)}</span><span class="uc-seat-id">P${id+1}</span></div><div class="uc-seat-model">${esc(api.model || tx('未设置模型','No model configured'))}</div><div class="uc-seat-persona">${esc(cfg.persona || tx('默认人格 · 点击配置','Default persona · click to edit'))}</div>${word}</div>${badge?`<span class="uc-seat-badge">${esc(badge)}</span>`:''}</article>`;
    }).join('');
  };

  UC._avatarForName = function(name){
    const p = this.state?.players.find(x=>x.name===name);
    return portraitOf(p ? p.id : 0);
  };
  UC._chapter = function(text){ const feed=this._ui?.querySelector('#uc-feed'); if(feed){const el=document.createElement('div');el.className='uc-chapter';el.textContent=text;feed.appendChild(el);feed.scrollTop=feed.scrollHeight;} };
  UC._system = function(text,important){ const feed=this._ui?.querySelector('#uc-feed'); if(feed){const el=document.createElement('div');el.className='uc-system'+(important?' important':'');el.innerHTML=text;feed.appendChild(el);feed.scrollTop=feed.scrollHeight;} };
  UC._speech = function(pl,text){
    const feed=this._ui?.querySelector('#uc-feed'); if(!feed)return;
    const row=document.createElement('div'); row.className='uc-msg';
    row.innerHTML=`<img class="uc-msg-avatar" src="${esc(portraitOf(pl.id))}" alt=""><div class="uc-msg-main"><div class="uc-msg-meta"><span class="uc-msg-name">${esc(pl.name)}</span><span class="uc-model">${esc(apiOf(pl.id).model||'AI')}</span></div><div class="uc-msg-text">${esc(text)}</div></div>`;
    feed.appendChild(row); feed.scrollTop=feed.scrollHeight;
  };
  UC._setSpeaking = function(id,on){ this._ui?.querySelector(`.uc-seat[data-id="${id}"]`)?.classList.toggle('speaking',!!on); };

  UC.startSpectate = async function(){
    if (this._running) return;
    this._running=true;
    this._lobbyNames=namesFromWerewolf();
    const start=this._ui.querySelector('#uc-start'), dot=this._ui.querySelector('.uc-status-dot');
    start.disabled=true; start.textContent=tx('进行中…','Running…'); dot.classList.add('live');
    this._ui.querySelector('#uc-feed').innerHTML='';
    const players=this._lobbyNames.map((name,id)=>({id,name}));
    try{
      this.setup(players); this._renderLobby();
      const st=this.state;
      this._ui.querySelector('#uc-words').innerHTML=`${tx('多数词','Civilian')} <b>「${esc(st.civWord)}」</b><br>${tx('卧底词','Spy')} <b>「${esc(st.spyWord)}」</b>`;
      this._system(tx('观众已进入上帝视角；玩家只知道自己的词，不知道自身阵营。','God view enabled. Players know only their own word, not their faction.'),true);
      const result=await this._runPremiumGame();
      this._chapter(tx('终局揭晓','FINAL REVEAL'));
      this._system(`${result.winner==='spy'?tx('卧底获胜','Spy victory'):tx('平民获胜','Civilian victory')} · ${tx('卧底是','The spy was')} <b>${esc(result.spy.name)}</b>「${esc(result.spy.word)}」`,true);
    }catch(e){ this._system(`⚠ ${tx('对局中断','Game interrupted')}：${esc(e?.message||e)}<br><small>${tx('可点击席位切换该玩家的 API / 模型后重试。','Click a seat to change that player’s API/model, then retry.')}</small>`,true); }
    start.disabled=false; start.textContent='▶ '+tx('再来一局','Play again'); dot.classList.remove('live'); this._running=false; this._renderLobby();
  };

  UC._runPremiumGame = async function(){
    const S=this.state;
    while(!S.over){
      S.round++;
      this._ui.querySelector('#uc-status').textContent=tx(`第 ${S.round} 轮 · 存活 ${this.alivePlayers().length}`,`Round ${S.round} · ${this.alivePlayers().length} alive`);
      this._ui.querySelector('#uc-round').textContent=tx(`第 ${S.round} 轮`, `Round ${S.round}`);
      this._chapter(tx(`第 ${S.round} 轮 · 描述`,`ROUND ${S.round} · CLUES`));
      const alive=this.alivePlayers(), descs=[];
      for(const pl of alive){
        this._setSpeaking(pl.id,true);
        const text=await this.describe(pl,descs);
        const d={round:S.round,name:pl.name,text}; descs.push(d); S.descLog.push(d);
        this._speech(pl,text); this._setSpeaking(pl.id,false);
      }
      this._chapter(tx('匿名投票','SECRET BALLOT'));
      const tally={};
      for(const pl of alive){ const target=await this.vote(pl,descs,alive); tally[target]=(tally[target]||0)+1; }
      S.voteLog.push({round:S.round,tally});
      let outName=null,mx=-1; Object.entries(tally).forEach(([name,count])=>{if(count>mx){mx=count;outName=name;}});
      this._system(tx('票型：','Votes: ')+Object.entries(tally).map(([n,c])=>`${esc(n)} × ${c}`).join('　'));
      const out=S.players.find(p=>p.name===outName&&p.alive);
      if(out){out.alive=false;S.out.push({name:out.name,isSpy:out.isSpy,round:S.round});this._system(`◆ <b>${esc(out.name)}</b> ${tx('被请离沙龙，身份：','leaves the salon — ')}<b>${out.isSpy?tx('卧底','SPY'):tx('平民','CIVILIAN')}</b>`,true);this._renderLobby();}
      if(out?.isSpy){S.over=true;S.winner='civilians';}
      else if(this.alivePlayers().length<=3&&this.spyAlive()){S.over=true;S.winner='spy';}
      else if(!this.spyAlive()){S.over=true;S.winner='civilians';}
    }
    return {winner:S.winner,out:S.out,descLog:S.descLog,spy:S.players.find(p=>p.isSpy)};
  };
})();
