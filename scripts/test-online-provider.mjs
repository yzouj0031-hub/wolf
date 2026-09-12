// 联机大厅的「提供 AI 席位」必须对着本机真实的模型配置说话。
//
// 此前这个勾选框是一句纯粹的自我声明：不检查本机配没配 API，旁边的「公开模型名」还是个
// 手打的展示字符串，和真实配置毫无关系。于是房主的「平均分配」可以把席位分给一台根本
// 没有 API 的设备，而这件事要等到对局真的跑起来、那几个席位集体哑火时才会暴露。
//
// 同时要守住安全边界：Key 永远不离开这台设备，也永远不进联机表——这条不能因为
// 「反正都要登录了」就放松。Key 一旦发到别人的设备上就收不回来了。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../multiplayer.js', import.meta.url), 'utf8');

// ── 1. ★ 安全边界：Key 不能出现在任何上行数据里 ────────────────────────────────
{
  // 所有 rpc(...) 调用的参数里都不许出现 key
  const calls = src.match(/rpc\('[^']+',\s*\{[\s\S]*?\}\)/g) || [];
  assert.ok(calls.length >= 4, '没有找到联机 RPC 调用，测试可能失效了');
  for (const call of calls) {
    assert.ok(!/\bkey\b/i.test(call), `联机 RPC 的上行参数里出现了 key → ${call.slice(0, 120)}`);
  }
  // 本机配置读取函数只能被用来做判断和显示模型名，不能把 url/key 拼进任何上行字符串
  assert.ok(!/p_[a-z_]*key/i.test(src), 'RPC 参数名里出现了 key 字段');
  assert.ok(!/localModel\(\)\.key/.test(src.replace(/return !!\(cfg\.url && cfg\.key && cfg\.model\);/, '')),
    'key 被读出来做了判空以外的用途');
}

// ── 2. 读取本机配置：只认已经配好的全局设置，三项齐全才算数 ──────────────────────
{
  const a = src.indexOf('  function seatApi(seatIndex) {');
  const b = src.indexOf('  /* ── 房间快照 → 开局花名册', a);
  assert.ok(a >= 0 && b > a, 'seatApi / localModelReady 未找到');
  const fields = {};
  const ctx = {
    window: {},
    document: { getElementById: (id) => (id in fields ? { value: fields[id] } : null) },
  };
  vm.createContext(ctx);
  vm.runInContext(
    `const $ = id => document.getElementById(id);\n${src.slice(a, b)}\nthis.ready = localModelReady; this.read = localModel; this.seatApi = seatApi; this.seatReady = seatApiReady;`,
    ctx, { filename: 'multiplayer.js:localModel' },
  );

  const set = (o) => { for (const k of Object.keys(fields)) delete fields[k]; Object.assign(fields, o); };

  set({});
  assert.equal(ctx.ready(), false, '什么都没配却认为可以托管');
  set({ 'g-url': 'https://api.example.com', 'g-key': '', 'g-model': 'gpt-5' });
  assert.equal(ctx.ready(), false, '缺 key 却认为可以托管');
  set({ 'g-url': '', 'g-key': 'sk-x', 'g-model': 'gpt-5' });
  assert.equal(ctx.ready(), false, '缺地址却认为可以托管');
  set({ 'g-url': 'https://api.example.com', 'g-key': 'sk-x', 'g-model': '' });
  assert.equal(ctx.ready(), false, '缺模型名却认为可以托管');
  // 全是空格不算填了
  set({ 'g-url': '   ', 'g-key': '   ', 'g-model': '   ' });
  assert.equal(ctx.ready(), false, '空白字符被当成了有效配置');
  set({ 'g-url': ' https://api.example.com ', 'g-key': ' sk-x ', 'g-model': ' gpt-5 ' });
  assert.equal(ctx.ready(), true, '三项齐全却认为不能托管');
  assert.equal(ctx.read().model, 'gpt-5', '模型名没有去掉首尾空格');

  // ★ 席位 API 必须复用游戏自己的 getAPI（本席位覆盖 → 全局回落），不能另起炉灶：
  //   否则同一台设备在单机和联机里会用上不同的模型，出了问题完全没法排查。
  const asked = [];
  ctx.window.getAPI = (i) => { asked.push(i); return i === 3 ? {url:'https://relay.b', key:'sk-b', model:'claude-opus-5'} : {url:'', key:'', model:''}; };
  assert.equal(ctx.seatApi(3).model, 'claude-opus-5', '席位 API 没有走游戏的 getAPI');
  assert.deepEqual(asked, [3], 'getAPI 没有按席位号查询');
  assert.equal(ctx.seatReady(3), true, '席位有独立配置却认为不可用');
  assert.equal(ctx.seatReady(4), false, '席位没有配置却认为可用');
  // 大厅可能先于主脚本就绪：getAPI 抛异常也要安全退回读输入框
  ctx.window.getAPI = () => { throw new Error('not ready'); };
  assert.equal(ctx.read().model, 'gpt-5', 'getAPI 抛异常时没有退回全局输入框');
  delete ctx.window.getAPI;
}

// ── 2b. ★ 花名册：宁可开不了局，也不开一个注定卡住的局 ──────────────────────────
{
  const a = src.indexOf('  function buildRoster(');
  const b = src.indexOf('  function providerHTML(mine) {', a);
  assert.ok(a >= 0 && b > a, 'buildRoster 未找到');
  const ctx = { MT: new Proxy({}, { get: (_, k) => String(k) + ':{seat}{name}{n}{cap}{list}' }), Map, Set, Array, Number, String };
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + '\nthis.build = buildRoster;', ctx, { filename: 'multiplayer.js:buildRoster' });

  const room = (max) => ({ max_seats: max });
  const mem = (seat, id, extra = {}) => ({ seat_no: seat, user_id: id, display_name: 'P' + seat, can_host_ai: false, max_ai_seats: 0, ...extra });
  const ai = (seat, provider, extra = {}) => ({ seat_no: seat, provider_user_id: provider, display_name: 'AI' + seat, model_label: 'gpt-5', ...extra });

  // 正常：2 真人 + 8 AI，全部由 u1 托管
  const host = mem(1, 'u1', { can_host_ai: true, max_ai_seats: 8, display_name: '房主' });
  let r = ctx.build(room(10), [host, mem(2, 'u2')], Array.from({length:8},(_,i)=>ai(i+3,'u1')), 'u1', [10,12,14]);
  assert.equal(r.ok, true, '正常阵容却开不了局：' + r.errors.join(' / '));
  assert.equal(r.seats.length, 10, '花名册席位数不对');
  assert.equal(r.seats[0].kind, 'self', '自己的席位没有标成 self');
  assert.equal(r.seats[1].kind, 'remote', '别人的席位没有标成 remote');
  assert.equal(r.seats[2].kind, 'ai', 'AI 席位没有标成 ai');
  assert.equal(r.seats[2].userId, 'u1', 'AI 席位没有记住由谁托管');
  // 换个人看同一个房间，self/remote 要跟着换
  const r2 = ctx.build(room(10), [host, mem(2, 'u2')], Array.from({length:8},(_,i)=>ai(i+3,'u1')), 'u2', [10,12,14]);
  assert.equal(r2.seats[0].kind, 'remote', '别人视角下房主席位应是 remote');
  assert.equal(r2.seats[1].kind, 'self', '别人视角下自己的席位应是 self');

  // 座位数对不上板子
  r = ctx.build(room(9), [mem(1,'u1')], [], 'u1', [10,12,14]);
  assert.equal(r.ok, false, '9 座的房间竟然可以开局');
  assert.ok(r.errors.some(e => e.startsWith('rosterSeatCount')), '没有报座位数不匹配');

  // 有空位
  r = ctx.build(room(10), [host, mem(2,'u2')], Array.from({length:7},(_,i)=>ai(i+3,'u1')), 'u1', [10,12,14]);
  assert.equal(r.ok, false, '有空位竟然可以开局');
  assert.ok(r.errors.some(e => e.startsWith('rosterEmptySeat')), '没有报空位');

  // 提供者已经离开房间
  r = ctx.build(room(10), [host], Array.from({length:9},(_,i)=>ai(i+2,'gone')), 'u1', [10,12,14]);
  assert.ok(r.errors.some(e => e.startsWith('rosterProviderGone')), '提供者离开了却没有拦住');

  // 提供者关掉了托管
  const off = mem(1,'u1',{can_host_ai:false, max_ai_seats:9});
  r = ctx.build(room(10), [off], Array.from({length:9},(_,i)=>ai(i+2,'u1')), 'u1', [10,12,14]);
  assert.ok(r.errors.some(e => e.startsWith('rosterProviderOff')), '提供者关了托管却没有拦住');

  // 超出容量
  const small = mem(1,'u1',{can_host_ai:true, max_ai_seats:3});
  r = ctx.build(room(10), [small], Array.from({length:9},(_,i)=>ai(i+2,'u1')), 'u1', [10,12,14]);
  assert.ok(r.errors.some(e => e.startsWith('rosterOverCapacity')), '超出托管容量却没有拦住');

  // 同一个座位既有玩家又有 AI
  r = ctx.build(room(10), [host, mem(2,'u2')], [ai(2,'u1')].concat(Array.from({length:8},(_,i)=>ai(i+3,'u1'))), 'u1', [10,12,14]);
  assert.ok(r.errors.some(e => e.startsWith('rosterDoubleBooked')), '一个座位坐了两个人却没有拦住');

  // 重名必须消歧：否则"我投白马探"指向谁都说不清
  r = ctx.build(room(10), [host, mem(2,'u2',{display_name:'房主'})], Array.from({length:8},(_,i)=>ai(i+3,'u1')), 'u1', [10,12,14]);
  assert.equal(r.ok, true, '重名不该阻止开局，只该改名');
  assert.notEqual(r.seats[0].name, r.seats[1].name, '重名没有被消歧');
  assert.ok(r.warnings.some(w => w.startsWith('rosterDupName')), '重名没有给出提示');

  // 名字全空要有兜底，不能出现无名玩家
  r = ctx.build(room(10), [mem(1,'u1',{display_name:'   ', can_host_ai:true, max_ai_seats:9})],
    Array.from({length:9},(_,i)=>ai(i+2,'u1',{display_name:''})), 'u1', [10,12,14]);
  assert.ok(r.seats.every(s => s.name && s.name.trim()), '出现了没有名字的席位');

  // 垃圾输入不能崩
  for (const bad of [null, undefined, {}, {max_seats:'x'}]) {
    assert.doesNotThrow(() => ctx.build(bad, null, null, 'u1', [10,12,14]), '畸形房间数据让花名册崩了');
    assert.equal(ctx.build(bad, null, null, 'u1', [10,12,14]).ok, false, '畸形房间数据竟然通过了');
  }
}

