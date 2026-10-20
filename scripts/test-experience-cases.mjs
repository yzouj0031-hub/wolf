// 📖 经验库：案例数据健康 + 挑选逻辑（node 侧，不开浏览器）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ROLE_IDS = new Set([...fs.readFileSync('index.html', 'utf8').matchAll(/reg\(\{id:'([a-z_]+)'/g)].map(m => m[1]));
const sandbox = { window: undefined, console };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync('experience-cases.js', 'utf8'), sandbox, { filename: 'experience-cases.js' });
const X = sandbox.WolfExperience;
assert.ok(X && X.CASES.length >= 12 && X.EXAMPLES.length >= 6, '案例/范例数量不够');

// 数据健康：角色 id 真实存在、阶段/阵营合法、不带世界书内部术语、长度有上限、id 唯一
const JARGON = /账本|标尺|排他性|暂认|证据等级|S级|A级|零成本|目标函数|时点|信息差|视角关/;
const ids = new Set();
for (const it of [...X.CASES, ...X.EXAMPLES]) {
  assert.ok(!ids.has(it.id), `重复 id ${it.id}`); ids.add(it.id);
  for (const r of it.needs || []) assert.ok(ROLE_IDS.has(r), `${it.id}: 未知角色 ${r}`);
  assert.ok(['good', 'bad', 'any'].includes(it.team), `${it.id}: team 非法`);
  for (const w of it.when) assert.ok(['day', 'pk', 'sheriff', 'lastwords', 'wolfnight'].includes(w), `${it.id}: when 非法 ${w}`);
  assert.ok(!JARGON.test(it.text), `${it.id}: 案例文本里混进了世界书术语`);
  assert.ok(it.text.length <= 320, `${it.id}: 太长 ${it.text.length}`);
  // 提到的角色名必须在 needs 里声明，否则会撞"本局没有的角色一次都不许提"
  for (const [word, rid] of [['预言家', 'seer'], ['女巫', 'witch'], ['守卫', 'guard'], ['猎人', 'hunter'], ['骑士', 'knight']]) {
    if (it.text.includes(word)) assert.ok((it.needs || []).includes(rid), `${it.id}: 文本提到${word}但 needs 没声明 ${rid}`);
  }
}

const mk = (keys, extra) => {
  const players = keys.map((k, id) => ({ id, name: 'N' + id, alive: true, role: { id: k, team: k === 'werewolf' ? 'bad' : 'good' } }));
  return Object.assign({ players, round: 2, phase: 'day', history: [] }, extra);
};
const day = { prompt: '【第2天·白天发言·第一轮】', opts: {} };

// 没有女巫的局，不能出现提到女巫的案例
{
  const S = mk(['seer', 'villager', 'villager', 'werewolf', 'werewolf', 'hunter']);
  for (const p of S.players) {
    const out = X.build(p, day, S);
    assert.ok(!out.includes('女巫') && !out.includes('守卫'), `${p.role.id}: 注入了本局不存在的角色`);
    assert.ok(out.length <= X.MAX_CHARS, '超出预算');
  }
  const wolf = X.select(S.players[3], day, S);
  assert.ok(wolf.cases.every(c => c.team !== 'good'), '狼看到了好人专属案例');
  const good = X.select(S.players[0], day, S);
  assert.ok(good.cases.every(c => c.team !== 'bad'), '好人看到了狼专属案例');
}
// 身份专属范例只给那个座位
{
  const S = mk(['seer', 'villager', 'werewolf', 'werewolf', 'witch']);
  assert.ok(!X.select(S.players[1], day, S).examples.some(e => e.id === 'ex_seer'), '村民不该拿到预言家报查验的范例');
  assert.ok(X.select(S.players[0], day, S).examples.some(e => e.id === 'ex_seer'), '预言家应拿到自己的范例');
}
// 阶段：密谈只给 wolfnight；技能确认 / 投票不注入；遗言给 lastwords
{
  const S = mk(['seer', 'villager', 'witch', 'werewolf', 'werewolf', 'guard']);
  const w = S.players[3];
  const night = X.select(w, { prompt: '【狼队密谈·开场陈述】', opts: { wolfOnly: true } }, S);
  assert.equal(night.ctx.phase, 'wolfnight');
  assert.ok(night.cases.length > 0 && night.cases.every(c => c.when.includes('wolfnight')));
  assert.equal(X.build(w, { prompt: '【猎人开枪】', opts: { skillConfirm: true } }, S), '');
  assert.equal(X.build(w, { prompt: '【投票】请选择一人', opts: { requireGame: false } }, S), '');
  const lw = X.select(S.players[1], { prompt: '【遗言】你死了，最后说几句。', opts: {} }, S);
  assert.equal(lw.ctx.phase, 'lastwords');
  assert.ok(lw.examples.some(e => e.id === 'ex_lastwords'), '遗言阶段应给遗言范例');
}
// 局面标签：对跳 / 被查杀 / 残局 / 首日
{
  const S = mk(['seer', 'villager', 'witch', 'werewolf', 'werewolf', 'guard'], { round: 1, history: [
    { name: 'N0', text: '我是预言家，昨晚验了N3是狼，查杀N3。' },
    { name: 'N4', text: '我才是预言家，N0 是悍跳。' }
  ] });
  const c = X.ctxOf(S.players[3], day, S);
  assert.ok(c.tags.has('counterclaim') && c.tags.has('accused') && c.tags.has('early'), [...c.tags].join());
  const sel = X.select(S.players[0], day, S);
  assert.ok(['seer_counterclaim', 'seer_three_lines'].includes(sel.cases[0].id), '对跳局的预言家应优先看到对跳案例：' + sel.cases[0].id);
  const late = X.ctxOf(S.players[0], day, mk(['seer', 'villager', 'werewolf', 'werewolf'], { round: 4 }));
  assert.ok(late.tags.has('late') && !late.tags.has('early'));
}
// 轮换：同一人不同轮次看到的案例不完全一样
{
  const S = mk(['seer', 'villager', 'villager', 'villager', 'werewolf', 'werewolf', 'witch', 'guard', 'hunter']);
  const seen = new Set();
  for (let r = 1; r <= 4; r++) { S.round = r; X.select(S.players[1], day, S).cases.forEach(c => seen.add(c.id)); }
  assert.ok(seen.size >= 3, '案例没有随轮次轮换：' + [...seen].join());
}
// 开关
{
  const S = mk(['seer', 'villager', 'werewolf']);
  sandbox.WOLF_EXPERIENCE_OFF = true;
  assert.equal(X.build(S.players[1], day, S), '');
  sandbox.WOLF_EXPERIENCE_OFF = false;
  sandbox.TeachingWorldbooks = { mode: () => 'clean' };
  assert.equal(X.build(S.players[1], day, S), '', '纯净模式不该注入');
  sandbox.TeachingWorldbooks = { mode: () => 'official' };
  assert.ok(X.build(S.players[1], day, S).includes('【别人打过的几局'));
}
console.log('experience-cases: data health, role gating, phase/team selection, rotation and switches OK');
