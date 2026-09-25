// API 配置存取与备选 API
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 6. 配置存取
 * ================================================================ */
/* ================================================================
 *  § 备选API管理
 * ================================================================ */
let extraFallbacks = []; // [{url,key,model,type}, ...]

function renderFbList() {
  const list = $('fb-list');
  if (!list) return;
  list.innerHTML = '';
  // 始终至少显示1条（原始备选）
  const rows = extraFallbacks.length ? extraFallbacks : [{url:'',key:'',model:'',type:'openai'}];
  if (!extraFallbacks.length) extraFallbacks = rows;
  rows.forEach((fb, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:5px;background:rgba(255,255,255,0.02);border:1px solid rgba(245,160,184,0.1);border-radius:var(--r);padding:5px 7px';
    row.innerHTML = `
      <div style="display:flex;gap:4px;margin-bottom:3px;align-items:center">
        <span style="font-size:.65em;color:#6a6080;min-width:14px">#${i+1}</span>
        <input type="text" placeholder="备选API地址" value="${fb.url||''}" style="flex:2;font-size:.75em" data-fi="${i}" data-field="url">
        <input type="password" placeholder="密钥" value="${fb.key||''}" style="flex:1;font-size:.75em" data-fi="${i}" data-field="key">
        <button data-fi="${i}" class="fb-del" style="padding:1px 6px;background:rgba(200,48,64,0.15);border:1px solid rgba(200,48,64,0.3);border-radius:4px;color:#c87080;font-size:.75em;cursor:pointer">✕</button>
      </div>
      <div style="display:flex;gap:4px">
        <input type="text" placeholder="模型名称" value="${fb.model||''}" style="flex:2;font-size:.75em" data-fi="${i}" data-field="model">
        <select style="flex:1;font-size:.72em" data-fi="${i}" data-field="type">
          <option value="openai"${fb.type==='openai'?' selected':''}>OpenAI兼容</option>
          <option value="anthropic"${fb.type==='anthropic'?' selected':''}>Anthropic</option>
          <option value="gemini"${fb.type==='gemini'?' selected':''}>Gemini</option>
        </select>
      </div>`;
    // 事件
    row.querySelectorAll('input,select').forEach(el => {
      el.addEventListener('input', () => {
        const idx = parseInt(el.dataset.fi);
        extraFallbacks[idx][el.dataset.field] = el.value;
        saveCfg();
      });
    });
    row.querySelector('.fb-del').onclick = () => {
      if (extraFallbacks.length > 1) {
        extraFallbacks.splice(i, 1);
        renderFbList(); saveCfg();
      }
    };
    list.appendChild(row);
  });
}

function getFallbacks() {
  // 兼容旧版单备选字段
  const legacy = {
    url: ($('fb-url') && $('fb-url').value.trim()) || '',
    key: ($('fb-key') && $('fb-key').value.trim()) || '',
    model: ($('fb-model') && $('fb-model').value.trim()) || '',
    type: ($('fb-type') && $('fb-type').value) || 'openai'
  };
  const list = extraFallbacks.filter(f => f.url && f.key);
  if (!list.length && legacy.url && legacy.key) return [legacy];
  return list;
}

/* ================================================================
 *  § SaveStore：IndexedDB 存档库
 *  容量几百MB起（远超localStorage的5MB），支持多槽位。
 *  同步读写走内存缓存，落盘异步写IndexedDB；auto槽镜像一份到
 *  localStorage 以兼容旧版本与云存档。
 * ================================================================ */
const SaveStore = (() => {
  const DB_NAME = 'wolf_saves', STORE = 'saves', LEGACY_KEY = 'wg_savegame';
  const cache = {};  // slot -> json字符串（同步读取用）
  let db = null, available = ('indexedDB' in window);

  function open() {
    return new Promise((resolve) => {
      if (!available) return resolve(null);
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { available = false; resolve(null); };
      } catch (_) { available = false; resolve(null); }
    });
  }

  const ready = (async () => {
    db = await open();
    if (db) {
      await new Promise((resolve) => {
        try {
          const st = db.transaction(STORE, 'readonly').objectStore(STORE);
          const keysReq = st.getAllKeys(), valsReq = st.getAll();
          valsReq.onsuccess = () => {
            const ks = keysReq.result || [], vs = valsReq.result || [];
            ks.forEach((k, i) => { if (typeof vs[i] === 'string') cache[k] = vs[i]; });
            resolve();
          };
          valsReq.onerror = () => resolve();
        } catch (_) { resolve(); }
      });
    }
    // 迁移：旧的 localStorage 存档搬进 IndexedDB（IDB里没有或localStorage更新时）
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        let lt = 0, ct = -1;
        try { lt = (JSON.parse(legacy)._time) || 0; } catch (_) {}
        try { ct = cache.auto ? (JSON.parse(cache.auto)._time || 0) : -1; } catch (_) {}
        if (ct < lt) set('auto', legacy);
      }
    } catch (_) {}
    return true;
  })();

  function persist(slot, json) {
    if (!db) return;
    try {
      const tx = db.transaction(STORE, 'readwrite');
      if (json === null) tx.objectStore(STORE).delete(slot);
      else tx.objectStore(STORE).put(json, slot);
      tx.onerror = (e) => console.error('[存档库] IndexedDB写入失败', slot, e);
    } catch (e) { console.error('[存档库] IndexedDB写入异常', e); }
  }

  function set(slot, json) {
    cache[slot] = json;
    persist(slot, json);
    if (slot === 'auto') {  // 兼容镜像：放不下就静默放弃（IDB里已有完整版）
      try { localStorage.setItem(LEGACY_KEY, json); } catch (_) {}
    }
  }

  function get(slot) {
    if (cache[slot] != null) return cache[slot];
    if (slot === 'auto') { try { return localStorage.getItem(LEGACY_KEY); } catch (_) {} }
    return null;
  }

  function remove(slot) {
    delete cache[slot];
    persist(slot, null);
    if (slot === 'auto') { try { localStorage.removeItem(LEGACY_KEY); } catch (_) {} }
  }

  function meta(slot) {
    const raw = get(slot);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      const players = (s.S && s.S.players) || [];
      return {
        slot, time: s._time || 0,
        round: s.S && s.S.round, phase: (s.S && s.S.phase) || '',
        alive: players.filter(p => p.alive).length, total: players.length,
        sizeKB: Math.round(raw.length / 1024)
      };
    } catch (_) { return {slot, time: 0, broken: true}; }
  }

  return {ready, get, set, remove, meta, isAvailable: () => available};
})();
