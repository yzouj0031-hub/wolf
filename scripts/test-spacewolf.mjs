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
  assert.notEqual(g1.replay, 'none', '终局后应显示复盘台');
  if (g1.meetings) {
    const mt = await page.evaluate(() => $('sw-meeting').textContent);
    assert.ok(mt.includes('次会议'), '会议面板没有内容');
  }
  // ── 复盘台：时间轴标记、跳事件、播放、跟随轨迹、同步面板、导入 ──
  const rp = await page.evaluate(async () => {
    const S = SpaceWolf, G = S._state.G, RP = S._rp;
    const marks = document.querySelectorAll('#sw-tl-marks .sw-tl-mark').length;
    const visible = G.events.filter(e => ['kill', 'bodySeen', 'meeting', 'vote', 'end'].includes(e.type)).length;
    const dur = RP.dur;
    // 回放打开时，实时循环不能再把地图画回终局：拖到 0 后小人应停在开局位置（食堂）
    S._rpSeek(0); await new Promise(r => setTimeout(r, 120));
    const atStart = document.querySelector('#sw-g-av .sw-av').getAttribute('transform');
    const timeAtStart = document.getElementById('sw-rp-time').textContent;
    // 跳到下一个事件
    S._rpJump(1); const t1 = RP.t;
    const firstMark = G.events.find(e => ['kill', 'bodySeen', 'meeting', 'vote', 'end'].includes(e.type));
    // 跟随第一个人：有轨迹线、回放页有他的见闻
    const sel = document.getElementById('sw-rp-follow'); sel.value = '0'; sel.dispatchEvent(new Event('change'));
    S._rpSeek(Math.min(dur, 30000));
    const trail = document.querySelector('#sw-g-trail polyline');
    const followed = document.querySelector('#sw-g-av .sw-av.follow');
    const paneText = document.getElementById('sw-rp-pane').textContent;
    // 播放：时间前进；暂停后停住
    S._rpSeek(0); S._rpTogglePlay(); await new Promise(r => setTimeout(r, 400)); const tPlay = RP.t; S._rpTogglePlay(); await new Promise(r => setTimeout(r, 200)); const tStop = RP.t;
    // 会议页同步：第一次会议之前显示"还没有开过会"，之后显示会议
    const me = G.events.find(e => e.type === 'meeting');
    let meetingBefore = '', meetingAfter = '';
    if (me) { S._rpSeek(Math.max(0, me.t - 1000)); meetingBefore = document.getElementById('sw-meeting').textContent; S._rpSeek(me.t + 1); meetingAfter = document.getElementById('sw-meeting').textContent; }
    // 上帝视角关掉：击杀标记消失
    document.getElementById('sw-god').click(); const marksNoGod = document.querySelectorAll('#sw-tl-marks .sw-tl-mark.kill').length; document.getElementById('sw-god').click();
    // 导入：导出的 JSON 再导回来，复盘台照样能开
    const data = JSON.parse(JSON.stringify(S._exportData()));
    S._rpImport(data);
    const imported = { on: S._rp.on, marks: document.querySelectorAll('#sw-tl-marks .sw-tl-mark').length, players: S._state.G.players.length, end: document.getElementById('sw-end').textContent.includes('获胜') };
    return { marks, visible, dur, atStart, timeAtStart, t1, firstT: firstMark && firstMark.t, trail: !!trail, followed: !!followed, paneHasFollow: paneText.includes('为止的见闻'), tPlay, tStop, me: !!me, meetingBefore, meetingAfter, marksNoGod, imported };
  });
  assert.equal(rp.marks, rp.visible, '时间轴标记数应等于可见事件数');
  assert.ok(rp.dur > 0 && /00:00/.test(rp.timeAtStart), '拖到 0 时时间应为 00:00：' + rp.timeAtStart);
  assert.ok(rp.atStart && /translate\(/.test(rp.atStart), '回放应接管地图渲染');
  assert.equal(rp.t1, rp.firstT, '⏭ 应跳到第一个事件');
  assert.ok(rp.trail && rp.followed && rp.paneHasFollow, '跟随模式应画轨迹、加亮小人并在回放页显示见闻');
  assert.ok(rp.tPlay > 0 && Math.abs(rp.tStop - rp.tPlay) < 1500, '播放应前进、暂停应停住：' + rp.tPlay + ' ' + rp.tStop);
  if (rp.me) { assert.ok(rp.meetingBefore.includes('还没有开过会'), '会议前应提示还没开会'); assert.ok(rp.meetingAfter.includes('次会议'), '会议后应显示会议内容'); }
  assert.equal(rp.marksNoGod, 0, '非上帝视角不该显示击杀标记');
  assert.ok(rp.imported.on && rp.imported.marks === rp.marks && rp.imported.players === 7 && rp.imported.end, '导入回放后复盘台应能打开：' + JSON.stringify(rp.imported));

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
