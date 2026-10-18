// 🚀 太空狼人杀：页面接线 + 无头浏览器里跑一局脚本演示到终局 + 桩 API 跑一次会议。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withOfflinePage } from './lib/offline-browser.mjs';

// ── 接线 ──
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('data-mode="spacewolf"'), '大厅没有太空狼人杀卡片');
assert.ok(html.includes("else if (mode === 'spacewolf') openSpaceWolf();"), '大厅没有分发到太空狼人杀');
assert.ok(html.includes('<link rel="stylesheet" href="./spacewolf.css">'), '样式未加载');
assert.ok(html.includes('<script src="./spacewolf-engine.js"></script>') && html.includes('<script src="./spacewolf.js"></script>'), '脚本未加载');
assert.ok(html.indexOf('<script src="./spacewolf.js">') > html.indexOf('<script src="./mystery.js">'), '太空狼人杀要在 mystery.js（多渠道请求层）之后加载');
assert.ok(fs.existsSync('icons/modes/spacewolf.svg'), '缺少模式图');
const sw = fs.readFileSync('sw.js', 'utf8');
for (const f of ['./spacewolf-engine.js', './spacewolf.js', './spacewolf.css']) assert.ok(sw.includes(`'${f}'`), `PWA 缓存清单缺 ${f}`);
const build = fs.readFileSync('scripts/build-www.mjs', 'utf8');
for (const f of ['spacewolf-engine.js', 'spacewolf.js', 'spacewolf.css']) assert.ok(build.includes(`'${f}'`), `APK 打包清单缺 ${f}`);
const js = fs.readFileSync('spacewolf.js', 'utf8');
assert.ok(!/callAI\(|buildSystemPrompt\(|\bS\.players\b/.test(js), '太空狼人杀必须独立于狼人杀主引擎');
assert.ok(js.includes('流程已暂停，不会自动跳过'), '会议发言失败必须暂停询问');

await withOfflinePage(async (page, origin) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/index.html');
  await page.waitForFunction(() => window.SpaceWolf && window.SpaceWolfEngine && window.AuxGameAPI);

  // 解析助手
  const parsed = await page.evaluate(() => [
    SpaceWolf._parseJson('好的。{"plan":"task","room":"电力室","note":"去接线",}'),
    SpaceWolf._parseJson('<thinking>{"plan":"x"}</thinking>{"plan":"hunt","target":"蓝","kill":{"target":"蓝","allowWitness":false}}'),
    SpaceWolf._tag('<say>我在食堂</say><claims>{"rooms":["食堂"]}</claims>', 'claims')
  ]);
  assert.equal(parsed[0].plan, 'task'); assert.equal(parsed[0].room, '电力室');
  assert.equal(parsed[1].plan, 'hunt'); assert.equal(parsed[1].kill.target, '蓝');
  assert.equal(parsed[2], '{"rooms":["食堂"]}');

  // ── 场景 1：纯脚本演示，8 倍速跑到终局 ──
  await page.evaluate(() => { localStorage.removeItem('wg_spacewolf_v1'); SpaceWolf.open(); });
  await page.waitForSelector('#sw-view.on');
  await page.waitForSelector('#sw-start');
  await page.evaluate(() => {
    $('sw-c-players').value = '7'; $('sw-c-imps').value = '1'; $('sw-c-tasks').value = '2'; $('sw-c-cd').value = '15';
    $('sw-c-demo').checked = true;
    ['sw-c-players', 'sw-c-imps', 'sw-c-tasks', 'sw-c-cd', 'sw-c-demo'].forEach(id => $(id).dispatchEvent(new Event('change')));
  });
  await page.click('#sw-start');
  await page.waitForSelector('#sw-game .sw-av');
  await page.click('#sw-speed [data-s="8"]');
  const avatars = await page.$$eval('#sw-g-av .sw-av', els => els.length);
  assert.equal(avatars, 7, '地图上宇航员数量不对');
  assert.equal(await page.$$eval('#sw-g-rooms rect', els => els.length), 14, '房间数量不对');
  await page.waitForFunction(() => SpaceWolf._state.G && SpaceWolf._state.G.phase === 'ended', null, { timeout: 240000 });
  const g1 = await page.evaluate(() => { const G = SpaceWolf._state.G; return { winner: G.winner, t: G.t, meetings: G.meetings.length, kills: G.events.filter(e => e.type === 'kill').length, frames: SpaceWolf._state.frames.length, logLines: document.querySelectorAll('#sw-log .sw-log-line').length, end: $('sw-end').textContent, replay: $('sw-replay').style.display }; });
  console.log('demo game:', g1.winner, Math.round(g1.t / 1000) + 's', 'meetings', g1.meetings, 'kills', g1.kills, 'frames', g1.frames);
  assert.ok(['crew', 'impostor'].includes(g1.winner));
  assert.ok(g1.end.includes('获胜'), '终局面板没有显示胜负');
  assert.ok(g1.frames > 10, '回放帧太少');
  assert.ok(g1.logLines > 5, '上帝日志太少');
  assert.notEqual(g1.replay, 'none', '终局后应显示回放条');
  if (g1.meetings) {
    const mt = await page.evaluate(() => $('sw-meeting').textContent);
    assert.ok(mt.includes('次会议'), '会议面板没有内容');
  }
  // 回放：拖到中间，位置变化
  await page.evaluate(() => { const r = $('sw-replay-range'); r.value = Math.floor(+r.max / 2); r.dispatchEvent(new Event('input')); });
  const replayTime = await page.$eval('#sw-replay-time', e => e.textContent);
  assert.ok(/^\d\d:\d\d$/.test(replayTime));

  // ── 场景 2：桩 API —— 行动脑给 JSON、会议脑给 say/claims/vote，跑到第一次会议结束 ──
  await page.click('#sw-restart');
  await page.waitForSelector('#sw-start');
  await page.evaluate(() => {
    window.__calls = { action: 0, speech: 0, vote: 0 };
    window.AuxGameAPI.request = async (api, sys, user) => {
      const me = (sys.match(/你是(\S+?)，身份/) || [])[1];
      const imp = sys.includes('身份：内鬼');
      if (sys.includes('现在是紧急会议')) {
        if (user.includes('现在投票')) { window.__calls.vote++; const others = (user.match(/可投的人：([^，\n]+(?:、[^，\n]+)*)/) || [])[1]; const first = others ? others.split('、')[0] : 'skip'; return `<thinking>随便</thinking><vote>${imp ? first : 'skip'}</vote>`; }
        window.__calls.speech++;
        return `<thinking>盘算一下</thinking><say>我这段时间在电力室和仓库做任务，没看到可疑的人。</say><claims>{"rooms":["电力室","仓库"],"seen":[]}</claims>`;
      }
      window.__calls.action++;
      await new Promise(r => setTimeout(r, 50));
      if (imp) {
        const aliveLine = (user.match(/【存活】([^\n]+)/) || [])[1] || '';
        const target = aliveLine.split('、').map(s => s.trim()).find(c => c && c !== me) || '';
        return `{"plan":"hunt","target":"${target}","kill":{"target":"${target}","allowWitness":false},"seconds":40,"note":"桩：盯住${target}"}`;
      }
      return '{"plan":"task","note":"桩：做任务"}';
    };
    $('sw-c-players').value = '7'; $('sw-c-imps').value = '1'; $('sw-c-tasks').value = '3'; $('sw-c-cd').value = '15';
    $('sw-c-demo').checked = false; $('sw-c-interval').value = '4'; $('sw-c-conc').value = '8';
    $('sw-a-prov').value = 'custom'; $('sw-a-url').value = 'http://127.0.0.1:9/v1'; $('sw-a-key').value = 'k'; $('sw-a-model').value = 'stub';
    ['sw-c-players', 'sw-c-imps', 'sw-c-tasks', 'sw-c-cd', 'sw-c-demo', 'sw-c-interval', 'sw-c-conc', 'sw-a-prov', 'sw-a-url', 'sw-a-key', 'sw-a-model'].forEach(id => $(id).dispatchEvent(new Event('change')));
  });
  await page.click('#sw-start');
  await page.waitForSelector('#sw-game .sw-av');
  await page.click('#sw-speed [data-s="8"]');
  await page.waitForFunction(() => { const G = SpaceWolf._state.G; return G && (G.meetings.some(m => m.result) || G.phase === 'ended'); }, null, { timeout: 240000 });
  const g2 = await page.evaluate(() => { const G = SpaceWolf._state.G; return { calls: window.__calls, brainEvents: G.events.filter(e => e.type === 'brain').length, verify: G.events.filter(e => e.type === 'verify').map(e => e.text), meetings: G.meetings.map(m => ({ speeches: m.speeches.length, votes: Object.keys(m.votes).length, result: !!m.result, claims: m.speeches.filter(s => s.claims).length })), phase: G.phase, apiPlayers: G.players.filter(p => p.brain === 'api').length }; });
  console.log('stub game:', JSON.stringify(g2).slice(0, 400));
  assert.ok(g2.calls.action > 0, '行动脑没有被调用');
  assert.ok(g2.brainEvents > 0, '上帝日志里没有模型决定');
  if (g2.meetings.length) {
    assert.ok(g2.calls.speech > 0 && g2.calls.vote > 0, '会议脑没有被调用');
    assert.ok(g2.meetings[0].speeches > 0 && g2.meetings[0].claims > 0, '会议发言或口供没有记录');
    assert.ok(g2.verify.length > 0, '没有口供核验记录');
  }
  await page.evaluate(() => SpaceWolf.close());
  assert.ok(await page.$eval('#mm', e => e.style.display !== 'none'), '关闭后应回到大厅');

  const bad = errors.filter(e => !/favicon|ERR_FAILED|supabase/i.test(e));
  assert.equal(bad.length, 0, '页面报错：' + bad.join('\n'));
  console.log('spacewolf: wiring, demo game to the end, replay, stub-API brains and meeting OK');
});
