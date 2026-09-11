// 发言分诊 Tier 1 的回归测试。
//
// 背景：坏发言分两类。协议/格式故障（推理摘要标题、整段粗体、截断、沉默）是确定性的，
// 正则零成本判得了。但"让我理一下局面……我作为真预言家，如果现在不跳，警徽流就没人认，
// 所以我应该公开身份"这种【审议散文】和真发言都是中文散文，没有任何结构信号能分开——
// 正则只能靠认词，而词表放宽一点就会吞掉真神跳身份，那是游戏级事故。这一小撮交给便宜模型
// 做一次二选一。
//
// 这个测试守住三条设计约束，任何一条塌了这层就变成负资产：
//   ① 分诊不是全检——闸门必须窄，正常发言一次都不该问；
//   ② 问机械问题不问好不好——让模型评价质量它一定挑得出毛病，然后开始否掉正常发言；
//   ③ fail-open——判官超时/没配/看不懂，一律原样放行，绝不能变成新的故障源。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FILES = ['index.html', 'en/index.html'];
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

function load(src, file) {
  const ctx = vm.createContext({ console });
  let a = src.indexOf('function parseAI(c, opts)');
  let b = src.indexOf('// ★ v9.6 抽出全局 SSE', a);
  assert.ok(a >= 0 && b > a, `${file}: parseAI 未找到`);
  vm.runInContext(src.slice(a, b), ctx, { filename: `${file}:parseAI` });
  a = src.indexOf('const SPEECH_JUDGE_CAP');
  b = src.indexOf('async function judgeSpeechIsPublic', a);
  assert.ok(a >= 0 && b > a, `${file}: 分诊闸门未找到`);
  vm.runInContext(`${src.slice(a, b)}; this.gate = needsSpeechJudge; this.sys = SPEECH_JUDGE_SYS; this.cap = SPEECH_JUDGE_CAP; this.streak = SPEECH_JUDGE_FAIL_STREAK;`,
    ctx, { filename: `${file}:judge` });
  return ctx;
}

const SPEECH = '我是预言家，昨晚查验白马探，结果是狼人。今天我的票给他，请大家跟一下，顺便核对昨天7号的改口。';
const DELIB = '让我理一下现在的局面。7号昨天先跳了预言家，但他今天的票又改了方向，这里有矛盾。'
  + '我作为真预言家，如果现在不跳，警徽流就没人认。所以我应该公开身份，把查验报出来，同时点名白马探。';

