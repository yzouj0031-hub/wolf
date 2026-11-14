// 参与者模式：规则层等同裸规则；公开记录不平铺进系统提示，而是作为"自你上次开口以来发生的事"逐轮进对话；
//   带私密印象笔记；不跑时序正则、不过判官、不压缩记忆、不开记忆窗口；投票与发言同温、不带决策锚点。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withOfflinePage } from './lib/offline-browser.mjs';
const dumpTo = process.argv[2];
for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(/if \(liveMode\(\) && !opts\.systemPromptOverride\) \{\n\s*LIVE_PENDING_SEEN\.set\(p, S\.history\.length\);\n\s*prompt = liveInjectEvents\(p, liveScrubTask\(prompt\), LIVE_PENDING_SEEN\.get\(p\)\);/.test(src), `${file}: callAI 应把增量事件插进任务`);
  assert.ok(/const SKILL_STATE_KEYS = \[[\s\S]*?'_liveSeen','_liveNotes','_liveNotesRound'\]/.test(src), `${file}: 事件指针与笔记要进存档字段表`);
  assert.ok(/opts\.enforceNightChronology && !liveMode\(\) && hasFirstPersonNightChronologyError/.test(src), `${file}: 参与者模式不跑时序正则`);
  assert.ok(/const _judgeMode = \(S\.debugDisableSpeechJudge \|\| liveMode\(\)\) \? 'off'/.test(src), `${file}: 参与者模式不过判官`);
  assert.ok(/async function compressAllMemories\(\) \{\n\s*if \(liveMode\(\)\) return;/.test(src), `${file}: 参与者模式不压缩记忆`);
  assert.ok(/memLimit > 0 && !liveMode\(\)\) \? filteredMemory\.slice\(-memLimit\)/.test(src), `${file}: 参与者模式不开记忆窗口`);
  assert.ok(/!\(opts\.decisionKind === 'day-vote' && liveMode\(\)\)\) \? 0\.5 : Infinity/.test(src), `${file}: 参与者模式投票不压温度`);
  assert.ok(/callAI\(p, liveMode\(\) \? liveVotePrompt\(isWhitewolfReady\)/.test(src), `${file}: 参与者模式用自己的投票题`);
  if (file === 'index.html') assert.ok(/inferredDecisionKind && !opts\.systemPromptOverride && !liveMode\(\)/.test(src), `${file}: 参与者模式不加决策锚点`);

  assert.ok(/if \(liveMode\(\) && opts && opts\.skillConfirm && !opts\.reasoningStage && !\/格式纠正\/\.test\(String\(prompt \|\| ''\)\)\) opts = \{\.\.\.opts, reasoningStage: 'normal'\};/.test(src), `${file}: 参与者模式的投票和技能决定应与发言同档思考`);
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(async () => {
      window.__DEMO__ = true;
      MODE_CONFIGS.simLive = { name: 'sim', count: 12, roles: ['werewolf','werewolf','werewolf','wolfbeauty','seer','witch','hunter','guard','villager','villager','villager','villager'] };
      S.mode = 'simLive'; S.pureAI = true; startGame(); S.round = 2; S.phase = 'day';
      const out = {};
      TeachingWorldbooks.load({ mode: 'live', liteMigrated: true });
      out.modeName = TeachingWorldbooks.mode();
      out.bareOn = bareRulesMode(); out.liveOn = liveMode();
      out.injection = TeachingWorldbooks.buildInjection({ roleId: 'villager', team: 'good', phase: 'day' });
      const task = { prompt: '【第2天·白天发言】', opts: {} };
      const villager = S.players.find(x => x.role.id === 'villager');
      const other = S.players.find(x => x.id !== villager.id);
      const third = S.players.find(x => x.id !== villager.id && x.id !== other.id);
      for (const role of ['villager', 'seer', 'werewolf']) out['live:' + role] = buildSystemPrompt(S.players.find(x => x.role.id === role), task);
      // 增量事件：别人的发言和票型进块，自己的发言不重复，标题行留在最前
      S.history.push({ phase: 'day', round: 1, name: other.name, text: '我觉得' + third.name + '有点怪。' });
      S.history.push({ phase: 'day', round: 1, name: villager.name, text: '我先听听。' });
      S.history.push({ phase: 'vote', round: 1, name: '【投票结果·逐人票型】', text: third.name + '←' + other.name });
      S.history.push({ phase: 'day', round: 2, name: third.name, text: other.name + '你昨天票投得太快。' });
      out.block1 = liveNewEventsBlock(villager);
      out.injected = liveInjectEvents(villager, '【第2天·白天发言】这是第2天投票前唯一的一次发言。\n【现在】第2夜平安夜。');
      villager._liveSeen = S.history.length;
      out.block2 = liveNewEventsBlock(villager);
      villager._liveSeen = 0;
      out.block3 = liveNewEventsBlock(villager, 2);
      // 指针只在回答真的写进记忆后才前移
      const realImpl = _callAIImpl;
      try {
        _callAIImpl = async (p, prompt, opts) => { LIVE_PENDING_SEEN.set(p, S.history.length); if (!(opts && opts.noMemory)) p.memory.push({ role: 'user', content: prompt }, { role: 'assistant', content: 'ok' }); return { thinking: '', game: 'ok', action: '' }; };
        villager._liveSeen = 0;
        await callAI(villager, '【投票】投谁出局？', { noMemory: true });
        out.seenAfterNoMemory = villager._liveSeen;
        await callAI(villager, '【第2天·白天发言】', {});
        out.seenAfterMemory = villager._liveSeen;
        out.pendingCleared = LIVE_PENDING_SEEN.has(villager);
      } finally { _callAIImpl = realImpl; }
      // 印象笔记：解析、剥离、回灌
      out.parsedTag = parseAI('<thinking>想一下</thinking><game>我投' + third.name + '。</game><notes>' + third.name + '：六成狼；' + other.name + '：先信。</notes>');
      out.parsedFree = parseAI(other.name + '你怪怪的，我今天先不投。\n[笔记]' + other.name + '：五成狼，看明天票。[/笔记]');
      out.parsedPlanAndNotes = parseAI('<game>先听听。</game>[计划]明天盯住' + other.name + '，他改票就推[/计划][笔记]' + other.name + '：三成[/笔记]');
      villager._liveNotes = other.name + '：五成狼。'; villager._liveNotesRound = 1;
      out.withNotes = buildSystemPrompt(villager, task);
      out.task = bareTask('【第2天·白天发言】这是第2天投票前唯一的一次发言。\n【重要】<game>标签里必须写完整的正式发言。');
      out.vote = liveVotePrompt(false); out.voteWW = liveVotePrompt(true);
      out.scrubDay = liveScrubTask('【第2天·白天发言】这是第2天投票前唯一的一次发言。\n\n【现在】\n· 现在是第2天白天。\n· 已出局（不能再行动、不能被投票、不能与之对话）：P1[第1夜]。\n【发言顺序·系统事实】今天的发言顺序由系统指定（座位/警长定序）：1.P3→2.P4。\n你排在第2位。排在你之后的 P5 还没发言。');
      {
        const keep = S.history.length;
        S.history.push({ phase: 'day', round: 2, name: third.name, text: '我是好人，票给' + other.name + '。' }, { phase: 'day', round: 2, name: third.name, text: '[遗言] 我是好人，票给' + other.name + '。' }, { phase: 'day', round: 2, name: other.name, text: '收到。' });
        villager._liveSeen = keep; out.lastWords = liveNewEventsBlock(villager); villager._liveSeen = 0; S.history.length = keep;
      }
      villager._wasFree = $('m-free-output') ? $('m-free-output').checked : true;
      out.sysOp = buildSystemPrompt(villager, { prompt: '【投票】', opts: { skillConfirm: true } });
      if ($('m-free-output')) { $('m-free-output').checked = false; out.sysTag = buildSystemPrompt(villager, task); $('m-free-output').checked = villager._wasFree; }
      out.scrubSheriff = liveScrubTask('【竞选演讲】你在竞选警长，现在轮到你发言。昨晚的死讯要等竞选结束才公布。\n<game>里写你真正要说出口的话。');
      out.scrubWolf = liveScrubTask('【狼队夜聊·第1夜】只有狼队能看到。\n\n【本局对今晚战术有影响的硬规则·系统事实】\n· 今晚过后先进行警长竞选，竞选结束才公布今晚的死讯：今晚被刀、且没被救下的人，在竞选阶段仍被当作在场——照常报名上警、发竞选言、投票。\n· 本局有女巫：救药还在时她每晚能看到刀口。\n\n<thinking>你的分析</thinking>');
      out.scrubWolfOnly = liveScrubTask('【狼队夜聊·第1夜】只有狼队能看到。\n\n【本局对今晚战术有影响的硬规则·系统事实】\n· 今晚过后先进行警长竞选，竞选结束才公布今晚的死讯：今晚被刀、且没被救下的人，在竞选阶段仍被当作在场——照常报名上警、发竞选言、投票。\n\n<thinking>你的分析</thinking>');
      out.stageVote = resolveAIReasoning(villager, '【投票】', { skillConfirm: true, decisionKind: 'day-vote' }).stage;
      out.stageFix = resolveAIReasoning(villager, '【骑士决斗·行动格式纠正】', { skillConfirm: true }).stage;
      out.stageSpeech = resolveAIReasoning(villager, '【第2天·白天发言】', {}).stage;
      // 回归：精简官方不受影响
      TeachingWorldbooks.load({ mode: 'lite', liteMigrated: true });
      out['lite:villager'] = buildSystemPrompt(villager, task);
      out.liteBare = bareRulesMode(); out.liteLive = liveMode();
      out.liteStageVote = resolveAIReasoning(villager, '【投票】', { skillConfirm: true, decisionKind: 'day-vote' }).stage;
      TeachingWorldbooks.load({ mode: 'bare', liteMigrated: true });
      out['bare:villager'] = buildSystemPrompt(villager, task);
      out.bareTask = bareTask('【第2天·白天发言】……\n【重要】<game>标签里必须写完整的正式发言。');
      out.names = { villager: villager.name, other: other.name, third: third.name };
      return out;
    });
    assert.equal(errors.length, 0, `${file}: ${errors.join('\n')}`);
    assert.equal(r.modeName, 'live', `${file}: 存档里的 live 要能读回来`);
    assert.ok(r.bareOn && r.liveOn, `${file}: 参与者模式下 bareRulesMode 与 liveMode 都为真`);
    assert.equal(r.injection, '', `${file}: 参与者模式不注入教学世界书`);
    for (const role of ['villager', 'seer', 'werewolf']) {
      const sys = r['live:' + role];
      assert.ok(sys.includes('【你在打一局狼人杀】'), `${file} ${role}: 缺少参与者框架`);
      for (const gone of ['【发言记录】', '【对局记录', '时间轴', 'E编号', '【说人话', '【口气', '【别人打过的几局', '权威时间轴判定协议', '系统硬事实速查', '【⚠️ 下判断前的默认立场', '【策略自主原则', '【先比较方案'])
        assert.ok(!sys.includes(gone), `${file} ${role}: 参与者模式里还有 ${gone}`);
      assert.ok(sys.includes('【本局配置】') && sys.includes('【当前局势】'), `${file} ${role}: 配置和局势要在`);
      assert.ok(sys.length < (file === 'index.html' ? 4500 : 7000), `${file} ${role}: 系统提示应短（${sys.length} 字）`); // 英文页多一段语言与术语说明
    }
    const { villager, other, third } = r.names;
    assert.ok(r.block1.startsWith('【自你上次开口以来发生的事】'), `${file}: 事件块标题`);
    assert.ok(r.block1.includes('── 第1天·白天 ──') && r.block1.includes('── 第1天·投票 ──') && r.block1.includes('── 第2天·白天 ──'), `${file}: 事件块要分阶段`);
    assert.ok(r.block1.includes(other + '：我觉得' + third + '有点怪。') && r.block1.includes('【投票结果·逐人票型】' + third + '←' + other), `${file}: 事件块要含别人的发言和票型`);
    assert.ok(!r.block1.includes('我先听听'), `${file}: 自己的发言不重复进事件块`);
    assert.ok(r.injected.startsWith('【第2天·白天发言】这是第2天投票前唯一的一次发言。\n\n【自你上次开口以来发生的事】'), `${file}: 事件块插在标题行之后`);
    assert.ok(r.injected.endsWith('【现在】第2夜平安夜。'), `${file}: 任务正文保留在事件块之后`);
    assert.equal(r.block2, '', `${file}: 没有新事件时事件块为空`);
    assert.ok(r.block3.includes('我觉得') && !r.block3.includes('票投得太快'), `${file}: upto 截断事件块`);
    assert.equal(r.seenAfterNoMemory, 0, `${file}: noMemory 调用不前移指针`);
    assert.equal(r.seenAfterMemory, 4, `${file}: 写入记忆后指针前移到当时的记录长度`);
    assert.equal(r.pendingCleared, false, `${file}: 提交后清掉待定指针`);
    assert.equal(r.parsedTag.notes, third + '：六成狼；' + other + '：先信。', `${file}: <notes> 要解析`);
    assert.equal(r.parsedTag.game, '我投' + third + '。', `${file}: 笔记不进发言`);
    assert.equal(r.parsedFree.notes, other + '：五成狼，看明天票。', `${file}: [笔记] 要解析`);
    assert.equal(r.parsedFree.game, other + '你怪怪的，我今天先不投。', `${file}: 自由输出里笔记要剥掉`);
    assert.equal(r.parsedPlanAndNotes.plan, '明天盯住' + other + '，他改票就推', `${file}: 计划照常解析`);
    assert.equal(r.parsedPlanAndNotes.notes, other + '：三成', `${file}: 计划和笔记分开`);
    assert.equal(r.parsedPlanAndNotes.game, '先听听。', `${file}: 计划和笔记都不进发言`);
    assert.ok(r.withNotes.includes('【你自己上一轮写的私密笔记（第1轮）】\n' + other + '：五成狼。'), `${file}: 笔记要回灌到系统提示`);
    assert.equal(r.task, '【第2天·白天发言】这是第2天投票前唯一的一次发言。', `${file}: 参与者模式的任务不带标签提醒`);
    assert.ok(r.vote.startsWith('【投票】') && r.vote.includes('<action>名字/None</action>') && !r.vote.includes('EXPLODE'), `${file}: 投票题`);
    assert.ok(r.voteWW.includes('EXPLODE:目标名'), `${file}: 白狼王投票题带自爆`);
    assert.equal(r.scrubDay, '【第2天·白天发言】这是第2天投票前唯一的一次发言。\n\n【现在】\n· 现在是第2天白天。', `${file}: 白天题里不再重复发言顺序和出局名单：${JSON.stringify(r.scrubDay)}`);
    assert.ok(r.lastWords.includes('收到。') && !r.lastWords.includes('我是好人'), `${file}: 遗言已有通知，不在事件块里再出现两遍：${r.lastWords}`);
    assert.ok(/这一步只提交选择/.test(r.sysOp), `${file}: 纯操作请求只留一句格式说明`);
    if (r.sysTag) assert.ok(/说出口的话写在 <game> 里/.test(r.sysTag), `${file}: 关掉自由输出时要有一句标签说明`);
    // 流程事实只在规则里说一次，不跟在题目后面；框架里不出现描述过程的话（写什么它们就讲什么）
    assert.equal(r.scrubSheriff, '【竞选演讲】你在竞选警长，现在轮到你发言。\n<game>里写你真正要说出口的话。', `${file}: 竞选题不带死讯提醒`);
    assert.ok(!r.scrubWolf.includes('今晚过后先进行警长竞选') && r.scrubWolf.includes('· 本局有女巫') && r.scrubWolf.includes('【本局对今晚战术有影响的硬规则·系统事实】'), `${file}: 狼队题只去掉竞选那条：${r.scrubWolf}`);
    assert.ok(!r.scrubWolfOnly.includes('硬规则·系统事实') && r.scrubWolfOnly.includes('<thinking>你的分析</thinking>'), `${file}: 事实列表空了就连标题一起去掉：${r.scrubWolfOnly}`);
    for (const role of ['villager', 'seer', 'werewolf']) {
      const sys = r['live:' + role];
      assert.ok(sys.includes('第一天先竞选警长，竞选结束后才公布昨夜出局的人'), `${file} ${role}: 竞选在公布死讯之前这条规则应在规则里`);
      for (const gone of ['只听到了排在他前面的发言', '一轮一轮', '翻旧账', '解释规则', '印象', '助手', '【标签边界】', '输出契约', '凑格式', '内容安全声明', '不要拒绝', '不能与死者对话'])
        assert.ok(!sys.includes(gone), `${file} ${role}: 参与者框架里不应再有「${gone}」`);
    }
    assert.deepEqual([r.stageVote, r.stageFix, r.stageSpeech], ['normal', 'quick', 'normal'], `${file}: 参与者模式下决定与发言同档，格式纠正保持最低档`);
    assert.ok(r['lite:villager'].includes('【发言记录】') && !r['lite:villager'].includes('【你在打一局狼人杀】'), `${file}: 精简官方不受影响`);
    assert.ok(!r.liteBare && !r.liteLive, `${file}: 精简官方下两个开关都为假`);
    assert.equal(r.liteStageVote, 'quick', `${file}: 其他模式的思考分流不变`);
    assert.ok(r['bare:villager'].includes('【发言记录】') && !r['bare:villager'].includes('【你在打一局狼人杀】'), `${file}: 裸规则不受影响`);
    assert.ok(r.bareTask.endsWith('【重要】<game>里写你真正要说出口的话。'), `${file}: 裸规则的任务尾巴照旧`);
    if (dumpTo && file === 'index.html') fs.writeFileSync(dumpTo, r['live:villager'] + '\n\n=====\n\n' + r.injected);
    console.log(`${file}: live villager ${r['live:villager'].length} chars, lite ${r['lite:villager'].length} chars`);
  });
}
console.log('live mode: prompt, incremental events, notes, vote and regressions OK');
