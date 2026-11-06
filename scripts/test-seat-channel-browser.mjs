// 座位渠道：全局切到 Claude 官方时，单独配了别家地址的座位按自己的地址判断格式；座位也能自己选渠道
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';
for (const file of ['index.html', 'en/index.html']) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const $ = id => document.getElementById(id);
      $('g-apitype').value = 'anthropic'; $('g-url').value = 'https://api.anthropic.com'; $('g-key').value = 'k'; $('g-model').value = 'claude-opus-5-5';
      for (const k in playerConfigs) delete playerConfigs[k];
      playerConfigs[1] = { url: 'https://relay.example.com/v1', key: 'k2', model: 'agy-gemini-4-argon' };          // 中转，没选渠道
      playerConfigs[2] = { url: 'https://api.anthropic.com/', model: 'claude-sonnet-5-5' };                          // 和全局同一个地址
      playerConfigs[3] = { url: 'https://claude-relay.example.com', model: 'claude-x', apiType: 'custom-anthropic' }; // 中转，选了 Anthropic 格式
      playerConfigs[4] = { url: 'https://generativelanguage.googleapis.com', model: 'gemini-x' };                    // Gemini 官方地址
      const out = { p0: getAPI(0).type, p1: getAPI(1).type, p2: getAPI(2).type, p3: getAPI(3).type, p4: getAPI(4).type };
      // 面板：打开 P2 的命牌，选渠道并保存，再打开回显
      openPCfg(1);
      out.optCount = $('pc-apitype').options.length; out.shownAuto = $('pc-apitype').value;
      $('pc-apitype').value = 'custom-gemini'; savePCfg();
      out.saved = playerConfigs[1].apiType; out.p1After = getAPI(1).type;
      openPCfg(1); out.shownAfter = $('pc-apitype').value;
      $('pc-apitype').value = ''; savePCfg(); out.cleared = 'apiType' in playerConfigs[1]; out.p1Auto = getAPI(1).type;
      return out;
    });
    assert.equal(r.p0, 'anthropic', `${file}: 没单独配地址的座位跟全局`);
    assert.equal(r.p1, 'openai', `${file}: 单独配了中转地址的座位不能沿用全局的 Anthropic 格式`);
    assert.equal(r.p2, 'anthropic', `${file}: 座位地址就是全局地址时跟全局渠道`);
    assert.equal(r.p3, 'anthropic', `${file}: 座位自己选的渠道优先`);
    assert.equal(r.p4, 'gemini', `${file}: Gemini 官方地址按地址判断`);
    assert.ok(r.optCount > 5 && r.shownAuto === '', `${file}: 命牌面板的渠道下拉没填好 ${JSON.stringify(r)}`);
    assert.equal(r.saved, 'custom-gemini'); assert.equal(r.p1After, 'gemini'); assert.equal(r.shownAfter, 'custom-gemini', `${file}: 渠道没回显`);
    assert.equal(r.cleared, false, `${file}: 选回自动应删掉 apiType`); assert.equal(r.p1Auto, 'openai');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`${file}: seat channels ok`);
  });
}
console.log('seat channel: per-seat type, address-based inference, panel save and echo OK');
