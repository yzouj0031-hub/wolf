// 千屿行村屋可以进出：从村长家门口往里走能进到堂屋（弹出屋名），往里走不会穿过后墙；
// 从侧面撞墙进不去。写实和水墨两种画风都要成立。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

// 按住前进直到位置不再变化（软件渲染帧率低，按时长算不准走了多远）
const walk = async (page, maxMs) => {
  await page.keyboard.down('w');
  let last = null, still = 0;
  for (let t = 0; t < maxMs; t += 500) {
    await page.waitForTimeout(500);
    const p = await page.evaluate(() => __qyxState().pos);
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.05) { if (++still >= 6) break; } else still = 0;
    last = p;
  }
  await page.keyboard.up('w'); await page.waitForTimeout(300);
};

for (const real of [1, 0]) {
  for (const [label, start, facing, check] of [
    // 村长家：中心 (25,262)，进深 8，前门朝 +z（z=266），后墙内侧 z≈258.2
    ['door', [25, 270], Math.PI, (p, toast) => { assert.ok(p[1] < 265.2 && p[1] > 258.2, `没从门口走进屋：${p}`); assert.ok(/堂屋/.test(toast), `进门没有提示屋名：${toast}`); }],
    // 东山墙外侧 x=30.5，往 -x 走会被墙挡住
    ['wall', [33, 263], -Math.PI / 2, (p) => { assert.ok(p[0] > 30.2, `穿墙进屋了：${p}`); }],
  ]) {
    await withOfflinePage(async (page, origin) => {
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(([real, x, z, f]) => {
        localStorage.setItem('qianyu-xing-settings-v1', JSON.stringify({ quality: 0, music: 0, sfx: 0, autoCam: 0, sens: 1, real }));
        localStorage.setItem('qianyu-xing-save-v1', JSON.stringify({ v: 1, pos: [x, 0, z], facing: f, hour: 10, day: 1, q: { m1: 'active' } }));
        // 提示几秒后会淡出移除，所以出现时就记下来
        window.__toasts = [];
        new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('toast')) window.__toasts.push(n.textContent); })
          .observe(document, { childList: true, subtree: true });
      }, [real, start[0], start[1], facing]);
      await page.goto(origin + '/qianyuxing/index.html');
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
      await page.click('#t-go');
      await page.waitForFunction(() => __qyxState().state === 'play', null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      for (let k = 0; k < 20 && await page.evaluate(() => __qyxState().dialog); k++) { await page.keyboard.press('Space'); await page.waitForTimeout(300); }
      await walk(page, 60000);   // 一直往前走到停下：门口能进屋、走到里面被陈设或后墙挡住；侧墙直接挡住
      const p = await page.evaluate(() => __qyxState().pos);
      const toast = await page.evaluate(() => window.__toasts.join('|'));
      check(p, toast);
      assert.deepEqual(errors, [], errors.join('\n'));
      console.log(`qianyuxing houses real=${real} ${label}: ${p.map(v => v.toFixed(1)).join(',')}`);
    });
  }
}
console.log('qianyuxing enterable houses OK');
