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
  const a = src.indexOf('  function localModel() {');
  const b = src.indexOf('  function providerHTML(mine) {', a);
  assert.ok(a >= 0 && b > a, 'localModel / localModelReady 未找到');
  const fields = {};
  const ctx = {
    document: { getElementById: (id) => (id in fields ? { value: fields[id] } : null) },
  };
  vm.createContext(ctx);
  vm.runInContext(
    `const $ = id => document.getElementById(id);\n${src.slice(a, b)}\nthis.ready = localModelReady; this.read = localModel;`,
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

console.log('online provider: real local model required, key never uploaded, UI gated and label backfilled');
