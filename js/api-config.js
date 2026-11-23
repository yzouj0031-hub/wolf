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
          <option value="vertex"${fb.type==='vertex'?' selected':''}>Vertex AI</option>
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

/* ================================================================
 *  § VertexDirect：Google Cloud Vertex AI 浏览器原生直连
 *  支持 3 种鉴权凭证（自动识别）：
 *    1. 服务账号 JSON（Service Account Key JSON）：浏览器本地用 Web Crypto RS256
 *       签发 JWT 向 oauth2.googleapis.com/token 换取 access_token，缓存 50 分钟自动续期；
 *    2. OAuth2 访问令牌（ya29.xxx）：直接作为 Bearer Token 发送；
 *    3. Google Cloud API Key（AIzaSy...）：支持 Vertex Express Mode / 绑定项目的 API Key。
 *  支持 3 类 Vertex 模型自动分流：
 *    - Gemini 系列 → Vertex 原生 :generateContent（保留 Gemini 3 thought 原生分离与前缀缓存）
 *    - Claude 系列 → Vertex Anthropic :rawPredict（保留双断点 cache_control 与 adaptive thinking）
 *    - Model Garden 第三方模型（如 deepseek-ai/...）→ Vertex /endpoints/openapi/chat/completions
 * ================================================================ */
