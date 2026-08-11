import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ReasoningControl = require('../reasoning-control.js');

const quick = ReasoningControl.resolveMode({globalMode:'smart', opts:{skillConfirm:true}});
assert.equal(quick.stage, 'quick');
assert.equal(quick.effective, 'low');

const speech = ReasoningControl.resolveMode({globalMode:'smart', prompt:'请发表你的看法'});
assert.equal(speech.stage, 'normal');
assert.equal(speech.effective, 'medium');

const pact = ReasoningControl.resolveMode({globalMode:'smart', opts:{skillConfirm:true, reasoningStage:'deep'}});
assert.equal(pact.stage, 'deep');
assert.equal(pact.effective, 'high');

const override = ReasoningControl.resolveMode({globalMode:'low', playerMode:'xhigh', opts:{skillConfirm:true}});
assert.equal(override.source, 'player');
assert.equal(override.effective, 'xhigh');
assert.equal(ReasoningControl.resolveMode({globalMode:'auto'}).effective, 'auto');

assert.deepEqual(
  ['instant','light','standard','deep','auto'].map(ReasoningControl.migrateLegacyKimiMode),
  ['off','low','medium','xhigh','auto']
);
assert.equal(ReasoningControl.thinkingBudget('off'), 0);
assert.equal(ReasoningControl.thinkingBudget('xhigh'), 16384);
assert.equal(ReasoningControl.openAIEffort('off', true), 'minimal');
assert.equal(ReasoningControl.openAIEffort('xhigh', true), 'xhigh');
assert.equal(ReasoningControl.openAIEffort('xhigh', false), 'high');
assert.equal(ReasoningControl.anthropicEffort('off'), 'low');
assert.equal(ReasoningControl.anthropicEffort('xhigh'), 'xhigh');
assert.equal(ReasoningControl.anthropicEffort('auto'), null);
assert.deepEqual(ReasoningControl.geminiThinkingConfig('gemini-3.1-pro-preview', 'medium'), {thinkingLevel:'medium'});
assert.deepEqual(ReasoningControl.geminiThinkingConfig('gemini-3.1-pro-preview', 'off'), {thinkingLevel:'low'});
assert.deepEqual(ReasoningControl.geminiThinkingConfig('gemini-3-flash-preview', 'off'), {thinkingLevel:'minimal'});
assert.deepEqual(ReasoningControl.geminiThinkingConfig('gemini-2.5-flash', 'high'), {thinkingBudget:8192});
assert.deepEqual(ReasoningControl.geminiThinkingConfig('gemini-2.5-pro', 'off'), {thinkingBudget:128});
assert.equal(ReasoningControl.geminiThinkingConfig('gemini-2.0-flash', 'high'), null);

const root = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const english = fs.readFileSync(new URL('../en/index.html', import.meta.url), 'utf8');
const build = fs.readFileSync(new URL('./build-www.mjs', import.meta.url), 'utf8');

for (const [source, label] of [[root, 'root'], [english, 'English']]) {
  assert.match(source, /id="g-reasoning-mode"/, `${label} global reasoning selector`);
  assert.match(source, /id="pc-reasoning-mode"/, `${label} per-player reasoning selector`);
  assert.match(source, /reasoningMode:\$\('g-reasoning-mode'\)/, `${label} reasoning persistence`);
  assert.match(source, /migrateLegacyKimiMode\(d\.kimiThinkingMode\)/, `${label} legacy Kimi migration`);
  assert.match(source, /reasoningStage:'deep'/, `${label} deep pact routing`);
  assert.match(source, /applyCompatibleReasoningControl/, `${label} compatible provider mapping`);
  assert.match(source, /id:'custom'.*name:'GPT \/ OpenAI (?:反代 \/ 中转|proxy).*type:'openai'/, `${label} explicit GPT reverse-proxy channel`);
  assert.match(source, /return u \+ '\/chat\/completions'/, `${label} GPT proxy uses OpenAI-compatible chat completions`);
  assert.match(source, /body\.output_config = \{effort: anthropicEffort\}/, `${label} native Claude effort mapping`);
  assert.match(source, /Gemini endpoint rejected reasoning mode|Gemini端点不支持思考档位/, `${label} Gemini fallback`);
  assert.doesNotMatch(source, /id="kimi-thinking-mode"/, `${label} obsolete Kimi-only selector removed`);
  assert.doesNotMatch(source, /body\.reasoning_effort = pcfg\.reasoningEffort/, `${label} fixed GPT reasoning override removed`);
}

assert.match(root, /src="\.\/reasoning-control\.js"/);
assert.match(english, /src="\.\.\/reasoning-control\.js"/);
assert.match(build, /'reasoning-control\.js'/);

console.log('Reasoning control regression checks passed');
