// 千屿行写实画风：写实（精美/省电）和水墨三种配置都要能编译所有着色器、进入游戏不报错；
// 设置里的「画风」切换会存下并重新载入。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

for (const [real, quality] of [[1, 2], [1, 0], [0, 2]]) {
  await withOfflinePage(async (page, origin) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { const t = m.text(); if (/shader error|program not valid|WebGLProgram|THREE\./.test(t) && m.type() !== 'log') errors.push(t.slice(0, 300)); });
    await page.addInitScript(([real, quality]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('qianyu-xing-settings-v1', JSON.stringify({ quality, music: 0, sfx: 0, autoCam: 1, sens: 1, real }));
        sessionStorage.setItem('seeded', '1');
      }
    }, [real, quality]);
    await page.goto(origin + '/qianyuxing/index.html');
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    await page.click('#t-go');
    await page.waitForFunction(() => __qyxState().state === 'play', null, { timeout: 30000 });
    await page.waitForTimeout(3000);
    assert.deepEqual(errors, [], `real=${real} quality=${quality}: ${errors.join('\n')}`);
    if (real === 1 && quality === 2) {
      // 设置里切到水墨：存下 real=0 并重新载入
      await page.evaluate(() => document.querySelector('#m-menu').click());
      await page.waitForTimeout(300);
      const nav = page.waitForEvent('load', { timeout: 30000 });
      await page.evaluate(() => document.querySelector('#set-rl .tab[data-v="0"]').click());
      await nav;
      const st = await page.evaluate(() => JSON.parse(localStorage.getItem('qianyu-xing-settings-v1')));
      assert.equal(st.real, 0, '画风设置没有存下来');
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
      assert.deepEqual(errors, [], errors.join('\n'));
    }
    console.log(`qianyuxing style real=${real} quality=${quality}: shaders compile, game runs`);
  });
}
console.log('qianyuxing realistic style OK');
