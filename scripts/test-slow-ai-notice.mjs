// ⏳ 思考过久提醒 + 绝不悄悄跳过发言：两个页面都要带上同一套机制。
// 1. AIWait：请求超过阈值就在对局日志写等待说明、角落出「不等了」；叫停只中断当前尝试。
// 2. 超时分支：区分用户叫停 / 连接被掐 / 真超时；开了手动重试立刻问，不再默默重试；
//    日志里说清接下来会发生什么（没配备用时不再谎称"尝试备用模型"）。
// 3. 备用 API 超时不再静默返回空结果。
// 4. proc：批处理里抛出的异常和缺失的结果都记成技术故障、暂停询问，不再 `if (!r) continue` 跳过。
// 5. 设置项「思考过久提醒」存在并持久化。
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const page of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(page, 'utf8');
  const has = (needle, msg) => assert.ok(html.includes(needle), `${page}: ${msg}（缺少 ${needle.slice(0, 50)}）`);
  const count = (needle) => html.split(needle).length - 1;

  // AIWait
  has('const AIWait = (() => {', '缺少 AIWait 模块');
  has("document.getElementById('t-slow')", 'AIWait 没有读取「思考过久提醒」设置');
  has('window.AI_SLOW_NOTICE_MS', 'AIWait 没有留 window.AI_SLOW_NOTICE_MS 覆盖口');
  has("data-stop=", '角标缺少「不等了」按钮');
  has("w.node = node || null;", '等待说明没有挂到对局日志节点上');
  has("    return d;\n  },\n  logSpeech(p, g, isWolfChat) {", 'Render.log 没有返回节点');

  // _callAIImpl：每次尝试都包 _watched，用户叫停合并进 abort 信号
  has('const _watched = async (run, att, maxAtt) => {', '缺少 _watched');
  has("const result = await _watched(() => tryOnce(api, att, api.type || 'openai'), att, maxRetries);", '主 API 调用没有包 _watched');
  has("const result = await _watched(() => tryOnce(fbApi, att, fbType), fi + 1, fallbacks.length);", '备用 API 调用没有包 _watched');
  has("if (_userStopCtrl) _userStopCtrl.signal.addEventListener('abort', () => ctrl.abort());", '「不等了」没有合并进请求的 abort 信号');

  // 超时分支
  has("const _isCut = !_userStopped && _waited < _limit * 0.8;", '超时分支没有区分用户叫停');
  has("if (_hasFb || isManualRetryEnabled() || _userStopped) {", '开了手动重试却仍要先默默重试');
  assert.equal(count('秒），尝试备用模型`'), 0, `${page}: 超时日志仍一律写"尝试备用模型"`);
  has("silentReason = (_userStopped ? '用户停止等待' : (_isCut ? '连接被掐断' : '主API超时')) + `（已等 ${_waited} 秒）`;", '对话框原因没带等待秒数');

  // 备用 API 超时
  assert.equal(count("if (e.name==='AbortError' || S.gameId!==myGid) return {thinking:'',game:'',action:''};"), 0, `${page}: 备用 API 超时仍静默返回空结果`);
  has("if (e.name==='AbortError') {\n              // 备用 API 也超时或被「不等了」叫停", '备用 API 超时没有说明并换下一个');

  // proc
  has("const _settled = await Promise.allSettled(batch.map(async (p, j) => {", 'proc 没有接住批处理的 rejected');
  has("results[j] = {thinking:'', game:'', action:'', _technicalFailure:true, _technicalReason:'请求过程抛出异常：' + msg};", '批处理异常没有记成技术故障');
  has("r = results[j] = {thinking:'', game:'', action:'', _technicalFailure:true, _technicalReason:'发言结果缺失'};", '缺失结果没有记成技术故障');
  assert.equal(count("      let r = results[j];\n      if (!r) continue;"), 0, `${page}: proc 仍会 \`if (!r) continue\` 悄悄跳过`);

  // 设置项
  has('id="t-slow"', '缺少「思考过久提醒」输入框');
  has("slowNotice:$('t-slow')?$('t-slow').value:'60',", '「思考过久提醒」没有保存');
  has("if (d.slowNotice && $('t-slow')) $('t-slow').value = d.slowNotice;", '「思考过久提醒」没有读取');

  // 两个页面的内联脚本都能通过语法检查
  const re = /<script>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) new Function(m[1]);
}

console.log('slow AI notice: AIWait, user stop, timeout wording, fallback abort, proc no-skip and settings present on both pages');
