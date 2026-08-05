(function () {
  'use strict';

  const FORMAT = 'wolf-teaching-worldbooks';
  const VERSION = 1;
  const MAX_BOOKS = 200;
  const MAX_CONTENT = 100000;
  const MAX_TOTAL_CONTENT = 800000;
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const VALID_MODES = new Set(['official', 'custom', 'hybrid', 'clean']);
  const VALID_TEAMS = new Set(['good', 'bad', 'third']);
  const VALID_PHASES = new Set(['night', 'day', 'sheriff', 'vote', 'ending']);
  const UI_EN = /\/en(?:\/|$)/.test(location.pathname);
  const UI = UI_EN ? {
    modes:{official:'Official teaching',custom:'Custom worldbooks',hybrid:'Hybrid',clean:'Clean mode'},
    empty:'No custom teaching worldbooks yet. Choose “Write a worldbook” and type the teaching prompt directly.', priority:'Priority', global:'Global',
    edit:'Edit', export:'Export', remove:'Delete', enable:'Enable this worldbook', confirmDelete:name=>`Delete “${name}”?`,
    needName:'Enter a worldbook name', needContent:'Enter teaching prompt content', tooLarge:'Worldbook file cannot exceed 2MB',
    imported:n=>`Imported ${n} teaching worldbook(s)`, importFailed:e=>'Import failed: '+e
  } : {
    modes:{official:'官方教学',custom:'自定义世界书',hybrid:'混合模式',clean:'纯净模式'},
    empty:'还没有自定义教学世界书。点击“手写新世界书”，直接写下希望 AI 遵循的教学提示词。', priority:'优先级', global:'全局生效',
    edit:'编辑', export:'导出', remove:'删除', enable:'启用这本世界书', confirmDelete:name=>`删除世界书“${name}”？`,
    needName:'请填写世界书名称', needContent:'请填写教学提示词内容', tooLarge:'世界书文件不能超过 2MB',
    imported:n=>`已导入 ${n} 本教学世界书`, importFailed:e=>'导入失败：'+e
  };

  let state = { mode: 'official', maxChars: 12000, books: [] };
  let onChange = function () {};
  let getContext = function () { return {}; };

  const el = id => document.getElementById(id);
  const uid = () => 'wb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const listify = value => {
    const arr = Array.isArray(value) ? value : String(value || '').split(/[,，\n]/);
    return [...new Set(arr.map(x => String(x || '').trim()).filter(Boolean))];
  };
  const clamp = (n, min, max, fallback) => {
    n = Number(n);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  const normalizedPhase = phase => {
    phase = String(phase || '').toLowerCase();
    if (phase === 'night') return 'night';
    if (phase.includes('sheriff')) return 'sheriff';
    if (phase.includes('vote') || phase.includes('trial') || phase.includes('duel')) return 'vote';
    if (phase.includes('end') || phase.includes('over') || phase.includes('mvp')) return 'ending';
    return 'day';
  };

  function normalizeBook(raw, index) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const teams = listify(raw.teams || raw.team).filter(x => VALID_TEAMS.has(x));
    const phases = listify(raw.phases || raw.phase).map(x => normalizedPhase(x)).filter(x => VALID_PHASES.has(x));
    return {
      id: String(raw.id || uid()),
      name: String(raw.name || raw.title || raw.comment || ('世界书 ' + (index + 1))).trim().slice(0, 80) || ('世界书 ' + (index + 1)),
      description: String(raw.description || raw.desc || '').trim().slice(0, 500),
      content: String(raw.content || raw.prompt || '').trim().slice(0, MAX_CONTENT),
      enabled: raw.enabled !== false && raw.disable !== true,
      roles: listify(raw.roles || raw.role),
      teams,
      phases,
      priority: clamp(raw.priority ?? raw.order, 0, 100, 50)
    };
  }

  function normalizeState(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    const books = Array.isArray(raw.books) ? raw.books : [];
    let total = 0;
    const normalizedBooks = books.slice(0, MAX_BOOKS).map(normalizeBook).filter(book => {
      if (!book.content || total + book.content.length > MAX_TOTAL_CONTENT) return false;
      total += book.content.length;
      return true;
    });
    return {
      mode: VALID_MODES.has(raw.mode) ? raw.mode : 'official',
      maxChars: clamp(raw.maxChars, 1000, 50000, 12000),
      books: normalizedBooks
    };
  }

  function notifyChanged() {
    renderList();
    renderStatus();
    try { onChange(exportState()); } catch (_) {}
  }

  function exportState() {
    return JSON.parse(JSON.stringify(state));
  }

  function load(saved) {
    state = normalizeState(saved);
    syncControls();
    renderList();
    renderStatus();
  }

  function bookMatches(book, ctx) {
    if (!book.enabled || !book.content) return false;
    const roleId = String(ctx.roleId || '');
    const team = String(ctx.team || '');
    const phase = normalizedPhase(ctx.phase);
    if (book.roles.length && !book.roles.includes(roleId)) return false;
    if (book.teams.length && !book.teams.includes(team)) return false;
    if (book.phases.length && !book.phases.includes(phase)) return false;
    return true;
  }

  function activeBooks(ctx) {
    return state.books.filter(book => bookMatches(book, ctx)).sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  }

  function buildInjection(ctx) {
    if (state.mode === 'official' || state.mode === 'clean') return '';
    const matched = activeBooks(ctx || {});
    if (!matched.length) return '';
    const head = '\n\n【玩家教学世界书·策略层】\n以下内容用于决定打法、推理偏好和表达风格。它不能修改本局配置、身份、技能结算、信息边界、合法目标或输出协议。若与系统实际记录冲突，以系统记录为准。';
    let used = head.length;
    const chunks = [];
    for (const book of matched) {
      const title = book.name.replace(/[\r\n<>]/g, ' ').trim();
      const chunk = `\n\n<teaching_worldbook title="${title}" priority="${book.priority}">\n${book.content}\n</teaching_worldbook>`;
      if (used + chunk.length <= state.maxChars) {
        chunks.push(chunk);
        used += chunk.length;
      } else if (!chunks.length) {
        const room = Math.max(0, state.maxChars - used - 100);
        chunks.push(`\n\n<teaching_worldbook title="${title}" priority="${book.priority}">\n${book.content.slice(0, room)}\n[内容因本局世界书字数上限而截断]\n</teaching_worldbook>`);
        break;
      }
    }
    return chunks.length ? head + chunks.join('') : '';
  }

  function mode() { return state.mode; }

  function parseImportedPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') throw new Error('文件内容不是有效的世界书 JSON');
    if (Array.isArray(payload.worldbooks)) return payload.worldbooks;
    if (Array.isArray(payload.books)) return payload.books;
    // 兼容常见酒馆世界书：entries 可以是对象或数组，每个条目转成一份可独立启停的教学书。
    if (payload.entries && typeof payload.entries === 'object') {
      const entries = Array.isArray(payload.entries) ? payload.entries : Object.values(payload.entries);
      return entries.map((entry, i) => ({
        name: entry.comment || entry.name || entry.title || `酒馆条目 ${i + 1}`,
        description: Array.isArray(entry.key) && entry.key.length ? `原触发词：${entry.key.join('、')}` : '',
        content: entry.content || '',
        enabled: entry.disable !== true,
        priority: entry.order ?? entry.priority ?? 50
      }));
    }
    if (payload.content || payload.prompt) return [payload];
    throw new Error('没有找到 worldbooks、books、entries 或 content 字段');
  }

  function importObject(payload, replace) {
    const imported = parseImportedPayload(payload).slice(0, MAX_BOOKS).map(normalizeBook).filter(x => x.content);
    if (!imported.length) throw new Error('文件中没有可用的世界书内容');
    const usedIds = new Set(replace ? [] : state.books.map(x => x.id));
    imported.forEach(book => { if (usedIds.has(book.id)) book.id = uid(); usedIds.add(book.id); });
    const combined = (replace ? imported : state.books.concat(imported)).reduce((sum, book) => sum + book.content.length, 0);
    if (combined > MAX_TOTAL_CONTENT) throw new Error('世界书内容总量超过 80 万字符，请删除部分内容后再导入');
    if (replace) state.books = imported;
    else state.books = state.books.concat(imported).slice(0, MAX_BOOKS);
    notifyChanged();
    return imported.length;
  }

  function download(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportPayload(books) {
    return {type:FORMAT, version:VERSION, exportedAt:new Date().toISOString(), worldbooks:books};
  }

  function renderStatus() {
    const node = el('twb-status');
    if (!node) return;
    const ctx = getContext() || {};
    const active = activeBooks(ctx).length;
    const base = UI_EN
      ? `${UI.modes[state.mode]} · ${state.books.length} saved · ${active} match current conditions`
      : `${UI.modes[state.mode]} · 已保存 ${state.books.length} 本 · 当前条件匹配 ${active} 本`;
    const roleIds = Array.isArray(ctx.rolesInGame) ? [...new Set(ctx.rolesInGame.filter(Boolean))] : [];
    node.textContent = base + (roleIds.length ? (UI_EN ? ` · Role IDs in this game: ${roleIds.join(', ')}` : ` · 本局身份ID：${roleIds.join('、')}`) : '');
  }

  function renderList() {
    const root = el('twb-list');
    if (!root) return;
    root.innerHTML = '';
    if (!state.books.length) {
      const empty = document.createElement('div');
      empty.className = 'twb-empty';
      empty.textContent = UI.empty;
      root.appendChild(empty);
      return;
    }
    state.books.slice().sort((a,b) => b.priority-a.priority).forEach(book => {
      const row = document.createElement('div');
      row.className = 'twb-row';
      const toggle = document.createElement('input');
      toggle.type = 'checkbox'; toggle.checked = book.enabled;
      toggle.title = UI.enable;
      toggle.addEventListener('change', () => { book.enabled = toggle.checked; notifyChanged(); });
      const info = document.createElement('div'); info.className = 'twb-info';
      const name = document.createElement('strong'); name.textContent = book.name;
      const meta = document.createElement('span');
      const scope = [book.roles.length ? (UI_EN?'Roles:':'身份:')+book.roles.join('/') : '', book.teams.length ? (UI_EN?'Teams:':'阵营:')+book.teams.join('/') : '', book.phases.length ? (UI_EN?'Phases:':'阶段:')+book.phases.join('/') : ''].filter(Boolean).join(' · ');
      meta.textContent = `${UI.priority} ${book.priority}${scope ? ' · '+scope : ' · '+UI.global}`;
      const preview = document.createElement('small'); preview.textContent = book.description || book.content.slice(0, 90);
      info.append(name, meta, preview);
      const actions = document.createElement('div'); actions.className = 'twb-actions';
      const edit = document.createElement('button'); edit.type='button'; edit.textContent=UI.edit; edit.onclick=()=>openEditor(book.id);
      const out = document.createElement('button'); out.type='button'; out.textContent=UI.export; out.onclick=()=>download(`${safeFilename(book.name)}.json`, exportPayload([book]));
      const del = document.createElement('button'); del.type='button'; del.textContent=UI.remove; del.className='danger'; del.onclick=()=>{ if(confirm(UI.confirmDelete(book.name))){ state.books=state.books.filter(x=>x.id!==book.id); notifyChanged(); } };
      actions.append(edit,out,del);
      row.append(toggle,info,actions);
      root.appendChild(row);
    });
  }

  function safeFilename(name) {
    return String(name || '狼人杀教学世界书').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  }

  function openEditor(id) {
    const book = state.books.find(x => x.id === id) || null;
    el('twb-edit-id').value = book ? book.id : '';
    el('twb-edit-name').value = book ? book.name : '';
    el('twb-edit-desc').value = book ? book.description : '';
    el('twb-edit-content').value = book ? book.content : '';
    el('twb-edit-roles').value = book ? book.roles.join(', ') : '';
    el('twb-edit-teams').value = book ? book.teams.join(', ') : '';
    el('twb-edit-phases').value = book ? book.phases.join(', ') : '';
    el('twb-edit-priority').value = book ? book.priority : 50;
    el('twb-main-view').style.display = 'none';
    el('twb-edit-view').style.display = 'flex';
  }

  function closeEditor() {
    el('twb-edit-view').style.display = 'none';
    el('twb-main-view').style.display = 'block';
  }

  function saveEditor() {
    const name = el('twb-edit-name').value.trim();
    const content = el('twb-edit-content').value.trim();
    if (!name) return alert(UI.needName);
    if (!content) return alert(UI.needContent);
    const raw = {
      id: el('twb-edit-id').value || uid(), name,
      description: el('twb-edit-desc').value,
      content,
      roles: listify(el('twb-edit-roles').value),
      teams: listify(el('twb-edit-teams').value),
      phases: listify(el('twb-edit-phases').value),
      priority: el('twb-edit-priority').value,
      enabled: true
    };
    const book = normalizeBook(raw, state.books.length);
    const index = state.books.findIndex(x => x.id === book.id);
    const total = state.books.reduce((sum, item, i) => sum + (i === index ? 0 : item.content.length), 0) + book.content.length;
    if (total > MAX_TOTAL_CONTENT) return alert(UI_EN ? 'Total worldbook content cannot exceed 800,000 characters' : '世界书内容总量不能超过 80 万字符');
    if (index >= 0) book.enabled = state.books[index].enabled;
    if (index >= 0) state.books[index] = book; else state.books.push(book);
    closeEditor();
    notifyChanged();
  }

  function syncControls() {
    if (el('twb-mode')) el('twb-mode').value = state.mode;
    if (el('twb-max-chars')) el('twb-max-chars').value = state.maxChars;
  }

  function injectStyles() {
    if (el('twb-style')) return;
    const style = document.createElement('style');
    style.id = 'twb-style';
    style.textContent = `
      .twb-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:9px 0}.twb-toolbar select,.twb-toolbar input{min-width:120px}
      .twb-note{padding:9px 11px;border:1px solid rgba(184,154,91,.28);background:rgba(184,154,91,.06);border-radius:8px;color:#a9a0ba;font-size:.72em;line-height:1.6}
      .twb-list{display:flex;flex-direction:column;gap:7px;max-height:42vh;overflow:auto;margin-top:10px}.twb-empty{padding:28px;text-align:center;color:#777087;border:1px dashed rgba(184,154,91,.22);border-radius:9px}
      .twb-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(184,154,91,.2);background:rgba(20,17,28,.72);border-radius:9px}.twb-row>input{min-width:auto;width:auto}
      .twb-info{min-width:0;display:flex;flex-direction:column;gap:2px}.twb-info strong{color:#e2c98d}.twb-info span{font-size:.67em;color:#9087a0}.twb-info small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#aaa1ba}
      .twb-actions{display:flex;gap:5px}.twb-actions button{padding:5px 8px;font-size:.7em}.twb-actions .danger{color:#d98a98;border-color:rgba(217,92,112,.35)}
      .twb-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.twb-edit-grid .wide{grid-column:1/-1}.twb-edit-grid label{display:flex;flex-direction:column;gap:4px;font-size:.72em;color:#9f96ae}.twb-edit-grid input,.twb-edit-grid textarea{max-width:none;width:100%}
      .twb-advanced{margin-top:2px;padding:8px 10px;border:1px solid rgba(184,154,91,.18);border-radius:8px;background:rgba(255,255,255,.025)}.twb-advanced summary{cursor:pointer;color:#a99db8;font-size:.74em;margin-bottom:7px}.twb-advanced>.twb-edit-grid{padding-top:4px}
      @media(max-width:700px){.twb-row{grid-template-columns:auto minmax(0,1fr)}.twb-actions{grid-column:1/-1;justify-content:flex-end}.twb-edit-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (el('teaching-wb-modal')) return;
    const en = UI_EN;
    const modal = document.createElement('div');
    modal.className = 'epop';
    modal.id = 'teaching-wb-modal';
    modal.innerHTML = en ? `
      <div class="ebox" style="max-width:820px;width:94%">
        <h3>Teaching Worldbooks</h3>
        <div id="twb-main-view">
          <div class="twb-note">Worldbooks control AI strategy, reasoning preferences, and speaking style only. Game identity, skill resolution, information boundaries, legal targets, and output protocol remain protected hard rules.</div>
          <div class="twb-toolbar">
            <label>Injection mode <select id="twb-mode"><option value="official">Official teaching</option><option value="custom">Custom only</option><option value="hybrid">Official + custom</option><option value="clean">Clean (no teaching)</option></select></label>
            <label>Maximum characters <input id="twb-max-chars" type="number" min="1000" max="50000" step="500" value="12000"></label>
            <button type="button" id="twb-add">Write a worldbook</button>
            <label class="be" style="cursor:pointer">Import file (optional)<input type="file" id="twb-import-file" accept=".json,.txt,application/json,text/plain" style="display:none"></label>
            <button type="button" id="twb-export-all">Export all</button>
          </div>
          <div id="twb-status" style="font-size:.7em;color:#9b91aa"></div><div id="twb-list" class="twb-list"></div>
          <div class="btns"><button type="button" id="twb-close">Close</button></div>
        </div>
        <div id="twb-edit-view" style="display:none;flex-direction:column;gap:10px">
          <input type="hidden" id="twb-edit-id"><div class="twb-edit-grid">
            <label class="wide">Worldbook name<input id="twb-edit-name" maxlength="80" placeholder="e.g. Competitive logic"></label>
            <label class="wide">Write the teaching prompt<textarea id="twb-edit-content" maxlength="100000" placeholder="Tell the AI how to reason, claim roles, vote, cooperate, and speak. Plain language is enough; no JSON format is needed." style="height:360px;resize:vertical"></textarea></label>
            <label class="wide">Description (optional)<input id="twb-edit-desc" maxlength="500" placeholder="A short note for yourself"></label>
            <details class="wide twb-advanced"><summary>Advanced activation settings (optional)</summary><div class="twb-edit-grid">
              <label>Priority (0-100)<input id="twb-edit-priority" type="number" min="0" max="100" value="50"></label>
              <label>Player role IDs<input id="twb-edit-roles" placeholder="seer, witch; blank = all"></label>
              <label>Teams<input id="twb-edit-teams" placeholder="good, bad, third; blank = all"></label>
              <label>Phases<input id="twb-edit-phases" placeholder="night, day, sheriff, vote, ending; blank = all"></label>
            </div></details>
          </div><div class="btns"><button type="button" id="twb-edit-save">Save worldbook</button><button type="button" id="twb-edit-cancel">Cancel</button></div>
        </div>
      </div>` : `
      <div class="ebox" style="max-width:820px;width:94%">
        <h3>教学世界书</h3>
        <div id="twb-main-view">
          <div class="twb-note">世界书只控制 AI 的打法、推理偏好和表达风格。身份、技能结算、信息边界、合法目标和输出格式仍由游戏硬规则保护，世界书不能覆盖。</div>
          <div class="twb-toolbar">
            <label>注入模式 <select id="twb-mode"><option value="official">官方教学</option><option value="custom">仅自定义世界书</option><option value="hybrid">官方教学＋自定义</option><option value="clean">纯净模式（无教学）</option></select></label>
            <label>每次最多注入字符 <input id="twb-max-chars" type="number" min="1000" max="50000" step="500" value="12000"></label>
            <button type="button" id="twb-add">手写新世界书</button>
            <label class="be" style="cursor:pointer">从文件导入（可选）<input type="file" id="twb-import-file" accept=".json,.txt,application/json,text/plain" style="display:none"></label>
            <button type="button" id="twb-export-all">导出全部</button>
          </div>
          <div id="twb-status" style="font-size:.7em;color:#9b91aa"></div><div id="twb-list" class="twb-list"></div>
          <div class="btns"><button type="button" id="twb-close">关闭</button></div>
        </div>
        <div id="twb-edit-view" style="display:none;flex-direction:column;gap:10px">
          <input type="hidden" id="twb-edit-id"><div class="twb-edit-grid">
            <label class="wide">世界书名称<input id="twb-edit-name" maxlength="80" placeholder="例：高阶竞技逻辑流"></label>
            <label class="wide">直接手写教学提示词<textarea id="twb-edit-content" maxlength="100000" placeholder="直接告诉 AI 应该怎样推理、跳身份、投票、配合和发言。写普通文字即可，不需要 JSON 格式。" style="height:360px;resize:vertical"></textarea></label>
            <label class="wide">简介（可不填）<input id="twb-edit-desc" maxlength="500" placeholder="给自己看的简短说明"></label>
            <details class="wide twb-advanced"><summary>高级生效范围（可不设置）</summary><div class="twb-edit-grid">
              <label>优先级（0-100）<input id="twb-edit-priority" type="number" min="0" max="100" value="50"></label>
              <label>限定玩家身份 ID<input id="twb-edit-roles" placeholder="例：seer, witch；留空=全部"></label>
              <label>限定阵营<input id="twb-edit-teams" placeholder="good, bad, third；留空=全部"></label>
              <label>限定阶段<input id="twb-edit-phases" placeholder="night, day, sheriff, vote, ending；留空=全部"></label>
            </div></details>
          </div><div class="btns"><button type="button" id="twb-edit-save">保存世界书</button><button type="button" id="twb-edit-cancel">取消</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  function initUI(options) {
    options = options || {};
    onChange = typeof options.onChange === 'function' ? options.onChange : onChange;
    getContext = typeof options.getContext === 'function' ? options.getContext : getContext;
    injectStyles();
    ensureModal();
    const open = el('btn-teaching-wb');
    if (!open || open.dataset.bound === '1') return;
    open.dataset.bound = '1';
    open.addEventListener('click', () => { syncControls(); renderList(); renderStatus(); el('teaching-wb-modal').classList.add('show'); });
    el('twb-close').addEventListener('click', () => el('teaching-wb-modal').classList.remove('show'));
    el('twb-add').addEventListener('click', () => openEditor(''));
    el('twb-edit-cancel').addEventListener('click', closeEditor);
    el('twb-edit-save').addEventListener('click', saveEditor);
    el('twb-mode').addEventListener('change', e => { state.mode = VALID_MODES.has(e.target.value) ? e.target.value : 'official'; notifyChanged(); });
    el('twb-max-chars').addEventListener('change', e => { state.maxChars = clamp(e.target.value,1000,50000,12000); e.target.value=state.maxChars; notifyChanged(); });
    el('twb-export-all').addEventListener('click', () => download('狼人杀教学世界书.json', exportPayload(state.books)));
    el('twb-import-file').addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) return alert(UI.tooLarge);
      try {
        const rawText = await file.text();
        let payload;
        try { payload = JSON.parse(rawText); }
        catch (jsonError) {
          if (!/\.txt$/i.test(file.name)) throw jsonError;
          payload = {name:file.name.replace(/\.txt$/i,''), description:'Imported from plain text', content:rawText};
        }
        const count = importObject(payload, false);
        alert(UI.imported(count));
      } catch (err) { alert(UI.importFailed(err.message || err)); }
    });
    syncControls(); renderList(); renderStatus();
  }

  window.TeachingWorldbooks = {load, exportState, buildInjection, activeBooks, mode, initUI, importObject, format:FORMAT, version:VERSION};
})();
