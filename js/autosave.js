// 自动存档
// 中英文页面（index.html / en/index.html）共用，从页面主脚本原样搬出，内容未改。

/* ================================================================
 *  § 自动存档：阶段变化 / 后台切换 / 每60秒
 * ================================================================ */
const AutoSave = (() => {
  const INTERVAL_MS = 60 * 1000;
  const PHASE_CHECK_MS = 1500;
  let lastSignature = '';
  let lastSavedAt = 0;

  function canSave() {
    return !!(S && Array.isArray(S.players) && S.players.length && S.phase && S.phase !== 'waiting');
  }

  function signature() {
    if (!canSave()) return '';
    const alive = S.players.filter(p => p.alive).map(p => p.id).join(',');
    return [S.gameId, S.round, S.phase, S.gameOver ? 1 : 0, alive].join('|');
  }

  function save(reason, force = false) {
    if (!canSave()) return false;
    // ★ 阶段处理进行中(S.running)时状态不一致：夜晚 handler 会先重置 nightData 再逐个重跑夜间行动，
    //   若此刻存档，读档续玩会把这一夜从头重跑一遍——魔术师交换、"第N夜"标题、各夜间行动都会出现两次，
    //   且重跑时 nightData 被清空会覆盖掉真实的交换/守护结果。只在阶段边界(!running)落盘，读档才安全。
    if (S && S.running) return false;
    const now = Date.now();
    if (!force && now - lastSavedAt < 1500) return false;
    const ok = saveGame({silent:true, reason});
    if (ok) {
      lastSavedAt = now;
      lastSignature = signature();
      console.debug('[自动存档]', reason, new Date(now).toLocaleTimeString());
    }
    return ok;
  }

  setInterval(() => {
    const next = signature();
    if (!next) { lastSignature = ''; return; }
    if (!lastSignature) { lastSignature = next; return; }
    if (next !== lastSignature) save('阶段变化');
  }, PHASE_CHECK_MS);

  setInterval(() => save('定时保存'), INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save('切到后台', true);
  });
  window.addEventListener('pagehide', () => save('页面关闭', true));

  return {save};
})();
