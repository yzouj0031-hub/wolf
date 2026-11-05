// 精简官方：默认模式；只给规则事实与常见误读，不发两万字的方法论；完整官方仍可选；旧存档的「官方教学」迁移一次
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const twb = TeachingWorldbooks;
      const out = { fresh: (twb.load(null), twb.mode()) };
      twb.load({ mode: 'official' }); out.migrated = twb.mode();
      twb.load({ mode: 'official', liteMigrated: true }); out.keptFull = twb.mode();
      twb.load({ mode: 'clean', liteMigrated: true }); out.keptClean = twb.mode();
      window.__DEMO__ = true;
      MODE_CONFIGS.simLite = { name: 'sim', count: 12, roles: ['werewolf','werewolf','werewolf','wolfbeauty','seer','witch','hunter','guard','villager','villager','villager','villager'] };
      S.mode = 'simLite'; S.pureAI = true; startGame(); S.round = 2; S.phase = 'day';
      const task = { prompt: '【第2天·白天发言·第一轮】', opts: {} };
      const build = (mode, roleId) => { twb.load({ mode, liteMigrated: true }); return buildSystemPrompt(S.players.find(x => x.role.id === roleId), task); };
      for (const m of ['lite', 'official']) for (const role of ['villager', 'seer', 'werewolf']) out[m + ':' + role] = build(m, role);
      return out;
    });
    assert.equal(r.fresh, 'lite', `${file}: 新用户默认应是精简官方`);
    assert.equal(r.migrated, 'lite', `${file}: 旧存档的官方教学应迁移到精简官方`);
    assert.equal(r.keptFull, 'official', `${file}: 迁移过后手动选的完整官方要保留`);
    assert.equal(r.keptClean, 'clean', `${file}: 其他模式不受迁移影响`);
    for (const role of ['villager', 'seer', 'werewolf']) {
      const lite = r['lite:' + role], full = r['official:' + role];
      assert.ok(lite.length < full.length * 0.6, `${file} ${role}: 精简版应明显短于完整版（${lite.length} vs ${full.length}）`);
      assert.ok(lite.includes('【几件容易看错的事】') && lite.includes('【你能用什么】'), `${file} ${role}: 精简核心没注入`);
      for (const heavy of ['【证据等级】', '【时点知识账本', '【算一算别人要付什么代价', '【官方战术理解']) assert.ok(!lite.includes(heavy), `${file} ${role}: 精简版里还有 ${heavy}`);
      assert.ok(full.includes('【证据等级】'), `${file} ${role}: 完整官方应保留方法论`);
      for (const keep of ['【说人话', '【口气', '【本局配置】']) assert.ok(lite.includes(keep), `${file} ${role}: 精简版丢了 ${keep}`);
    }
    assert.ok(r['lite:villager'].includes('【别人打过的几局'), `${file}: 精简版应带经验库`);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${file}: lite ${r['lite:villager'].length} / full ${r['official:villager'].length} chars (villager)`);
  });
}
console.log('lite teaching: default, migration, size and content checks OK');
