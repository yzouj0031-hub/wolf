// 🛑 技术故障绝不自动跳过：两个页面都要带上同一套机制。
//   公开发言 / 狼人密谈 / 遗言：生成失败 → 暂停询问（切换模型重试 / 当前模型重试 / 手写代替 / 照用原话 / 确认跳过）。
//   投票 / 夜间技能：两次格式纠正失败 → 暂停询问（再问模型 / 切换后再问 / 手动替它选 / 确认按故障处理）。
//   投票请求没返回结果的那一票、密谈批处理里抛出的异常，都不再悄悄消失。
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const page of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(page, 'utf8');
  const has = (needle, msg) => assert.ok(html.includes(needle), `${page}: ${msg}（缺少 ${needle.slice(0, 60)}）`);
  const count = needle => html.split(needle).length - 1;

  // 顶层助手
  has('function technicalDialogAllowed()', '缺少视角守卫');
  has('async function recoverTechnicalSpeechFor(p, failed, promptFn, opts, label)', '缺少顶层发言恢复流程');
  has("{label:'手写代替（你来替它说）', value:'manual'}", '发言故障弹框缺少手写代替');
  has("{label:'照用它最后一次的原话（不再审核）', value:'raw'}", '发言故障弹框缺少照用原话');
  has("{label:'确认跳过本次发言', value:'skip', danger:true}", '跳过必须是用户的明确选择');
  has('async function askTechnicalAction(player, label, detail)', '缺少行动故障询问');
  has("{label:'确认按技术故障处理（不执行）', value:'skip', danger:true}", '行动故障弹框缺少确认按钮');
  has('async function pickTargetsManually(player, label, candidates, minCount, maxCount, allowPass)', '缺少手动选目标');

  // proc：薄封装 + 记录被否掉的原文
  has('const recoverTechnicalSpeech = (p, failed) => recoverTechnicalSpeechFor(p, failed, promptFn, opts, label);', 'proc 没有改用顶层流程');
  assert.equal(count("_lastRejectedGame = String(_r.game || ''); _r = {..._r, thinking:"), 2, `${page}: 判官否掉的原文没有记录（两处）`);
  has("_technicalReason:'生成或解析后无有效正式发言', _rawCandidate:_lastRejectedGame}", '技术故障没带上原文');

  // procWolf
  has("results[j] = {thinking:'', game:'', action:'', _technicalFailure:true, _technicalReason:'密谈结果缺失'};", '密谈缺失结果没有记成技术故障');
  has("await recoverTechnicalSpeechFor(p, {...r, _technicalFailure:true, _technicalReason:r._technicalReason || '密谈生成或解析后无有效发言'}, promptFn, opts, label || '狼人密谈');", '密谈失败没有暂停询问');
  assert.equal(count("      if (results[j]==='player') continue; // 先跳过人类，等AI发完\n      const r = results[j];\n      if (!r) continue;"), 0, `${page}: 密谈仍会 if (!r) continue 跳过`);

  // 遗言
  assert.equal(count("_technicalReason:'遗言生成或解析后无有效内容'}, () => willPrompt"), 2, `${page}: 遗言两条分支没有都接上询问流程`);
  has("words = (r && !r._technicalFailure) ? (r.game || '') : '';", '确认跳过的遗言仍会广播进记忆');

  // 行动解析器
  assert.equal(count('const choice = await askTechnicalAction(player, '), 3, `${page}: 三个解析器没有都接上询问`);
  has("const picked = await pickTargetsManually(player, cfg.label, candidates, minTargetCount, maxTargetCount, !!cfg.allowPass);", '目标类解析器缺少手动选目标');
  has("return {status:'execute', value:String(v).toUpperCase(), source:'manual'};", '枚举类解析器缺少手动选项');
  has("if (t) return {status:'execute', kind:'poison', target:t, raw:'POISON|P' + (t.id+1), source:'manual'};", '女巫解析器缺少手动用药');

  // 投票
  has("vr = aiR[p.id] = {thinking:'', game:'', action:''};", '投票请求没返回结果的那一票仍会悄悄消失');
  assert.equal(count("      const vr = aiR[p.id];\n      if (!vr || vr.actionTechnicalInvalid) continue;"), 0, `${page}: 投票仍会 if (!vr) continue`);

  // 内联脚本语法
  const re = /<script>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) new Function(m[1]);
}

console.log('no auto skip: speech, wolf chat, last words, votes and night skills all pause and ask on both pages');
