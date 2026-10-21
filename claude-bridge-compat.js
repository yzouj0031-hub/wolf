// Claude 反代（Claude Code bridge 一类的 OpenAI 兼容层）的适配：
//   · 流里夹着的「[反代生成失败：…]」标记和 error 事件转成明确的报错，不再当成正文
//   · 明确的政策拦截、密钥错误、模型名不可用不再空转重试；网络抖动、限流、空回复照旧重试
//   · 请求体去掉 Claude 兼容层常拒绝的采样字段（top_p 与 temperature 不能同时给）
// 这里不碰提示词：规则书里的 <thinking> / [草稿] 是在教模型怎么输出，洗掉就成了病句。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ClaudeBridgeCompat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FAILURE_MARKER = /\[反代生成失败[：:]\s*([\s\S]*?)\]/i;
  const CLAUDE_MODEL = /(?:^|[\/_-])(claude|anthropic|fable|mythos|opus|sonnet|haiku)(?:[-_.\d]|$)/i;
  const EMPTY_MESSAGE = '中转返回了空响应(连接成功但无输出内容,通常是中转限流/上游故障/模型不可用,建议换模型或换中转)';

  function isClaudeModel(model) {
    const name = String(model || '').trim();
    return /claude|anthropic/i.test(name) || CLAUDE_MODEL.test(name);
  }

  // 只整理请求参数，消息内容原样发出
  function prepareOpenAIRequest(body) {
    if (!body || !isClaudeModel(body.model)) return body;
    const next = Object.assign({}, body, {stream: true});
    delete next.top_p;
    delete next.frequency_penalty;
    delete next.presence_penalty;
    return next;
  }

  function messageFrom(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.message === 'string') return value.message;
    if (value.error) return messageFrom(value.error);
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  function failureFromText(text) {
    const match = String(text || '').match(FAILURE_MARKER);
    return match ? (match[1] || '反代生成失败').trim() : '';
  }

  function failureFromEvent(event) {
    if (!event || typeof event !== 'object') return '';
    if (event.error) return messageFrom(event.error);
    if (event.type === 'error') return messageFrom(event.message || event);
    const delta = event.choices && event.choices[0] && (event.choices[0].delta || event.choices[0].message);
    return failureFromText(delta && delta.content);
  }

  function makeError(message, code, extra) {
    const error = new Error(String(message || '请求失败'));
    error.code = code || 'BRIDGE_ERROR';
    if (extra) Object.assign(error, extra);
    return error;
  }

  function validateJSON(data) {
    if (data && data.error) throw makeError(messageFrom(data.error), 'BRIDGE_ERROR');
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const marker = failureFromText(typeof content === 'string' ? content : '');
    if (marker) throw makeError(marker, 'BRIDGE_ERROR');
    return data;
  }

  function assertStreamResult(result) {
    const streamError = result && result.streamError;
    if (streamError) throw makeError(streamError, 'BRIDGE_ERROR');
    const marker = failureFromText(result && result.content);
    if (marker) throw makeError(marker, 'BRIDGE_ERROR');
    if (!String(result && result.content || '').trim() && !String(result && result.reasoning || '').trim()) {
      throw makeError(EMPTY_MESSAGE, 'EMPTY_RESPONSE');
    }
    return result;
  }

  // 不可重试的只有三类：政策拦截、密钥或权限、模型名不可用，以及明确说额度用完的。
  // 网络抖动（ECONNRESET 等）、限流（429）、空回复、超时都算临时故障，照旧重试。
  function classifyError(error) {
    const message = messageFrom(error);
    const lower = message.toLowerCase();
    if (/usage policy|acceptable use|violat|reverse engineering|duplicating model outputs|使用政策|政策限制/.test(lower)) {
      return {kind:'policy', retryable:false, label:'使用政策拦截'};
    }
    if (/\b401\b|\b403\b|invalid[ _-]?api[ _-]?key|api key|unauthori[sz]ed|forbidden|密钥|未授权/.test(lower)) {
      return {kind:'auth', retryable:false, label:'API 密钥或权限错误'};
    }
    if (/session limit|usage limit|insufficient[ _-]?quota|quota exceeded|额度已?用完|配额已?用完|额度不足|配额不足/.test(lower)) {
      return {kind:'quota', retryable:false, label:'额度或会话上限'};
    }
    if (/invalid model|selected model|model.{0,100}(?:not found|unavailable|may not exist|do not have access|don't have access)|模型.{0,16}(?:不存在|不可用|无权限)/.test(lower)) {
      return {kind:'model', retryable:false, label:'模型名称不可用'};
    }
    if ((error && error.code === 'EMPTY_RESPONSE') || /空响应|没有返回正文|无有效响应内容/.test(message)) {
      return {kind:'empty', retryable:true, label:'空回复'};
    }
    if (/\b429\b|rate limit|too many requests|限流/.test(lower)) {
      return {kind:'ratelimit', retryable:true, label:'限流'};
    }
    if ((error && error.name === 'AbortError') || /timeout|timed out|超时|连接被掐断/.test(lower)) {
      return {kind:'timeout', retryable:true, label:'连接超时或中断'};
    }
    if (/\b5\d\d\b|econn|connection reset|network|fetch failed|socket|网络/.test(lower)) {
      return {kind:'network', retryable:true, label:'反代或网络暂时故障'};
    }
    return {kind:'unknown', retryable:true, label:'调用失败'};
  }

  function shouldRetry(error, attempt, maxAttempts) {
    return classifyError(error).retryable && Number(attempt) < Number(maxAttempts);
  }

  function userMessage(error) {
    const info = classifyError(error);
    const raw = messageFrom(error).replace(/^Error:\s*/i, '').slice(0, 240);
    return `${info.label}${raw ? `：${raw}` : ''}`;
  }

  return {
    isClaudeModel,
    prepareOpenAIRequest,
    failureFromText,
    failureFromEvent,
    validateJSON,
    assertStreamResult,
    classifyError,
    shouldRetry,
    userMessage
  };
});
