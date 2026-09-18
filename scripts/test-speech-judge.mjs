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
const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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
    ['狼队密谈', DELIB, { wolfOnly: true }],
    ['技能确认', DELIB, { skillConfirm: true }],
    ['静默调用', DELIB, { silent: true }],
    ['过短（另有重写兜底）', '让我想想。我投7号。', {}],
  ];
  for (const [name, text, opts] of MUST_NOT_ASK) {
    assert.equal(ask(text, opts), false, `${file}: 分诊模式下「${name}」被送去问诊了，闸门太宽`);
  }

  // ── 3a. ★ 两个曾经「压根不判」的洞 ──────────────────────────────────────────
  // 都是同一类失败：不是判官判错了，而是这条发言根本没被送去判——日志上什么都看不到。
  // 洞一：全检档按长度设上限，>3000 字直接跳过。而被倾倒出来的思维链恰恰最容易超长，
  //       最该拦的那一类反而是唯一漏过去的。
  const LONG_DELIB = '让我理一下现在的局面。' + 'P7昨天跳了预言家但票投给P3，这和他的查验矛盾；我如果现在跳守卫女巫可能信我。'.repeat(120);
  assert.ok(ctx.parseAI(LONG_DELIB, {}).game.length > 3000, '用例本身不够长，测不到这个洞');
  assert.equal(ask(LONG_DELIB, {}, 'all'), true, `${file}: 全检档仍然按长度放过超长发言`);
  // 洞二：分诊档要求「没用协议」，于是模型规规矩矩打了 <game> 标签、里面装思维链时，
  //       分诊对它完全失明。
  assert.equal(ask(`<game>${DELIB}</game>`, {}, 'triage'), true,
    `${file}: 分诊档对「打了 <game> 标签但装着思维链」仍然失明`);
  // 但协议正确、内容也确实是发言的，不该被这个放宽卷进来
  assert.equal(ask(`<game>${SPEECH}</game>`, {}, 'triage'), false, `${file}: 放宽之后误伤了正常的带协议发言`);

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
  // ★ 缺省参数等于全检。成本从来不是拦着不查的理由——实测全检一局约 5 万 input token，
  // Flash 级模型连一毛钱都花不到。此前默认分诊、并为「省钱」加了一串收窄条件，
  // 而那些条件恰好就是后来每一个漏检的洞。
  assert.equal(ctx.gate(ctx.parseAI(SPEECH, {}), {}), true, `${file}: 默认档位不是全检`);
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
    src.includes("{role: 'user', content: '【待判断文本】\\n' + String(text || '').slice(0, 8000)}"),
    `${file}: 判官请求体里带了候选文本以外的东西`,
  );

  // ── 5. ★ fail-open 与成本护栏 ───────────────────────────────────────────────
  // 上限只是「防异常循环」的兜底，不是成本护栏：撞上是【静默】跳过，最该查的后期发言
  // 反而查不到。正常一局的公开发言约 60 次，两档都必须远高于它。
  assert.ok(ctx.cap.triage >= 100, `${file}: 分诊档上限 ${ctx.cap.triage} 太低，一局中段就会撞上并静默停检`);
  assert.ok(ctx.cap.all >= 100, `${file}: 全检档的上限太低，正常一局就会被截断`);
  for (const [why, marker] of [
    ['判官/主持人/全局都没配', "if (!api.url || !api.key || !api.model) return null;"],
    ['超时', 'setTimeout(() => ctl.abort(), 8000);'],
    ['HTTP 失败', 'if (!res.ok) return null;'],
    ['返回看不懂', "    return null;\n  } catch (e) {\n    return null;"],
  ]) {
    assert.ok(src.includes(marker), `${file}: 判官在「${why}」时没有 fail-open`);
  }
  // 温度必须为 0：这是分类，不是创作
  assert.ok(src.includes('temperature: 0,\n    max_tokens: 32,'), `${file}: 判官不是确定性调用`);

  // ★ 限流必须和「判官不可用」分开：Flash 这类模型 RPM 常常只有 20 上下，配额不够时
  //   429 天然成串出现。若按不可用计数，连续三条就熔断，整局分诊停摆——配额抖一下，
  //   功能就没了。限流会恢复，配置错误不会，这是两件事。
  assert.ok(src.includes('const JUDGE_BUSY_STATUS = [429, 500, 502, 503, 504, 529];'), `${file}: 没有识别限流/过载状态码`);
  assert.ok(src.includes('if (JUDGE_BUSY_STATUS.includes(res.status)) return JUDGE_BUSY;'), `${file}: 限流没有被单独区分`);
  assert.ok(src.includes('if (_verdict === JUDGE_BUSY) {'), `${file}: 调用点没有单独处理限流`);
  assert.ok(src.includes('_js.busy = (_js.busy || 0) + 1;'), `${file}: 限流没有单独计数`);
  // 限流分支绝不能碰连败计数，否则熔断照样会被触发
  const busyStart = src.indexOf('if (_verdict === JUDGE_BUSY) {');
  const busyEnd = src.indexOf('} else if (_verdict === null) {', busyStart);
  assert.ok(busyStart > 0 && busyEnd > busyStart, `${file}: 找不到限流分支`);
  const busyBranch = src.slice(busyStart, busyEnd);
  assert.ok(!/_js\.streak/.test(busyBranch), `${file}: 限流分支动了连败计数，配额抖动会误触熔断`);
  assert.ok(!/_js\.failed/.test(busyBranch), `${file}: 限流被计成了判官不可用`);
  // 撞限流要退避重试一次再放行
  assert.ok(src.includes('for (let attempt = 0; attempt < 2; attempt++) {'), `${file}: 撞限流后没有退避重试`);
  assert.ok(src.includes('await new Promise(resolve => setTimeout(resolve, 1500));'), `${file}: 退避没有间隔`);
  // 成绩单要把「被限流放行」单列，否则用户会以为分诊全程在工作
  assert.ok(src.includes('if (js.busy) bits.push(`被限流放行 ${js.busy}`);'), `${file}: 成绩单没有反映限流`);
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
  for (const opt of ['<option value="off">关闭</option>', '<option value="triage">分诊</option>', '<option value="all" selected>全检</option>']) {
    assert.ok(src.includes(opt), `${file}: 「发言分诊」缺少档位 → ${opt}`);
  }
  assert.ok(
    src.includes("const _judgeMode = S.debugDisableSpeechJudge ? 'off'")
    && src.includes("if (!_judgeRejected && needsSpeechJudge(_r, opts, _judgeMode)) {"),
    `${file}: 档位没有接上分诊调用点`,
  );
  assert.ok(src.includes("speechJudge:$('m-speech-judge')?$('m-speech-judge').value:'all',"), `${file}: 档位没有存档`);
  // 旧存档里这里是布尔（复选框时代），不能因为换成下拉就把用户的设置读丢
  assert.ok(
    src.includes("const _sj = typeof d.speechJudge === 'boolean' ? (d.speechJudge ? 'all' : 'off') : d.speechJudge;"),
    `${file}: 旧存档的布尔值没有迁移`,
  );
  assert.ok(src.includes("if (['off','triage','all'].includes(_sj)) $('m-speech-judge').value = _sj;"), `${file}: 档位没有读档`);
}

