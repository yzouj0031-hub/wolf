// 观众席与观战提问
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 观众席（多人轮流版）
 * ================================================================ */

// 观众配置存储（最多4个）
let spectatorList = []; // [{name, persona, url, key, model}]
if (!window._specIndexGlobal) window._specIndexGlobal = 0;

function getSpecIndex() { return window._specIndexGlobal; }
function advanceSpecIndex() { window._specIndexGlobal = (window._specIndexGlobal + 1) % Math.max(1, spectatorList.length); }

function isSpecEnabled() {
  return S.pureAI && !!($('spec-enable') && $('spec-enable').checked) && spectatorList.length > 0;
}

function getActiveSpec() {
  if (!spectatorList.length) return null;
  return spectatorList[getSpecIndex() % spectatorList.length];
}

function buildSpecSys(spec) {
  const name = spec.name || '神秘观众';
  const persona = spec.persona || '';
  const allInfo = S.players.map(p => p.name+'(P'+(p.id+1)+')→'+p.role.emoji+p.role.name+'['+(p.alive?'存活':'已死')+']').join(', ');
  const base = persona
    ? persona
    : `你是「${name}」，正在观看一场AI狼人杀对局。你以上帝视角知道所有玩家的真实身份。用你自己的风格评论这场游戏——可以吐槽、可以惊叹、可以分析，就像朋友一起看球赛一样自然。`;
  return `${base}\n\n【你知道的全局信息（含真实身份）】${allInfo}\n\n注意：你的评论只有上帝视角的观察者（屏幕前的人）能看到，AI玩家完全不知道你的存在。直接输出评论，不要加任何前缀或格式标签。100字以内，口语化，有个性。`;
}

function specShouldFire(eventType) {
  const freq = ($('spec-freq') && $('spec-freq').value) || 'mid';
  if (freq === 'high') return true;
  if (freq === 'mid') return ['death','vote_result','duel','round_end','game_end','night_end'].includes(eventType);
  if (freq === 'low') return ['death','vote_result','game_end'].includes(eventType);
  return false;
}

async function callSpectator(eventType, context) {
  if (humanViewLocked()) return;
  if (!isSpecEnabled()) return;
  if (!specShouldFire(eventType)) return;
  // 话多模式随机跳过30%防止发言刷屏
  if (($('spec-freq')&&$('spec-freq').value)==='high' && eventType==='speech' && Math.random()<0.3) return;

  const spec = getActiveSpec();
  if (!spec) return;
  advanceSpecIndex();

  const url = (spec.url||'').trim() || ($('g-url')&&$('g-url').value.trim()) || 'https://api.openai.com/v1';
  const key = (spec.key||'').trim() || ($('g-key')&&$('g-key').value.trim()) || '';
  const model = (spec.model||'').trim() || ($('g-model')&&$('g-model').value.trim()) || 'gpt-4o';
  if (!key) return;

  const myGid = S.gameId;
  const name = spec.name || '神秘观众';
  const eventDesc = {
    death:      `有人死亡：${context}`,
    vote_result:`投票结果出来了：${context}`,
    duel:       `骑士决斗：${context}`,
    round_end:  `这一轮白天发言结束了。`,
    night_end:  `天亮了：${context}`,
    game_end:   `游戏结束：${context}`,
    speech:     `${context}`,
  }[eventType] || context || '';

  (async () => {
    try {
      const res = await fetch(url+'/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model, messages:[{role:'system',content:blindMaskPublic(buildSpecSys(spec))},{role:'user',content:blindMaskPublic(`【刚刚发生的事】${eventDesc}\n\n用你的风格评论一下。`)}], temperature:1.0, max_tokens:200, stream:true}),
        signal: S.abortCtrl.signal
      });
      if (!res.ok || S.gameId!==myGid) return;
      const data = await parseAPIResponseWithSSEFallback(res, { tag: '[观众]' });
      const text = blindNamesOn() ? blindMaskPublic(data.choices?.[0]?.message?.content?.trim()) : data.choices?.[0]?.message?.content?.trim();
      if (!text || S.gameId!==myGid) return;
      const entry = document.createElement('div');
      entry.className = 'le spectator' + (eventType === 'game_end' ? ' ending' : '');
      entry.innerHTML = `<div class="lh"><span>🍿</span><span class="name">${name}</span></div>`;
      const gd = document.createElement('div');
      gd.className = 'log-game';
      gd.textContent = text;
      entry.appendChild(gd);
      $('gl').appendChild(entry);
      scrollGL();
      gameRecord.push({type:'spectator', name, text});
    } catch(e) { if(e.name!=='AbortError') Render.devLog('err',`[观众:${name}] ${e.message}`); }
  })();
}

