// 名字库管理
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 名字库管理
 * ================================================================ */
const NamePoolManager = (function() {
  const STORE_KEY = 'wg_namepool';

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved) && saved.length) return saved;
    } catch(e) {}
    return [...NAME_POOL.cn]; // 默认
  }

  function save(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch(e) {}
    // 同步到 NAME_POOL.cn
    NAME_POOL.cn = [...list];
  }

  // 当前编辑中的名字列表
  let current = [];

  function renderCurrent() {
    const el = document.getElementById('namepool-current-tags');
    if (!el) return;
    if (!current.length) {
      el.innerHTML = '<span style="font-size:.72em;color:#4a4070">还没有名字，从下方预设中点击添加，或手动输入</span>';
      return;
    }
    el.innerHTML = current.map((name, i) =>
      `<span class="namepool-current-tag">
        ${name}
        <span class="rm" data-i="${i}">✕</span>
      </span>`
    ).join('');
    el.querySelectorAll('.rm').forEach(btn => {
      btn.onclick = () => {
        current.splice(parseInt(btn.dataset.i), 1);
        renderCurrent();
        syncTagStates();
      };
    });
  }

  function syncTagStates() {
    document.querySelectorAll('.namepool-tag').forEach(tag => {
      tag.classList.toggle('selected', current.includes(tag.dataset.name));
    });
  }

  function addName(name) {
    name = name.trim();
    if (!name || current.includes(name)) return;
    current.push(name);
    renderCurrent();
    syncTagStates();
  }

  function init() {
    const overlay = document.getElementById('namepool-overlay');
    const openBtn = document.getElementById('btn-namepool');
    const closeBtn = document.getElementById('namepool-close-btn');
    const saveBtn = document.getElementById('namepool-save-btn');
    const customInput = document.getElementById('namepool-custom-input');
    const customAdd = document.getElementById('namepool-custom-add');

    if (!overlay) return;

    openBtn?.addEventListener('click', () => {
      current = load();
      renderCurrent();
      syncTagStates();
      overlay.classList.add('open');
    });

    closeBtn?.addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

    saveBtn?.addEventListener('click', () => {
      if (!current.length) { alert('名字库不能为空'); return; }
      save(current);
      overlay.classList.remove('open');
      // 给个反馈
      const btn = saveBtn;
      btn.textContent = '✅ 已保存！';
      setTimeout(() => { btn.textContent = '✅ 保存名字库'; }, 1500);
    });

    // 预设标签点击
    document.querySelectorAll('.namepool-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const name = tag.dataset.name;
        if (current.includes(name)) {
          current = current.filter(n => n !== name);
        } else {
          current.push(name);
        }
        renderCurrent();
        syncTagStates();
      });
    });

    // 自定义输入
    const doAdd = () => {
      const val = customInput.value.trim();
      if (!val) return;
      // 支持逗号分隔批量添加
      val.split(/[,，、]/).forEach(n => addName(n.trim()));
      customInput.value = '';
    };
    customAdd?.addEventListener('click', doAdd);
    customInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
  }

  // 初始化时从 localStorage 恢复名字池
  function restore() {
    const saved = load();
    NAME_POOL.cn = saved;
  }

  return { init, restore };
})();

// 页面加载时恢复名字池
NamePoolManager.restore();