// ── 6b. ★ 判官可以单独指定模型，而且多档开关要能看出自己是开着的 ────────────────
// 用户反馈：截图里下拉已经选了「全检」，可 chip 不亮、「已开启 N/M」也不算它，
// 完全无法确认这个开关到底生效没有。原因是计数和亮起只认 input[type=checkbox]，
// CSS 的 :has() 判不了 select 的 value。
for (const file of FILES) {
  const src = read(file);

  // 判官有自己的三个输入框，回落顺序：专用 → 主持人 → 全局
  for (const id of ['j-url', 'j-key', 'j-model']) {
    assert.ok(src.includes(`id="${id}"`), `${file}: 缺少判官专用配置输入框 ${id}`);
  }
  assert.ok(src.includes('function getJudgeAPI() {'), `${file}: 判官没有独立的配置读取`);
  assert.ok(src.includes("url: (own.url || host.url || '').replace(/\\/$/, ''),"), `${file}: 判官地址没有回落到主持人`);
  assert.ok(src.includes("key: own.key || host.key || '',"), `${file}: 判官密钥没有回落`);
  assert.ok(src.includes("model: own.model || host.model || ''"), `${file}: 判官模型没有回落`);
  assert.ok(src.includes('  const api = getJudgeAPI();'), `${file}: 判官调用没有改用独立配置`);
  assert.ok(!src.includes("const api = (typeof getHostAPI === 'function') ? getHostAPI() : null;"),
    `${file}: 判官仍然绑死在主持人配置上`);
  // 启用提示报的模型名要跟着判官配置走，否则用户看到的是主持人的模型，误以为配错了
  assert.ok(src.includes("getJudgeAPI().model"), `${file}: 启用提示报的不是判官实际用的模型`);
  // 判官密钥不能存成明文可见的 text 框
  assert.match(src, /<input type="password" id="j-key"/, `${file}: 判官密钥输入框不是密码框`);
  // 三个字段都要能存档读档，否则每次开应用都得重填
  for (const [key, id] of [['judgeUrl', 'j-url'], ['judgeKey', 'j-key'], ['judgeModel', 'j-model']]) {
    assert.ok(src.includes(`${key}:$('${id}')?$('${id}').value:''`), `${file}: ${key} 没有存档`);
    assert.ok(src.includes(`if (d.${key}&&$('${id}')) $('${id}').value=d.${key};`), `${file}: ${key} 没有读档`);
  }
  assert.ok(src.includes("'j-url','j-key','j-model'].forEach"), `${file}: 判官配置改动后没有自动存档`);

  // 多档开关的状态：chip 要亮、要计数、改档要立刻重算
  assert.ok(src.includes('data-on-values="triage all"'), `${file}: 「发言分诊」没有声明哪些档位算开着`);
  assert.ok(src.includes('function selectChipOn(lab){'), `${file}: 计数逻辑不认多档开关`);
  assert.ok(src.includes('var total = boxes.length + chips.length;'), `${file}: 总数没有把多档开关算进去`);
  assert.ok(src.includes("e.target.tagName === 'SELECT'"), `${file}: 改档之后没有重算 chip 状态`);
  // 状态点此前被显式隐藏，导致这种开关连「有没有生效」都看不出来
  assert.ok(src.includes('.mti[data-on-values]::after { display:block; }'), `${file}: 多档开关没有状态点`);
  assert.ok(src.includes('.mti:not(:has(input[type="checkbox"])):not([data-on-values])::after'),
    `${file}: 隐藏状态点的规则没有排除多档开关`);
}

