// 自创角色与人设库
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 自创角色管理
 * ================================================================ */
let customRoleArtDraft = {portrait:'', actionCG:''};

function updateCustomRoleArtPreview() {
  [['portrait','cr-portrait-preview','cr-portrait-box'],['actionCG','cr-cg-preview','cr-cg-box']].forEach(([key,previewId,boxId]) => {
    const data = safeCustomRoleArt(customRoleArtDraft[key]);
    const preview = $(previewId), box = $(boxId);
    if (!preview || !box) return;
    preview.style.backgroundImage = data ? `url("${data}")` : '';
    box.classList.toggle('has-art', !!data);
  });
}

function compressCustomRoleArt(file, kind) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || '').startsWith('image/')) return reject(new Error('请选择图片文件'));
    if (file.size > 20 * 1024 * 1024) return reject(new Error('原图超过 20MB，请先缩小'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片无法读取')); };
    img.onload = () => {
      try {
        const target = kind === 'portrait' ? {w:600,h:800} : {w:1280,h:720};
        const ratio = target.w / target.h;
        let sx=0, sy=0, sw=img.naturalWidth, sh=img.naturalHeight;
        if (sw / sh > ratio) { const nw = sh * ratio; sx = (sw - nw) / 2; sw = nw; }
        else { const nh = sw / ratio; sy = (sh - nh) / 2; sh = nh; }
        const scale = Math.min(1, target.w / sw, target.h / sh);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sw * scale));
        canvas.height = Math.max(1, Math.round(sh * scale));
        canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        let data = '', quality = kind === 'portrait' ? .8 : .76;
        do {
          data = canvas.toDataURL('image/webp', quality);
          if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', quality);
          quality -= .08;
        } while (data.length > 420000 && quality >= .48);
        URL.revokeObjectURL(url);
        if (!safeCustomRoleArt(data)) return reject(new Error('压缩后仍然过大，请换一张细节更少的图片'));
        resolve(data);
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.src = url;
  });
}

function bindCustomRoleArtInputs() {
  const status = $('cr-art-status');
  [['portrait','cr-portrait-file'],['actionCG','cr-cg-file']].forEach(([kind,id]) => {
    const input = $(id); if (!input || input.dataset.bound) return;
    input.dataset.bound = '1';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0]; input.value = ''; if (!file) return;
      if (status) status.textContent = '正在裁切并压缩图片…';
      try {
        customRoleArtDraft[kind] = await compressCustomRoleArt(file, kind);
        updateCustomRoleArtPreview();
        if (status) status.textContent = kind === 'portrait' ? '图鉴立绘已就绪，保存角色后生效。' : '行动 CG 已就绪，保存角色后生效。';
      } catch (e) { if (status) status.textContent = '图片处理失败：' + e.message; }
    });
  });
  if ($('cr-portrait-clear') && !$('cr-portrait-clear').dataset.bound) {
    $('cr-portrait-clear').dataset.bound='1'; $('cr-portrait-clear').onclick=()=>{customRoleArtDraft.portrait='';updateCustomRoleArtPreview();};
  }
  if ($('cr-cg-clear') && !$('cr-cg-clear').dataset.bound) {
    $('cr-cg-clear').dataset.bound='1'; $('cr-cg-clear').onclick=()=>{customRoleArtDraft.actionCG='';updateCustomRoleArtPreview();};
  }
}

function updateCustomRoleClassVisibility() {
  const show = $('cr-team') && $('cr-team').value === 'good';
  if ($('cr-good-class-row')) $('cr-good-class-row').style.display = show ? '' : 'none';
  if ($('cr-good-class-note')) $('cr-good-class-note').style.display = show ? '' : 'none';
}

function openCustomRoleDialog() {
  // 清空表单（新建模式）
  $('cr-name').value = '';
  $('cr-emoji').value = '';
  $('cr-team').value = 'good';
  if ($('cr-good-class')) $('cr-good-class').value = 'god';
  updateCustomRoleClassVisibility();
  $('cr-desc').value = '';
  $('cr-guide').value = '';
  if ($('cr-ability')) $('cr-ability').value = '';
  document.querySelectorAll('.cr-blk').forEach(cb => cb.checked = false);
  customRoleArtDraft = {portrait:'', actionCG:''};
  bindCustomRoleArtInputs(); updateCustomRoleArtPreview();
  $('crpop-title').textContent = '── ✏️ 自创角色 ──';
  // 删除隐藏的编辑id
  $('cr-save').dataset.editId = '';
  renderCustomRoleList();
  $('crpop').classList.add('show');
}

