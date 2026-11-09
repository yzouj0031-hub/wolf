// 裸规则：只给规则、身份技能、局面、输出格式；说话指导、经验库、战术提示、白天发言里的教法都不发；其他模式不受影响
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withOfflinePage } from './lib/offline-browser.mjs';
const dumpTo = process.argv[2];
for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(/minSpeechChars = bareRulesMode\(\) \? 1/.test(src), `${file}: 裸规则应关掉短发言补写`);
  assert.ok(/if \(!bareRulesMode\(\)\) await (nightStep\('wolf-strategy', \(\) => )?wolfStrategyDiscuss\(ws\)/.test(src), `${file}: 裸规则应跳过狼盟密约`);
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      window.__DEMO__ = true;
      MODE_CONFIGS.simBare = { name: 'sim', count: 12, roles: ['werewolf','werewolf','werewolf','wolfbeauty','seer','witch','hunter','guard','villager','villager','villager','villager'] };
      S.mode = 'simBare'; S.pureAI = true; startGame(); S.round = 2; S.phase = 'day';
      gameRecord.push({ type: 'speech', name: S.players[0].name, game: '我先说两句。', round: 1, phase: 'day' });
      const task = { prompt: '【第2天·白天发言·第一轮】', opts: {} };
      const out = {};
      for (const mode of ['bare', 'lite']) {
        TeachingWorldbooks.load({ mode, liteMigrated: true });
        for (const role of ['villager', 'seer', 'werewolf']) out[mode + ':' + role] = buildSystemPrompt(S.players.find(x => x.role.id === role), task);
        out[mode + ':wolfHint'] = buildWolfChoiceHint();
        out[mode + ':brief'] = getFullRoleBrief(S.players.find(x => x.role.id === 'seer'));
        out[mode + ':rules'] = buildRulesExport();
        out[mode + ':anchor'] = typeof buildDecisionAnchor === 'function' ? buildDecisionAnchor(S.players[0], 'day-vote', S.players, { allowPass: true }) : null;
        out[mode + ':webRules'] = buildWebRulesExport(S.players.find(x => x.role.id === 'seer'));
        out[mode + ':task'] = bareTask('【第2天·白天发言】这是第2天投票前唯一的一次发言。\n【当前局势】……\n【重要】<game>标签里必须写完整的正式发言。别只甩一句结论，不要硬凑一个人来怀疑。');
        out[mode + ':task2'] = bareTask('【第2天·白天发言·第二轮】……\n\n【⚠️ 严禁复读第一轮】① 正面反驳 ② 改票 ③ 新角度\n\n【重要】<game>标签里必须写完整的正式发言。');
      }
      out.modeName = (TeachingWorldbooks.load({ mode: 'bare', liteMigrated: true }), TeachingWorldbooks.mode());
      return out;
    });
    assert.equal(r.modeName, 'bare', `${file}: 存档里的 bare 要能读回来`);
    for (const role of ['villager', 'seer', 'werewolf']) {
      const bare = r['bare:' + role], lite = r['lite:' + role];
      for (const gone of ['【说人话', '【口气', '【身份·没事别报', '【你是在牌桌上跟对手博弈', '【别人打过的几局', '【几段说得还行的发言', '【策略自主原则', '【先比较方案', '【允许创造', '【几件容易看错的事', '【身份声明同标尺', '【公开讨论的表达底线', '【位置学常识', '【胜负判定·你的目标函数'])
        assert.ok(!bare.includes(gone), `${file} ${role}: 裸规则里还有 ${gone}`);
      for (const gone of ['权威时间轴判定协议', '只是提议/声称', '系统硬事实速查', '严重警告·绝对禁止脑补', '本局能力索引', '⚠️ 铁律', '【狼队身份配合】', '规则不是今夜情报', '不等于"好人"', '所有玩家必须遵守', '身份分类·硬规则', '你的真实记录', '本局确实是屠边规则'])
        assert.ok(!bare.includes(gone), `${file} ${role}: 裸规则的规则部分还有说教 ${gone}`);
      for (const keep of ['【本局配置】', '【当前局势】', '【基本流程】', '【对局记录·按时间先后】', '<game>', '每个人说话时只听到了排在他前面的发言'])
        assert.ok(bare.includes(keep), `${file} ${role}: 裸规则丢了 ${keep}`);
      assert.ok(bare.length < lite.length, `${file} ${role}: 裸规则应比精简官方短（${bare.length} vs ${lite.length}）`);
      assert.ok(lite.includes('【说人话') && lite.includes('【几件容易看错的事'), `${file} ${role}: 精简官方不应受影响`);
    }
    assert.equal(r['bare:wolfHint'], '', `${file}: 裸规则不给狼队战术提示`);
    if (file === 'index.html') assert.ok(r['bare:brief'].includes('每晚查验一名其他玩家') && !r['bare:brief'].includes('每晚看一人知道好坏'), `${file}: 裸规则的角色说明应写清技能 ${r['bare:brief']}`);
    if (r['lite:anchor'] !== null) {
      assert.equal(r['bare:anchor'], '', `${file}: 裸规则不应附私密决策检查清单`);
      assert.ok(r['lite:anchor'].includes('私密决策锚点'), `${file}: 其他模式的决策锚点不应被关`);
    }
    const B = "(typeof bareRulesMode === 'function' && bareRulesMode())";
    for (const [label, needle] of [
      ['自由输出发言指导', "finalPrompt += " + B + " ? '\\n\\n直接用第一人称说出你要对大家说的话。"],
      ['公开发言要说完整', "if (isFreeOutput && !" + B + ") finalPrompt += '\\n\\n【公开发言要说完整】"],
      ['白天投票', "callAI(p, " + B + " ? '【投票】投谁出局？\\n<thinking>思考</thinking>"],
      ['狼队第二轮', "const prompt = " + B + " ? `【狼队夜聊·第二轮】"],
      ['猎人开枪', "callAI(p, " + B + " ? '【猎人开枪】你已经出局"],
      ['警长报名', "callAI(p, " + B + " ? '【警长竞选】天亮了"],
      ['竞选发言', "proc(candidates, p => " + B + " ? '【竞选演讲】"],
      ['狼队首夜事实的结论句', "(" + B + " ? '' : '所以今晚刀口死不死，都不影响他明天上警起跳。')"],
    ]) assert.ok(src.includes(needle), `${file}: 裸规则下「${label}」应只给规则和选项`);
    if (file === 'index.html') {
      for (const k of ['bare:rules', 'bare:webRules']) {
        for (const gone of ['推理建议', '推理证据等级', '信息边界', '必须遵守', '不得', '你的目标函数', '不要'])
          assert.ok(!r[k].includes(gone), `${file} ${k}: 裸规则导出里还有 ${gone}\n${r[k]}`);
        for (const keep of ['【本局规则】', '胜负：屠', '【在场角色】', '每晚查验一名其他玩家', '【基本流程】'])
          assert.ok(r[k].includes(keep), `${file} ${k}: 裸规则导出缺 ${keep}`);
        assert.ok(!/骑士|白狼王|狼王不能/.test(r[k]), `${file} ${k}: 不在场的角色不该出现在规则里\n${r[k]}`);
      }
      assert.ok(r['lite:rules'].includes('推理建议'), `${file}: 其他模式的规则导出不应被改`);
    }
    assert.ok(/这就是你|THIS IS YOU/.test(r['lite:brief']), `${file}: 其他模式的角色说明不应被改`);
    for (const [label, re] of [['守卫夜晚', /contextPrompt = bareRulesMode\(\) \? '【守卫·第'/], ['女巫夜晚', /contextPrompt = bareRulesMode\(\) \? '【女巫·第'/], ['狼队开场', /const prompt = \(bareRulesMode\(\) && !killBlocked\) \? `【狼队夜聊/]])
      assert.ok(re.test(src), `${file}: 裸规则下${label}提示应只给规则和选项`);
    assert.ok(!r['bare:task'].includes('别只甩一句结论') && r['bare:task'].includes('【当前局势】') && r['bare:task'].endsWith('【重要】<game>里写你真正要说出口的话。'), `${file}: 白天发言任务的教法没去干净 ${r['bare:task']}`);
    assert.ok(!r['bare:task2'].includes('严禁复读') && !r['bare:task2'].includes('正面反驳'), `${file}: 第二轮的「必须反驳」还在`);
    assert.ok(r['lite:task'].includes('别只甩一句结论'), `${file}: 其他模式的任务说明不应被改`);
    assert.equal(errors.length, 0, errors.join('\n'));
    if (dumpTo && file === 'index.html') fs.writeFileSync(dumpTo, r['bare:villager'] + '\n\n=====RULES=====\n' + r['bare:rules'] + '\n\n=====WEB=====\n' + r['bare:webRules']);
    console.log(`${file}: bare ${r['bare:villager'].length} / lite ${r['lite:villager'].length} chars (villager)`);
  });
}
console.log('bare rules: system prompt, task prompts, wolf hint, experience and switches OK');
