// 角色生成器（AI 驱动）
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 角色生成器（AI驱动）
 * ================================================================ */
(function() {
  const STYLES = {
    faithful: '忠实原著，保留原角色核心性格特征和口头禅，语气尽量贴近原作表现。',
    dark: '暗黑强化版，放大角色的阴暗面、执念和危险性，更有戏剧张力，带有压迫感。',
    dramatic: '戏剧张力版，强化情感表达，语言更为华丽，擅长用声势浩大的口吻表达自己。',
    brief: '简洁精炼版，用最少的文字概括核心性格，适合快速配置，无废话。'
  };

  function buildPrompt(name, work, styleKey) {
    const styleDesc = STYLES[styleKey] || STYLES.faithful;
    return `你是一个狼人杀游戏的角色人设生成器。请为以下角色生成一段适合在AI狼人杀游戏中使用的角色人设文本。

角色名：${name}
来源作品：${work}
风格要求：${styleDesc}

请生成一段角色人设，格式如下（直接输出，不要加任何标题或前言）：

你是${name}，来自《${work}》。

【核心性格】（2-3句话概括核心性格特征，包括说话风格、思维方式、行为习惯）

【说话方式】（描述说话的语气、口头禅、惯用句式，让AI能准确模仿）

【在狼人杀中的表现风格】（结合角色性格，描述该角色在推理、投票、发言时的独特风格和倾向）

【禁止事项】（2-3条该角色绝对不会说的话或做的事，保持角色一致性）

注意：人设内容要具体实用，字数控制在250-400字之间，让AI看了就能准确扮演这个角色。`;
  }

  async function generatePersona() {
    const name = document.getElementById('chagen-name').value.trim();
    const work = document.getElementById('chagen-work').value.trim();
    const style = document.getElementById('chagen-style').value;
    const statusEl = document.getElementById('chagen-status');
    const outputEl = document.getElementById('chagen-output');
    const resultEl = document.getElementById('chagen-result');
    const genBtn = document.getElementById('chagen-gen-btn');

    if (!name) {
      statusEl.className = 'chagen-status err';
      statusEl.textContent = '⚠️ 请输入角色名';
      document.getElementById('chagen-name').focus();
      return;
    }

    // 取全局API配置
    const url = (document.getElementById('g-url').value || '').trim().replace(/\/$/, '');
    const key = (document.getElementById('g-key').value || '').trim();
    const model = (document.getElementById('g-model').value || '').trim();

    if (!url || !key) {
      statusEl.className = 'chagen-status err';
      statusEl.textContent = '⚠️ 请先在设置面板填写API地址和密钥';
      return;
    }

    genBtn.disabled = true;
    statusEl.className = 'chagen-status loading';
    statusEl.textContent = '✨ 生成中…';
    outputEl.value = '';
    outputEl.classList.add('chagen-cursor');
    resultEl.classList.add('show');

    const prompt = buildPrompt(name, work || '未知作品', style);

    try {
      const res = await fetch(url + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
          temperature: 0.85,
          stream: true
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'HTTP ' + res.status);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              outputEl.value = fullText;
              outputEl.scrollTop = outputEl.scrollHeight;
            }
          } catch(e) {}
        }
      }

      outputEl.classList.remove('chagen-cursor');
      statusEl.className = 'chagen-status ok';
      statusEl.textContent = '✅ 生成完成！可以编辑后复制到命牌人设栏';
    } catch(e) {
      outputEl.classList.remove('chagen-cursor');
      statusEl.className = 'chagen-status err';
      statusEl.textContent = '❌ 生成失败：' + e.message;
    }
    genBtn.disabled = false;
  }

  function initCharacterGenerator() {
    const overlay = document.getElementById('chagenOverlay');
    const openBtn = document.getElementById('btn-chagen');
    const genBtn = document.getElementById('chagen-gen-btn');
    const closeBtn = document.getElementById('chagen-close-btn');
    const copyBtn = document.getElementById('chagen-copy-btn');
    const regenBtn = document.getElementById('chagen-regen-btn');

    if (!overlay) return;

    openBtn?.addEventListener('click', () => {
      document.getElementById('chagen-status').textContent = '就绪，输入角色信息后点击生成';
      document.getElementById('chagen-status').className = 'chagen-status';
      document.getElementById('chagen-result').classList.remove('show');
      document.getElementById('chagen-output').value = '';
      overlay.classList.add('show');
      setTimeout(() => document.getElementById('chagen-name')?.focus(), 100);
    });

    closeBtn?.addEventListener('click', () => overlay.classList.remove('show'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });

    genBtn?.addEventListener('click', generatePersona);
    regenBtn?.addEventListener('click', generatePersona);

    // Enter键触发生成
    ['chagen-name', 'chagen-work'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') generatePersona();
      });
    });

    copyBtn?.addEventListener('click', () => {
      const txt = document.getElementById('chagen-output').value.trim();
      if (!txt) return;
      navigator.clipboard.writeText(txt).then(() => {
        copyBtn.textContent = '✅ 已复制！';
        setTimeout(() => { copyBtn.textContent = '📋 复制到剪贴板'; }, 2000);
      }).catch(() => {
        // 降级方案
        document.getElementById('chagen-output').select();
        document.execCommand('copy');
        copyBtn.textContent = '✅ 已复制！';
        setTimeout(() => { copyBtn.textContent = '📋 复制到剪贴板'; }, 2000);
      });
    });

    const toVaultBtn = document.getElementById('chagen-tovault-btn');
    toVaultBtn?.addEventListener('click', () => {
      const txt = document.getElementById('chagen-output').value.trim();
      if (!txt) return;
      // 用角色名作为人设名称，留空则取作品名，再留空则用默认
      const nm = (document.getElementById('chagen-name')?.value || '').trim()
        || (document.getElementById('chagen-work')?.value || '').trim()
        || '生成人设';
      window.personaPool = window.personaPool || [];
      window.personaPool.push({ id: 'persona_' + Date.now() + '_' + Math.floor(Math.random()*1000), title: nm, persona: txt });
      saveCfg();
      toVaultBtn.textContent = '✅ 已存入！';
      setTimeout(() => { toVaultBtn.textContent = '📥 存入人设库'; }, 2000);
    });
  }

  // 等DOM ready后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCharacterGenerator);
  } else {
    initCharacterGenerator();
  }
})();