function renderCustomRoleList() {
  const list = $('cr-list');
  if (!list) return;
  const defs = window._customRolesDefs || [];
  if (!defs.length) {
    list.innerHTML = '<div style="font-size:0.72em;color:#5a5070;text-align:center;padding:8px">还没有自创角色</div>';
    return;
  }
  const teamColor = {bad:'var(--cinnabar-light)', good:'var(--jade)', third:'var(--third-amber)'};
  list.innerHTML = '<div style="font-size:0.72em;color:#8880a8;margin-bottom:6px;font-family:var(--font-title)">── 已创建的角色 ──</div>'
    + defs.map(cr => { const portrait=safeCustomRoleArt(cr.portrait); const visual=portrait?`<img src="${portrait}" alt="" style="width:38px;height:48px;object-fit:cover;border-radius:7px;border:1px solid rgba(208,160,240,.24)">`:(window.RoleSigils?window.RoleSigils.render(cr.id):''); return `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(208,160,240,0.04);border:1px solid rgba(208,160,240,0.1);border-radius:var(--r);margin-bottom:4px">
      <span class="cr-role-thumb" style="width:38px;flex:0 0 38px;display:grid;place-items:center">${visual}</span>
      <div style="flex:1">
        <div style="font-size:0.82em;font-family:var(--font-title);color:${teamColor[cr.team]||'#d8d0e8'}">${escapeHtml(cr.name)}</div>
        <div style="font-size:0.65em;color:#6a6080">${escapeHtml(roleFactionClassLabel(ALL_ROLES[cr.id] || cr))} · ${escapeHtml(cr.desc||'')}</div>
      </div>
      <button data-cr-edit="${escapeHtml(cr.id)}" style="padding:3px 8px;font-size:0.7em;background:rgba(104,184,232,0.1);color:var(--jade);border:1px solid var(--jade);border-radius:var(--r);cursor:pointer">编辑</button>
      <button data-cr-delete="${escapeHtml(cr.id)}" style="padding:3px 8px;font-size:0.7em;background:rgba(200,48,64,0.1);color:var(--cinnabar-light);border:1px solid rgba(200,48,64,0.3);border-radius:var(--r);cursor:pointer">删除</button>
    </div>`; }).join('');
  list.querySelectorAll('[data-cr-edit]').forEach(btn => btn.onclick=()=>editCustomRole(btn.dataset.crEdit));
  list.querySelectorAll('[data-cr-delete]').forEach(btn => btn.onclick=()=>deleteCustomRole(btn.dataset.crDelete));
}

function editCustomRole(id) {
  const cr = (window._customRolesDefs||[]).find(x=>x.id===id);
  if (!cr) return;
  $('cr-name').value = cr.name;
  $('cr-emoji').value = cr.emoji||'';
  $('cr-team').value = cr.team;
  if ($('cr-good-class')) $('cr-good-class').value = cr.goodRoleClass === 'villager' ? 'villager' : 'god';
  updateCustomRoleClassVisibility();
  $('cr-desc').value = cr.desc||'';
  $('cr-guide').value = cr.guide||'';
  if ($('cr-ability')) $('cr-ability').value = cr.ability||'';
  const abils = Array.isArray(cr.abilities) ? cr.abilities : [];
  document.querySelectorAll('.cr-blk').forEach(cb => cb.checked = abils.includes(cb.value));
  customRoleArtDraft = {portrait:safeCustomRoleArt(cr.portrait), actionCG:safeCustomRoleArt(cr.actionCG)};
  bindCustomRoleArtInputs(); updateCustomRoleArtPreview();
  $('crpop-title').textContent = '── ✏️ 编辑角色 ──';
  $('cr-save').dataset.editId = id;
}

function deleteCustomRole(id) {
  window._customRolesDefs = (window._customRolesDefs||[]).filter(x=>x.id!==id);
  // 从ALL_ROLES删掉
  delete ALL_ROLES[id];
  delete MAX_COUNT[id];
  delete ROLE_CLS[id];
  saveCfg();
  initRoles();
  renderCustomRoleList();
  // 同步更新自定义配置弹窗（如果已打开）
  if ($('cpop').classList.contains('show')) renderCR();
}