const VertexDirect = (() => {
  const DEFAULT_MODELS = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.0-flash',
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-opus-4-5@20251101',
    'claude-sonnet-4-5@20250929',
    'claude-haiku-4-5@20251001',
    'claude-3-7-sonnet@20250219'
  ];

  const CLAUDE_VERTEX_ALIAS = {
    'claude-opus-4-5': 'claude-opus-4-5@20251101',
    'claude-opus-4-5-20251101': 'claude-opus-4-5@20251101',
    'claude-sonnet-4-5': 'claude-sonnet-4-5@20250929',
    'claude-sonnet-4-5-20250929': 'claude-sonnet-4-5@20250929',
    'claude-haiku-4-5': 'claude-haiku-4-5@20251001',
    'claude-haiku-4-5-20251001': 'claude-haiku-4-5@20251001',
    'claude-3-7-sonnet': 'claude-3-7-sonnet@20250219',
    'claude-3-7-sonnet-20250219': 'claude-3-7-sonnet@20250219',
    'claude-3-5-sonnet': 'claude-3-5-sonnet-v2@20241022',
    'claude-3-5-haiku': 'claude-3-5-haiku@20241022'
  };

  const _tokenCache = new Map();    // clientEmail -> { token, expMs }
  const _tokenInflight = new Map(); // clientEmail -> Promise<string>

  function isVertexUrl(url) {
    const s = String(url || '').trim().toLowerCase();
    return s.startsWith('vertex://') || s.includes('aiplatform.googleapis.com');
  }

  function _tryParseSaJson(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    let candidate = s;
    if (!candidate.startsWith('{') && /^[A-Za-z0-9+/=_-]{60,}$/.test(candidate)) {
      try { candidate = atob(candidate.replace(/-/g, '+').replace(/_/g, '/')); } catch (_) {}
    }
    if (!candidate.startsWith('{')) return null;
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && obj.client_email && obj.private_key) return obj;
    } catch (_) {}
    return null;
  }

  function parseKey(rawKey) {
    const s = String(rawKey || '').trim();
    if (!s) return { kind: 'empty', projectId: '' };
    const sa = _tryParseSaJson(s);
    if (sa) {
      return {
        kind: 'sa_json',
        sa,
        projectId: String(sa.project_id || '').trim(),
        clientEmail: String(sa.client_email || '').trim()
      };
    }
    if (s.startsWith('{')) {
      return { kind: 'invalid_json', projectId: '', error: 'JSON 缺少 client_email 或 private_key 字段（请确认是 Google Cloud 服务账号密钥 JSON）' };
    }
    if (/^ya29\./.test(s)) {
      return { kind: 'oauth_token', token: s, projectId: '' };
    }
    if (/^AIza[0-9A-Za-z_-]{20,}/.test(s)) {
      return { kind: 'api_key', apiKey: s, projectId: '' };
    }
    return { kind: 'token', token: s, projectId: '' };
  }

  function _isRegionName(seg) {
    return /^(?:global|[a-z]+-[a-z]+\d+[a-z]?)$/i.test(String(seg || '').trim());
  }

  function resolveSpec(rawUrl, rawKey, rawModel) {
    const keyInfo = parseKey(rawKey);
    const u = String(rawUrl || '').trim().replace(/\/+$/, '');
    let projectId = '';
    let location = '';
    let forceOpenAI = false;

    if (/\/endpoints\/openapi\b/i.test(u)) forceOpenAI = true;

    // 1. 完整 https://...aiplatform.googleapis.com/... 地址提取
    const mProj = u.match(/\/projects\/([^/?#]+)/i);
    const mLoc  = u.match(/\/locations\/([^/?#]+)/i);
    const mHostLoc = u.match(/^https?:\/\/([a-z0-9-]+)-aiplatform\.googleapis\.com/i);
    if (mProj) projectId = mProj[1];
    if (mLoc) location = mLoc[1];
    else if (mHostLoc) location = mHostLoc[1];

    // 2. vertex://[projectId/]location 或 简写 [projectId/]location
    if (!projectId && !location) {
      const stripped = u.replace(/^vertex:\/\//i, '').replace(/^https?:\/\/[^/]+\/?/i, '').replace(/^\/+|\/+$/g, '');
      const parts = stripped ? stripped.split('/').filter(Boolean) : [];
      if (parts.length === 1) {
        if (_isRegionName(parts[0])) {
          location = parts[0].toLowerCase();
        } else {
          projectId = parts[0];
        }
      } else if (parts.length >= 2) {
        if (_isRegionName(parts[0]) && !_isRegionName(parts[1])) {
          location = parts[0].toLowerCase();
          projectId = parts[1];
        } else {
          projectId = parts[0];
          location = parts[1].toLowerCase();
        }
      }
    }

    if (!projectId && keyInfo.projectId) projectId = keyInfo.projectId;
    if (!location) location = 'global';

    const host = location === 'global'
      ? 'https://aiplatform.googleapis.com'
      : `https://${location}-aiplatform.googleapis.com`;

    const rawM = String(rawModel || '').trim() || 'gemini-2.5-pro';
    let cleanModel = rawM
      .replace(/^publishers\/(?:google|anthropic)\/models\//i, '')
      .replace(/^models\//i, '')
      .replace(/^(?:google|anthropic)\//i, '');

    let protocol = 'gemini';
    let vertexModel = cleanModel;
    let endpoint = '';
    const pidDisplay = projectId || '<项目ID>';

    if (forceOpenAI || (cleanModel.includes('/') && !/^(?:gemini|claude)/i.test(cleanModel))) {
      protocol = 'openai';
      vertexModel = rawM;
      endpoint = `${host}/v1beta1/projects/${pidDisplay}/locations/${location}/endpoints/openapi/chat/completions`;
    } else if (/claude/i.test(cleanModel)) {
      protocol = 'anthropic';
      const lowerM = cleanModel.toLowerCase();
      vertexModel = CLAUDE_VERTEX_ALIAS[lowerM] || cleanModel;
      endpoint = `${host}/v1/projects/${pidDisplay}/locations/${location}/publishers/anthropic/models/${vertexModel}:rawPredict`;
    } else {
      protocol = 'gemini';
      if (!projectId && keyInfo.kind === 'api_key') {
        endpoint = `${host}/v1beta1/publishers/google/models/${vertexModel}:generateContent`;
      } else {
        endpoint = `${host}/v1beta1/projects/${pidDisplay}/locations/${location}/publishers/google/models/${vertexModel}:generateContent`;
      }
    }

    return {
      isVertex: true,
      protocol,
      host,
      projectId,
      location,
      vertexModel,
      endpoint,
      keyInfo
    };
  }

  function _b64UrlFromBytes(bytes) {
    let bin = '';
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function _b64UrlFromJson(obj) {
    return _b64UrlFromBytes(new TextEncoder().encode(JSON.stringify(obj)));
  }

  function _pemToArrayBuffer(pem) {
    const b64 = String(pem || '')
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\\n/g, '')
      .replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function _exchangeServiceAccountToken(sa) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error('当前环境不支持 Web Crypto API，无法在本地签发服务账号 JWT（请使用 HTTPS 或 localhost 访问）');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const header = { alg: 'RS256', typ: 'JWT' };
    if (sa.private_key_id) header.kid = sa.private_key_id;
    const payload = {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: tokenUri,
      iat: nowSec - 30,
      exp: nowSec + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform'
    };
    const signingInput = _b64UrlFromJson(header) + '.' + _b64UrlFromJson(payload);
    const keyBuf = _pemToArrayBuffer(sa.private_key);
    const cryptoKey = await window.crypto.subtle.importKey(
      'pkcs8',
      keyBuf,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await window.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signingInput)
    );
    const jwt = signingInput + '.' + _b64UrlFromBytes(sigBuf);
    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + encodeURIComponent(jwt)
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) {}
    if (!res.ok || !data.access_token) {
      const errDetail = data.error_description || data.error || text.slice(0, 200);
      throw new Error('Vertex 服务账号换取 Token 失败（HTTP ' + res.status + '）：' + errDetail);
    }
    return {
      token: data.access_token,
      expMs: Date.now() + ((Number(data.expires_in) || 3600) - 300) * 1000
    };
  }

  async function getAccessToken(sa) {
    const cacheKey = sa.client_email + '|' + (sa.private_key_id || '');
    const cached = _tokenCache.get(cacheKey);
    if (cached && cached.token && Date.now() < cached.expMs) {
      return cached.token;
    }
    if (_tokenInflight.has(cacheKey)) {
      return _tokenInflight.get(cacheKey);
    }
    const p = _exchangeServiceAccountToken(sa)
      .then(res => {
        _tokenCache.set(cacheKey, res);
        _tokenInflight.delete(cacheKey);
        return res.token;
      })
      .catch(err => {
        _tokenInflight.delete(cacheKey);
        throw err;
      });
    _tokenInflight.set(cacheKey, p);
    return p;
  }

  async function prepare(rawUrl, rawKey, rawModel) {
    const spec = resolveSpec(rawUrl, rawKey, rawModel);
    if (spec.keyInfo.kind === 'empty') {
      throw new Error('Vertex AI 未配置密钥：请导入服务账号 JSON 文件，或填入 OAuth Token / Google Cloud API Key');
    }
    if (spec.keyInfo.kind === 'invalid_json') {
      throw new Error(spec.keyInfo.error);
    }
    if (!spec.projectId && spec.keyInfo.kind !== 'api_key') {
      throw new Error('Vertex AI 缺少项目 ID（Project ID）：请在密钥框粘贴/导入服务账号 JSON，或在地址栏按 vertex://你的项目ID/' + spec.location + ' 格式填写');
    }
    let endpoint = spec.endpoint;
    const headers = { 'Content-Type': 'application/json' };
    if (spec.keyInfo.kind === 'sa_json') {
      const token = await getAccessToken(spec.keyInfo.sa);
      headers['Authorization'] = 'Bearer ' + token;
    } else if (spec.keyInfo.kind === 'api_key') {
      const sep = endpoint.includes('?') ? '&' : '?';
      endpoint = endpoint + sep + 'key=' + encodeURIComponent(spec.keyInfo.apiKey);
    } else {
      headers['Authorization'] = 'Bearer ' + (spec.keyInfo.token || String(rawKey || '').trim());
    }
    return Object.assign({}, spec, { endpoint, headers });
  }

  function applyServiceAccountJsonText(rawText, target) {
    const sa = _tryParseSaJson(rawText);
    if (!sa) throw new Error('所选文件不是有效的 Google Cloud 服务账号 JSON（需包含 client_email 与 private_key）');
    const compact = JSON.stringify(sa);
    const isPC = target === 'pc';
    const keyEl = $(isPC ? 'pck' : 'g-key');
    const urlEl = $(isPC ? 'pcu' : 'g-url');
    const typeEl = $(isPC ? 'pc-apitype' : 'g-apitype');
    if (typeEl) typeEl.value = 'vertex';
    if (keyEl) keyEl.value = compact;
    if (urlEl) {
      const curSpec = resolveSpec(urlEl.value, compact, '');
      const loc = curSpec.location || 'global';
      urlEl.value = sa.project_id ? `vertex://${sa.project_id}/${loc}` : `vertex://${loc}`;
    }
    if (typeof refreshApiChannelUI === 'function') refreshApiChannelUI(false);
    if (typeof saveCfg === 'function') saveCfg();
    return sa;
  }

  function pickServiceAccountFile(target) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const sa = applyServiceAccountJsonText(String(reader.result || ''), target || 'global');
          const msg = `✅ 已导入 Vertex 服务账号：${sa.client_email}（项目：${sa.project_id || '未含 project_id'}）`;
          if (typeof Render !== 'undefined' && Render.log) Render.log('system', msg);
          if (target === 'pc' && $('pc-test-result')) {
            const box = $('pc-test-result');
            box.style.display = 'block';
            box.style.background = 'rgba(80,160,100,0.15)';
            box.style.color = '#90d8a0';
            box.textContent = msg;
          }
        } catch (err) {
          alert('❌ 导入服务账号 JSON 失败：' + err.message);
        }
      };
      reader.readAsText(file);
    };
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => inp.remove(), 5000);
  }

  function setRegion(loc, target) {
    const isPC = target === 'pc';
    const urlEl = $(isPC ? 'pcu' : 'g-url');
    const keyEl = $(isPC ? 'pck' : 'g-key');
    if (!urlEl) return;
    const spec = resolveSpec(urlEl.value || ($('g-url') ? $('g-url').value : ''), (keyEl && keyEl.value) || ($('g-key') ? $('g-key').value : ''), '');
    urlEl.value = spec.projectId ? `vertex://${spec.projectId}/${loc}` : `vertex://${loc}`;
    if (typeof refreshApiChannelUI === 'function') refreshApiChannelUI(false);
    if (typeof saveCfg === 'function') saveCfg();
  }

  return {
    DEFAULT_MODELS,
    isVertexUrl,
    parseKey,
    resolveSpec,
    getAccessToken,
    prepare,
    applyServiceAccountJsonText,
    pickServiceAccountFile,
    setRegion
  };
})();
window.VertexDirect = VertexDirect;

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
