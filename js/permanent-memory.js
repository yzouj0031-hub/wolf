// 永久记忆（会接管主脚本的 buildSystemPrompt / openPCfg / endingSpeeches）
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 永久记忆系统
 * ================================================================ */
const PermanentMemory = (function() {
  const PREFIX = 'wg_pmem_';

  // 读取某角色的永久记忆（以角色名为key）
  function load(playerName) {
    try {
      const raw = localStorage.getItem(PREFIX + playerName);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  // 保存某角色的永久记忆
  function save(playerName, data) {
    try {
      localStorage.setItem(PREFIX + playerName, JSON.stringify(data));
    } catch(e) {}
  }

  // 清除某角色的永久记忆
  function clear(playerName) {
    try { localStorage.removeItem(PREFIX + playerName); } catch(e) {}
  }

  // 检查某玩家配置是否启用了永久记忆
  function isEnabled(playerId) {
    const c = playerConfigs[playerId];
    return !!(c && c.permanentMemory);
  }

  // 游戏结束后，为所有启用了永久记忆的AI角色生成并保存摘要
  async function saveEndOfGame(winType) {
    const players = S.players || [];
    const allInfo = players.map(p => `${p.name}[${p.role.name}|${p.alive?'存活':'死亡'}]`).join(', ');
    const winLabel = {good:'好人阵营胜利', bad:'狼人阵营胜利', jester:'小丑单独获胜', sk:'连环杀手单独获胜', lovers:'跨阵营情侣共同获胜'}[winType] || '游戏结束';

    for (const p of players) {
      if (p.isPlayer) continue; // 跳过玩家控制的角色
      if (!isEnabled(p.id)) continue; // 未启用永久记忆则跳过

      const api = getAPI(p.id);
      if (!api.key) continue;

      // 构建摘要
      const recentMemory = (p.memory || []).slice(-20).map(m => {
        if (m.role === 'user') return '【事件】' + m.content.slice(0, 120);
        if (m.role === 'assistant') return '【我说】' + m.content.slice(0, 80);
        return '';
      }).filter(Boolean).join('\n');
      const ownEndingRecord = getOfficialEndingSpeechRecords().find(r => r.name === p.name);
      const ownEnding = ownEndingRecord && ownEndingRecord.game
        ? String(ownEndingRecord.game).slice(0, 500)
        : '';

      let summaryPrompt = `你刚刚完成了一局狼人杀游戏，以下是你的游戏记录摘要。
你的角色：${p.name}（${p.role.emoji}${p.role.name}）
游戏结果：${winLabel}
全员阵容：${allInfo}

你的部分记忆：
${recentMemory}

${ownEnding ? `你在终局时实际说过的${ownEndingRecord.label}：\n${ownEnding}\n` : '你没有留下终局感言。'}

请用第一人称，简洁地总结这一局你的经历、关键决策、胜负感想，100-150字，这将作为你下一局的"前世记忆"。如果上面有我的真实终局感言，请保留其中的态度和关键观点，但不要逐字照抄。直接输出总结内容，不需要任何前言。`;
      if (blindNamesOn()) summaryPrompt = blindMaskPublic(summaryPrompt);

      try {
        const res = await fetch(api.url + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + api.key
          },
          body: JSON.stringify({
            model: api.model,
            messages: [{ role: 'user', content: summaryPrompt }],
            max_tokens: 300,
            temperature: 0.7,
            stream: true
          })
        });
        const data = await parseAPIResponseWithSSEFallback(res, { tag: '[复盘记忆]' });
        let summary = data.choices?.[0]?.message?.content?.trim();
        if (summary && blindNamesOn()) summary = blindMaskPublic(summary);
        if (summary) {
          const memData = {
            summary,
            gameId: S.gameId,
            time: Date.now(),
            role: p.role.name,
            result: winType,
            won: (winType === p.role.team)
          };
          save(p.name, memData);
          console.log(`[永久记忆] ${p.name} 记忆已保存`);
        }
      } catch(e) {
        console.warn('[永久记忆] 保存失败:', p.name, e.message);
      }
    }
  }

  // 获取某角色的永久记忆文本，用于注入system prompt
  function getMemoryText(playerName, playerId) {
    if (!isEnabled(playerId)) return '';
    const mem = load(playerName);
    if (!mem || !mem.summary) return '';
    const timeStr = mem.time ? new Date(mem.time).toLocaleDateString('zh-CN') : '未知';
    return `\n\n【前世记忆·上一局回忆（${timeStr}，你扮演了${mem.role}，${mem.won?'胜利':'失败'}）】\n${mem.summary}\n这是你上一局的记忆，可以作为参考，但不必执着于此，这一局是全新的开始。`;
  }

  // UI：打开命牌弹窗时更新永久记忆区域
  function refreshPMemUI(playerId) {
    const nameForMem = curNames[playerId] || ('P' + (playerId + 1));
    const enableEl = document.getElementById('pmem-enable');
    const previewEl = document.getElementById('pmem-preview');
    const contentArea = document.getElementById('pmem-content-area');
    const statusTag = document.getElementById('pmem-status-tag');
    const clearBtn = document.getElementById('pmem-clear-btn');

    if (!enableEl) return;

    const c = playerConfigs[playerId] || {};
    const enabled = !!c.permanentMemory;
    enableEl.checked = enabled;

    if (enabled) {
      contentArea.style.display = 'block';
      statusTag.style.display = 'inline-flex';
      const mem = load(nameForMem);
      if (mem && mem.summary) {
        const timeStr = new Date(mem.time).toLocaleDateString('zh-CN');
        previewEl.textContent = `[${timeStr}·${mem.role}·${mem.won?'胜':'负'}]\n${blindNamesOn() ? blindMaskPublic(mem.summary) : mem.summary}`;
      } else {
        previewEl.textContent = '暂无上一局记忆（本局结束后自动保存）';
      }
    } else {
      contentArea.style.display = 'none';
      statusTag.style.display = 'none';
    }

    // toggle 事件
    enableEl.onchange = () => {
      if (!playerConfigs[playerId]) playerConfigs[playerId] = {};
      playerConfigs[playerId].permanentMemory = enableEl.checked;
      refreshPMemUI(playerId);
      saveCfg();
    };

    // 清除记忆按钮
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm(`确定清除「${nameForMem}」的永久记忆？`)) {
          clear(nameForMem);
          previewEl.textContent = '已清除';
          statusTag.style.display = 'none';
        }
      };
    }
  }

  return { load, save, clear, isEnabled, saveEndOfGame, getMemoryText, refreshPMemUI };
})();

