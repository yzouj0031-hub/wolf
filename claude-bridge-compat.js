(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ClaudeBridgeCompat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FAILURE_MARKER = /\[反代生成失败[：:]\s*([\s\S]*?)\]/i;
  const CLAUDE_MODEL = /(?:^|[\/_-])(claude|anthropic|fable|mythos|opus|sonnet|haiku)(?:[-_.\d]|$)/i;

  function isClaudeModel(model) {
    const name = String(model || '').trim();
    return /claude|anthropic/i.test(name) || CLAUDE_MODEL.test(name);
  }

  function sanitizeReasoningRequest(text) {
    let out = String(text == null ? '' : text);
    const notice = '（请在内部完成判断，不要输出隐藏思维链或草稿。）';
    return out
      .replace(/<\s*(?:thinking|draft)\s*>[\s\S]*?<\s*\/\s*(?:thinking|draft)\s*>/gi, notice)
      .replace(/[\[【]\s*(?:草稿|思考|thinking|draft)\s*[\]】][\s\S]*?[\[【]\s*\/\s*(?:草稿|思考|thinking|draft)\s*[\]】]/gi, notice)
      .replace(/<\s*\/?\s*(?:thinking|draft)\s*>/gi, '')
      .replace(/[\[【]\s*\/?\s*(?:草稿|思考|thinking|draft)\s*[\]】]/gi, '');
  }

  function sanitizeContent(content) {
    if (typeof content === 'string') return sanitizeReasoningRequest(content);
    if (!Array.isArray(content)) return content;
    return content.map(part => {
      if (typeof part === 'string') return sanitizeReasoningRequest(part);
      if (!part || typeof part !== 'object' || typeof part.text !== 'string') return part;
      return Object.assign({}, part, {text: sanitizeReasoningRequest(part.text)});
    });
  }

  function prepareOpenAIRequest(body) {
    if (!body || !isClaudeModel(body.model)) return body;
    const next = Object.assign({}, body, {stream: true});
    if (Array.isArray(body.messages)) {
      next.messages = body.messages.map(message => Object.assign({}, message, {
        content: sanitizeContent(message.content)
      }));
    }
    // Claude/OpenAI compatibility layers frequently reject sampling controls in
    // combinations. The bridge owns these defaults, so omit the optional fields.
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
    return match ? (match[1] || 'Claude 反代生成失败').trim() : '';
  }

  function failureFromEvent(event) {
    if (!event || typeof event !== 'object') return '';
    if (event.error) return messageFrom(event.error);
    if (event.type === 'error') return messageFrom(event.message || event);
    const delta = event.choices && event.choices[0] && (event.choices[0].delta || event.choices[0].message);
    return failureFromText(delta && delta.content);
  }

  function makeError(message, code, extra) {
    const error = new Error(String(message || 'Claude 反代请求失败'));
    error.code = code || 'CLAUDE_BRIDGE_ERROR';
    if (extra) Object.assign(error, extra);
    return error;
  }

  function validateJSON(data) {
    if (data && data.error) throw makeError(messageFrom(data.error), 'CLAUDE_BRIDGE_ERROR');
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const marker = failureFromText(content);
    if (marker) throw makeError(marker, 'CLAUDE_BRIDGE_ERROR');
    return data;
  }

  function assertStreamResult(result) {
    const streamError = result && result.streamError;
    if (streamError) throw makeError(streamError, 'CLAUDE_BRIDGE_ERROR');
    const marker = failureFromText(result && result.content);
    if (marker) throw makeError(marker, 'CLAUDE_BRIDGE_ERROR');
    if (!String(result && result.content || '').trim() && !String(result && result.reasoning || '').trim()) {
      throw makeError('Claude 反代连接成功，但没有返回正文', 'CLAUDE_EMPTY_RESPONSE');
    }
    return result;
  }

  function classifyError(error) {
    const message = messageFrom(error);
    const lower = message.toLowerCase();
    if (/usage policy|acceptable use|violat|reverse engineering|duplicating model outputs|使用政策|政策限制/.test(lower)) {
      return {kind:'policy', retryable:false, label:'Claude 使用政策拦截'};
    }
    if (/\b401\b|\b403\b|api[ _-]?key|unauthori[sz]ed|forbidden|密钥|未授权/.test(lower)) {
      return {kind:'auth', retryable:false, label:'API 密钥或权限错误'};
    }
    if (/session limit|usage limit|rate limit|quota|reset(?:s| at)?|额度|配额|达到.{0,8}上限/.test(lower)) {
      return {kind:'quota', retryable:false, label:'Claude 额度或会话上限'};
    }
    if (/invalid model|selected model|model.{0,100}(?:not found|unavailable|may not exist|do not have access|don't have access)|模型.{0,16}(?:不存在|不可用|无权限)/.test(lower)) {
      return {kind:'model', retryable:false, label:'模型名称不可用'};
    }
    if ((error && error.code === 'CLAUDE_EMPTY_RESPONSE') || /空响应|没有返回正文|无有效响应内容/.test(message)) {
      return {kind:'empty', retryable:true, label:'Claude 反代空回复'};
    }
    if ((error && error.name === 'AbortError') || /timeout|timed out|超时|连接被掐断/.test(lower)) {
      return {kind:'timeout', retryable:true, label:'连接超时或中断'};
    }
    if (/\b5\d\d\b|econn|network|fetch failed|socket|网络/.test(lower)) {
      return {kind:'network', retryable:true, label:'反代或网络暂时故障'};
    }
    return {kind:'unknown', retryable:true, label:'Claude 反代调用失败'};
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
    sanitizeReasoningRequest,
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
