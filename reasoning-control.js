(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ReasoningControl = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MODES = Object.freeze(['smart', 'auto', 'off', 'low', 'medium', 'high', 'xhigh']);
  const STAGES = Object.freeze(['quick', 'normal', 'deep']);
  const SMART_MODE_BY_STAGE = Object.freeze({quick: 'low', normal: 'medium', deep: 'high'});
  const THINKING_BUDGETS = Object.freeze({off: 0, low: 1024, medium: 4096, high: 8192, xhigh: 16384});

  function normalizeMode(value, fallback) {
    const mode = String(value || '').toLowerCase();
    return MODES.includes(mode) ? mode : (fallback || 'smart');
  }

  function migrateLegacyKimiMode(value) {
    return ({
      smart: 'smart',
      auto: 'auto',
      instant: 'off',
      light: 'low',
      standard: 'medium',
      deep: 'xhigh'
    })[String(value || '').toLowerCase()] || 'smart';
  }

  function classifyStage(prompt, opts) {
    opts = opts || {};
    if (STAGES.includes(opts.reasoningStage)) return opts.reasoningStage;
    if (opts.skillConfirm) return 'quick';
    const text = String(prompt || '');
    if (/密约[·・]?独立提案|狼盟密约|关键残局|pact proposal|critical endgame/i.test(text)) return 'deep';
    return 'normal';
  }

  function resolveMode(params) {
    params = params || {};
    const globalMode = normalizeMode(params.globalMode, 'smart');
    const rawPlayerMode = String(params.playerMode || 'inherit').toLowerCase();
    const configured = rawPlayerMode !== 'inherit' && MODES.includes(rawPlayerMode)
      ? rawPlayerMode
      : globalMode;
    const stage = classifyStage(params.prompt, params.opts);
    return {
      configured,
      effective: configured === 'smart' ? SMART_MODE_BY_STAGE[stage] : configured,
      stage,
      source: rawPlayerMode !== 'inherit' && MODES.includes(rawPlayerMode) ? 'player' : 'global'
    };
  }

  function thinkingBudget(mode) {
    return Object.prototype.hasOwnProperty.call(THINKING_BUDGETS, mode)
      ? THINKING_BUDGETS[mode]
      : null;
  }

  function openAIEffort(mode, allowXHigh) {
    if (mode === 'auto') return null;
    if (mode === 'off') return 'minimal';
    if (mode === 'xhigh') return allowXHigh ? 'xhigh' : 'high';
    return ['low', 'medium', 'high'].includes(mode) ? mode : null;
  }

  function anthropicEffort(mode) {
    if (mode === 'auto') return null;
    if (mode === 'off') return 'low';
    return ['low', 'medium', 'high', 'xhigh'].includes(mode) ? mode : null;
  }

  function geminiThinkingConfig(model, mode) {
    const mn = String(model || '').toLowerCase();
    if (mode === 'auto') return null;
    if (mn.includes('gemini-3') || mn.includes('gemini3')) {
      const minimum = mn.includes('pro') ? 'low' : 'minimal';
      return {thinkingLevel: mode === 'off' ? minimum : (mode === 'xhigh' ? 'high' : mode)};
    }
    if (mn.includes('gemini-2.5') || mn.includes('gemini2.5')) {
      return {thinkingBudget: mode === 'off' && mn.includes('pro') ? 128 : thinkingBudget(mode)};
    }
    return null;
  }

  return Object.freeze({
    MODES,
    STAGES,
    normalizeMode,
    migrateLegacyKimiMode,
    classifyStage,
    resolveMode,
    thinkingBudget,
    openAIEffort,
    anthropicEffort,
    geminiThinkingConfig
  });
});
