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
    'gemini-4-carbon',
    'gemini-4-argon',
    'gemini-4-neon',
    'gemini-4-hydrogen',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'claude-fable-5-2',
    'claude-mythos-5-2',
    'claude-opus-5-5',
    'claude-sonnet-5-5',
    'claude-haiku-5-5',
    'claude-fable-5-1',
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-opus-4-5@20251101',
    'claude-sonnet-4-5@20250929',
    'claude-haiku-4-5@20251001',
    'deepseek-ai/deepseek-v4-pro-maas',
    'deepseek-ai/deepseek-v4.1-flash-maas',
    'deepseek-ai/deepseek-v3.2-maas',
    'moonshotai/kimi-k2.5-maas',
    'moonshotai/kimi-k2-thinking-maas',
    'moonshotai/kimi-k2-0905-maas'
  ];

  const CLAUDE_VERTEX_ALIAS = {
    'fable-5-2': 'claude-fable-5-2',
    'fable-5.2': 'claude-fable-5-2',
    'claude-fable-5.2': 'claude-fable-5-2',
    'mythos-5-2': 'claude-mythos-5-2',
    'mythos-5.2': 'claude-mythos-5-2',
    'claude-mythos-5.2': 'claude-mythos-5-2',
    'opus-5-5': 'claude-opus-5-5',
    'opus-5.5': 'claude-opus-5-5',
    'claude-opus-5.5': 'claude-opus-5-5',
    'sonnet-5-5': 'claude-sonnet-5-5',
    'sonnet-5.5': 'claude-sonnet-5-5',
    'claude-sonnet-5.5': 'claude-sonnet-5-5',
    'haiku-5-5': 'claude-haiku-5-5',
    'haiku-5.5': 'claude-haiku-5-5',
    'claude-haiku-5.5': 'claude-haiku-5-5',
    'fable-5-1': 'claude-fable-5-1',
    'mythos-5-1': 'claude-mythos-5-1',
    'opus-5': 'claude-opus-5',
    'sonnet-5': 'claude-sonnet-5',
    'claude-opus-4-7-latest': 'claude-opus-4-7',
    'claude-sonnet-4-6-latest': 'claude-sonnet-4-6',
    'claude-opus-4-6-latest': 'claude-opus-4-6',
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

    const rawM = String(rawModel || '').trim() || 'gemini-4-argon';
    let cleanModel = rawM
      .replace(/^publishers\/(?:google|anthropic)\/models\//i, '')
      .replace(/^models\//i, '')
      .replace(/^(?:google|anthropic)\//i, '');

    let protocol = 'gemini';
    let vertexModel = cleanModel;
    let endpoint = '';
    const pidDisplay = projectId || '<项目ID>';

    if (/^(?:kimi-|deepseek-)/i.test(cleanModel) && !cleanModel.includes('/')) {
      const prefix = /^kimi-/i.test(cleanModel) ? 'moonshotai/' : 'deepseek-ai/';
      cleanModel = prefix + (/-maas$/i.test(cleanModel) ? cleanModel : cleanModel + '-maas');
    }

    if (forceOpenAI || (cleanModel.includes('/') && !/^(?:gemini|claude)/i.test(cleanModel))) {
      protocol = 'openai';
      vertexModel = cleanModel;
      endpoint = `${host}/v1beta1/projects/${pidDisplay}/locations/${location}/endpoints/openapi/chat/completions`;
    } else if (/claude|^(?:fable|mythos|opus|sonnet|haiku)(?:[-_.\d]|$)/i.test(cleanModel)) {
      protocol = 'anthropic';
      const lowerM = cleanModel.toLowerCase();
      let normalizedClaude = CLAUDE_VERTEX_ALIAS[lowerM];
      if (!normalizedClaude) {
        normalizedClaude = cleanModel
          .replace(/^(fable|mythos|opus|sonnet|haiku)(?=[-_.\d]|$)/i, 'claude-$1')
          .replace(/-latest$/i, '')
          .replace(/(\d+)\.(\d+)/g, '$1-$2');
      }
      vertexModel = normalizedClaude;
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
    const cleanLoc = String(loc || 'global').trim().toLowerCase() || 'global';
    urlEl.value = spec.projectId ? `vertex://${spec.projectId}/${cleanLoc}` : `vertex://${cleanLoc}`;
    if (typeof refreshApiChannelUI === 'function') refreshApiChannelUI(false);
    if (typeof saveCfg === 'function') saveCfg();
  }

  function setProjectId(pid, target) {
    const isPC = target === 'pc';
    const urlEl = $(isPC ? 'pcu' : 'g-url');
    const keyEl = $(isPC ? 'pck' : 'g-key');
    if (!urlEl) return;
    const cleanPid = String(pid || '').trim();
    const spec = resolveSpec(urlEl.value || ($('g-url') ? $('g-url').value : ''), (keyEl && keyEl.value) || ($('g-key') ? $('g-key').value : ''), '');
    const loc = spec.location || 'global';
    urlEl.value = cleanPid ? `vertex://${cleanPid}/${loc}` : `vertex://${loc}`;
    const urlInput = $(isPC ? 'pcu' : 'g-url');
    if (urlInput && document.activeElement && document.activeElement.id === 'vtx-inline-pid') {
      // 仅更新预览与警告，不重绘整个 vertexHelper 以免打断手填焦点
      _updatePreviewOnly();
    } else if (typeof refreshApiChannelUI === 'function') {
      refreshApiChannelUI(false);
    }
    if (typeof saveCfg === 'function') saveCfg();
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _updatePreviewOnly() {
    const previewSpan = $('vtx-live-ep');
    const warnSpan = $('vtx-live-warn');
    const urlEl = $('g-url'), modelEl = $('g-model'), keyEl = $('g-key');
    if (!urlEl) return;
    const u = urlEl.value;
    const m = (modelEl && modelEl.value) || '';
    const k = (keyEl && keyEl.value) || '';
    const spec = resolveSpec(u || 'vertex://global', k, m || '<模型名>');
    if (previewSpan) previewSpan.textContent = '预览：' + spec.endpoint;
    if (warnSpan) {
      let w = '';
      if (spec.keyInfo.kind === 'invalid_json') w = spec.keyInfo.error;
      else if (!spec.projectId && spec.keyInfo.kind !== 'api_key') {
        w = '请在下方「项目 ID」框手填你的 Google Cloud Project ID，或粘贴/导入服务账号 JSON';
      }
      warnSpan.style.display = w ? 'inline' : 'none';
      warnSpan.textContent = w ? ('⚠ ' + w) : '';
    }
  }

  function renderHelperHtml(rawUrl, rawKey, rawModel, target) {
    const t = target || 'global';
    const spec = resolveSpec(rawUrl || 'vertex://global', rawKey || '', rawModel || '');
    const kInfo = spec.keyInfo;
    const credLine = kInfo.kind === 'sa_json'
      ? `<span style="color:#7fbf8f">✅ 已识别服务账号：${_escHtml(kInfo.clientEmail)}（项目：${_escHtml(spec.projectId || kInfo.projectId || '未指定')}，本地自动签发/续期 Token）</span>`
      : kInfo.kind === 'api_key'
        ? `<span style="color:#7fbf8f">🔑 已识别 Google Cloud API Key（AIza…）</span>`
        : kInfo.kind === 'oauth_token'
          ? `<span style="color:#d8b868">🔑 已识别 OAuth 临时令牌（ya29.…，有效期 1 小时；也可点「✍️ 手填向导」填服务账号私钥永久免刷）</span>`
          : `<span style="color:#8aa8c8">💡 可直接手填下方<b>项目 ID</b> + <b>区域</b>，密钥栏填 API Key / <code>ya29.</code> 令牌，或点「✍️ 手填向导」/「📂 导入 JSON」</span>`;
    const presetRegions = ['global', 'us-central1', 'us-east5', 'europe-west1', 'asia-east1'];
    return `<div style="margin:4px 0;padding:6px 8px;background:rgba(104,184,232,0.07);border:1px solid rgba(104,184,232,0.22);border-radius:4px;line-height:1.45">`
      + credLine
      + `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;align-items:center">`
      + `<span style="color:#8aa8c8;font-size:.92em">项目ID：</span>`
      + `<input type="text" id="vtx-inline-pid" value="${_escHtml(spec.projectId || '')}" placeholder="手填 Project ID（如 my-gcp-proj）" oninput="VertexDirect.setProjectId(this.value,'${t}')" style="width:155px;padding:2px 6px;font-size:.92em;background:rgba(0,0,0,0.35);border:1px solid rgba(104,184,232,0.35);border-radius:3px;color:#d8e8f8">`
      + `<span style="color:#8aa8c8;font-size:.92em;margin-left:2px">区域：</span>`
      + `<input type="text" id="vtx-inline-loc" value="${_escHtml(spec.location || 'global')}" placeholder="如 global / us-east5" onchange="VertexDirect.setRegion(this.value,'${t}')" style="width:92px;padding:2px 6px;font-size:.92em;background:rgba(0,0,0,0.35);border:1px solid rgba(104,184,232,0.35);border-radius:3px;color:#d8e8f8">`
      + presetRegions.map(loc =>
          `<button type="button" onclick="VertexDirect.setRegion('${loc}','${t}')" style="padding:1px 6px;font-size:.86em;background:${spec.location===loc?'rgba(104,184,232,0.24)':'rgba(255,255,255,0.04)'};border:1px solid ${spec.location===loc?'rgba(104,184,232,0.55)':'rgba(200,180,140,0.22)'};border-radius:3px;color:${spec.location===loc?'#b8e4ff':'#b8aa90'};cursor:pointer">${loc}</button>`
        ).join('')
      + `</div>`
      + `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;align-items:center">`
      + `<button type="button" onclick="VertexDirect.openManualDialog('${t}')" style="padding:2px 8px;font-size:.92em;background:rgba(200,168,76,0.18);border:1px solid rgba(200,168,76,0.45);border-radius:3px;color:#f0d488;cursor:pointer">✍️ 手填配置向导（分项手填 / 粘贴 JSON）</button>`
      + `<button type="button" onclick="VertexDirect.pickServiceAccountFile('${t}')" style="padding:2px 8px;font-size:.92em;background:rgba(104,184,232,0.16);border:1px solid rgba(104,184,232,0.4);border-radius:3px;color:#98d0f0;cursor:pointer">📂 导入服务账号 JSON 文件</button>`
      + `</div></div>`;
  }

  function openManualDialog(target) {
    const t = target || 'global';
    const isPC = t === 'pc';
    const urlEl = $(isPC ? 'pcu' : 'g-url');
    const keyEl = $(isPC ? 'pck' : 'g-key');
    const modelEl = $(isPC ? 'pcm' : 'g-model');
    const curUrl = (urlEl && urlEl.value) || ($('g-url') ? $('g-url').value : '');
    const curKey = (keyEl && keyEl.value) || ($('g-key') ? $('g-key').value : '');
    const curModel = (modelEl && modelEl.value) || ($('g-model') ? $('g-model').value : 'gemini-4-argon');
    const spec = resolveSpec(curUrl, curKey, curModel);
    const kInfo = spec.keyInfo;

    let old = $('vtx-manual-modal');
    if (old) old.remove();

    const initMode = kInfo.kind === 'api_key' ? 'api_key'
      : kInfo.kind === 'oauth_token' ? 'oauth_token'
      : 'sa_fields';

    const modal = document.createElement('div');
    modal.id = 'vtx-manual-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(4px)';
    modal.innerHTML = `
      <div style="width:min(540px,96vw);max-height:90vh;overflow-y:auto;background:#141222;border:1px solid rgba(104,184,232,0.4);border-radius:10px;padding:16px 18px;color:#d8d0e8;box-shadow:0 18px 50px rgba(0,0,0,0.75);font-size:0.84em;line-height:1.5">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(104,184,232,0.18)">
          <strong style="color:#98d0f0;font-size:1.08em">✍️ Google Cloud Vertex AI 手填配置向导（${isPC ? '当前座位' : '全局默认'}）</strong>
          <button type="button" id="vtx-m-close" style="background:none;border:none;color:#8a8098;font-size:1.2em;cursor:pointer;padding:2px 6px">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label style="display:block;font-size:.86em;color:#98b8d8;margin-bottom:3px">① Google Cloud 项目 ID (Project ID) *</label>
            <input type="text" id="vtx-m-pid" value="${_escHtml(spec.projectId || '')}" placeholder="例：gen-lang-client-0123456789" style="width:100%;padding:6px 8px;background:rgba(0,0,0,0.35);border:1px solid rgba(104,184,232,0.3);border-radius:5px;color:#e8f0ff;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:.86em;color:#98b8d8;margin-bottom:3px">② 区域 (Location / Region) *</label>
            <div style="display:flex;gap:4px">
              <input type="text" id="vtx-m-loc" value="${_escHtml(spec.location || 'global')}" placeholder="如 global 或 us-east5" style="flex:1;padding:6px 8px;background:rgba(0,0,0,0.35);border:1px solid rgba(104,184,232,0.3);border-radius:5px;color:#e8f0ff;box-sizing:border-box">
              <select id="vtx-m-loc-preset" style="width:92px;padding:4px;background:rgba(0,0,0,0.35);border:1px solid rgba(104,184,232,0.25);border-radius:5px;color:#b8d0e8;font-size:.88em">
                <option value="">常用区域…</option>
                <option value="global">global (推荐·Gemini 4/Claude 5)</option>
                <option value="us-central1">us-central1 (美中)</option>
                <option value="us-east5">us-east5 (美东·Claude主力)</option>
                <option value="us-east1">us-east1</option>
                <option value="us-west1">us-west1</option>
                <option value="europe-west1">europe-west1 (欧洲)</option>
                <option value="europe-west4">europe-west4</option>
                <option value="asia-east1">asia-east1 (台湾)</option>
                <option value="asia-northeast1">asia-northeast1 (东京)</option>
                <option value="asia-southeast1">asia-southeast1 (新加坡)</option>
              </select>
            </div>
          </div>
        </div>

        <div style="margin-bottom:10px">
          <label style="display:block;font-size:.86em;color:#98b8d8;margin-bottom:3px">③ 模型名称（可直接手填任意 Vertex 模型 ID，或从右侧常用列表选）</label>
          <div style="display:flex;gap:6px">
            <input type="text" id="vtx-m-model" value="${_escHtml(curModel)}" placeholder="如 gemini-4-argon / gemini-3.8-flash / claude-fable-5-2 / claude-opus-5-5" style="flex:1;padding:6px 8px;background:rgba(0,0,0,0.35);border:1px solid rgba(104,184,232,0.3);border-radius:5px;color:#e8f0ff;box-sizing:border-box">
            <select id="vtx-m-model-preset" style="width:170px;padding:4px 6px;background:rgba(0,0,0,0.35);border:1px solid rgba(104,184,232,0.25);border-radius:5px;color:#b8d0e8;font-size:.88em">
              <option value="">常用模型速选…</option>
              ${DEFAULT_MODELS.map(m => `<option value="${_escHtml(m)}">${_escHtml(m)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="margin-bottom:8px">
          <label style="display:block;font-size:.86em;color:#98b8d8;margin-bottom:4px">④ 鉴权方式（三选一，均可手填）</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <label style="flex:1;min-width:140px;padding:6px 8px;background:rgba(104,184,232,0.08);border:1px solid rgba(104,184,232,0.25);border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:.88em">
              <input type="radio" name="vtx-m-auth" value="sa_fields" ${initMode==='sa_fields'?'checked':''}>
              <span><b>服务账号手填/JSON</b><br><small style="color:#7898b8">永久有效·自动续期</small></span>
            </label>
            <label style="flex:1;min-width:130px;padding:6px 8px;background:rgba(104,184,232,0.08);border:1px solid rgba(104,184,232,0.25);border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:.88em">
              <input type="radio" name="vtx-m-auth" value="oauth_token" ${initMode==='oauth_token'?'checked':''}>
              <span><b>OAuth Access Token</b><br><small style="color:#7898b8">手填 ya29.xxx 临时令牌</small></span>
            </label>
            <label style="flex:1;min-width:130px;padding:6px 8px;background:rgba(104,184,232,0.08);border:1px solid rgba(104,184,232,0.25);border-radius:5px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:.88em">
              <input type="radio" name="vtx-m-auth" value="api_key" ${initMode==='api_key'?'checked':''}>
              <span><b>Google Cloud API Key</b><br><small style="color:#7898b8">手填 AIzaSy... 密钥</small></span>
            </label>
          </div>
        </div>

        <div id="vtx-m-pane-sa" style="display:${initMode==='sa_fields'?'block':'none'};padding:10px;background:rgba(0,0,0,0.25);border:1px solid rgba(104,184,232,0.18);border-radius:6px;margin-bottom:10px">
          <div style="font-size:.82em;color:#8ab0d0;margin-bottom:6px">
            你可以直接分项手填下面的<b>服务账号邮箱</b>与<b>私钥</b>，也可以在最下方粘贴完整 JSON（会自动拆解填入上面各框）：
          </div>
          <div style="margin-bottom:8px">
            <label style="display:block;font-size:.84em;color:#98b8d8;margin-bottom:2px">服务账号邮箱 (client_email) *</label>
            <input type="text" id="vtx-m-email" value="${_escHtml((kInfo.sa && kInfo.sa.client_email) || '')}" placeholder="例：wolf-vertex@my-project.iam.gserviceaccount.com" style="width:100%;padding:5px 8px;background:rgba(0,0,0,0.4);border:1px solid rgba(104,184,232,0.28);border-radius:4px;color:#e8f0ff;font-family:monospace;font-size:.9em;box-sizing:border-box">
          </div>
          <div style="margin-bottom:8px">
            <label style="display:block;font-size:.84em;color:#98b8d8;margin-bottom:2px">私钥 (private_key，含 -----BEGIN PRIVATE KEY-----) *</label>
            <textarea id="vtx-m-pk" rows="4" placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...&#10;-----END PRIVATE KEY-----" style="width:100%;padding:6px 8px;background:rgba(0,0,0,0.4);border:1px solid rgba(104,184,232,0.28);border-radius:4px;color:#e8f0ff;font-family:monospace;font-size:.82em;resize:vertical;box-sizing:border-box">${_escHtml((kInfo.sa && kInfo.sa.private_key) || '')}</textarea>
          </div>
          <details style="font-size:.82em;color:#8aa8c8">
            <summary style="cursor:pointer;color:#98d0f0">📋 或者：直接粘贴整段服务账号 JSON / 从文件导入（自动填入上方字段）</summary>
            <div style="margin-top:6px">
              <textarea id="vtx-m-json-paste" rows="3" placeholder='把下载的 .json 文件内容整段粘贴到这里，会自动提取 project_id、client_email 和 private_key…' style="width:100%;padding:6px 8px;background:rgba(0,0,0,0.4);border:1px solid rgba(104,184,232,0.25);border-radius:4px;color:#c8e0f8;font-family:monospace;font-size:.85em;resize:vertical;box-sizing:border-box"></textarea>
            </div>
          </details>
        </div>

        <div id="vtx-m-pane-oauth" style="display:${initMode==='oauth_token'?'block':'none'};padding:10px;background:rgba(0,0,0,0.25);border:1px solid rgba(104,184,232,0.18);border-radius:6px;margin-bottom:10px">
          <label style="display:block;font-size:.84em;color:#98b8d8;margin-bottom:3px">手填 OAuth2 Access Token（在终端运行 <code>gcloud auth print-access-token</code> 获取）*</label>
          <input type="text" id="vtx-m-oauth" value="${_escHtml(kInfo.kind==='oauth_token' ? kInfo.token : '')}" placeholder="ya29.a0AeXRPp5..." style="width:100%;padding:6px 8px;background:rgba(0,0,0,0.4);border:1px solid rgba(104,184,232,0.28);border-radius:4px;color:#e8f0ff;font-family:monospace;font-size:.9em;box-sizing:border-box">
          <div style="font-size:.78em;color:#a89870;margin-top:4px">⚠️ 注：<code>ya29.</code> 开头的临时令牌默认 1 小时过期；若希望长期免刷，建议切到左侧「服务账号手填/JSON」。</div>
        </div>

        <div id="vtx-m-pane-apikey" style="display:${initMode==='api_key'?'block':'none'};padding:10px;background:rgba(0,0,0,0.25);border:1px solid rgba(104,184,232,0.18);border-radius:6px;margin-bottom:10px">
          <label style="display:block;font-size:.84em;color:#98b8d8;margin-bottom:3px">手填 Google Cloud API Key（在 Google Cloud Console → APIs & Services → Credentials 创建）*</label>
          <input type="text" id="vtx-m-apikey" value="${_escHtml(kInfo.kind==='api_key' ? kInfo.apiKey : '')}" placeholder="AIzaSy..." style="width:100%;padding:6px 8px;background:rgba(0,0,0,0.4);border:1px solid rgba(104,184,232,0.28);border-radius:4px;color:#e8f0ff;font-family:monospace;font-size:.9em;box-sizing:border-box">
        </div>

        <div id="vtx-m-preview" style="padding:7px 9px;background:rgba(0,0,0,0.35);border-radius:5px;font-size:.8em;color:#8ab8d8;word-break:break-all;margin-bottom:12px"></div>

        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button type="button" id="vtx-m-cancel" style="padding:6px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(200,180,140,0.22);border-radius:5px;color:#a8a090;cursor:pointer">取消</button>
          <button type="button" id="vtx-m-save" style="padding:6px 16px;background:linear-gradient(135deg,rgba(104,184,232,0.28),rgba(70,130,190,0.22));border:1px solid rgba(104,184,232,0.6);border-radius:5px;color:#c8ecff;font-weight:600;cursor:pointer">✅ 应用手填配置</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const pidInput = $('vtx-m-pid');
    const locInput = $('vtx-m-loc');
    const locPreset = $('vtx-m-loc-preset');
    const modInput = $('vtx-m-model');
    const modPreset = $('vtx-m-model-preset');
    const emailInput = $('vtx-m-email');
    const pkInput = $('vtx-m-pk');
    const jsonPaste = $('vtx-m-json-paste');
    const oauthInput = $('vtx-m-oauth');
    const apikeyInput = $('vtx-m-apikey');
    const previewBox = $('vtx-m-preview');

    const getAuthMode = () => {
      const checked = modal.querySelector('input[name="vtx-m-auth"]:checked');
      return checked ? checked.value : 'sa_fields';
    };

    const updateModalPreview = () => {
      const mode = getAuthMode();
      $('vtx-m-pane-sa').style.display = mode === 'sa_fields' ? 'block' : 'none';
      $('vtx-m-pane-oauth').style.display = mode === 'oauth_token' ? 'block' : 'none';
      $('vtx-m-pane-apikey').style.display = mode === 'api_key' ? 'block' : 'none';
      const pid = pidInput.value.trim();
      const loc = locInput.value.trim() || 'global';
      const m = modInput.value.trim() || 'gemini-2.5-pro';
      const u = pid ? `vertex://${pid}/${loc}` : `vertex://${loc}`;
      const fakeKey = mode === 'api_key' ? (apikeyInput.value.trim() || 'AIzaSyDummyKeyForPreview1234567') : '';
      const s = resolveSpec(u, fakeKey, m);
      previewBox.innerHTML = `🔗 <b>最终请求端点预览</b>（协议：<code>${s.protocol}</code>）：<br>${_escHtml(s.endpoint)}`;
    };

    modal.querySelectorAll('input[name="vtx-m-auth"]').forEach(r => r.addEventListener('change', updateModalPreview));
    [pidInput, locInput, modInput, apikeyInput].forEach(el => el.addEventListener('input', updateModalPreview));
    locPreset.addEventListener('change', () => {
      if (locPreset.value) { locInput.value = locPreset.value; locPreset.value = ''; updateModalPreview(); }
    });
    modPreset.addEventListener('change', () => {
      if (modPreset.value) { modInput.value = modPreset.value; modPreset.value = ''; updateModalPreview(); }
    });
    jsonPaste.addEventListener('input', () => {
      const sa = _tryParseSaJson(jsonPaste.value);
      if (sa) {
        if (sa.project_id) pidInput.value = sa.project_id;
        if (sa.client_email) emailInput.value = sa.client_email;
        if (sa.private_key) pkInput.value = sa.private_key;
        updateModalPreview();
      }
    });

    const closeModal = () => modal.remove();
    $('vtx-m-close').onclick = closeModal;
    $('vtx-m-cancel').onclick = closeModal;
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    $('vtx-m-save').onclick = () => {
      const mode = getAuthMode();
      const pid = pidInput.value.trim();
      const loc = (locInput.value.trim() || 'global').toLowerCase();
      const m = modInput.value.trim();
      let finalKey = '';

      if (mode === 'sa_fields') {
        const email = emailInput.value.trim();
        let pk = pkInput.value.trim();
        if (!email || !pk) {
          alert('请手填「服务账号邮箱 (client_email)」和「私钥 (private_key)」！');
          return;
        }
        // 兼容用户粘贴私钥时把字面量 \n 粘进来的情况
        if (pk.includes('\\n') && !pk.includes('\n')) {
          pk = pk.replace(/\\n/g, '\n');
        }
        if (!pk.includes('-----BEGIN')) {
          pk = '-----BEGIN PRIVATE KEY-----\n' + pk + '\n-----END PRIVATE KEY-----\n';
        }
        const saObj = {
          type: 'service_account',
          project_id: pid || '',
          client_email: email,
          private_key: pk,
          token_uri: 'https://oauth2.googleapis.com/token'
        };
        finalKey = JSON.stringify(saObj);
      } else if (mode === 'oauth_token') {
        finalKey = oauthInput.value.trim();
        if (!finalKey) { alert('请手填 OAuth2 Access Token（ya29.xxx）！'); return; }
        if (!pid) { alert('使用 OAuth Token 时必须手填「项目 ID (Project ID)」！'); return; }
      } else if (mode === 'api_key') {
        finalKey = apikeyInput.value.trim();
        if (!finalKey) { alert('请手填 Google Cloud API Key（AIzaSy...）！'); return; }
      }

      const typeEl = $(isPC ? 'pc-apitype' : 'g-apitype');
      if (typeEl) typeEl.value = 'vertex';
      if (urlEl) urlEl.value = pid ? `vertex://${pid}/${loc}` : `vertex://${loc}`;
      if (keyEl) keyEl.value = finalKey;
      if (modelEl && m) modelEl.value = m;

      if (typeof refreshApiChannelUI === 'function') refreshApiChannelUI(false);
      if (typeof saveCfg === 'function') saveCfg();
      closeModal();

      const msg = `✅ 已应用手填 Vertex AI 配置（项目：${pid || '默认'}，区域：${loc}）`;
      if (typeof Render !== 'undefined' && Render.log) Render.log('system', msg);
      if (isPC && $('pc-test-result')) {
        const box = $('pc-test-result');
        box.style.display = 'block';
        box.style.background = 'rgba(80,160,100,0.15)';
        box.style.color = '#90d8a0';
        box.textContent = msg;
      }
    };

    updateModalPreview();
  }

  function registerClaudeAlias(alias, target) {
    if (!alias || !target) return;
    CLAUDE_VERTEX_ALIAS[String(alias).toLowerCase()] = String(target);
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
    setRegion,
    setProjectId,
    renderHelperHtml,
    openManualDialog,
    registerClaudeAlias
  };
})();
window.VertexDirect = VertexDirect;

/* ================================================================
 *  § LiveModelSync：实时抓取并自动同步全网最新模型 & 当前接口模型
 *    1. 免密钥公开模型目录（OpenRouter /api/v1/models 实时返回各厂商按发布时间排序的最新模型 + reasoning 能力元数据）
 *    2. 当前已配置接口实时拉取（Anthropic /v1/models、Gemini /v1beta/models、OpenAI /models、Vertex Publisher Models）
 *    3. 自动合并到 API_PROVIDERS、VertexDirect.DEFAULT_MODELS、<datalist> 候选列表与推理模型识别表，并缓存至 localStorage
 * ================================================================ */
const LiveModelSync = (() => {
  const STORAGE_KEY = 'wg_live_models_v1';
  const AUTO_KEY = 'wg_auto_sync_models';
  const STALE_MS = 2 * 3600 * 1000; // 2 小时自动刷新
  const PUBLIC_CATALOG_URL = 'https://openrouter.ai/api/v1/models';

  let _state = {
    updatedAt: 0,
    providers: {},       // provId -> string[]
    reasoningModels: []  // string[] (lowercase model id or bare id)
  };
  let _reasoningSet = new Set();
  let _syncInflight = null;

  function _loadCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        _state.updatedAt = Number(parsed.updatedAt) || 0;
        _state.providers = (parsed.providers && typeof parsed.providers === 'object') ? parsed.providers : {};
        _state.reasoningModels = Array.isArray(parsed.reasoningModels) ? parsed.reasoningModels : [];
        _reasoningSet = new Set(_state.reasoningModels.map(x => String(x).toLowerCase()));
      }
    } catch (_) {}
  }

  function _saveCache() {
    try {
      _state.reasoningModels = [..._reasoningSet];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (_) {}
  }

  function isAutoSyncEnabled() {
    try {
      const v = localStorage.getItem(AUTO_KEY);
      return v === null ? true : v === '1';
    } catch (_) { return true; }
  }

  function setAutoSync(on) {
    try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch (_) {}
    const cb = document.getElementById('g-auto-sync-models');
    if (cb && cb.checked !== !!on) cb.checked = !!on;
    if (on) syncNow({ interactive: false });
  }

  function isKnownReasoningModel(modelName) {
    const mn = String(modelName || '').trim().toLowerCase();
    if (!mn) return false;
    if (_reasoningSet.has(mn)) return true;
    const bare = mn.split('/').pop().replace(/[:@].*$/, '');
    if (_reasoningSet.has(bare)) return true;
    // 点号与连字符互转匹配（如 claude-fable-5.2 <-> claude-fable-5-2）
    const dashed = bare.replace(/(\d+)\.(\d+)/g, '$1-$2');
    const dotted = bare.replace(/(\d+)-(\d+)/g, '$1.$2');
    return _reasoningSet.has(dashed) || _reasoningSet.has(dotted);
  }

  function _mergeUnique(frontList, backList, limit) {
    const out = [];
    const seen = new Set();
    const push = (m) => {
      const s = String(m || '').trim();
      if (!s) return;
      const k = s.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(s);
    };
    (frontList || []).forEach(push);
    (backList || []).forEach(push);
    return limit ? out.slice(0, limit) : out;
  }

  function applyToRuntime() {
    const provs = (typeof API_PROVIDERS !== 'undefined' && Array.isArray(API_PROVIDERS)) ? API_PROVIDERS : [];
    const pMap = _state.providers || {};

    if (pMap.vertex && pMap.vertex.length && window.VertexDirect && Array.isArray(VertexDirect.DEFAULT_MODELS)) {
      const mergedVtx = _mergeUnique(pMap.vertex, VertexDirect.DEFAULT_MODELS, 80);
      VertexDirect.DEFAULT_MODELS.length = 0;
      mergedVtx.forEach(m => VertexDirect.DEFAULT_MODELS.push(m));
    }

    provs.forEach(pv => {
      if (!pv || !pv.id) return;
      const liveList = pMap[pv.id];
      if (Array.isArray(liveList) && liveList.length) {
        pv.models = _mergeUnique(liveList, pv.models || [], 120);
      }
      if (pv.id === 'vertex' && window.VertexDirect) {
        pv.models = VertexDirect.DEFAULT_MODELS;
      }
    });

    // 同步刷新当前渠道的 <datalist id="g-model-list">
    try {
      const sel = document.getElementById('g-apitype');
      const dl = document.getElementById('g-model-list');
      if (dl && provs.length) {
        const curId = (sel && sel.value) || provs[0].id;
        const curProv = provs.find(x => x.id === curId) || provs[0];
        dl.innerHTML = (curProv.models || []).map(m => `<option value="${m}">`).join('');
      }
    } catch (_) {}

    _renderStatusBadge();
  }

  function _formatAgo(ts) {
    if (!ts) return '未同步';
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60) return '刚刚';
    if (sec < 3600) return Math.floor(sec / 60) + '分钟前';
    if (sec < 86400) return Math.floor(sec / 3600) + '小时前';
    return Math.floor(sec / 86400) + '天前';
  }

  function _renderStatusBadge(customText, color) {
    const el = document.getElementById('live-model-status');
    if (!el) return;
    if (customText) {
      el.textContent = customText;
      if (color) el.style.color = color;
      return;
    }
    const cb = document.getElementById('g-auto-sync-models');
    if (cb) cb.checked = isAutoSyncEnabled();
    const total = Object.values(_state.providers || {}).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
    if (_state.updatedAt && total > 0) {
      el.textContent = `🟢 已同步实时模型库（${_formatAgo(_state.updatedAt)}）`;
      el.style.color = '#7fbf8f';
    } else {
      el.textContent = '📡 内置前沿模型库（点右侧可实时抓取全网/接口最新模型）';
      el.style.color = '#8a8098';
    }
  }

  function recordProviderModels(provId, models, meta) {
    if (!provId || !Array.isArray(models) || !models.length) return;
    _state.providers[provId] = _mergeUnique(models, _state.providers[provId] || [], 150);
    _state.updatedAt = Date.now();
    if (meta && Array.isArray(meta.reasoningIds)) {
      meta.reasoningIds.forEach(id => {
        if (id) _reasoningSet.add(String(id).trim().toLowerCase());
      });
    }
    models.forEach(m => {
      const s = String(m || '').trim().toLowerCase();
      if (/thinking|reasoner|reasoning|(?:^|\/)o[1-9](?:[-_.]|$)/.test(s)) {
        _reasoningSet.add(s);
        _reasoningSet.add(s.split('/').pop());
      }
    });
    // 若拉取的是 anthropic / gemini，也顺带把新模型合并进 vertex 候选列表
    if (provId === 'anthropic') {
      const vtxClaude = models
        .filter(m => /claude|^(?:fable|mythos|opus|sonnet|haiku)/i.test(m))
        .map(m => m.replace(/-latest$/i, '').replace(/(\d+)\.(\d+)/g, '$1-$2'));
      if (vtxClaude.length) {
        _state.providers.vertex = _mergeUnique(_state.providers.vertex || [], vtxClaude, 100);
      }
    } else if (provId === 'gemini') {
      const vtxGem = models.filter(m => /^gemini-(?:2\.5|[3-9])/i.test(m) && !/tts|embedding|aqa|imagen|veo/i.test(m));
      if (vtxGem.length) {
        _state.providers.vertex = _mergeUnique(vtxGem, _state.providers.vertex || [], 100);
      }
    }
    _saveCache();
    applyToRuntime();
  }

  function _isChatModelId(id) {
    const s = String(id || '').toLowerCase();
    if (!s) return false;
    if (/:(?:free|extended)$/.test(s)) return false;
    if (/embed|moderation|whisper|tts|audio|speech|dall-e|imagen|veo|sora|stable-diffusion|flux|bge-|rerank|guard|safety/i.test(s)) return false;
    return true;
  }

  async function fetchPublicCatalog() {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tid = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
    try {
      const res = await fetch(PUBLIC_CATALOG_URL, ctrl ? { signal: ctrl.signal } : undefined);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const rows = Array.isArray(data && data.data) ? data.data : [];
      if (!rows.length) return null;

      // 按发布时间倒序（最新发布的模型排最前）
      const sorted = rows
        .filter(x => x && x.id && _isChatModelId(x.id))
        .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));

      const buckets = {
        anthropic: [],
        gemini: [],
        openai: [],
        deepseek: [],
        openrouter: [],
        vertex: []
      };

      for (const item of sorted) {
        const fullId = String(item.id).trim();
        const [vendor, ...rest] = fullId.split('/');
        const bare = rest.join('/');
        if (!bare) continue;

        // 记录支持 reasoning 的模型，供 detectThinkingFlags 动态识别
        const params = Array.isArray(item.supported_parameters) ? item.supported_parameters : [];
        if (params.includes('reasoning') || params.includes('include_reasoning') || /thinking|reasoner|reasoning/i.test(fullId)) {
          _reasoningSet.add(fullId.toLowerCase());
          _reasoningSet.add(bare.toLowerCase());
        }

        if (/^(?:anthropic|google|openai|deepseek|qwen|z-ai|thudm|moonshotai|minimax|x-ai)$/i.test(vendor)) {
          if (buckets.openrouter.length < 60) buckets.openrouter.push(fullId);
        }

        if (vendor === 'anthropic' && /^(?:claude|fable|mythos|opus|sonnet|haiku)/i.test(bare)) {
          const dashed = bare.replace(/(\d+)\.(\d+)/g, '$1-$2');
          buckets.anthropic.push(dashed);
          if (dashed !== bare) {
            VertexDirect.registerClaudeAlias(bare, dashed);
            VertexDirect.registerClaudeAlias(bare.replace(/^claude-/i, ''), dashed);
          }
          if (buckets.vertex.length < 45) buckets.vertex.push(dashed);
        } else if (vendor === 'google' && /^gemini-(?:2\.5|[3-9])/i.test(bare)) {
          buckets.gemini.push(bare);
          if (buckets.vertex.length < 45) buckets.vertex.push(bare);
        } else if (vendor === 'openai' && /^(?:gpt-[5-9]|o[1-9])/i.test(bare) && !/audio|realtime|image/i.test(bare)) {
          buckets.openai.push(bare);
        } else if (vendor === 'deepseek' && /^deepseek/i.test(bare)) {
          buckets.deepseek.push(bare);
          const maasId = `deepseek-ai/${bare.replace(/-maas$/i, '')}-maas`;
          if (buckets.vertex.length < 70) buckets.vertex.push(maasId);
        } else if (vendor === 'moonshotai' && /^kimi/i.test(bare)) {
          const maasId = `moonshotai/${bare.replace(/-maas$/i, '')}-maas`;
          if (buckets.vertex.length < 70) buckets.vertex.push(maasId);
        } else if (vendor === 'qwen' && /^qwen/i.test(bare)) {
          const maasId = `qwen/${bare.replace(/-maas$/i, '')}-maas`;
          if (buckets.vertex.length < 70) buckets.vertex.push(maasId);
        }
      }

      Object.keys(buckets).forEach(k => {
        if (buckets[k].length) {
          _state.providers[k] = _mergeUnique(buckets[k], _state.providers[k] || [], 120);
        }
      });
      _state.updatedAt = Date.now();
      _saveCache();
      applyToRuntime();
      return buckets;
    } finally {
      if (tid) clearTimeout(tid);
    }
  }

  async function fetchVertexPublisherModels(rawUrl, rawKey) {
    const spec = VertexDirect.resolveSpec(rawUrl || 'vertex://global', rawKey || '', '');
    const keyInfo = spec.keyInfo;
    if (!keyInfo || keyInfo.kind === 'empty' || keyInfo.kind === 'invalid_json') return [];

    const headers = {};
    let queryAuth = '';
    if (keyInfo.kind === 'api_key') {
      queryAuth = '&key=' + encodeURIComponent(keyInfo.apiKey);
    } else if (keyInfo.kind === 'sa_json') {
      const token = await VertexDirect.getAccessToken(keyInfo.sa);
      headers['Authorization'] = 'Bearer ' + token;
    } else if (keyInfo.token) {
      headers['Authorization'] = 'Bearer ' + keyInfo.token;
    }

    const publishers = ['google', 'anthropic', 'moonshotai', 'deepseek-ai', 'qwen', 'meta', 'mistralai'];
    const out = [];
    await Promise.all(publishers.map(async (pub) => {
      try {
        const url = `https://aiplatform.googleapis.com/v1beta1/publishers/${pub}/models?pageSize=200${queryAuth}`;
        const res = await fetch(url, { headers });
        if (!res.ok) return;
        const d = await res.json();
        const list = Array.isArray(d && d.models) ? d.models : (Array.isArray(d && d.publisherModels) ? d.publisherModels : []);
        for (const item of list) {
          const name = String((item && (item.name || item.versionId || item.id)) || '')
            .replace(/^.*\/models\//, '')
            .trim();
          if (!name || !_isChatModelId(name)) continue;
          if (pub === 'google') {
            if (/^gemini-(?:2\.5|[3-9])/i.test(name)) out.push(name);
          } else if (pub === 'anthropic') {
            if (/^claude/i.test(name)) out.push(name);
          } else {
            out.push(name.includes('/') ? name : `${pub}/${name}`);
          }
        }
      } catch (_) {}
    }));
    return out;
  }

  async function syncNow(opts) {
    opts = opts || {};
    if (_syncInflight) return _syncInflight;
    _renderStatusBadge('🔄 正在实时抓取最新模型…', '#d8b868');

    _syncInflight = (async () => {
      let publicOk = false;
      let endpointCount = 0;

      // 1. 抓取免密钥全网实时模型目录
      try {
        const b = await fetchPublicCatalog();
        if (b) publicOk = true;
      } catch (_) {}

      // 2. 如果当前填了 API 地址与密钥，同时抓取当前渠道接口的实时模型列表
      if (opts.includeEndpoint !== false) {
        try {
          const sel = document.getElementById('g-apitype');
          const urlEl = document.getElementById('g-url');
          const keyEl = document.getElementById('g-key');
          const provId = (sel && sel.value) || '';
          const u = (urlEl && urlEl.value || '').trim();
          const k = (keyEl && keyEl.value || '').trim();
          const prov = (typeof getProvider === 'function' && getProvider(provId)) || null;
          const type = (prov && prov.type) || (typeof inferApiType === 'function' ? inferApiType(u) : 'openai');

          if (type === 'vertex' && k) {
            const vModels = await fetchVertexPublisherModels(u, k);
            if (vModels.length) {
              recordProviderModels('vertex', vModels);
              endpointCount = vModels.length;
            }
          } else if (u && k && typeof modelListRequest === 'function' && typeof parseModelList === 'function') {
            const req = modelListRequest(type, u, k);
            const r = await fetch(req.url, { headers: req.headers });
            if (r.ok) {
              const d = await r.json();
              const parsed = parseModelList(type, d);
              if (parsed.length) {
                recordProviderModels(provId || type, parsed);
                endpointCount = parsed.length;
              }
            }
          }
        } catch (_) {}
      }

      _renderStatusBadge();
      // 若模型选择弹窗正处于打开状态，实时刷新弹窗内的列表
      try {
        const overlay = document.getElementById('modelListOverlay');
        if (overlay && overlay.classList.contains('show') && typeof renderModelList === 'function') {
          const sel = document.getElementById('g-apitype');
          const prov = (typeof getProvider === 'function' && sel && getProvider(sel.value)) || null;
          if (prov && Array.isArray(prov.models) && prov.models.length) {
            window._cachedModels = prov.models.slice();
            renderModelList(prov.models);
          }
        }
      } catch (_) {}

      if (opts.interactive && typeof Render !== 'undefined' && Render.log) {
        if (publicOk || endpointCount > 0) {
          const parts = [];
          if (publicOk) parts.push('全网最新前沿模型目录');
          if (endpointCount > 0) parts.push(`当前接口 ${endpointCount} 个可用模型`);
          Render.log('system', `✅ 已实时同步最新模型（${parts.join(' + ')}），下拉候选框与模型列表已自动更新`);
        } else {
          Render.log('system', '⚠️ 实时抓取未返回新模型，已保留当前前沿模型库');
        }
      }
      return { publicOk, endpointCount };
    })().finally(() => {
      _syncInflight = null;
    });

    return _syncInflight;
  }

  function init() {
    _loadCache();
    applyToRuntime();
    // 在真实浏览器环境中（非自动化离线沙盒），若开启了自动更新且缓存过期则后台静默同步一次
    if (typeof navigator !== 'undefined' && !navigator.webdriver && isAutoSyncEnabled()) {
      const age = Date.now() - (_state.updatedAt || 0);
      if (age > STALE_MS) {
        setTimeout(() => { syncNow({ interactive: false }); }, 1500);
      }
    }
  }

  return {
    init,
    syncNow,
    fetchPublicCatalog,
    fetchVertexPublisherModels,
    recordProviderModels,
    applyToRuntime,
    isKnownReasoningModel,
    isAutoSyncEnabled,
    setAutoSync,
    getState: () => _state
  };
})();
window.LiveModelSync = LiveModelSync;

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
