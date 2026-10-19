// 📖 经验库：真实页面里 buildSystemPrompt 会带上案例块；关掉开关 / 技能确认不带；中英两页都生效。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

await withOfflinePage(async (page, origin) => {
  for (const file of ['index.html', 'en/index.html']) {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file);
    await page.waitForFunction(() => typeof buildSystemPrompt === 'function' && window.WolfExperience && typeof ALL_ROLES === 'object');
    const r = await page.evaluate(() => {
      const keys = ['seer', 'witch', 'hunter', 'villager', 'villager', 'villager', 'werewolf', 'werewolf', 'werewolf'];
      S.players = keys.map((key, id) => ({ id, name: 'N' + id, role: ALL_ROLES[key], alive: true, memory: [] }));
      Object.assign(S, { playerId: -1, pureAI: true, directorMode: false, gameOver: false, round: 2, phase: 'day', sheriff: 0, history: [] });
      const day = { prompt: '【第2天·白天发言·第一轮】说说你的想法', opts: {} };
      const villager = buildSystemPrompt(S.players[3], day);
      const wolfNight = buildSystemPrompt(S.players[6], { prompt: '【狼队密谈·开场陈述】', opts: { wolfOnly: true } });
      const skill = buildSystemPrompt(S.players[2], { prompt: '【猎人开枪】', opts: { skillConfirm: true } });
      $('m-experience').checked = false;
      const off = buildSystemPrompt(S.players[3], day);
      $('m-experience').checked = true;
      const cfg = JSON.parse(localStorage.getItem('wg_cfg') || '{}');
      return {
        v: villager.includes('【别人打过的几局'), vEx: villager.includes('【几段说得还行的发言'),
        noGuard: !/守卫/.test(villager.slice(villager.indexOf('【别人打过的几局'), villager.indexOf('【别人打过的几局') + 1700)),
        w: wolfNight.includes('【别人打过的几局') && /狼队夜聊|密谈/.test(wolfNight.slice(wolfNight.indexOf('【别人打过的几局'))),
        skill: skill.includes('【别人打过的几局'), off: off.includes('【别人打过的几局'),
        len: villager.length
      };
    });
    assert.ok(r.v && r.vEx, `${file}: 白天发言没有注入案例/范例`);
    assert.ok(r.noGuard, `${file}: 注入了本局没有的守卫`);
    assert.ok(r.w, `${file}: 狼队密谈没有拿到密谈案例`);
    assert.ok(!r.skill, `${file}: 技能确认不该注入案例`);
    assert.ok(!r.off, `${file}: 关掉开关后仍在注入`);
    const bad = errors.filter(e => !/favicon|ERR_FAILED|supabase/i.test(e));
    assert.equal(bad.length, 0, `${file}: 页面报错 ${bad.join('\n')}`);
    console.log(file, 'ok, villager system prompt', r.len, 'chars');
  }
});
