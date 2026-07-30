import fs from 'node:fs';

for (const path of ['../index.html', '../en/index.html']) {
  const html = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const required = [
    '【子狐媚惑结果·完整永久记录】',
    "r.role === 'fox'",
    '这些是你亲自得到的阵营铁信息，但不等于知道目标的精确角色',
    'function recordNightSkillMuted(p, ability)',
    "role:'skill-muted'",
    '【你的技能封锁结果·完整永久记录】',
    '你不知道是谁造成的',
    "recordNightSkillMuted(se, '查验')",
    "recordNightSkillMuted(sk, '独立袭击')",
    "recordNightSkillMuted(magP, '号码交换')",
    "recordNightSkillMuted(witchP, '用药（药水已退回）')",
    "recordNightSkillMuted(p, '获赐的主动技能')",
    '你的技能封锁记录：',
    "case 'skill-muted'"
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`${path} lacks Fox/private-result marker: ${marker}`);
  }

  const helperStart = html.indexOf('function recordNightSkillMuted(p, ability)');
  const helperEnd = html.indexOf('function reflectInspectSubject', helperStart);
  const helper = html.slice(helperStart, helperEnd);
  if (/子狐|fox/i.test(helper)) {
    throw new Error(`${path} leaks the Fox as the mute source to the affected player`);
  }

  const state = {round: 3};
  const records = [];
  const {recordNightSkillMuted} = new Function('S', 'gameRecord', `${helper}; return {recordNightSkillMuted};`)(state, records);
  const target = {id: 6, name: 'Test Guard', memory: []};
  recordNightSkillMuted(target, '守护');
  recordNightSkillMuted(target, '守护');
  if (records.length !== 1 || target.memory.length !== 1) {
    throw new Error(`${path} does not deduplicate the same player's mute result for one night`);
  }
  if (!/没有生效/.test(target.memory[0].content) || /子狐/.test(target.memory[0].content)) {
    throw new Error(`${path} gives the muted player the wrong private information`);
  }
}

console.log('Fox results persist; muted players learn failure without learning its source');