// ── 6c. ★ 第 0 层：明显的思维链倾倒，正则直接拦，不必花判官那一次 ────────────────
// 判官会漏——泄漏的思维链大量提到玩家和票型，读起来很像在分析局面；限流或超时也会让
// 整条直接放行。这些信号是结构性的，正则比模型更可靠，而且零成本、零延迟。
{
  for (const file of FILES) {
    const src = read(file);
    assert.ok(src.includes('const _COT_DUMP_SIGNALS = ['), `${file}: 缺少思维链倾倒的确定性信号表`);
    assert.ok(src.includes('function looksLikeThinkingDump(text) {'), `${file}: 缺少确定性前置检查`);
    assert.ok(src.includes('const _dump = looksLikeThinkingDump(_r.game);'), `${file}: 前置检查没有接进发言流程`);
    // 必须走和判官判 B 完全相同的重写路径，而不是另起一套
    assert.ok(src.includes("_r = {..._r, thinking: (_r.thinking ? _r.thinking + '\\n\\n' : '') + _r.game, game: ''};"),
      `${file}: 前置检查没有复用判 B 的重写路径`);
    assert.ok(src.includes('_judgeRejected = true;'), `${file}: 前置检查命中后没有触发重写`);
    // 分诊关掉时完全不介入
    assert.ok(src.includes("if (_judgeMode !== 'off' && needsSpeechJudge(_r, opts, _judgeMode)) {"),
      `${file}: 关掉分诊后前置检查仍在介入`);
    // 成绩单要单列，否则用户会以为是判官抓到的
    assert.ok(src.includes('if (js.caught) bits.push(`正则直接拦下 ${js.caught}`);'), `${file}: 成绩单没有反映正则拦截`);
    assert.ok(src.includes('if (!js || (!js.asked && !js.caught)) return;'), `${file}: 只被正则拦下时不打印成绩单`);
  }

  // 功能测试：该抓的要抓，真发言一条都不能误伤
  const src = read('index.html');
  const a = src.indexOf('const _COT_DUMP_SIGNALS'); const b = src.indexOf('// 纯函数，便于测试', a);
  const ctx = vm.createContext({String});
  vm.runInContext(src.slice(a, b) + '; this.f = looksLikeThinkingDump;', ctx, {filename: 'index.html:dump'});

  for (const t of [
    '让我先理一下当前局面。P7昨天跳了预言家但票投给P3，这和他的查验矛盾，我应该先不跳等P9表态。',
    '我需要先分析一下场上的情况。目前看P3和P7的说法对不上，我倾向于认为P3是狼。今天我投P3。',
    '第一步：确认身份。第二步：分析票型。第三步：决定投谁。综上我投P7。',
    '方案A是直接跳预言家把查验报出来，方案B是先压一手看看别人怎么说，我选方案B。',
    'Let me think about this. P7 claimed seer yesterday but his vote went to P3.',
    '**Assessing the vote** **Weighing the claim** **Deciding the target** 我投P7。',
    '按照 thinking 字段的要求我先分析，然后在 game 字段里写发言。我投P3。',
    '我是预言家，昨晚查验白马探。<action>白马探</action>',
  ]) assert.ok(ctx.f(t), `没抓到明显的思维链倾倒：${t.slice(0, 40)}`);

  // ★ 误伤一条真发言的代价远大于漏掉一条倾倒：漏了还有判官兜底，误伤则是把好发言扔掉重写
  for (const t of [
    '我是预言家，昨晚查验白马探，结果是狼人。今天我的票给他，请大家跟一下，顺便核对昨天7号的改口。',
    '我先说结论：我投白马探。理由有三条，第一他昨天的票型对不上，第二他今天改口了，第三他一直在替7号说话。',
    '我觉得我现在应该跳了：我是预言家，昨晚查验白马探是狼人。警徽流我给宫野志保。',
    '我应该没记错的话，7号昨天投的是白马探，今天却说自己一直站边我。这两句对不上，请他解释。',
    'P3说的那个方案A我不认同，我们还是按原计划走。我今天投P7。',
    '昨晚我守了白马探。今天天亮之前系统明确告诉我一件事——他同时受到了守护。我是守卫。',
    '我是**女巫**。昨晚我救了自己，毒药还在手上。今天我投白马探。',
  ]) assert.equal(ctx.f(t), null, `误伤了真发言：${t.slice(0, 40)}`);

  assert.equal(ctx.f('我投7号。'), null, '过短的发言不该在这一层判');
  assert.equal(ctx.f(''), null, '空串不该命中');
  assert.equal(ctx.f(null), null, 'null 不该命中');
}