// ── 观众列表 UI 渲染 ──
function renderSpecPopList() {
  const container = $('spec-pop-list');
  if (!container) return;
  container.innerHTML = '';
  spectatorList.forEach((spec, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.15);border-radius:var(--r);padding:7px 9px;display:flex;flex-direction:column;gap:4px;';
    item.innerHTML = `
      <div style="display:flex;gap:5px;align-items:center;">
        <span style="font-size:0.72em;color:#c8a0e8;min-width:18px">#${idx+1}</span>
        <input type="text" placeholder="观众名字" value="${spec.name||''}" data-psi="${idx}" data-field="name"
          style="flex:1;font-size:0.78em;padding:4px 7px;background:rgba(160,100,220,0.09);border:1px solid rgba(160,100,220,0.22);color:#d8d0e8;border-radius:var(--r);">
        <button data-psi="${idx}" class="spec-pop-del" style="font-size:0.7em;padding:2px 7px;background:rgba(200,48,64,0.15);color:#f06880;border:1px solid rgba(200,48,64,0.25);border-radius:var(--r);cursor:pointer;">✕</button>
      </div>
      <textarea placeholder="人设（留空自由发挥）&#10;例：你是死亡笔记里的Ryuk，正在旁观这场人间游戏…" data-psi="${idx}" data-field="persona"
        style="font-size:0.73em;padding:5px 7px;height:56px;resize:none;background:rgba(160,100,220,0.05);border:1px solid rgba(160,100,220,0.13);color:#d8d0e8;border-radius:var(--r);font-family:var(--font-body);width:100%;box-sizing:border-box;">${spec.persona||''}</textarea>`;
    container.appendChild(item);
  });
  container.querySelectorAll('[data-psi][data-field]').forEach(el => {
    const si = parseInt(el.dataset.psi);
    const field = el.dataset.field;
    const sync = () => {
      if (!spectatorList[si]) return;
      spectatorList[si][field] = el.value;
      saveSpecList();
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
  });
  container.querySelectorAll('.spec-pop-del').forEach(btn => {
    btn.addEventListener('click', () => {
      spectatorList.splice(parseInt(btn.dataset.psi), 1);
      window._specIndexGlobal = 0;
      renderSpecPopList();
      saveSpecList();
      const addBtn = $('spec-pop-add');
      if (addBtn) addBtn.style.display = spectatorList.length >= 4 ? 'none' : '';
    });
  });
  const addBtn = $('spec-pop-add');
  if (addBtn) addBtn.style.display = spectatorList.length >= 4 ? 'none' : '';
}

function renderCpopSpecList() {
  const container = $('cpop-spec-list');
  if (!container) return;
  container.innerHTML = '';
  spectatorList.forEach((spec, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;gap:4px;align-items:flex-start;background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.15);border-radius:var(--r);padding:5px 7px;';
    item.innerHTML = `
      <span style="font-size:0.7em;color:#c8a0e8;min-width:14px;padding-top:5px">#${idx+1}</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
        <input type="text" placeholder="观众名字" value="${spec.name||''}" data-csi="${idx}" data-field="name"
          style="font-size:0.75em;padding:3px 6px;background:rgba(160,100,220,0.08);border:1px solid rgba(160,100,220,0.2);color:#d8d0e8;border-radius:var(--r);width:100%;box-sizing:border-box">
        <textarea placeholder="人设（留空自由发挥）" data-csi="${idx}" data-field="persona"
          style="font-size:0.72em;padding:3px 6px;height:44px;resize:none;background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.12);color:#d8d0e8;border-radius:var(--r);font-family:var(--font-body);width:100%;box-sizing:border-box">${spec.persona||''}</textarea>
      </div>
      <button data-csi="${idx}" class="cpop-spec-del" style="font-size:0.7em;padding:2px 5px;background:rgba(200,48,64,0.15);color:#f06880;border:1px solid rgba(200,48,64,0.25);border-radius:var(--r);cursor:pointer;flex-shrink:0;margin-top:2px">✕</button>`;
    container.appendChild(item);
  });
  container.querySelectorAll('[data-csi][data-field]').forEach(el => {
    const si = parseInt(el.dataset.csi);
    const field = el.dataset.field;
    const sync = () => {
      if (!spectatorList[si]) return;
      spectatorList[si][field] = el.value;
      // 同步回设置面板的spec-list
      renderSpecList();
      saveSpecList();
    };
    el.addEventListener('input', sync);
    el.addEventListener('change', sync);
  });
  container.querySelectorAll('.cpop-spec-del').forEach(btn => {
    btn.addEventListener('click', () => {
      spectatorList.splice(parseInt(btn.dataset.csi), 1);
      window._specIndexGlobal = 0;
      renderCpopSpecList();
      renderSpecList();
      saveSpecList();
      const addBtn = $('cpop-spec-add');
      if (addBtn) addBtn.style.display = spectatorList.length >= 4 ? 'none' : '';
    });
  });
  const addBtn = $('cpop-spec-add');
  if (addBtn) addBtn.style.display = spectatorList.length >= 4 ? 'none' : '';
}