for (const file of FILES) {
  const src = read(file);
  const ctx = load(src, file);

  // ── 1. parseAI 必须如实报告"模型有没有用协议" ────────────────────────────────
  assert.equal(ctx.parseAI(SPEECH, {})._noGameTag, true, `${file}: 裸文本没有被标成"没用协议"`);
  assert.equal(ctx.parseAI(`<game>${SPEECH}</game>`)._noGameTag, false, `${file}: 用了协议却被标成没用`);
  assert.equal(ctx.parseAI(`<thinking>想一想</thinking><game>${SPEECH}</game>`)._noGameTag, false,
    `${file}: 完整协议被标成没用`);

  const ask = (text, opts = {}, mode = 'triage') => ctx.gate(ctx.parseAI(text, opts), opts, mode);

  // ── 2. 该问的要问 ───────────────────────────────────────────────────────────
  assert.equal(ask(DELIB), true, `${file}: Claude 式审议前言没有被送去问诊`);

  // ── 3. ★ 不该问的一次都不能问（分诊不是全检）─────────────────────────────────
  const MUST_NOT_ASK = [
    ['真发言', SPEECH, {}],
    ['正文里偶然出现「我应该」',
      '我应该没记错的话，7号昨天投的是白马探，今天却说自己一直站边我。这两句对不上，请他解释清楚。我今天的票给7号。', {}],
    // 闸门只看前 150 字（审议前言长在开头），正文中段的自我表述不触发
    ['公开宣布要跳身份',
      '我觉得我现在应该跳了：我是预言家，昨晚查验白马探是狼人。警徽流我给宫野志保。请大家核对7号昨天的票型。', {}],
    ['用了 <game> 协议', `<game>${DELIB}</game>`, {}],
    ['狼队密谈', DELIB, { wolfOnly: true }],
    ['技能确认', DELIB, { skillConfirm: true }],
    ['静默调用', DELIB, { silent: true }],
    ['过短（另有重写兜底）', '让我想想。我投7号。', {}],
  ];
  for (const [name, text, opts] of MUST_NOT_ASK) {
    assert.equal(ask(text, opts), false, `${file}: 分诊模式下「${name}」被送去问诊了，闸门太宽`);
  }

  // ── 3b. 三档模式 ────────────────────────────────────────────────────────────
  // 关闭：一条都不问，哪怕是最明显的审议前言
  assert.equal(ask(DELIB, {}, 'off'), false, `${file}: 关闭档仍然在问诊`);
  assert.equal(ask(SPEECH, {}, 'off'), false, `${file}: 关闭档仍然在问诊`);
  // 全检：每条公开发言都过一遍，包括用了协议的、没有规划痕迹的
  assert.equal(ask(SPEECH, {}, 'all'), true, `${file}: 全检档漏掉了普通发言`);
  assert.equal(ask(`<game>${SPEECH}</game>`, {}, 'all'), true, `${file}: 全检档漏掉了用了协议的发言`);
  assert.equal(ask(DELIB, {}, 'all'), true, `${file}: 全检档漏掉了审议前言`);
  // 但全检也不是什么都问：非公开发言、失败态、过短，一律不花这个钱
  assert.equal(ask(DELIB, {wolfOnly: true}, 'all'), false, `${file}: 全检档把狼队密谈也送去问了`);
  assert.equal(ask(DELIB, {skillConfirm: true}, 'all'), false, `${file}: 全检档把技能确认也送去问了`);
  assert.equal(ask('让我想想。我投7号。', {}, 'all'), false, `${file}: 全检档把过短发言也送去问了`);
  assert.equal(ctx.gate({game: '(沉默)', _noGameTag: true}, {}, 'all'), false, `${file}: 全检档把沉默占位也送去问了`);
  // 缺省参数等于分诊档，不能等于全检
  assert.equal(ctx.gate(ctx.parseAI(SPEECH, {}), {}), false, `${file}: 默认档位不是分诊`);
  // 已经是失败态的不该再花钱
  assert.equal(ctx.gate({ game: '(沉默)', _noGameTag: true }, {}), false, `${file}: 沉默占位仍被送去问诊`);
  assert.equal(ctx.gate(null, {}), false, `${file}: 空结果没有被挡住`);

  // ── 4. ★ 提示词必须是机械二分类，不是质量评价 ────────────────────────────────
  assert.match(ctx.sys, /机械的二分类，不是在评价质量/, `${file}: 判官提示词没有声明这是分类不是评价`);
  assert.match(ctx.sys, /拿不准就答\s*A/, `${file}: 判官没有被要求"拿不准就放行"——这是防止它通胀式否决的关键`);
  assert.match(ctx.sys, /仍然是\s*A。你不负责评价质量/, `${file}: 判官没有被明确禁止因"发言写得差"而否决`);
  assert.match(ctx.sys, /只输出一个字母/, `${file}: 判官输出没有被约束成单字母`);
  // 判官只看候选文本，不给局面信息：省钱、防泄底，也防它对战术有意见
  assert.ok(!/存活玩家|本局配置|身份分配/.test(ctx.sys), `${file}: 判官提示词里混进了局面信息`);
  assert.ok(
    src.includes("{role: 'user', content: '【待判断文本】\\n' + String(text || '').slice(0, 1500)}"),
    `${file}: 判官请求体里带了候选文本以外的东西`,
  );

  // ── 5. ★ fail-open 与成本护栏 ───────────────────────────────────────────────
  assert.equal(ctx.cap.triage, 8, `${file}: 分诊档的每局上限被改动`);
  assert.ok(ctx.cap.all >= 100, `${file}: 全检档的上限太低，正常一局就会被截断`);
  for (const [why, marker] of [
    ['没配主持人API', "if (!api || !api.url || !api.key || !api.model) return null;"],
    ['超时', 'setTimeout(() => ctl.abort(), 8000);'],
    ['HTTP 失败', 'if (!res.ok) return null;'],
    ['返回看不懂', "    return null;\n  } catch (e) {\n    return null;"],
  ]) {
    assert.ok(src.includes(marker), `${file}: 判官在「${why}」时没有 fail-open`);
  }
  // 温度必须为 0：这是分类，不是创作
  assert.ok(src.includes('temperature: 0,\n        max_tokens: 32,'), `${file}: 判官不是确定性调用`);
  // 只有明确判定为 B 才动发言；null 一律放行
  assert.ok(src.includes("} else if (_verdict === 'B') {"), `${file}: 调用点没有只认明确的 B 判定`);
  assert.ok(
    src.includes("if (_verdict === null) {") && src.includes("              _js.failed++;"),
    `${file}: 判官不可用时没有单独计数`,
  );
  // 被否决的发言挪回 thinking，绝不丢——与 parseAI 里两处泄漏拦截的处理一致
  assert.ok(
    src.includes("_r = {..._r, thinking: (_r.thinking ? _r.thinking + '\\n\\n' : '') + _r.game, game: ''};"),
    `${file}: 被否决的内容没有挪回 thinking`,
  );
  assert.ok(
    src.includes('if (_js.tripped || _js.asked >= (SPEECH_JUDGE_CAP[_judgeMode] || SPEECH_JUDGE_CAP.triage))'),
    `${file}: 每局上限没有按档位生效，或熔断没有接上`,
  );

  // ── 5b. ★ 熔断：fail-open 单次便宜，但公开发言是串行的 ────────────────────────
  // 全检档下判官若配错或指向慢模型，就是每条白等 8 秒 × 上百条 ≈ 二十分钟，
  // 而且一条都没判成——正好毁掉"全检几乎无感"的前提。连挂几次必须本局停手。
  assert.ok(ctx.streak >= 2 && ctx.streak <= 5, `${file}: 熔断阈值 ${ctx.streak} 不合理`);
  assert.ok(src.includes('_js.failed++;\n              _js.streak++;'), `${file}: 判官不可用时没有累计连续失败`);
  assert.ok(
    src.includes('if (_js.streak >= SPEECH_JUDGE_FAIL_STREAK && !_js.tripped) {')
    && src.includes('_js.tripped = true;'),
    `${file}: 连续失败没有触发熔断`,
  );
  // 熔断只提示一次，不能每条发言刷一行
  assert.equal((src.match(/_js\.tripped = true;/g) || []).length, 1, `${file}: 熔断被重复触发`);
  // 成功一次就把连败清零，避免零星超时攒够三次误熔断
  assert.ok(src.includes("_js.rejected++; _js.streak = 0;"), `${file}: 判定为 B 之后没有清零连败`);
  assert.ok(src.includes("_js.passed++; _js.streak = 0;"), `${file}: 判定为 A 之后没有清零连败`);
  // 统计必须随每局重建（freshState 不带 _judgeStats），否则上限和熔断会跨局累积
  assert.ok(!/freshState\([\s\S]{0,2000}_judgeStats/.test(src), `${file}: _judgeStats 被带进了 freshState，会跨局累积`);

  // ── 6. 开关：UI 可关，控制台也可关 ──────────────────────────────────────────
  for (const opt of ['<option value="off">关闭</option>', '<option value="triage" selected>分诊</option>', '<option value="all">全检</option>']) {
    assert.ok(src.includes(opt), `${file}: 「发言分诊」缺少档位 → ${opt}`);
  }
  assert.ok(
    src.includes("const _judgeMode = S.debugDisableSpeechJudge ? 'off'")
    && src.includes("if (needsSpeechJudge(_r, opts, _judgeMode)) {"),
    `${file}: 档位没有接上分诊调用点`,
  );
  assert.ok(src.includes("speechJudge:$('m-speech-judge')?$('m-speech-judge').value:'triage',"), `${file}: 档位没有存档`);
  // 旧存档里这里是布尔（复选框时代），不能因为换成下拉就把用户的设置读丢
  assert.ok(
    src.includes("const _sj = typeof d.speechJudge === 'boolean' ? (d.speechJudge ? 'triage' : 'off') : d.speechJudge;"),
    `${file}: 旧存档的布尔值没有迁移`,
  );
  assert.ok(src.includes("if (['off','triage','all'].includes(_sj)) $('m-speech-judge').value = _sj;"), `${file}: 档位没有读档`);
}

console.log('speech judge: off/triage/all modes, mechanical A/B prompt, fail-open + per-game cap and switch wiring passed');
