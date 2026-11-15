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
      // 最后一道过滤：事实留下，判断指导、时间注解、强调词去掉
      const sc = t => liveScrub(bareScrub(t, 'user'), 'user');
      out.scPkVote = sc('【PK投票 - 关键决战】\n刚才投票出现平票（A、B 票数相同），PK 候选人已经完成最后自救发言。\n\n你现在必须从 A、B 中选择一人放逐。\n\n\n这是流程强制二选一，不代表平票者中必然有狼；两人都可能是好人，也可能包含狼人。\n重新比较两人的硬事实矛盾、信息时点、此前票型和放逐收益。不要因已经投过而机械重复，也不要因谁措辞更差就自动惩罚谁。若证据都薄，选择误伤风险更低、其好人解释更不自然的一方，但不要虚构铁证。\n\n<thinking>比较两个候选人的硬证据、好人解释与投错代价，决定投谁</thinking>\n<game></game>\n<action>玩家完整名字（必须从 A、B 中选一个，不要写 None）</action>');
      out.scPkSpeech = sc('【PK发言】你和其他人平票了，这是你最后的自救机会，说服大家不要投你！\n\n【自你上次开口以来发生的事】\nA：过\n\n注意：<game>标签里直接写完整的自救发言，全力说服大家不要投你。\n\n直接用第一人称说。');
      out.scDay = sc('【第2天·白天发言】这是第2天投票前唯一的一次发言，没有第二轮。\n\n【现在】\n· 现在是第2天白天（第2夜的结果已经公布）。\n· 第2夜的结果：A出局。');
      out.scAnn = sc('【公告·第2天】A夜晚出局（死于第1夜，第2天天亮才公布）。（身份未公开）') + '|' + sc('【公告·第2天】B被投票放逐（死于第2天白天）。（身份未公开）');
      out.scLw = sc('【遗言·第2天】A在第1夜死亡、第2天天亮公布死讯后留下遗言：「我是好人」') + '|' + sc('【遗言·第2天】B在第2天被投票放逐出局前留下遗言：「过」');
      out.scCharm = sc('【公告】魅惑连带已触发，A随之殒命。这说明已有一名狼美人出局，但狼美人具体是哪名死者、双方真实身份均不公开。');
      out.scDuel = sc('【决斗结果】A（骑士）向B发起决斗。A认错了人，A已死亡！B存活。这说明B不属于狼人阵营。');
      out.scLabels = sc('【你的身份与技能·硬信息】你是村民\n【查验结果·内部真实完整记录】\n第1夜：查验了A\n【查验结果·重要】你尝试查验A→好人显示。\n【你的历次行动记录·逐夜精确记录】\n狼队刀口记录（绝密）：\n守卫：基于你上面的推演做决定：守谁？\n【狼队平票追加讨论】平票目标：A、B。从中选一个最终刀口，快速表态！');
      out.scWolfHd = sc('【狼队夜聊·第1夜】只有狼队能看到。\n可刀目标:A,B\n\n【本局对今晚战术有影响的硬规则·系统事实】\n· 本局开启隐死亡：出局者不翻牌、不公布身份。\n\n<thinking>你的分析</thinking>');
      out.scWolfOther = sc('【狼队夜聊·第1夜】只有狼队能看到。\n\n【本局对今晚战术有影响的硬规则·系统事实】\n· 本局开启隐死亡：出局者不翻牌、不公布身份。\n· 本局有守墓人：他每晚只读到上一个白天被放逐者的阵营。\n\n<thinking>你的分析</thinking>');
      out.scOwn = liveScrub('我觉得这是你最后的自救机会，快速表态！（死于第1夜，第2天天亮才公布）', 'assistant');
      out.scNight = sc('· “先行动”不是这句\n夜间固定顺序：守卫 → 狼\n“先行动”表示先选择目标并先产生会影响后续行动的状态；最终死亡仍在夜末统一结算，除非技能明确写成立即结算。\n白天/触发型技能：');
      out.scrubDay = liveScrubTask('【第2天·白天发言】这是第2天投票前唯一的一次发言。\n\n【现在】\n· 现在是第2天白天。\n· 已出局（不能再行动、不能被投票、不能与之对话）：P1[第1夜]。\n【发言顺序·系统事实】今天的发言顺序由系统指定（座位/警长定序）：1.P3→2.P4。\n你排在第2位。排在你之后的 P5 还没发言。');
      {
        const keep = S.history.length;
        S.history.push({ phase: 'day', round: 2, name: third.name, text: '我是好人，票给' + other.name + '。' }, { phase: 'day', round: 2, name: third.name, text: '[遗言] 我是好人，票给' + other.name + '。' }, { phase: 'day', round: 2, name: other.name, text: '收到。' });
        villager._liveSeen = keep; out.lastWords = liveNewEventsBlock(villager); villager._liveSeen = 0; S.history.length = keep;
      }
      villager._wasFree = $('m-free-output') ? $('m-free-output').checked : true;
      out.sysOp = buildSystemPrompt(villager, { prompt: '【投票】', opts: { skillConfirm: true } });
      if ($('m-free-output')) { $('m-free-output').checked = false; out.sysTag = buildSystemPrompt(villager, task); $('m-free-output').checked = villager._wasFree; }
      out.scrubDayNew = liveScrubTask('【第2天·白天发言】这是第2天投票前唯一的一次发言。\n\n【现在】\n· 现在是第2天白天。\n【发言顺序】1.P3→2.P4→3.P5。\n你排在第2位。排在你之后的 P5 还没发言。');
      out.scrubSheriff = liveScrubTask('【竞选演讲】你在竞选警长，现在轮到你发言。昨晚的死讯要等竞选结束才公布。\n<game>里写你真正要说出口的话。');
      out.scrubWolf = liveScrubTask('【狼队夜聊·第1夜】只有狼队能看到。\n\n【本局对今晚战术有影响的硬规则·系统事实】\n· 今晚过后先进行警长竞选，竞选结束才公布今晚的死讯：今晚被刀、且没被救下的人，在竞选阶段仍被当作在场——照常报名上警、发竞选言、投票。\n· 本局有女巫：救药还在时她每晚能看到刀口，并在白天任何人起跳之前就决定救不救；同一夜不能同时用两瓶药；救药一旦用掉（不论救的是谁），她此后再也看不到刀口。\n· 本局开启隐死亡：出局者不翻牌、不公布身份。\n\n<thinking>你的分析</thinking>');
      out.leakParen = parseAI('（请在内部完成判断，不要输出内部判断或内部判断。）\n*站起来*\n\n翻牌！昨晚我验了' + other + '。').game;
      out.keepParen = parseAI('（笑）我先说一句，昨晚是平安夜。').game;
      out.keepMidParen = parseAI('我投' + other + '。（不要输出那种眼神啦）继续。').game;
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
    assert.ok(!/按你刚才|改了主意/.test(r.vote), `${file}: 投票题只说现在投票：${r.vote}`);
    assert.equal(r.scPkVote, '【PK投票】\n刚才投票出现平票（A、B 票数相同），两人已经做了PK发言。\n\n你现在必须从 A、B 中选择一人放逐。\n\n<thinking>思考</thinking>\n<game></game>\n<action>玩家完整名字（必须从 A、B 中选一个，不要写 None）</action>', `${file}: 平票重投只说从谁里面选：${JSON.stringify(r.scPkVote)}`);
    assert.equal(r.scPkSpeech, '【PK发言】你和其他人平票了，再发一次言，然后大家在平票的人里重新投票。\n\n【自你上次开口以来发生的事】\nA：过\n\n直接用第一人称说。', `${file}: PK 发言题（中间隔着事件记录也要去干净）：${JSON.stringify(r.scPkSpeech)}`);
    assert.equal(r.scDay, '【第2天·白天发言】轮到你发言。\n\n【现在】\n· 现在是第2天白天。\n· 第2夜的结果：A出局。', `${file}: 白天题不再强调"唯一一次""已经公布"：${JSON.stringify(r.scDay)}`);
    assert.equal(r.scAnn, '【公告·第2天】A夜晚出局。（身份未公开）|【公告·第2天】B被投票放逐。（身份未公开）', `${file}: 公告不再带"死于何时、何时公布"：${r.scAnn}`);
    assert.equal(r.scLw, '【遗言·第2天】A（第1夜出局）留下遗言：「我是好人」|【遗言·第2天】B（第2天被放逐）留下遗言：「过」', `${file}: 遗言：${r.scLw}`);
    assert.equal(r.scCharm, '【公告】魅惑连带已触发，A随之殒命。', `${file}: 公告不替玩家下结论：${r.scCharm}`);
    assert.equal(r.scDuel, '【决斗结果】A（骑士）向B发起决斗。A认错了人，A已死亡！B存活。', `${file}: 决斗公告不替玩家下结论：${r.scDuel}`);
    assert.equal(r.scLabels, '【你的身份与技能】你是村民\n【查验结果】\n第1夜：查验了A\n【查验结果】你尝试查验A→好人显示。\n【你的历次行动记录】\n狼队刀口记录：\n守卫：守谁？\n【狼队平票追加讨论】平票目标：A、B。从中选一个最终刀口。', `${file}: 标签上的强调词：${JSON.stringify(r.scLabels)}`);
    assert.equal(r.scWolfHd, '【狼队夜聊·第1夜】只有狼队能看到。\n可刀目标:A,B\n\n<thinking>你的分析</thinking>', `${file}: 夜聊题后面不重复隐死亡规则：${JSON.stringify(r.scWolfHd)}`);
    assert.ok(r.scWolfOther.includes('【和今晚有关的规则】\n· 本局有守墓人') && !r.scWolfOther.includes('隐死亡'), `${file}: 其余角色规则保留：${r.scWolfOther}`);
    assert.equal(r.scOwn, '我觉得这是你最后的自救机会，快速表态！（死于第1夜，第2天天亮才公布）', `${file}: 模型自己说过的话原样保留`);
    assert.equal(r.scNight, '· “先行动”不是这句\n夜间固定顺序：守卫 → 狼\n白天/触发型技能：', `${file}: 夜间顺序后面的解释句去掉：${JSON.stringify(r.scNight)}`);
    assert.ok(!/大胆点名|下注|吵架/.test(r['live:villager']) && r['live:villager'].includes('目标只有一个：让你的阵营赢。'), `${file}: 开场不再有"大胆点名、下注、吵架"`);
    assert.equal(r.scrubDay, '【第2天·白天发言】这是第2天投票前唯一的一次发言。\n\n【现在】\n· 现在是第2天白天。', `${file}: 白天题里不再重复发言顺序和出局名单：${JSON.stringify(r.scrubDay)}`);
    assert.equal(r.scrubDayNew, '【第2天·白天发言】这是第2天投票前唯一的一次发言。\n\n【现在】\n· 现在是第2天白天。', `${file}: 裸规则新标签的发言顺序行也不跟在题目后面：${JSON.stringify(r.scrubDayNew)}`);
    assert.ok(r.lastWords.includes('收到。') && !r.lastWords.includes('我是好人'), `${file}: 遗言已有通知，不在事件块里再出现两遍：${r.lastWords}`);
    assert.ok(/这一步只提交选择/.test(r.sysOp), `${file}: 纯操作请求只留一句格式说明`);
    if (r.sysTag) assert.ok(/说出口的话写在 <game> 里/.test(r.sysTag), `${file}: 关掉自由输出时要有一句标签说明`);
    // 流程事实只在规则里说一次，不跟在题目后面；框架里不出现描述过程的话（写什么它们就讲什么）
    assert.equal(r.scrubSheriff, '【竞选演讲】你在竞选警长，现在轮到你发言。\n<game>里写你真正要说出口的话。', `${file}: 竞选题不带死讯提醒`);
    // 女巫几时看刀口、几时决定，规则里的夜间顺序和女巫牌面已经写了；放在夜聊题目后面，狼会把它当台词念出来（实际对局出现过）
    assert.ok(!r.scrubWolf.includes('今晚过后先进行警长竞选') && !r.scrubWolf.includes('本局有女巫') && r.scrubWolf.includes('【本局对今晚战术有影响的硬规则·系统事实】\n· 本局开启隐死亡'), `${file}: 狼队题去掉竞选和女巫两条，其余事实保留：${r.scrubWolf}`);
    if (file === 'index.html') assert.ok(r['live:werewolf'].includes('女巫在解药仍在时查看最终狼刀'), `${file}: 女巫看刀口的时机仍在规则里`);
    // 模型念给自己听的整句括号提醒不是桌上的话；普通的括号动作、句中的括号照旧
    assert.ok(!/请在内部|不要输出/.test(r.leakParen) && r.leakParen.startsWith('*站起来*'), `${file}: 发言开头的自我提醒要去掉：${r.leakParen}`);
    assert.equal(r.keepParen, '（笑）我先说一句，昨晚是平安夜。', `${file}: 普通括号动作不动`);
    assert.ok(r.keepMidParen.includes('（不要输出那种眼神啦）'), `${file}: 句中的括号不动：${r.keepMidParen}`);
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