function renderSpecList() {
  const container = $('spec-list');
  if (!container) return;
  container.innerHTML = '';
  spectatorList.forEach((spec, idx) => {
    const item = document.createElement('div');
    item.style.cssText = 'background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.18);border-radius:var(--r);padding:6px 8px;display:flex;flex-direction:column;gap:4px;';
    item.innerHTML = `
      <div style="display:flex;gap:4px;align-items:center;">
        <span style="font-size:0.72em;color:#c8a0e8;font-weight:bold;min-width:16px">#${idx+1}</span>
        <input type="text" placeholder="观众名字（如：Ryuk）" value="${spec.name||''}" data-si="${idx}" data-field="name"
          style="flex:1;font-size:0.75em;padding:3px 6px;background:rgba(160,100,220,0.08);border:1px solid rgba(160,100,220,0.2);color:#d8d0e8;border-radius:var(--r);">
        <button data-si="${idx}" class="spec-adv" style="font-size:0.65em;padding:2px 6px;background:rgba(100,100,180,0.12);color:#9888c8;border:1px solid rgba(160,100,220,0.2);border-radius:var(--r);cursor:pointer;flex-shrink:0">高级▼</button>
        <button data-si="${idx}" class="spec-del" style="font-size:0.7em;padding:2px 6px;background:rgba(200,48,64,0.15);color:#f06880;border:1px solid rgba(200,48,64,0.25);border-radius:var(--r);cursor:pointer;flex-shrink:0">✕</button>
      </div>
      <textarea placeholder="人设（留空则用名字自由发挥）&#10;例：你是死亡笔记里的Ryuk，正在旁观这场狼人杀…" data-si="${idx}" data-field="persona"
        style="width:100%;height:52px;resize:none;font-size:0.72em;padding:4px 6px;background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.15);color:#d8d0e8;border-radius:var(--r);font-family:var(--font-body);box-sizing:border-box">${spec.persona||''}</textarea>
      <div class="spec-adv-panel" style="display:none;display:flex;flex-direction:column;gap:3px;">
        <div style="font-size:0.65em;color:#706080;padding:1px 0">API设置（留空用全局）</div>
        <div style="display:flex;gap:3px;">
          <input type="text" placeholder="API地址" value="${spec.url||''}" data-si="${idx}" data-field="url"
            style="flex:2;font-size:0.68em;padding:3px 5px;background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.15);color:#d8d0e8;border-radius:var(--r);">
          <input type="password" placeholder="密钥" value="${spec.key||''}" data-si="${idx}" data-field="key"
            style="flex:1;font-size:0.68em;padding:3px 5px;background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.15);color:#d8d0e8;border-radius:var(--r);">
          <input type="text" placeholder="模型" value="${spec.model||''}" data-si="${idx}" data-field="model"
            style="flex:2;font-size:0.68em;padding:3px 5px;background:rgba(160,100,220,0.06);border:1px solid rgba(160,100,220,0.15);color:#d8d0e8;border-radius:var(--r);">
        </div>
      </div>`;
    // 高级折叠按钮
    const advBtn = item.querySelector('.spec-adv');
    const advPanel = item.querySelector('.spec-adv-panel');
    // 如果已有API设置则默认展开
    if (spec.url || spec.key || spec.model) {
      advPanel.style.display = 'flex';
      advBtn.textContent = '高级▲';
    } else {
      advPanel.style.display = 'none';
    }
    advBtn.addEventListener('click', () => {
      const open = advPanel.style.display !== 'none';
      advPanel.style.display = open ? 'none' : 'flex';
      advBtn.textContent = open ? '高级▼' : '高级▲';
    });
    container.appendChild(item);
  });
  // 事件绑定
  container.querySelectorAll('[data-si][data-field]').forEach(el => {
    const si = parseInt(el.dataset.si);
    const field = el.dataset.field;
    el.addEventListener('change', () => {
      if (!spectatorList[si]) return;
      spectatorList[si][field] = el.value;
      saveSpecList();
    });
    el.addEventListener('input', () => {
      if (!spectatorList[si]) return;
      spectatorList[si][field] = el.value;
    });
  });
  container.querySelectorAll('.spec-del').forEach(btn => {
    btn.addEventListener('click', () => {
      spectatorList.splice(parseInt(btn.dataset.si), 1);
      window._specIndexGlobal = 0;
      renderSpecList();
      saveSpecList();
    });
  });
  const addBtn = $('spec-add');
  if (addBtn) addBtn.style.display = spectatorList.length >= 4 ? 'none' : '';
}

