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
  const API_STORAGE = 'wg_undercover_api_v2';
  let apiConfig = null;
  const apiKit = () => window.AuxGameAPI || null;
  const readMainApi = () => {
    const type=document.getElementById('g-apitype'),url=document.getElementById('g-url'),key=document.getElementById('g-key'),model=document.getElementById('g-model');
    const kit=apiKit(),provider=(type&&type.value)||(kit?kit.inferProvider(url&&url.value):'custom');
    return {provider,url:String(url&&url.value||'').trim(),key:String(key&&key.value||'').trim(),model:String(model&&model.value||'').trim()};
  };
  const loadApiConfig = () => {
    if(apiConfig)return apiConfig;
    let saved=null;try{saved=JSON.parse(localStorage.getItem(API_STORAGE)||'null');}catch(_){}
    apiConfig=saved&&saved.default&&saved.seats?saved:{version:2,default:readMainApi(),seats:{}};
    apiConfig.version=3;apiConfig.default=apiConfig.default||{};apiConfig.seats=apiConfig.seats||{};apiConfig.controllers=apiConfig.controllers||{};
    Array.from({length:8},(_,id)=>{if(!['api','web','human'].includes(apiConfig.controllers[id]))apiConfig.controllers[id]='api';});return apiConfig;
  };
  const saveApiConfig = () => {try{localStorage.setItem(API_STORAGE,JSON.stringify(loadApiConfig()));}catch(_){}};
  const seatOverride = (id,create) => {
    const cfg=loadApiConfig();if(create&&!cfg.seats[id])cfg.seats[id]={};return cfg.seats[id]||{};
  };
  const apiOf = id => {
    const kit=apiKit(),api=Object.assign({},loadApiConfig().default||{},seatOverride(id,false));
    api.provider=api.provider||(kit?kit.inferProvider(api.url):'custom');
    const meta=kit&&kit.provider(api.provider);api.type=(meta&&meta.type)||(/anthropic/i.test(api.provider)?'anthropic':/gemini/i.test(api.provider)?'gemini':'openai');
    api.url=String(api.url||'').trim().replace(/\/+$/,'');api.key=String(api.key||'').trim();api.model=String(api.model||'').trim();return api;
  };
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
    if (this._ui.classList.contains('show')) return;
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
          <button class="uc-btn secondary" id="uc-sync">↻ ${tx('同步名单','Sync roster')}</button>
          <button class="uc-btn secondary" id="uc-api-open">◇ ${tx('API 设置','API settings')}</button>
          <button class="uc-btn uc-roster-toggle" id="uc-roster-toggle">♙ ${tx('八席','Seats')}</button>
          <button class="uc-btn primary" id="uc-start">${tx('开始对局','Start game')}</button>
          <button class="uc-btn" id="uc-close">✕ ${tx('退出','Exit')}</button>
        </div>
      </header>
      <main class="uc-layout">
        <aside class="uc-panel uc-hero">
          <img class="uc-hero-art" src="${ROOT}/icons/modes/undercover.jpg" alt=""><i class="uc-hero-shade"></i>
          <div class="uc-hero-copy"><div class="uc-round-label">CURRENT CHAPTER</div><div class="uc-round-value" id="uc-round">${tx('等待入席','Awaiting players')}</div><div class="uc-hero-rule">${tx('同词者彼此试探，异词者藏入人群。每一句描述，都可能暴露真正的阵营。','Shared words form trust; one different word hides among them. Every clue can betray its speaker.')}</div><div class="uc-word-pair" id="uc-words">${tx('词面将在开局后揭晓给观众。','The word pair is revealed to spectators after the game starts.')}</div></div>
        </aside>
        <section class="uc-panel uc-feed-panel"><div class="uc-panel-head"><div><div class="uc-panel-title">${tx('沙龙记录','SALON TRANSCRIPT')}</div><div class="uc-panel-sub">${tx('描述 · 观察 · 投票','Clues · Reads · Votes')}</div></div></div><div class="uc-feed" id="uc-feed"></div></section>
        <aside class="uc-panel uc-roster"><div class="uc-panel-head"><div><div class="uc-panel-title">${tx('八席名册','EIGHT SEATS')}</div><div class="uc-panel-sub">${tx('点击席位设置姓名、头像与人格','Click a seat to edit name, avatar and persona')}</div></div><span class="uc-config-hint">${tx('逐席控制','Per-seat control')}</span></div><div class="uc-seats" id="uc-seats"></div></aside>
      </main>
      <div class="uc-api-overlay" id="uc-api-overlay" aria-hidden="true"><div class="uc-api-dialog">
        <div class="uc-api-head"><div><div class="uc-panel-title">${tx('谁是卧底 · API 设置','UNDERCOVER · API SETTINGS')}</div><div class="uc-panel-sub">${tx('独立于狼人杀和剧本杀保存','Saved separately from other games')}</div></div><button class="uc-btn" id="uc-api-close">✕</button></div>
        <div class="uc-api-scroll"><div class="uc-api-status" id="uc-api-status"></div><div class="uc-api-seat-control"><label>${tx('批量控制方式','Bulk controller')}<select id="uc-controller-all"><option value="">${tx('选择预设…','Choose preset…')}</option><option value="api">${tx('全部 API','All API')}</option><option value="web">${tx('全部网页端 AI','All Web AI')}</option><option value="human">${tx('全部真人','All human')}</option><option value="mixed">${tx('1 真人＋其余 API','1 human + remaining API')}</option></select></label><div>${tx('随后仍可逐席调整。','You can still adjust each seat below.')}</div></div>
          <div class="uc-api-grid">
            <label>${tx('渠道／接口格式','Provider / format')}<select id="uc-api-type"></select></label>
            <label>${tx('API 地址','API URL')}<input id="uc-api-url" placeholder="https://api.openai.com/v1"></label>
            <label>${tx('API 密钥','API key')}<input id="uc-api-key" type="password" placeholder="sk-..."></label>
            <label>${tx('默认模型','Default model')}<input id="uc-api-model" placeholder="gpt-4o"></label>
            <div class="uc-api-endpoint" id="uc-api-endpoint"></div>
          </div>
          <div class="uc-api-actions"><button class="uc-btn" id="uc-api-fetch-models">${tx('拉取模型','Fetch models')}</button><button class="uc-btn primary" id="uc-api-test">${tx('测试默认 API','Test default API')}</button><button class="uc-btn" id="uc-api-import">${tx('读取狼人杀主设置','Import Werewolf settings')}</button><button class="uc-btn" id="uc-api-toggle-key">${tx('显示密钥','Show keys')}</button></div>
          <div class="uc-api-test-result" id="uc-api-test-result"></div>
          <div class="uc-api-section-title">${tx('各席单独配置（留空＝继承默认）','Per-seat overrides (blank = inherit default)')}</div><div id="uc-api-seats"></div>
        </div>
      </div></div>
      <div class="uc-turn-overlay" id="uc-turn-overlay" aria-hidden="true"><div class="uc-turn-dialog" id="uc-turn-dialog"></div></div>`;
    document.body.appendChild(el);
    this._ui = el;
    el.querySelector('#uc-close').onclick = () => this.closeUI();
    el.querySelector('#uc-start').onclick = () => this.startSpectate();
    el.querySelector('#uc-sync').onclick = () => { this._lobbyNames = namesFromWerewolf(); this._renderLobby(); this._system(tx('已同步狼人杀的玩家名称、头像与人格；API 仍使用谁是卧底的独立配置。','Names, portraits and personas synced; Undercover API settings remain independent.'),true); };
    el.querySelector('#uc-api-open').onclick = () => this._openApiPanel();
    el.querySelector('#uc-api-close').onclick = () => this._closeApiPanel();
    el.querySelector('#uc-roster-toggle').onclick = () => el.querySelector('.uc-roster').classList.toggle('mobile-open');
    el.querySelector('#uc-seats').onclick = e => {
      const apiButton = e.target.closest('[data-seat-api]');
      if (apiButton) { this._openApiPanel(Number(apiButton.dataset.seatApi)); return; }
      const seat = e.target.closest('.uc-seat');
      if (!seat || this._running) return;
      this._openSharedConfig(Number(seat.dataset.id));
    };
    this._system(tx('点击席位的“控制设置”，可逐席选择 API、网页端 AI 或真人。','Use each seat’s Control button to choose API, Web AI, or a human player.'),true);
  };

  UC._openSharedConfig = function(id){
    if (typeof openPCfg !== 'function') return;
    document.body.classList.add('uc-configuring');
    try { if (typeof curNames !== 'undefined') curNames[id] = this._lobbyNames[id]; } catch(_) {}
    openPCfg(id);
    // 卧底的 API 已独立保存；这里仅借用旧弹窗编辑姓名、头像与人格，避免用户误改狼人杀命牌 API。
    const sharedApiRows=['pcu','pck','pcm'].map(x=>document.getElementById(x)?.closest('.row')).filter(Boolean);
    sharedApiRows.forEach(x=>x.style.display='none');
    const sharedApiExtras=['pc-test-result','btn-open-apivault'].map(x=>document.getElementById(x)).filter(Boolean);
    sharedApiExtras.forEach(x=>x.style.display='none');
    const finish = () => {
      setTimeout(()=>{
        const pop = document.getElementById('pcpop');
        if (pop && pop.classList.contains('show')) return;
        sharedApiRows.concat(sharedApiExtras).forEach(x=>x.style.display='');
        document.body.classList.remove('uc-configuring');
        this._lobbyNames = namesFromWerewolf();
        const cfg = configOf(id);
        const livePlayer = this.state?.players?.find(player => player.id === id);
        if (livePlayer && cfg.name) livePlayer.name = cfg.name;
        this._renderLobby();
      },20);
    };
    document.getElementById('pcsave')?.addEventListener('click',finish,{once:true});
    document.getElementById('pccancel')?.addEventListener('click',finish,{once:true});
  };

  const providerOptions = inherit => {
    const kit=apiKit(),providers=kit?kit.providers():[];
    return (inherit?`<option value="">${tx('继承默认渠道','Inherit default')}</option>`:'')
      +providers.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  };
  const setProvider = (el,value) => {
    if(!el)return;el.value=value||'';
    if(value&&el.value!==value){const o=document.createElement('option');o.value=value;o.textContent=value;el.appendChild(o);el.value=value;}
  };
  const seatSummary = id => {
    const kit=apiKit(),c=seatOverride(id,false),parts=[];
    if(seatController(id)!=='api')return controllerLabel(id)+' · '+tx('无需 API','no API');
    if(c.model)parts.push(c.model);if(c.provider)parts.push((kit&&kit.provider(c.provider)?.name)||c.provider);
    if(c.url)parts.push(tx('独立地址','custom URL'));if(c.key)parts.push(tx('独立密钥','custom key'));
    return parts.length?parts.join(' · '):tx('继承默认','inherits default');
  };
  UC._openApiPanel = function(seatId){this._renderApiPanel();const box=this._ui.querySelector('#uc-api-overlay');box.classList.add('show');box.setAttribute('aria-hidden','false');if(Number.isInteger(seatId)){const item=this._ui.querySelectorAll('.uc-api-seat')[seatId];if(item){item.open=true;requestAnimationFrame(()=>item.scrollIntoView({block:'nearest'}));}}};
  UC._closeApiPanel = function(){this._flushApiPanel();const box=this._ui.querySelector('#uc-api-overlay');box.classList.remove('show');box.setAttribute('aria-hidden','true');};
  UC._apiEndpointPreview = function(){
    const kit=apiKit(),box=this._ui.querySelector('#uc-api-endpoint');if(!kit||!box)return;
    const provider=this._ui.querySelector('#uc-api-type').value,meta=kit.provider(provider);
    const api={type:meta?.type||'openai',url:this._ui.querySelector('#uc-api-url').value.trim(),model:this._ui.querySelector('#uc-api-model').value.trim()};
    box.textContent=api.url?tx('实际请求：','Request: ')+kit.endpoint(api):tx('填写地址后显示最终请求路径。','The final request URL appears here.');
  };
  UC._flushApiPanel = function(){
    const host=this._ui?.querySelector('#uc-api-seats');if(!host||!host.dataset.ready)return;
    const cfg=loadApiConfig();cfg.default={provider:this._ui.querySelector('#uc-api-type').value||'custom',url:this._ui.querySelector('#uc-api-url').value.trim(),key:this._ui.querySelector('#uc-api-key').value.trim(),model:this._ui.querySelector('#uc-api-model').value.trim()};
    host.querySelectorAll('[data-seat][data-f]').forEach(el=>{const own=seatOverride(el.dataset.seat,true),v=String(el.value||'').trim();if(v)own[el.dataset.f]=v;else delete own[el.dataset.f];if(!Object.keys(own).length)delete cfg.seats[el.dataset.seat];});
    saveApiConfig();this._apiEndpointPreview();this._renderApiStatus();this._renderLobby();
  };
  UC._renderApiStatus = function(){
    const out=this._ui.querySelector('#uc-api-status'),apiSeats=Array.from({length:8},(_,id)=>id).filter(id=>seatController(id)==='api'),bad=apiSeats.filter(id=>{const a=apiOf(id),kit=apiKit();return !a.url||!a.model||(!a.key&&(!kit||kit.needsKey(a)));});
    out.textContent=!apiSeats.length
      ?tx('本局没有 API 席位；网页端 AI 与真人席位会在轮到时交接。','No API seats. Web AI and human seats are handled turn by turn.')
      :bad.length
      ?tx(`还有 ${bad.length} 个席位缺少地址、模型或必要密钥：`,`Missing URL, model, or required key for ${bad.length} seats: `)+bad.map(x=>'P'+(x+1)).join('、')
      :tx(`${apiSeats.length} 个 API 席位均已有可用配置；其余席位无需 API。`,`All ${apiSeats.length} API seats are configured; other seats do not require an API.`);
  };
  UC._renderApiPanel = function(){
    const kit=apiKit(),cfg=loadApiConfig(),base=cfg.default||{},host=this._ui.querySelector('#uc-api-seats');
    const type=this._ui.querySelector('#uc-api-type');type.innerHTML=providerOptions(false);setProvider(type,base.provider||(kit&&kit.inferProvider(base.url))||'custom');
    this._ui.querySelector('#uc-api-url').value=base.url||'';this._ui.querySelector('#uc-api-key').value=base.key||'';this._ui.querySelector('#uc-api-model').value=base.model||'';
    host.innerHTML=Array.from({length:8},(_,id)=>{const c=seatOverride(id,false),name=this._lobbyNames?.[id]||configOf(id).name||`P${id+1}`;
      const input=(f,label,type)=>`<label>${label}<input data-seat="${id}" data-f="${f}" ${type?`type="${type}"`:''} value="${esc(c[f]||'')}" placeholder="${tx('继承默认','Inherit default')}"></label>`;
      const mode=seatController(id),apiFields=`<div class="uc-api-seat-grid${mode==='api'?'':' uc-api-disabled'}"><label>${tx('渠道／格式','Provider / format')}<select data-seat="${id}" data-f="provider">${providerOptions(true)}</select></label>${input('url',tx('地址','URL'))}${input('key',tx('密钥','Key'),'password')}${input('model',tx('模型','Model'))}<div class="uc-api-seat-actions"><button class="uc-btn" data-fetch-seat="${id}">${tx('拉取模型','Fetch models')}</button><button class="uc-btn" data-test-seat="${id}">${tx('测试此席','Test seat')}</button><button class="uc-btn" data-clear-seat="${id}">${tx('清除覆盖','Clear override')}</button></div></div>`;
      return `<details class="uc-api-seat"><summary><b>P${id+1} · ${esc(name)}</b><span data-seat-summary="${id}">${esc(seatSummary(id))}</span></summary><div class="uc-api-seat-control"><label>${tx('控制方式','Controller')}<select data-control-seat="${id}"><option value="api">${tx('API 模型','API model')}</option><option value="web">${tx('网页端 AI','Web AI')}</option><option value="human">${tx('真人玩家','Human player')}</option></select></label><div>${mode==='api'?tx('自动调用本席 API。','Uses this seat API automatically.'):mode==='web'?tx('轮到时复制提示词并粘贴回复。','Copy the prompt and paste the web AI reply on each turn.'):tx('轮到时私密查看词语并手动发言／投票。','Privately reveal the word, then speak or vote manually.')}</div></div>${apiFields}</details>`;
    }).join('');host.dataset.ready='1';
    host.querySelectorAll('[data-control-seat]').forEach(sel=>{sel.value=seatController(Number(sel.dataset.controlSeat));sel.onchange=()=>{cfg.controllers[sel.dataset.controlSeat]=sel.value;saveApiConfig();this._renderApiPanel();this._renderLobby();};});
    Array.from({length:8},(_,id)=>setProvider(host.querySelector(`select[data-seat="${id}"]`),seatOverride(id,false).provider||''));
    ['uc-api-type','uc-api-url','uc-api-key','uc-api-model'].forEach(id=>{const el=this._ui.querySelector('#'+id);el.oninput=()=>this._flushApiPanel();el.onchange=()=>{if(id==='uc-api-type'){const meta=kit&&kit.provider(el.value),url=this._ui.querySelector('#uc-api-url');const known=kit&&kit.providers().some(x=>x.url&&x.url.replace(/\/+$/,'')===url.value.trim().replace(/\/+$/,''));if(meta?.url&&(!url.value.trim()||known))url.value=meta.url;}this._flushApiPanel();};});
    host.querySelectorAll('[data-seat][data-f]').forEach(el=>{const refresh=()=>{if(el.dataset.f==='provider'&&el.value){const meta=kit&&kit.provider(el.value),url=host.querySelector(`input[data-seat="${el.dataset.seat}"][data-f="url"]`);if(meta?.url&&url&&!url.value.trim())url.value=meta.url;}this._flushApiPanel();const s=host.querySelector(`[data-seat-summary="${el.dataset.seat}"]`);if(s)s.textContent=seatSummary(el.dataset.seat);};el.oninput=refresh;el.onchange=refresh;});
    host.querySelectorAll('[data-fetch-seat]').forEach(btn=>btn.onclick=e=>{e.preventDefault();const id=Number(btn.dataset.fetchSeat),target=host.querySelector(`input[data-seat="${id}"][data-f="model"]`);this._fetchModels(apiOf(id),target,`P${id+1}`,btn);});
    host.querySelectorAll('[data-test-seat]').forEach(btn=>btn.onclick=e=>{e.preventDefault();this._testApi(apiOf(Number(btn.dataset.testSeat)),`P${Number(btn.dataset.testSeat)+1}`,btn);});
    host.querySelectorAll('[data-clear-seat]').forEach(btn=>btn.onclick=e=>{e.preventDefault();delete cfg.seats[btn.dataset.clearSeat];saveApiConfig();this._renderApiPanel();});
    this._ui.querySelector('#uc-api-fetch-models').onclick=()=>{this._flushApiPanel();this._fetchModels(apiOf(-1),this._ui.querySelector('#uc-api-model'),tx('默认 API','Default API'),this._ui.querySelector('#uc-api-fetch-models'));};
    this._ui.querySelector('#uc-api-test').onclick=()=>{this._flushApiPanel();this._testApi(apiOf(-1),tx('默认 API','Default API'),this._ui.querySelector('#uc-api-test'));};
    this._ui.querySelector('#uc-api-import').onclick=()=>{cfg.default=readMainApi();saveApiConfig();this._renderApiPanel();const o=this._ui.querySelector('#uc-api-test-result');o.style.display='block';o.textContent=tx('已复制狼人杀主设置；后续修改不会反向影响狼人杀。','Werewolf settings copied; later edits will not affect Werewolf.');};
    this._ui.querySelector('#uc-api-toggle-key').onclick=()=>{const keys=[this._ui.querySelector('#uc-api-key'),...host.querySelectorAll('input[data-f="key"]')],show=keys.some(x=>x.type==='password');keys.forEach(x=>x.type=show?'text':'password');this._ui.querySelector('#uc-api-toggle-key').textContent=show?tx('隐藏密钥','Hide keys'):tx('显示密钥','Show keys');};
    this._ui.querySelector('#uc-controller-all').onchange=e=>{const value=e.target.value;if(!value)return;Array.from({length:8},(_,id)=>{cfg.controllers[id]=value==='mixed'?(id===0?'human':'api'):value;});e.target.value='';saveApiConfig();this._renderApiPanel();this._renderLobby();};
    this._apiEndpointPreview();this._renderApiStatus();
  };
  const seatController = id => loadApiConfig().controllers[id]||'api';
  const controllerLabel = id => ({api:tx('API 模型','API model'),web:tx('网页端 AI','Web AI'),human:tx('真人玩家','Human player')})[seatController(id)]||'API';
  const hasHumanSeats = () => Array.from({length:8},(_,id)=>id).some(id=>seatController(id)==='human');
  UC._fetchModels = async function(api,target,label,button){
    const kit=apiKit(),out=this._ui.querySelector('#uc-api-test-result'),old=button.textContent;this._flushApiPanel();out.style.display='block';out.textContent=tx('正在拉取模型列表…','Fetching model list…');button.disabled=true;button.textContent=tx('拉取中…','Fetching…');
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
    try{
      if(!kit?.listModels||!kit?.chooseModel)throw new Error(tx('模型列表模块未加载','Model-list module is unavailable'));
      const models=await kit.listModels(api,ctrl.signal);out.textContent=tx(`已拉取 ${models.length} 个模型，请选择一个。`,`${models.length} models loaded. Choose one.`);
      const selected=await kit.chooseModel(models,label+' · '+tx('选择模型','Choose model'));
      if(selected){target.value=selected;target.dispatchEvent(new Event('input',{bubbles:true}));out.textContent=tx('已选择模型：','Selected model: ')+selected;}
      else out.textContent=tx(`已拉取 ${models.length} 个模型，未更改当前选择。`,`${models.length} models loaded; current selection unchanged.`);
    }catch(e){out.textContent=tx('拉取模型失败：','Failed to fetch models: ')+(e?.name==='AbortError'?tx('30 秒内没有响应','no response within 30 seconds'):(e?.message||e));}
    finally{clearTimeout(timer);button.disabled=false;button.textContent=old;}
  };
  UC._testApi = async function(api,label,button){
    const kit=apiKit(),out=this._ui.querySelector('#uc-api-test-result');out.style.display='block';out.textContent=tx('正在测试 ','Testing ')+label+'…';button.disabled=true;
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000),start=Date.now();
    try{if(!kit)throw new Error(tx('通用 API 模块未加载','Shared API module is unavailable'));const raw=await kit.request(api,tx('你是连接测试助手。','You are a connection test assistant.'),tx('只回复：连接成功','Reply only: connected'),ctrl.signal,64);out.textContent=label+' · '+tx('连接成功','connected')+' · '+((Date.now()-start)/1000).toFixed(1)+'s\n'+String(raw).replace(/<[^>]+>/g,'').trim().slice(0,100);}
    catch(e){out.textContent=tx('连接失败：','Connection failed: ')+(e?.name==='AbortError'?tx('45 秒内没有响应','no response within 45 seconds'):(e?.message||e));}
    finally{clearTimeout(timer);button.disabled=false;}
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
      const control=seatController(id),controlText=control==='api'?(api.model||tx('未设置模型','No model configured')):controllerLabel(id);
      return `<article class="uc-seat${dead?' dead':''}" data-id="${id}"><img class="uc-seat-avatar" src="${esc(portraitOf(id))}" alt="" onerror="this.src='${ROOT}/icons/roles/villager.jpg'"><div class="uc-seat-copy"><div class="uc-seat-top"><span class="uc-seat-name">${esc(name)}</span><span class="uc-seat-id">P${id+1}</span></div><div class="uc-seat-model">${esc(controlText)}</div><div class="uc-seat-persona">${esc(cfg.persona || tx('默认人格 · 点击配置','Default persona · click to edit'))}</div><div class="uc-seat-tools"><button class="uc-seat-config" type="button"${this._running?' disabled':''}>${tx('玩家资料','Player')}</button><button class="uc-seat-api" type="button" data-seat-api="${id}">${tx('控制设置','Control')}</button></div>${word}</div>${badge?`<span class="uc-seat-badge">${esc(badge)}</span>`:''}</article>`;
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
    row.innerHTML=`<img class="uc-msg-avatar" src="${esc(portraitOf(pl.id))}" alt=""><div class="uc-msg-main"><div class="uc-msg-meta"><span class="uc-msg-name">${esc(pl.name)}</span><span class="uc-model">${esc(seatController(pl.id)==='api'?(apiOf(pl.id).model||'API'):controllerLabel(pl.id))}</span></div><div class="uc-msg-text">${esc(text)}</div></div>`;
    feed.appendChild(row); feed.scrollTop=feed.scrollHeight;
  };
  UC._setSpeaking = function(id,on){ this._ui?.querySelector(`.uc-seat[data-id="${id}"]`)?.classList.toggle('speaking',!!on); };

  const cleanApiReply = raw => {
    let text=String(raw||'').replace(/<\s*(?:thinking|think|draft)\s*>[\s\S]*?<\s*\/\s*(?:thinking|think|draft)\s*>/gi,'').trim();
    const tagged=text.match(/<\s*(?:game|say|answer|final)\s*>([\s\S]*?)<\s*\/\s*(?:game|say|answer|final)\s*>/i);
    if(tagged)text=tagged[1].trim();
    return text.replace(/<[^>]+>/g,'').trim();
  };
  UC._closeTurnOverlay = function(){const box=this._ui?.querySelector('#uc-turn-overlay');if(box){box.classList.remove('show');box.setAttribute('aria-hidden','true');this._ui.querySelector('#uc-turn-dialog').innerHTML='';}};
  UC._webAsk = function(pl,sys,user){
    return new Promise((resolve,reject)=>{
      const box=this._ui.querySelector('#uc-turn-overlay'),dialog=this._ui.querySelector('#uc-turn-dialog');
      const prompt=tx(`以下是【${pl.name}】的私密席位提示，只供这个网页端 AI 使用。`,`This is private context for ${pl.name}. Use it only for this web AI seat.`)+'\n\n===== SYSTEM =====\n'+sys+'\n\n===== USER =====\n'+user;
      dialog.innerHTML=`<div class="uc-panel-title">${tx('网页端 AI 接力','WEB AI RELAY')} · ${esc(pl.name)}</div><h3>${tx('复制提示词，粘贴回复','Copy prompt, paste reply')}</h3><textarea id="uc-turn-prompt" readonly></textarea><div class="uc-turn-actions"><button class="uc-btn" id="uc-turn-copy">${tx('复制提示词','Copy prompt')}</button></div><textarea id="uc-turn-reply" placeholder="${tx('粘贴网页端 AI 的回复','Paste the web AI reply')}"></textarea><div class="uc-turn-actions"><button class="uc-btn" id="uc-turn-cancel">${tx('中断对局','Stop game')}</button><button class="uc-btn primary" id="uc-turn-submit">${tx('提交回复','Submit reply')}</button></div>`;
      dialog.querySelector('#uc-turn-prompt').value=prompt;box.classList.add('show');box.setAttribute('aria-hidden','false');
      dialog.querySelector('#uc-turn-copy').onclick=async e=>{try{await navigator.clipboard.writeText(prompt);e.currentTarget.textContent=tx('已复制','Copied');}catch(_){dialog.querySelector('#uc-turn-prompt').select();}};
      dialog.querySelector('#uc-turn-submit').onclick=()=>{const raw=dialog.querySelector('#uc-turn-reply').value.trim();if(!raw)return;this._closeTurnOverlay();resolve(raw);};
      dialog.querySelector('#uc-turn-cancel').onclick=()=>{this._closeTurnOverlay();reject(new Error(tx('网页端 AI 接力已取消','Web AI relay cancelled')));};
    });
  };
  UC._humanAsk = function(pl,sys,user){
    return new Promise((resolve,reject)=>{
      const vote=/投票|vote/i.test(sys+'\n'+user),box=this._ui.querySelector('#uc-turn-overlay'),dialog=this._ui.querySelector('#uc-turn-dialog');
      const cancel=()=>{this._closeTurnOverlay();reject(new Error(tx('真人回合已中断','Human turn cancelled')));};
      const reveal=()=>{
        if(vote){
          const candidates=this.alivePlayers().filter(x=>x.id!==pl.id);let selected='';
          dialog.innerHTML=`<div class="uc-panel-title">${tx('真人私密回合','PRIVATE HUMAN TURN')} · ${esc(pl.name)}</div><h3>${tx('你的词语','Your word')}：「${esc(pl.word)}」</h3><div class="uc-turn-private">${tx('只选择投票对象，不需要公开解释。','Choose a ballot target. No public explanation is needed.')}</div><div class="uc-turn-options">${candidates.map(x=>`<button class="uc-btn" data-human-vote="${x.id}">${esc(x.name)}</button>`).join('')}</div><div class="uc-turn-actions"><button class="uc-btn" id="uc-human-cancel">${tx('中断对局','Stop game')}</button><button class="uc-btn primary" id="uc-human-submit" disabled>${tx('确认投票','Confirm vote')}</button></div>`;
          dialog.querySelectorAll('[data-human-vote]').forEach(btn=>btn.onclick=()=>{selected=btn.dataset.humanVote;dialog.querySelectorAll('[data-human-vote]').forEach(x=>x.classList.toggle('sel',x===btn));dialog.querySelector('#uc-human-submit').disabled=false;});
          dialog.querySelector('#uc-human-submit').onclick=()=>{const target=candidates.find(x=>String(x.id)===selected);if(target){this._closeTurnOverlay();resolve(target.name);}};
        }else{
          dialog.innerHTML=`<div class="uc-panel-title">${tx('真人私密回合','PRIVATE HUMAN TURN')} · ${esc(pl.name)}</div><h3>${tx('你的词语','Your word')}：「${esc(pl.word)}」</h3><div class="uc-turn-private">${tx('用一句话描述它，但不能直接说出词语本身。','Describe it in one sentence without saying the word itself.')}</div><textarea id="uc-human-desc" placeholder="${tx('输入你的公开描述','Enter your public clue')}"></textarea><div class="uc-api-test-result" id="uc-human-warning"></div><div class="uc-turn-actions"><button class="uc-btn" id="uc-human-cancel">${tx('中断对局','Stop game')}</button><button class="uc-btn primary" id="uc-human-submit">${tx('公开描述','Publish clue')}</button></div>`;
          dialog.querySelector('#uc-human-submit').onclick=()=>{const text=dialog.querySelector('#uc-human-desc').value.trim(),warn=dialog.querySelector('#uc-human-warning');if(!text)return;if(text.includes(pl.word)){warn.style.display='block';warn.textContent=tx('描述中直接出现了你的词，请换一种说法。','Your clue contains the secret word. Rephrase it.');return;}this._closeTurnOverlay();resolve(text);};
        }
        dialog.querySelector('#uc-human-cancel').onclick=cancel;
      };
      dialog.innerHTML=`<div class="uc-panel-title">${tx('真人席位交接','HUMAN HANDOFF')}</div><h3>${tx('请把设备交给','Pass the device to')} ${esc(pl.name)}</h3><div class="uc-turn-private">${tx('下一页会显示该玩家的秘密词语。其他玩家请移开视线。','The next screen reveals this player’s secret word. Other players should look away.')}</div><div class="uc-turn-actions"><button class="uc-btn" id="uc-human-cancel">${tx('中断对局','Stop game')}</button><button class="uc-btn primary" id="uc-human-reveal">${tx('由本人查看','Reveal to player')}</button></div>`;
      box.classList.add('show');box.setAttribute('aria-hidden','false');dialog.querySelector('#uc-human-reveal').onclick=reveal;dialog.querySelector('#uc-human-cancel').onclick=cancel;
    });
  };
  // 逐席路由：API 自动请求、网页端接力、真人私密操作可以混在同一局。
  UC._ask = async function(pl,sys,user){
    const control=seatController(pl.id);
    if(control==='web')return cleanApiReply(await this._webAsk(pl,sys,user));
    if(control==='human')return (await this._humanAsk(pl,sys,user)).trim();
    const kit=apiKit(),api=apiOf(pl.id);if(!kit)throw new Error(tx('自定义 API 模块未加载','Custom API module is unavailable'));
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),180000);
    try{const raw=await kit.request(api,sys,user,ctrl.signal,4096),text=cleanApiReply(raw);if(!text)throw new Error(tx(`${pl.name} 没有返回可识别的答案`,`${pl.name} returned no usable answer`));return text;}
    catch(e){if(e?.name==='AbortError')throw new Error(tx(`${pl.name} 请求超时`,`${pl.name} request timed out`));throw e;}
    finally{clearTimeout(timer);}
  };

  UC.startSpectate = async function(){
    if (this._running) return;
    this._running=true;
    this._lobbyNames=namesFromWerewolf();
    const start=this._ui.querySelector('#uc-start'), dot=this._ui.querySelector('.uc-status-dot');
    start.disabled=true; start.textContent=tx('进行中…','Running…'); dot.classList.add('live');
    this._ui.querySelector('#uc-feed').innerHTML='';
    const players=this._lobbyNames.map((name,id)=>({id,name,isPlayer:seatController(id)==='human'}));
    try{
      this._godView=!hasHumanSeats();this.setup(players); this._renderLobby();
      const st=this.state;
      this._ui.querySelector('#uc-words').innerHTML=this._godView?`${tx('多数词','Civilian')} <b>「${esc(st.civWord)}」</b><br>${tx('卧底词','Spy')} <b>「${esc(st.spyWord)}」</b>`:tx('本局含真人席位，词语已进入隐私保护模式。','Human seats are present; secret words are privacy-protected.');
      this._system(this._godView?tx('当前为上帝视角；AI 玩家只知道自己的词，不知道自身阵营。','God view enabled. AI players know only their own word, not their faction.'):tx('真人混合对局已开始；轮到真人时会出现私密交接页。','Mixed human game started. A private handoff appears on each human turn.'),true);
      const result=await this._runPremiumGame();
      this._chapter(tx('终局揭晓','FINAL REVEAL'));
      this._system(`${result.winner==='spy'?tx('卧底获胜','Spy victory'):tx('平民获胜','Civilian victory')} · ${tx('卧底是','The spy was')} <b>${esc(result.spy.name)}</b>「${esc(result.spy.word)}」`,true);
    }catch(e){ this._system(`⚠ ${tx('对局中断','Game interrupted')}：${esc(e?.message||e)}<br><small>${tx('可点击席位切换该玩家的 API / 模型后重试。','Click a seat to change that player’s API/model, then retry.')}</small>`,true); }
    start.disabled=false; start.textContent=tx('再来一局','Play again'); dot.classList.remove('live'); this._running=false; this._renderLobby();
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