// ── 3. ★ 界面：没配就不让勾，而且要说清为什么 ───────────────────────────────────
{
  assert.ok(src.includes("if (box) { box.disabled = !ready; if (!ready) box.checked = false; }"),
    '本机没配 API 时仍然可以勾选「提供 AI 席位」');
  assert.ok(src.includes("const enabled = ready && !!box?.checked;"), '容量/调度控件没有跟着本机配置一起禁用');
  assert.ok(src.includes("if ($('wg-save-provider')) $('wg-save-provider').disabled = !ready;"),
    '没配 API 时保存按钮仍然可点');
  // 面板上要直接写出这台设备会用哪个模型，否则用户无从判断自己供的是什么
  assert.ok(src.includes("MT.localReady + '：' + esc(cfg.model)"), '面板没有显示本机实际使用的模型');
  assert.ok(src.includes('MT.localMissing'), '没有配置时缺少说明文案');
  for (const key of ['localReady:', 'localMissing:']) {
    assert.equal((src.match(new RegExp(key, 'g')) || []).length, 2,
      `${key} 缺少中英两版文案（EN 与 ZH 各一份）`);
  }
  // 中英两份文案的内容不能是同一串，否则等于只写了一种语言
  const readyStrings = [...src.matchAll(/localReady:'([^']*)'/g)].map(m => m[1]);
  assert.equal(new Set(readyStrings).size, 2, 'localReady 的中英两版文案是同一串');
  const missingStrings = [...src.matchAll(/localMissing:'([^']*)'/g)].map(m => m[1]);
  assert.equal(new Set(missingStrings).size, 2, 'localMissing 的中英两版文案是同一串');
  // 只显示模型名：地址可能带私有中转域名，Key 一个字符都不能露
  assert.ok(!/esc\(cfg\.url\)/.test(src), '面板把 API 地址显示出来了');
  assert.ok(!/esc\(cfg\.key\)/.test(src), '面板把 API Key 显示出来了');
}

