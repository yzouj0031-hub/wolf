// 千屿行物理：剑砍碎缸子、走过去能把水桶推开、轻点跳比按住跳低。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

async function boot(page, origin, x, z, facing) {
  await page.addInitScript(([x, z, f]) => {
    localStorage.setItem('qianyu-xing-settings-v1', JSON.stringify({ quality: 0, music: 0, sfx: 0, autoCam: 0, sens: 1, real: 1 }));
    localStorage.setItem('qianyu-xing-save-v1', JSON.stringify({ v: 1, pos: [x, 0, z], facing: f, hour: 10, day: 1, q: { m1: 'active' } }));
  }, [x, z, facing]);
  await page.goto(origin + '/qianyuxing/index.html');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.click('#t-go');
  await page.waitForFunction(() => __qyxState().state === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  for (let k = 0; k < 20 && await page.evaluate(() => __qyxState().dialog); k++) { await page.keyboard.press('Space'); await page.waitForTimeout(300); }
}
// 先在一个页面里读出物件的位置，再按位置摆人
let bodies;
await withOfflinePage(async (page, origin) => { await boot(page, origin, 25, 312, 0); bodies = await page.evaluate(() => __qyxBodies()); });
assert.ok(bodies.length > 20, `物件太少：${bodies.length}`);
const jar = bodies.find(b => b.kind === 'jar'), bucket = bodies.find(b => b.kind === 'bucket');

// 1. 剑砍缸子：缸子碎掉
await withOfflinePage(async (page, origin) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const a = 0.9, x = jar.x - Math.sin(a) * 1.5, z = jar.z - Math.cos(a) * 1.5;
  await boot(page, origin, x, z, a);
  const i = (await page.evaluate(() => __qyxBodies())).findIndex(b => b.kind === 'jar' && Math.abs(b.x - x) < 3 && Math.abs(b.z - z) < 3);
  for (let k = 0; k < 3; k++) { await page.keyboard.press('j'); await page.waitForTimeout(1200); }
  const after = await page.evaluate(() => __qyxBodies());
  const hit = after.filter(b => b.kind === 'jar' && b.broken);
  assert.ok(hit.length >= 1, `剑没有砍碎缸子：${JSON.stringify(after[i])}`);
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log(`physics: sword broke ${hit.length} jar(s)`);
});

// 2. 推水桶：朝它走过去，它会被推开或撞倒
await withOfflinePage(async (page, origin) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const a = -1.2, x = bucket.x - Math.sin(a) * 2.5, z = bucket.z - Math.cos(a) * 2.5;
  await boot(page, origin, x, z, a);
  const b0 = (await page.evaluate(() => __qyxBodies())).find(b => b.kind === 'bucket' && Math.hypot(b.x - bucket.x, b.z - bucket.z) < 0.5);
  await page.keyboard.down('w');
  let moved = 0;
  for (let t = 0; t < 40 && moved < 0.4; t++) {
    await page.waitForTimeout(500);
    const now = (await page.evaluate(() => __qyxBodies())).filter(b => b.kind === 'bucket');
    moved = Math.max(...now.map(b => Math.hypot(b.x - b0.x, b.z - b0.z) < 4 ? Math.hypot(b.x - b0.x, b.z - b0.z) : 0));
  }
  await page.keyboard.up('w');
  assert.ok(moved >= 0.4, `走过去没把水桶推开（${moved.toFixed(2)}m）`);
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log(`physics: bucket pushed ${moved.toFixed(2)}m`);
});

// 3. 跳：轻点比按住低
await withOfflinePage(async (page, origin) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await boot(page, origin, 25, 305, 0);
  const jump = async (holdMs) => {
    await page.evaluate(() => { window.__ys = []; window.__yt = setInterval(() => window.__ys.push(__qyxState().py), 10); });
    const y0 = await page.evaluate(() => __qyxState().py);
    await page.keyboard.down('Space'); await page.waitForTimeout(holdMs); await page.keyboard.up('Space');
    await page.waitForTimeout(3500);
    const ys = await page.evaluate(() => { clearInterval(window.__yt); return window.__ys; });
    return Math.max(...ys) - y0;
  };
  const tap = await jump(15), hold = await jump(3000);   // 软件渲染帧率低，按住要够久才覆盖整个上升段
  assert.ok(hold > 0.9, `按住跳太低：${hold.toFixed(2)}`);
  assert.ok(hold - tap > 0.15, `轻点和按住跳一样高：tap ${tap.toFixed(2)} hold ${hold.toFixed(2)}`);
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log(`physics: jump tap ${tap.toFixed(2)}m, hold ${hold.toFixed(2)}m`);
});
console.log('qianyuxing physics OK');