function saveSpecList() {
  try {
    const cfg = JSON.parse(localStorage.getItem('wg_gufeng')||'{}');
    cfg.spectatorList = spectatorList;
    cfg.specEnable = $('spec-enable')?$('spec-enable').checked:false;
    cfg.specFreq   = $('spec-freq')?$('spec-freq').value:'mid';
    localStorage.setItem('wg_gufeng', JSON.stringify(cfg));
  } catch(e) {}
}

function loadSpecList() {
  try {
    const cfg = JSON.parse(localStorage.getItem('wg_gufeng')||'{}');
    if (Array.isArray(cfg.spectatorList)) spectatorList = cfg.spectatorList;
    if (cfg.specEnable!==undefined && $('spec-enable')) $('spec-enable').checked = cfg.specEnable;
    if (cfg.specFreq && $('spec-freq')) $('spec-freq').value = cfg.specFreq;
    // ★ 同步到首页开关
    if (cfg.specEnable!==undefined && $('spec-bar-enable')) $('spec-bar-enable').checked = cfg.specEnable;
    if (cfg.specFreq && $('spec-bar-freq')) $('spec-bar-freq').value = cfg.specFreq;
  } catch(e) {}
  renderSpecList();
}



/* ================================================================
 *  § 24. 观战提问系统
 * ================================================================ */
function openAskDialog() {
  if (humanViewLocked()) return humanViewDenied();
  if (!S.players || S.players.length === 0) { Render.log('system','⚠️ 请先开局'); return; }
  const sel = $('ask-target');
  sel.innerHTML = '';
  S.players.forEach(p => {
    const status = p.alive ? '存活' : '死亡';
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${publicPlayerLabel(p)} ${p.role?p.role.emoji:''} [${status}]`;
    sel.appendChild(opt);
  });
  $('ask-reply').style.display = 'none';
  $('ask-reply').textContent = '';
  $('ask-input').value = '';
  $('askOverlay').classList.add('show');
}

async function sendAsk() {
  if (humanViewLocked()) return humanViewDenied();
  const pid = parseInt($('ask-target').value);
  const question = $('ask-input').value.trim();
  if (!question) return;
  const p = S.players[pid];
  if (!p) return;
  const api = getAPI(p.id);
  if (!api.key) { $('ask-reply').textContent = '⚠️ 该角色未配置API'; $('ask-reply').style.display = 'block'; return; }

  $('ask-send').disabled = true;
  $('ask-send').textContent = '思考中...';
  $('ask-reply').textContent = '💭 思考中...';
  $('ask-reply').style.display = 'block';

  const gameOver = S.gameOver;
  const askPrompt = gameOver
    ? `【赛后复盘】游戏已经结束了。现在有观众想问你问题。请以你的角色身份、用你的真实想法来回答。不需要再伪装了，可以坦诚。\n观众问：${question}\n直接回答，不需要用<thinking><game><action>格式。`
    : `【观众提问】有一位上帝视角的观众想问你问题。请以你的角色身份来回答，但注意不要改变你在游戏中的策略。这只是一次旁白对话。\n观众问：${question}\n直接回答，不需要用<thinking><game><action>格式。`;
  const sys = buildSystemPrompt(p, {prompt:askPrompt, opts:{plainResponse:true}});

  try {
    const askMemLimit = parseInt($('g-mem').value) || 20;
    const askMemory = p.memory.slice(-askMemLimit).map(m => blindNamesOn() && typeof m.content === 'string' ? {...m, content:blindMaskPublic(m.content)} : m);
    const msgs = [{role:'system',content:sys}].concat(askMemory,[{role:'user',content:blindNamesOn()?blindMaskPublic(askPrompt):askPrompt}]);
    const res = await fetch(api.url+'/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+api.key},
      body: JSON.stringify({model:api.model, messages:msgs, temperature:0.8, max_tokens:2048, stream:true})
    });
    const data = await parseAPIResponseWithSSEFallback(res, { tag: '[询问玩家]' });
    const reply = blindNamesOn() ? blindMaskPublic(data.choices?.[0]?.message?.content || '(无回复)') : (data.choices?.[0]?.message?.content || '(无回复)');
    $('ask-reply').textContent = p.role.emoji + ' ' + publicPlayerLabel(p) + '：' + reply;
    // 也记录到游戏日志
    Render.log('system', '💬 观众提问 → ' + p.name + '：' + question);
    Render.log('speech', p.role.emoji + ' ' + p.name + '回答：' + reply.slice(0, 200) + (reply.length > 200 ? '...' : ''));
  } catch(e) {
    $('ask-reply').textContent = '❌ 请求失败：' + e.message;
  }
  $('ask-send').disabled = false;
  $('ask-send').textContent = '发送';
}