function saveCustomRole() {
  const name = $('cr-name').value.trim();
  const emoji = $('cr-emoji').value.trim() || '❓';
  const team = $('cr-team').value;
  const goodRoleClass = team === 'good' && $('cr-good-class') && $('cr-good-class').value === 'villager' ? 'villager' : 'god';
  const desc = $('cr-desc').value.trim();
  const guide = $('cr-guide').value.trim();
  const ability = ($('cr-ability') && $('cr-ability').value) || '';  // ★ 技能模板（单选）
  // ★ 积木技能（多选，可叠加）；勾了任意积木则优先用积木组合
  const abilities = Array.from(document.querySelectorAll('.cr-blk')).filter(cb => cb.checked).map(cb => cb.value);
  const portrait = safeCustomRoleArt(customRoleArtDraft.portrait);
  const actionCG = safeCustomRoleArt(customRoleArtDraft.actionCG);

  if (!name) { $('cr-name').focus(); $('cr-name').style.borderColor='var(--cinnabar)'; return; }
  $('cr-name').style.borderColor='';

  const editId = $('cr-save').dataset.editId;
  let id;

  if (editId) {
    // 编辑模式：原id保留
    id = editId;
    const nextDefs = (window._customRolesDefs||[]).map(x => x.id===id ? {id,name,emoji,team,goodRoleClass,desc,guide,ability,abilities,portrait,actionCG} : x);
    if (nextDefs.reduce((n,x)=>n+(x.portrait||'').length+(x.actionCG||'').length,0) > 1800000) { alert('自创角色图片总量过大，请移除部分图片后再保存。'); return; }
    window._customRolesDefs = nextDefs;
  } else {
    // 新建：生成唯一id
    id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    window._customRolesDefs = window._customRolesDefs || [];
    const next = {id, name, emoji, team, goodRoleClass, desc, guide, ability, abilities, portrait, actionCG};
    if ((window._customRolesDefs||[]).reduce((n,x)=>n+(x.portrait||'').length+(x.actionCG||'').length,0)+(portrait||'').length+(actionCG||'').length > 1800000) { alert('自创角色图片总量过大，请移除部分图片后再保存。'); return; }
    window._customRolesDefs.push(next);
  }

  registerCustomRole({id, name, emoji, team, goodRoleClass, desc, guide, ability, abilities, portrait, actionCG});
  saveCfg();
  roleBookPage = Math.max(0, Math.ceil(Object.keys(ALL_ROLES).length / ROLE_BOOK_PAGE_SIZE) - 1); initRoles();
  renderCustomRoleList();

  // 重置表单到新建状态
  $('cr-name').value=''; $('cr-emoji').value=''; $('cr-desc').value=''; $('cr-guide').value='';
  customRoleArtDraft={portrait:'',actionCG:''}; updateCustomRoleArtPreview();
  $('crpop-title').textContent='── ✏️ 自创角色 ──';
  $('cr-save').dataset.editId='';

  // 提示
  Render && Render.log && Render.log('system', `✅ 角色「${emoji}${name}」已保存，可在自定义局中使用`);
}

/* ================================================================
 *  § 人设库（开局可随机抽取分配给 AI）
 * ================================================================ */
window.personaPool = window.personaPool || [];

function openPersonaPool() {
  $('pp-title').value = '';
  $('pp-persona').value = '';
  $('pp-save').dataset.editId = '';
  renderPersonaPool();
  $('personapool-pop').classList.add('show');
}

function renderPersonaPool() {
  const list = $('pp-list');
  if (!list) return;
  const pool = window.personaPool || [];
  if (!pool.length) {
    list.innerHTML = '<div style="font-size:0.72em;color:#5a5070;text-align:center;padding:10px">人设库还是空的，先在上面新建一个吧</div>';
    return;
  }
  list.innerHTML = '<div style="font-size:0.72em;color:#8880a8;margin-bottom:6px;font-family:var(--font-title)">── 库中人设（' + pool.length + '）──</div>'
    + pool.map(pp => {
      const preview = (pp.persona || '').replace(/\s+/g, ' ').slice(0, 48);
      return `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 9px;background:rgba(208,160,240,0.04);border:1px solid rgba(208,160,240,0.1);border-radius:var(--r);margin-bottom:4px">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82em;font-family:var(--font-title);color:#d8d0e8">🎭 ${escapeHtml(pp.title || '(未命名)')}</div>
          <div style="font-size:0.65em;color:#6a6080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(preview)}${(pp.persona||'').length>48?'…':''}</div>
        </div>
        <button onclick="editPersona('${pp.id}')" style="padding:3px 8px;font-size:0.7em;background:rgba(104,184,232,0.1);color:var(--jade);border:1px solid var(--jade);border-radius:var(--r);cursor:pointer">编辑</button>
        <button onclick="deletePersona('${pp.id}')" style="padding:3px 8px;font-size:0.7em;background:rgba(200,48,64,0.1);color:var(--cinnabar-light);border:1px solid rgba(200,48,64,0.3);border-radius:var(--r);cursor:pointer">删除</button>
      </div>`;
    }).join('');
}