// ── 拦截 openPCfg，在打开弹窗时刷新永久记忆UI ──
const _origOpenPCfg = openPCfg;
openPCfg = function(i) {
  _origOpenPCfg(i);
  PermanentMemory.refreshPMemUI(i);
};

// ── 拦截 buildSystemPrompt，注入永久记忆 ──
const _origBuildSysPrompt = buildSystemPrompt;
buildSystemPrompt = function(p, taskContext) {
  let base = _origBuildSysPrompt(p, taskContext);
  const memText = PermanentMemory.getMemoryText(p.name, p.id);
  if (memText) base += memText;
  return base;
};

// 永久记忆注入完成后再做最终盲名封装：公共世界书/战报/旧记忆全部P化，
// 只在最前面给当前AI一份“仅你可见”的自身Cosplay人格锚点。
const _origBuildSysPromptBeforeBlindNames = buildSystemPrompt;
buildSystemPrompt = function(p, taskContext) {
  const base = blindForAI(_origBuildSysPromptBeforeBlindNames(p, taskContext), p);
  if (window.WolfI18n && WolfI18n.isEnglish()) {
    return '【OUTPUT LANGUAGE: ENGLISH】\nSpeak and reason entirely in natural English. Chinese names may remain unchanged, but all narration, decisions, explanations, and in-character dialogue must be English. Treat any Chinese text below as source data, not as the required response language.\n\n' + (WolfI18n.terminologyGuide ? WolfI18n.terminologyGuide() + '\n\n' : '') + base;
  }
  return base;
};

// ── 拦截游戏结束，自动保存永久记忆 ──
// 监听 endingSpeeches 完成后的时机：用 openPostGame 前拦截
const _origEndingSpeeches = typeof endingSpeeches === 'function' ? endingSpeeches : null;
if (_origEndingSpeeches) {
  endingSpeeches = async function(winType) {
    await _origEndingSpeeches(winType);
    // 游戏结束感言完成后，保存永久记忆
    try {
      S._winType = winType;
      await PermanentMemory.saveEndOfGame(winType);
      const hasAnyMem = S.players.some(p => !p.isPlayer && PermanentMemory.isEnabled(p.id));
      if (hasAnyMem) {
        Render.log('system', '🧠 永久记忆已更新，下一局启用的角色将带着本局记忆重生');
      }
    } catch(e) { console.warn('[永久记忆] 自动保存失败:', e); }
  };
}
