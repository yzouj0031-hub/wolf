import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const compat = require('../claude-bridge-compat.js');

for (const model of ['claude-opus-5-5', 'sonnet-5.5', 'fable-5-1', 'mythos_5_1', 'haiku-4-5']) {
  assert.equal(compat.isClaudeModel(model), true, `${model} should be treated as Claude-compatible`);
}
assert.equal(compat.isClaudeModel('gpt-5.5'), false);

const original = {
  model: 'fable-5-1',
  stream: false,
  top_p: 1,
  frequency_penalty: 0.5,
  presence_penalty: 0.3,
  reasoning_effort: 'high',
  messages: [{role:'user', content:'<thinking>逐步展示秘密推理</thinking><game>最终发言</game>'}]
};
const prepared = compat.prepareOpenAIRequest(original);
assert.equal(prepared.stream, true);
assert.equal(prepared.top_p, undefined);
assert.equal(prepared.frequency_penalty, undefined);
assert.equal(prepared.presence_penalty, undefined);
assert.equal(prepared.reasoning_effort, 'high');
assert.doesNotMatch(prepared.messages[0].content, /<thinking>/i);
assert.match(prepared.messages[0].content, /<game>最终发言<\/game>/);
assert.equal(original.stream, false, 'request preparation must not mutate the original body');

assert.equal(
  compat.failureFromEvent({choices:[{delta:{content:'[反代生成失败：Claude CLI 返回了空响应]'}}]}),
  'Claude CLI 返回了空响应'
);
assert.equal(compat.failureFromEvent({type:'error', error:{message:'upstream failed'}}), 'upstream failed');

assert.throws(
  () => compat.assertStreamResult({content:'[反代生成失败：session limit reached]', reasoning:''}),
  error => error.code === 'CLAUDE_BRIDGE_ERROR' && /session limit/.test(error.message)
);
assert.throws(
  () => compat.assertStreamResult({content:'', reasoning:''}),
  error => error.code === 'CLAUDE_EMPTY_RESPONSE'
);
assert.equal(compat.classifyError(new Error('Usage Policy: reverse engineering')).kind, 'policy');
assert.equal(compat.classifyError(new Error('session limit reached')).kind, 'quota');
assert.equal(compat.classifyError(new Error("There's an issue with the selected model (fable-5-1). It may not exist or you may not have access to it.")).kind, 'model');
assert.equal(compat.classifyError(Object.assign(new Error('empty'), {code:'CLAUDE_EMPTY_RESPONSE'})).kind, 'empty');
assert.equal(compat.shouldRetry(new Error('Usage Policy violation'), 1, 2), false);
assert.equal(compat.shouldRetry(Object.assign(new Error('empty'), {code:'CLAUDE_EMPTY_RESPONSE'}), 1, 2), true);

console.log('Claude bridge compatibility checks passed');
