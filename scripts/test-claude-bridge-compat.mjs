import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const compat = require('../claude-bridge-compat.js');

for (const model of ['claude-opus-5-5', 'sonnet-5.5', 'fable-5-1', 'mythos_5_1', 'haiku-4-5']) {
  assert.equal(compat.isClaudeModel(model), true, `${model} should be treated as Claude-compatible`);
}
assert.equal(compat.isClaudeModel('gpt-5.5'), false);

// 请求整理只动参数，消息原样：规则书里的 <thinking> / [草稿] 是在教模型怎么输出
const prompt = '在<thinking>里充分思考局势。在<game>里公开发言。可以在 [草稿] 和 [/草稿] 之间写内心思考。\n<thinking>你的分析</thinking>\n<game>发言</game>';
const original = {
  model: 'fable-5-1',
  stream: false,
  top_p: 1,
  temperature: 0.8,
  frequency_penalty: 0.5,
  presence_penalty: 0.3,
  reasoning_effort: 'high',
  messages: [{role:'system', content:prompt}, {role:'user', content:[{type:'text', text:prompt}]}]
};
const prepared = compat.prepareOpenAIRequest(original);
assert.equal(prepared.stream, true);
assert.equal(prepared.top_p, undefined);
assert.equal(prepared.temperature, 0.8);
assert.equal(prepared.frequency_penalty, undefined);
assert.equal(prepared.presence_penalty, undefined);
assert.equal(prepared.reasoning_effort, 'high');
assert.deepEqual(prepared.messages, original.messages, '提示词必须原样发出');
assert.equal(original.stream, false, 'request preparation must not mutate the original body');
assert.equal(compat.sanitizeReasoningRequest, undefined, '不再提供提示词清洗');
for (const page of ['index.html', 'en/index.html', 'mystery.js']) {
  assert.ok(!/sanitizeReasoningRequest|sanitizeContent/.test(fs.readFileSync(page, 'utf8')), `${page} 不该清洗提示词`);
}
const gpt = compat.prepareOpenAIRequest({model:'gpt-4o', top_p:1, stream:false});
assert.equal(gpt.top_p, 1, '非 Claude 模型不动');

assert.equal(
  compat.failureFromEvent({choices:[{delta:{content:'[反代生成失败：Claude CLI 返回了空响应]'}}]}),
  'Claude CLI 返回了空响应'
);
assert.equal(compat.failureFromEvent({type:'error', error:{message:'upstream failed'}}), 'upstream failed');
assert.equal(compat.failureFromEvent({choices:[{delta:{content:'正常发言'}}]}), '');

assert.throws(
  () => compat.assertStreamResult({content:'[反代生成失败：session limit reached]', reasoning:''}),
  error => error.code === 'BRIDGE_ERROR' && /session limit/.test(error.message)
);
assert.throws(
  () => compat.assertStreamResult({content:'', reasoning:''}),
  error => error.code === 'EMPTY_RESPONSE' && /中转返回了空响应/.test(error.message) && !/Claude/.test(error.message)
);
assert.doesNotThrow(() => compat.assertStreamResult({content:'', reasoning:'只想了没说'}));
assert.doesNotThrow(() => compat.validateJSON({choices:[{message:{content:[{type:'text', text:'分块'}]}}]}), '分块 content 不该报错');

// 不可重试：政策、密钥、模型名、明确的额度用完
assert.equal(compat.classifyError(new Error('Usage Policy: reverse engineering')).kind, 'policy');
assert.equal(compat.classifyError(new Error('HTTP 401 invalid api key')).kind, 'auth');
assert.equal(compat.classifyError(new Error('session limit reached')).kind, 'quota');
assert.equal(compat.classifyError(new Error('insufficient_quota')).kind, 'quota');
assert.equal(compat.classifyError(new Error("There's an issue with the selected model (fable-5-1). It may not exist or you may not have access to it.")).kind, 'model');
assert.equal(compat.shouldRetry(new Error('Usage Policy violation'), 1, 2), false);
// 可重试：网络抖动、限流、空回复、超时、5xx
for (const [text, kind] of [
  ['read ECONNRESET', 'network'],
  ['connection reset by peer', 'network'],
  ['HTTP 429 rate limit exceeded, retry after 2s', 'ratelimit'],
  ['HTTP 429 Too Many Requests', 'ratelimit'],
  ['HTTP 502 Bad Gateway', 'network'],
  ['The operation timed out', 'timeout'],
  ['usage will reset at 3pm', 'unknown']
]) {
  const info = compat.classifyError(new Error(text));
  assert.equal(info.kind, kind, `${text} → ${JSON.stringify(info)}`);
  assert.equal(info.retryable, true, `${text} 应可重试`);
}
assert.equal(compat.classifyError(Object.assign(new Error('empty'), {code:'EMPTY_RESPONSE'})).kind, 'empty');
assert.equal(compat.shouldRetry(Object.assign(new Error('empty'), {code:'EMPTY_RESPONSE'}), 1, 2), true);
assert.equal(compat.shouldRetry(new Error('read ECONNRESET'), 1, 2), true);
assert.equal(compat.shouldRetry(new Error('read ECONNRESET'), 2, 2), false, '到了次数上限才停');

// 新文件要进 PWA 缓存清单和打包清单
assert.ok(fs.readFileSync('sw.js', 'utf8').includes("'./claude-bridge-compat.js'"), 'PWA 缓存清单缺 claude-bridge-compat.js');
assert.ok(fs.readFileSync('scripts/build-www.mjs', 'utf8').includes("'claude-bridge-compat.js'"), 'APK 打包清单缺 claude-bridge-compat.js');

console.log('Claude bridge compatibility checks passed');
