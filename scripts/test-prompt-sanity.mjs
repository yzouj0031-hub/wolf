import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function buildAbsentClassicRoleRule(');
const end = html.indexOf('\nfunction buildSystemPrompt(', start);
assert.ok(start >= 0 && end > start, 'prompt sanity helpers are missing');

const S = {players:[], pureAI:true};
const helpers = new Function(
  'S',
  `${html.slice(start, end)}; return {buildAbsentClassicRoleRule, promptTaskKind, buildPhaseOutputContract, inspectPromptContradictions};`
)(S);

const {buildAbsentClassicRoleRule, promptTaskKind, buildPhaseOutputContract, inspectPromptContradictions} = helpers;

const withRealSeer = buildAbsentClassicRoleRule(
  new Set(['seer', 'villager', 'wolf']),
  ['预言家'],
  ['女巫', '守卫', '猎人', '骑士']
);
assert.match(withRealSeer, /本局没有：女巫、守卫、猎人、骑士/);
assert.doesNotMatch(withRealSeer, /本局虽然没有["“]预言家/,
  'a real seer was incorrectly described as absent');
assert.doesNotMatch(withRealSeer, /本局没有警徽流/,
  'a real seer lost badge-flow rules because another classic role was absent');

const substituteInspector = buildAbsentClassicRoleRule(
  new Set(['fox', 'villager', 'wolf']),
  ['子狐'],
  ['预言家', '女巫']
);
assert.match(substituteInspector, /本局虽然没有["“]预言家/);
assert.match(substituteInspector, /本局没有警徽流/);
assert.equal(buildAbsentClassicRoleRule(new Set(['seer']), ['预言家'], []), '');

const campaign = {prompt:'【警长竞选演讲】请发表竞选陈词', opts:{}};
assert.equal(promptTaskKind(campaign), 'speech');
const campaignContract = buildPhaseOutputContract(campaign, true);
assert.match(campaignContract, /本轮输出契约·发言/);
assert.match(campaignContract, /<action>不是通用必填项/);
assert.doesNotMatch(campaignContract, /按当前任务给出的格式填写<action>/);

for (const context of [
  {prompt:'【警长竞选】是否上警', opts:{skillConfirm:true}},
  {prompt:'【投票】请选择一人', opts:{requireGame:false}},
  {prompt:'【退选决定】退选或留在警上', opts:{}}
]) {
  assert.equal(promptTaskKind(context), 'operation');
  const contract = buildPhaseOutputContract(context, true);
  assert.match(contract, /本轮输出契约·纯操作/);
  assert.match(contract, /按当前任务给出的格式填写<action>/);
  assert.doesNotMatch(contract, /本轮必须把真正说出口的话放在非空<game>/);
}

const plainContext = {prompt:'【观众提问】为什么这样投票？', opts:{plainResponse:true}};
assert.equal(promptTaskKind(plainContext), 'plain');
const plainContract = buildPhaseOutputContract(plainContext, true);
assert.match(plainContract, /本轮输出契约·直接回答/);
assert.match(plainContract, /不使用<draft>\/<game>\/<action>/);
assert.doesNotMatch(plainContract, /本轮必须把真正说出口的话放在非空<game>/);

S.players = [
  {id:0, name:'A', role:{id:'seer', name:'预言家'}},
  {id:1, name:'B', role:{id:'wolf', name:'狼人'}}
];
const issues = inspectPromptContradictions(
  '【本局配置】预言家、狼人。本局虽然没有“预言家”这张牌，本局没有警徽流。',
  S.players[0],
  campaign
);
assert.ok(issues.some(x => x.includes('配置含预言家')),
  'runtime prompt diagnostics missed a role-presence contradiction');

assert.match(html, /buildSystemPrompt\(p, promptTaskContext\)/,
  'callAI does not pass the current phase into the system prompt');
assert.match(html, /inspectPromptContradictions\(sys, p, promptTaskContext\)/,
  'callAI does not run prompt diagnostics');
assert.equal((html.match(/buildSystemPrompt = function\(p, taskContext\)/g) || []).length, 3,
  'a buildSystemPrompt wrapper dropped the phase context');
assert.doesNotMatch(html, /_origBuildSysPrompt\(p\);/,
  'permanent-memory wrapper still drops the phase context');
assert.doesNotMatch(html, /_origBuildSysPromptBeforeBlindNames\(p\), p/,
  'blind-name wrapper still drops the phase context');
assert.match(html, /buildSystemPrompt\(p, \{prompt:askPrompt, opts:\{plainResponse:true\}\}\)/,
  'audience Q&A still receives the table-speech output contract');

const englishHtml = fs.readFileSync(new URL('../en/index.html', import.meta.url), 'utf8');
const englishStart = englishHtml.indexOf('function buildAbsentClassicRoleRule(');
const englishEnd = englishHtml.indexOf('\nfunction buildSystemPrompt(', englishStart);
assert.ok(englishStart >= 0 && englishEnd > englishStart, 'English prompt sanity helpers are missing');
const EnglishHelpers = new Function(
  'S',
  `${englishHtml.slice(englishStart, englishEnd)}; return {buildAbsentClassicRoleRule, buildPhaseOutputContract};`
)(S);
const englishWithSeer = EnglishHelpers.buildAbsentClassicRoleRule(
  new Set(['seer', 'wolf']), ['Seer'], ['Witch', 'Guard']
);
assert.doesNotMatch(englishWithSeer, /there is no Seer card|no Seer badge flow/i,
  'English prompt incorrectly removed a real Seer');
assert.match(EnglishHelpers.buildPhaseOutputContract(campaign, true), /TURN OUTPUT CONTRACT — SPEECH/);
assert.match(englishHtml, /buildSystemPrompt\(p, promptTaskContext\)/,
  'English callAI drops the current phase');
assert.equal((englishHtml.match(/buildSystemPrompt = function\(p, taskContext\)/g) || []).length, 3,
  'an English buildSystemPrompt wrapper dropped the phase context');
assert.doesNotMatch(englishHtml, /let modelAdapt = isPureAI/,
  'English prompt still contains the legacy one-size-fits-all output template');
assert.match(englishHtml, /let modelAdapt = '[^']*\[ROLE IMMERSION\][\s\S]*?buildPhaseOutputContract\(taskContext, isPureAI\)/,
  'English prompt does not use the phase-aware output contract');

console.log('Prompt sanity: role presence, phase contracts, wrapper propagation and runtime diagnostics passed');
