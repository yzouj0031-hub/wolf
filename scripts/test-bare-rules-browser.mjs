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
      const task = { prompt: '【第2天·白天发言·第一轮】', opts: {} };
      const out = {};
      for (const mode of ['bare', 'lite']) {
        TeachingWorldbooks.load({ mode, liteMigrated: true });
        for (const role of ['villager', 'seer', 'werewolf']) out[mode + ':' + role] = buildSystemPrompt(S.players.find(x => x.role.id === role), task);
        out[mode + ':wolfHint'] = buildWolfChoiceHint();
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
      for (const keep of ['【本局配置】', '【当前局势】', '【你的真实记录】', '<game>'])
        assert.ok(bare.includes(keep), `${file} ${role}: 裸规则丢了 ${keep}`);
      assert.ok(bare.length < lite.length, `${file} ${role}: 裸规则应比精简官方短（${bare.length} vs ${lite.length}）`);
      assert.ok(lite.includes('【说人话') && lite.includes('【几件容易看错的事'), `${file} ${role}: 精简官方不应受影响`);
    }
    assert.equal(r['bare:wolfHint'], '', `${file}: 裸规则不给狼队战术提示`);
    assert.ok(!r['bare:task'].includes('别只甩一句结论') && r['bare:task'].includes('【当前局势】') && r['bare:task'].endsWith('【重要】<game>里写你真正要说出口的话。'), `${file}: 白天发言任务的教法没去干净 ${r['bare:task']}`);
    assert.ok(!r['bare:task2'].includes('严禁复读') && !r['bare:task2'].includes('正面反驳'), `${file}: 第二轮的「必须反驳」还在`);
    assert.ok(r['lite:task'].includes('别只甩一句结论'), `${file}: 其他模式的任务说明不应被改`);
    assert.equal(errors.length, 0, errors.join('\n'));
    if (dumpTo && file === 'index.html') fs.writeFileSync(dumpTo, r['bare:villager']);
    console.log(`${file}: bare ${r['bare:villager'].length} / lite ${r['lite:villager'].length} chars (villager)`);
  });
}
console.log('bare rules: system prompt, task prompts, wolf hint, experience and switches OK');