// ── 4. 提交时再确认一次：设置面板就在同一页，勾完可能又被清空 ─────────────────────
{
  assert.ok(src.includes("if (!localModelReady() && $('wg-can-host-ai')?.checked) {"),
    '保存托管设置时没有复查本机配置');
  assert.ok(src.includes("const enabled = localModelReady() && !!$('wg-can-host-ai')?.checked;"),
    '上报的托管状态没有以本机配置为准');
}

// ── 5. 公开模型名：留空时用本机真实模型名兜底，而不是留一个空壳 ──────────────────
{
  assert.ok(
    src.includes("const modelLabel = (cleanName($('wg-model-label').value) || cleanName(localModel().model)).slice(0, 40);"),
    '公开模型名留空时没有回落到本机真实模型名',
  );
}

// ── 6. ★ 锁定阵容前必须先体检 ──────────────────────────────────────────────────
// 锁完才发现有空位 / 提供者跑了 / 分超容量，那时房间已经是 playing，只能整个解散重来。
{
  assert.ok(src.includes('const roster = currentRoster();\n    if (!roster.ok) { state.error = roster.errors.join'),
    '锁定阵容之前没有校验花名册');
  const lockIdx = src.indexOf('async function lockRoom()');
  const rpcIdx = src.indexOf("rpc('online_start_room'", lockIdx);
  const checkIdx = src.indexOf('if (!roster.ok)', lockIdx);
  assert.ok(checkIdx > 0 && checkIdx < rpcIdx, '体检发生在锁定之后，等于没体检');

  // 板子人数必须取自主脚本，不能在大厅里再抄一份——抄一份就一定会和 MODE_CONFIGS 漂移
  assert.ok(src.includes('const modes = window.MODE_CONFIGS;'), '板子人数没有取自主脚本');
  assert.ok(!/\[10,\s*12,\s*14\][\s\S]{0,80}allowedCounts/.test(src), '大厅里硬抄了一份板子人数');

  // 交付给引擎：大厅不自己复制开局逻辑，引擎没接好要如实说，不能假装已经开局
  assert.ok(src.includes('const bridge = window.WolfOnlineGame;'), '没有把花名册交给引擎');
  assert.ok(src.includes('state.error = MT.rosterNoBridge;'), '引擎没接好时没有提示');
  assert.ok(src.includes('isHost: state.room.host_id === state.user.id'), '交付时没有标明谁是主机');
}

console.log('online provider: real local model required, key never uploaded, UI gated, roster validated before lock');