function escapeHtml(s) {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function editPersona(id) {
  const pp = (window.personaPool||[]).find(x=>x.id===id);
  if (!pp) return;
  $('pp-title').value = pp.title || '';
  $('pp-persona').value = pp.persona || '';
  $('pp-save').dataset.editId = id;
  $('pp-title').focus();
}

function deletePersona(id) {
  window.personaPool = (window.personaPool||[]).filter(x=>x.id!==id);
  saveCfg();
  renderPersonaPool();
}

function savePersonaToPool() {
  const title = $('pp-title').value.trim();
  const persona = $('pp-persona').value.trim();
  if (!persona) { $('pp-persona').focus(); $('pp-persona').style.borderColor='var(--cinnabar)'; return; }
  $('pp-persona').style.borderColor='';
  const editId = $('pp-save').dataset.editId;
  window.personaPool = window.personaPool || [];
  if (editId) {
    window.personaPool = window.personaPool.map(x => x.id===editId ? {id:editId, title:title||'(未命名)', persona} : x);
  } else {
    window.personaPool.push({ id: 'persona_' + Date.now() + '_' + Math.floor(Math.random()*1000), title: title||'(未命名)', persona });
  }
  saveCfg();
  // 重置表单到新建状态
  $('pp-title').value=''; $('pp-persona').value=''; $('pp-save').dataset.editId='';
  renderPersonaPool();
}

// 开局调用：把库里的人设随机分配给 AI 位子（只填没手动配人设的位，池子不够则循环复用）
function applyPersonaPoolToPlayers() {
  // 先清除上一局由人设池写入的临时人设，避免被误当成"手动配置"而不再随机
  for (const k in playerConfigs) {
    if (playerConfigs[k] && playerConfigs[k]._fromPool) {
      delete playerConfigs[k].persona;
      delete playerConfigs[k]._fromPool;
      delete playerConfigs[k]._poolTitle;
    }
  }
  if (!$('m-persona-pool') || !$('m-persona-pool').checked) return;
  const pool = window.personaPool || [];
  if (!pool.length) return;
  const shuffled = shuffle(pool.slice());
  let k = 0;
  S.players.forEach(p => {
    if (p.isPlayer) return;                       // 跳过真人/导演接管位
    const cfg = playerConfigs[p.id] || {};
    if (cfg.persona && cfg.persona.trim()) return; // 已手动配人设的位不覆盖
    const chosen = shuffled[k % shuffled.length];
    k++;
    playerConfigs[p.id] = { ...(playerConfigs[p.id]||{}), persona: chosen.persona, _fromPool: true, _poolTitle: chosen.title };
  });
}

// 头像预览更新
function updateAvatarPreview(src) {
  const el = $('pcavatar-preview');
  if (!el) return;
  if (src) {
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML='❌'">`;
  } else {
    el.innerHTML = '';
  }
}

// 获取玩家头像HTML（圆形小图或emoji）
function getAvatarHtml(p, size) {
  size = size || 24;
  const cfg = playerConfigs[p.id];
  const av = cfg && cfg.avatar;
  if (av) {
    return `<img src="${av}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;vertical-align:middle;border:1px solid rgba(245,160,184,0.2)" onerror="this.style.display='none'">`;
  }
  const label = blindNamesOn() && !canSee(p)
    ? `P${p.id + 1}`
    : String(p.name || `P${p.id + 1}`).trim().slice(0, 1).toUpperCase();
  return `<span class="log-avatar" style="width:${size}px;height:${size}px;flex-basis:${size}px">${escapeHtml(label)}</span>`;
}
