// 千屿行手柄：用假手柄走一遍 标题开始 → 左摇杆移动 → A 跳 → 菜单键开菜单、十字键移高亮、B 关闭 → 视图键地图 → 对话 A 翻页
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

await withOfflinePage(async (page, origin) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const mk = () => ({ id: 'Fake Xbox Controller', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) });
    window.__pad = mk();
    navigator.getGamepads = () => [window.__pad];
    window.__btn = (i, on) => { window.__pad.buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; };
  });
  await page.goto(origin + '/qianyuxing/index.html');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const tap = async (i) => { await page.evaluate(i => window.__btn(i, true), i); await page.waitForTimeout(250); await page.evaluate(i => window.__btn(i, false), i); await page.waitForTimeout(250); };

  // 标题：A 开始旅程
  assert.equal(await page.evaluate(() => __qyxState().state), 'title');
  await tap(0);
  await page.waitForFunction(() => __qyxState().state === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  // 开场可能有对话：A 翻完
  for (let k = 0; k < 30 && await page.evaluate(() => __qyxState().dialog); k++) await tap(0);

  // 左摇杆向前走
  const p0 = await page.evaluate(() => __qyxState().pos);
  await page.evaluate(() => { window.__pad.axes[1] = -1; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__pad.axes[1] = 0; });
  const p1 = await page.evaluate(() => __qyxState().pos);
  const moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  assert.ok(moved > 0.3, `左摇杆没有让角色移动（${moved.toFixed(2)}）`);

  // A 跳
  await page.evaluate(() => { window.__states = []; const t = setInterval(() => window.__states.push(__qyxState().pstate), 30); setTimeout(() => clearInterval(t), 900); });
  await tap(0);
  await page.waitForTimeout(700);
  const states = await page.evaluate(() => window.__states);
  assert.ok(states.includes('air'), `A 没有起跳：${[...new Set(states)].join(',')}`);
  await page.waitForTimeout(1200);

  // 右摇杆转视角
  const yaw0 = await page.evaluate(() => __qyxState().yaw);
  await page.evaluate(() => { window.__pad.axes[2] = 1; });
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__pad.axes[2] = 0; });
  assert.ok(Math.abs(await page.evaluate(() => __qyxState().yaw) - yaw0) > 0.1, '右摇杆没有转动视角');

  // 菜单键开菜单 → 十字键移动高亮 → B 关闭
  await tap(9);
  assert.equal(await page.evaluate(() => __qyxState().modal), 'p-menu', '菜单键没有打开菜单');
  await tap(13);
  const f1 = await page.evaluate(() => __qyxState().focus);
  await tap(13);
  const f2 = await page.evaluate(() => __qyxState().focus);
  assert.ok(f1 && f2 && f1 !== f2, `十字键没有在菜单里移动高亮：${f1} → ${f2}`);
  await tap(1);
  assert.equal(await page.evaluate(() => __qyxState().modal), null, 'B 没有关闭菜单');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.pad-focus').length), 0, '关闭后高亮没清掉');

  // 视图键地图、RB 背包
  await tap(8);
  assert.equal(await page.evaluate(() => __qyxState().modal), 'p-map', '视图键没有打开地图');
  await tap(1);
  await tap(5);
  assert.equal(await page.evaluate(() => __qyxState().modal), 'p-bag', 'RB 没有打开背包');
  await tap(1);

  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(`qianyuxing gamepad: title start, move (${moved.toFixed(1)}m), jump, camera, menu focus, map, bag OK`);
});
