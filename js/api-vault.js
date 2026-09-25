// API 存储库
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § API 存储库
 * ================================================================ */
const ApiVault = (function() {
  const STORE_KEY = 'wg_apivault';

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch(e) { return []; }
  }
  function saveAll(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
    catch(e) {}
  }
  function add(entry) {
    const list = loadAll();
    entry.id = 'av_' + Date.now();
    list.push(entry);
    saveAll(list);
    return entry;
  }
  function update(id, entry) {
    const list = loadAll();
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) { list[idx] = {...list[idx], ...entry}; saveAll(list); }
  }
  function remove(id) {
    saveAll(loadAll().filter(x => x.id !== id));
  }
  function getById(id) {
    return loadAll().find(x => x.id === id);
  }

  // ── 渲染管理弹窗列表 ──
  function renderList() {
    const el = document.getElementById('apivault-list');
    if (!el) return;
    const list = loadAll();
    if (!list.length) {
      el.innerHTML = '<div class="api-vault-pick-empty" style="padding:16px 0">暂无保存的API配置<br><span style="font-size:.85em;color:#3a3060">在上方填写后点「保存到库」</span></div>';
      return;
    }
    el.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'apivault-entry';
      const maskedKey = item.key ? item.key.slice(0,6) + '****' + item.key.slice(-4) : '（未填）';
      div.innerHTML = `
        <div class="apivault-entry-info">
          <div class="apivault-entry-name">🔑 ${escHtml(item.name || '未命名')}</div>
          <div class="apivault-entry-model">模型：${escHtml(item.model || '（未填）')}</div>
          <div class="apivault-entry-url">地址：${escHtml(item.url || '（用全局）')}</div>
          <div class="apivault-entry-model" style="color:#5a5080">密钥：${maskedKey}</div>
        </div>
        <div class="apivault-entry-btns">
          <button class="apivault-edit-btn" data-id="${item.id}">✏️ 编辑</button>
          <button class="apivault-del-btn" data-id="${item.id}">🗑️ 删除</button>
        </div>`;
      div.querySelector('.apivault-edit-btn').onclick = () => startEdit(item.id);
      div.querySelector('.apivault-del-btn').onclick = () => {
        if (confirm(`删除「${item.name}」？`)) {
          remove(item.id);
          renderList();
          renderPickDropdown();
        }
      };
      el.appendChild(div);
    });
  }

  function startEdit(id) {
    const item = getById(id);
    if (!item) return;
    document.getElementById('apivault-name').value = item.name || '';
    document.getElementById('apivault-url').value = item.url || '';
    document.getElementById('apivault-key').value = item.key || '';
    document.getElementById('apivault-model').value = item.model || '';
    document.getElementById('apivault-edit-id').value = id;
    document.getElementById('apivault-form-title').textContent = '── 编辑配置 ──';
    document.getElementById('apivault-save-btn').textContent = '✅ 更新配置';
    document.getElementById('apivault-name').focus();
  }

  function resetForm() {
    document.getElementById('apivault-name').value = '';
    document.getElementById('apivault-url').value = '';
    document.getElementById('apivault-key').value = '';
    document.getElementById('apivault-model').value = '';
    document.getElementById('apivault-edit-id').value = '';
    document.getElementById('apivault-form-title').textContent = '── 添加新配置 ──';
    document.getElementById('apivault-save-btn').textContent = '＋ 保存到库';
  }

  function saveFromForm() {
    const name = (document.getElementById('apivault-name').value || '').trim();
    if (!name) {
      document.getElementById('apivault-name').focus();
      document.getElementById('apivault-name').style.borderColor = 'var(--cinnabar)';
      setTimeout(() => { document.getElementById('apivault-name').style.borderColor = ''; }, 1500);
      return;
    }
    const entry = {
      name,
      url:   (document.getElementById('apivault-url').value || '').trim(),
      key:   (document.getElementById('apivault-key').value || '').trim(),
      model: (document.getElementById('apivault-model').value || '').trim()
    };
    const editId = document.getElementById('apivault-edit-id').value;
    if (editId) {
      update(editId, entry);
    } else {
      add(entry);
    }
    resetForm();
    renderList();
    renderPickDropdown();
  }

  // ── 命牌弹窗中的下拉选取 ──
  function renderPickDropdown() {
    const dd = document.getElementById('pcvault-pick-dropdown');
    if (!dd) return;
    const list = loadAll();
    if (!list.length) {
      dd.innerHTML = '<div class="api-vault-pick-empty">暂无保存的API<br>点「管理API库」添加</div>';
      return;
    }
    dd.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'api-vault-pick-item';
      div.innerHTML = `
        <div style="flex:1;min-width:0">
          <div class="api-vault-pick-name">${escHtml(item.name)}</div>
          <div class="api-vault-pick-sub">${escHtml(item.model || '')}${item.url ? ' · ' + item.url.replace(/^https?:\/\//, '').slice(0,28) : ''}</div>
        </div>
        <span style="font-size:0.6em;color:#4a4070;flex-shrink:0">应用 →</span>`;
      div.onclick = () => {
        // 填入命牌弹窗的 API 字段
        document.getElementById('pcu').value = item.url || '';
        document.getElementById('pck').value = item.key || '';
        document.getElementById('pcm').value = item.model || '';
        closeDropdown();
        // 短暂高亮反馈
        ['pcu','pck','pcm'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            el.style.borderColor = 'rgba(136,136,204,0.6)';
            setTimeout(() => { el.style.borderColor = ''; }, 800);
          }
        });
      };
      dd.appendChild(div);
    });
  }

  function openDropdown() {
    renderPickDropdown();
    document.getElementById('pcvault-pick-dropdown').classList.add('open');
  }
  function closeDropdown() {
    const dd = document.getElementById('pcvault-pick-dropdown');
    if (dd) dd.classList.remove('open');
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── 初始化事件 ──
  function init() {
    // 管理弹窗开关
    const overlay = document.getElementById('apivault-overlay');
    document.getElementById('btn-open-apivault')?.addEventListener('click', () => {
      resetForm();
      renderList();
      overlay.classList.add('open');
    });
    document.getElementById('apivault-close-btn')?.addEventListener('click', () => {
      overlay.classList.remove('open');
      resetForm();
    });
    overlay?.addEventListener('click', e => {
      if (e.target === overlay) { overlay.classList.remove('open'); resetForm(); }
    });

    // 保存按钮
    document.getElementById('apivault-save-btn')?.addEventListener('click', saveFromForm);

    // 「从库选」下拉
    const pickBtn = document.getElementById('pcvault-pick-btn');
    const dd = document.getElementById('pcvault-pick-dropdown');
    pickBtn?.addEventListener('click', e => {
      e.stopPropagation();
      if (dd.classList.contains('open')) { closeDropdown(); }
      else { openDropdown(); }
    });

    // 点击其他地方关闭下拉
    document.addEventListener('click', e => {
      if (dd && dd.classList.contains('open')) {
        if (!dd.contains(e.target) && e.target !== pickBtn) closeDropdown();
      }
    });

    // 支持 Enter 提交表单
    ['apivault-name','apivault-url','apivault-key','apivault-model'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveFromForm();
      });
    });
  }

  return { init, renderPickDropdown, loadAll };
})();

// 在 bindEvents 后初始化
document.addEventListener('DOMContentLoaded', () => ApiVault.init());
// 如果 DOM 已经 ready（script 在 body 末）
if (document.readyState !== 'loading') ApiVault.init();