// ── 6d. ★ 全检默认开着，唯一真实的成本风险是判官回落到主力大模型 ────────────────
// getJudgeAPI 的回落链是 判官专用 → 主持人 → 全局。两个都没填时它会拿全局那个模型
// 跑几十次——成本可能差两三个数量级，而用户完全看不出来。所以必须说出口。
for (const file of FILES) {
  const src = read(file);
  assert.ok(src.includes("const _jOwn = $('j-model') && $('j-model').value.trim();"), `${file}: 没有检查判官是否单独配了模型`);
  assert.ok(src.includes("if (!_jOwn && !_jHost) {"), `${file}: 判官回落到全局模型时没有警告`);
  assert.match(src, /判官没有单独配置模型，正在使用全局的/, `${file}: 警告没有点明正在用的是全局模型`);
  assert.match(src, /请在「主持与调试 → 判官」里填一个 Flash \/ Haiku 这类快模型/, `${file}: 警告没有给出补救办法`);
  // 提示文字里要把真实成本写出来，否则用户只能靠猜
  assert.match(src, /一局约 5 万 input token/, `${file}: 开关说明没有写出真实成本`);
}

// ── 7. ★ 可见反馈：判官放行时静默，用户必须有别的办法确认它在工作 ──────────────
// 这个应用主要跑在平板和手机上，控制台够不着，所以 S._judgeStats 不能是唯一的验证手段。
for (const file of FILES) {
  const src = read(file);
  // 第一次真正开工要报一声，并说明用的是哪个模型
  assert.ok(src.includes('if (_js.asked === 1) {'), `${file}: 判官启用时没有任何提示`);
  assert.match(src, /发言分诊已启用（\$\{_judgeMode === 'all' \? '全检' : '分诊'\} · \$\{_jm\}）/,
    `${file}: 启用提示没有说清档位和模型`);
  // 局终要有成绩单，而且必须挂在所有结局路径都会过的地方
  assert.ok(src.includes('function logSpeechJudgeSummary()'), `${file}: 缺少局终成绩单`);
  assert.ok(src.includes('function recordLeaderboard(winType) {\n  logSpeechJudgeSummary();'),
    `${file}: 成绩单没有挂在每条结局路径都会经过的地方`);
  // 一次都没问过就不该刷屏
  assert.ok(src.includes('if (!js || (!js.asked && !js.caught)) return;'), `${file}: 没问过也会打印成绩单`);
  // 熔断过要在成绩单里点出来，否则用户只会看到"判官无响应 N"却不知道它已经停了
  assert.ok(src.includes("js.tripped ? '（已熔断，检查主持人API）'"), `${file}: 成绩单没有反映熔断`);
}

console.log('speech judge: off/triage/all modes, mechanical A/B prompt, fail-open + breaker, switch wiring and visible feedback passed');
