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
  // ── 场景 3：每人一个会议脑 —— API 库轮流分配 / 按座位指定，发言和终局表带模型标签 ──
  const roster = await page.evaluate(() => {
    const players = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i }));
    const entries = [{ id: 'av_a', name: 'A', model: 'model-a', url: 'u', key: 'k', provider: 'custom' }, { id: 'av_b', name: 'B', model: 'model-b', url: 'u', key: 'k', provider: 'custom' }, { id: 'av_c', name: 'C', model: 'model-c', url: 'u', key: 'k', provider: 'custom' }];
    let seed = 1; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
    const pool = SpaceWolf._assignRoster(players, { mode: 'pool', pool: ['av_a', 'av_b', 'av_c'] }, entries, rnd);
    const count = {}; players.forEach(p => { const m = pool[p.id].model; count[m] = (count[m] || 0) + 1; });
    const manual = SpaceWolf._assignRoster(players, { mode: 'manual', manual: { 0: 'av_c', 3: 'av_a', 5: 'av_zzz' } }, entries, rnd);
    const shared = SpaceWolf._assignRoster(players, { mode: 'shared', pool: ['av_a'] }, entries, rnd);
    const empty = SpaceWolf._assignRoster(players, { mode: 'pool', pool: ['av_zzz'] }, entries, rnd);
    return { count, manual: players.map(p => manual[p.id] ? manual[p.id].model : null), shared: Object.keys(shared).length, empty: Object.keys(empty).length, label: SpaceWolf._modelLabel('openai/gpt-4o-mini') };
  });
  assert.deepEqual(Object.values(roster.count).sort(), [2, 3, 3], '3 条配置 8 个人应轮流分成 3、3、2：' + JSON.stringify(roster.count));
  assert.deepEqual(roster.manual, ['model-c', null, null, 'model-a', null, null, null, null], '手动指定应按座位号落到人头：' + JSON.stringify(roster.manual));
  assert.equal(roster.shared, 0, '共用模式不该分配任何人');
  assert.equal(roster.empty, 0, '池里没有可用条目时不该分配');
  assert.ok(roster.label && roster.label.length <= 14, '模型标签应是短名');

  await page.click('#sw-restart');
  await page.waitForSelector('#sw-start');
  await page.evaluate(() => {
    localStorage.setItem('wg_apivault', JSON.stringify([
      { id: 'av_x', name: '甲', model: 'model-x', url: 'http://127.0.0.1:9/v1', key: 'kx' },
      { id: 'av_y', name: '乙', model: 'model-y', url: '', key: '' },
      { id: 'av_nomodel', name: '没模型', url: 'http://127.0.0.1:9/v1', key: 'k', model: '' }
    ]));
    $('g-url').value = 'http://127.0.0.1:9/v1'; $('g-key').value = 'k';
    SpaceWolf.close(); SpaceWolf.open();
  });
  await page.waitForSelector('#sw-start');
  const vault = await page.evaluate(() => SpaceWolf._vaultEntries().map(e => ({ id: e.id, model: e.model, url: e.url, key: e.key })));
  assert.deepEqual(vault.map(v => v.id), ['av_x', 'av_y'], 'API 库里没有模型名的条目不该出现：' + JSON.stringify(vault));
  assert.equal(vault[1].url, 'http://127.0.0.1:9/v1', 'API 库条目缺 url 时应用狼人杀全局配置补齐：' + JSON.stringify(vault[1]));
  await page.evaluate(() => {
    window.__speakers = {};
    window.AuxGameAPI.request = async (api, sys, user) => {
      const me = (sys.match(/你是(\S+?)，身份/) || [])[1];
      const imp = sys.includes('身份：内鬼');
      if (sys.includes('现在是紧急会议')) {
        if (user.includes('现在投票')) return '<thinking>x</thinking><vote>skip</vote>';
        window.__speakers[me] = api.model;
        return `<thinking>x</thinking><say>我是 ${api.model}，刚才在电力室。</say><claims>{"rooms":["电力室"],"seen":[]}</claims>`;
      }
      await new Promise(r => setTimeout(r, 50));
      if (imp) { const aliveLine = (user.match(/【存活】([^\n]+)/) || [])[1] || ''; const target = aliveLine.split('、').map(s => s.trim()).find(c => c && c !== me) || ''; return `{"plan":"hunt","target":"${target}","kill":{"target":"${target}","allowWitness":false},"seconds":40}`; }
      // 船员先去按紧急按钮，保证本场景一定开一次会（任务做完得太快会直接结束对局）；开过会后再做任务
      return Object.keys(window.__speakers).length ? '{"plan":"task"}' : '{"plan":"button"}';
    };
    $('sw-c-players').value = '7'; $('sw-c-imps').value = '1'; $('sw-c-tasks').value = '3'; $('sw-c-cd').value = '15';
    $('sw-c-demo').checked = false; $('sw-c-interval').value = '4'; $('sw-c-conc').value = '8';
    $('sw-a-prov').value = 'custom'; $('sw-a-url').value = 'http://127.0.0.1:9/v1'; $('sw-a-key').value = 'k'; $('sw-a-model').value = 'stub';
    $('sw-r-mode').value = 'pool';
    ['sw-c-players', 'sw-c-imps', 'sw-c-tasks', 'sw-c-cd', 'sw-c-demo', 'sw-c-interval', 'sw-c-conc', 'sw-a-prov', 'sw-a-url', 'sw-a-key', 'sw-a-model', 'sw-r-mode'].forEach(id => $(id).dispatchEvent(new Event('change')));
    document.querySelectorAll('#sw-r-pool input[type=checkbox]').forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change')); });
  });
  assert.equal(await page.$eval('#sw-r-pool', e => e.style.display), '', '选择轮流分配后应显示 API 库勾选列表');
  assert.deepEqual(await page.evaluate(() => SpaceWolf._cfg().roster), { mode: 'pool', pool: ['av_x', 'av_y'], manual: {} }, '勾选应写进配置');
  await page.click('#sw-start');
  await page.waitForSelector('#sw-game .sw-av');
  const seats = await page.evaluate(() => { const G = SpaceWolf._state.G; const count = {}; G.players.forEach(p => { const m = p.api && p.api.model; count[m] = (count[m] || 0) + 1; }); return { count, labels: G.players.map(p => p.modelLabel), avatars: document.querySelectorAll('#sw-game .sw-av-model').length, cards: document.querySelectorAll('#sw-crew .sw-model').length }; });
  assert.deepEqual(Object.values(seats.count).sort(), [3, 4], '两条配置 7 个人应分成 4、3：' + JSON.stringify(seats.count));
  assert.ok(seats.labels.every(Boolean), '每个人都应有模型标签');
  assert.equal(seats.avatars, 7, '地图小人头上应标模型');
  assert.equal(seats.cards, 7, '船员卡应带模型标签');
  await page.click('#sw-speed [data-s="8"]');
  await page.waitForFunction(() => { const G = SpaceWolf._state.G; return G && (G.meetings.some(m => m.result) || G.phase === 'ended'); }, null, { timeout: 240000 });
  const g3 = await page.evaluate(() => { const G = SpaceWolf._state.G; const byColor = {}; G.players.forEach(p => { byColor[p.color] = p.api.model; }); const wrong = Object.entries(window.__speakers).filter(([who, m]) => byColor[who] !== m); const texts = G.meetings.flatMap(m => m.speeches.map(s => ({ who: G.players.find(p => p.id === s.playerId).api.model, text: s.text }))); return { speakers: Object.keys(window.__speakers).length, wrong, textMismatch: texts.filter(t => !t.text.includes(t.who)).length, models: new Set(Object.values(window.__speakers)).size, speechTags: document.querySelectorAll('#sw-meeting .sw-model').length, speeches: G.meetings.reduce((n, m) => n + m.speeches.length, 0) }; });
  console.log('roster game:', JSON.stringify(g3).slice(0, 300));
  assert.ok(g3.speakers > 0, '会议脑没有被调用');
  assert.equal(g3.wrong.length, 0, '发言时用的模型应是该座位分到的那条：' + JSON.stringify(g3.wrong));
  assert.equal(g3.textMismatch, 0, '发言记录应来自座位自己的模型');
  assert.ok(g3.models >= 2 || g3.speakers < 2, '多人发言时应至少用到两个模型');
  assert.equal(g3.speechTags, g3.speeches, '会议页每条发言都应带模型标签');
  const ended = await page.evaluate(() => SpaceWolf._state.G.phase === 'ended');
  if (!ended) { await page.evaluate(() => { const G = SpaceWolf._state.G; G.players.filter(p => p.role === 'impostor').forEach(p => { p.alive = false; p.ejected = true; }); }); await page.waitForFunction(() => SpaceWolf._state.G.phase === 'ended', null, { timeout: 60000 }); }
  const end = await page.evaluate(() => ({ tags: document.querySelectorAll('#sw-end table .sw-model').length, sum: !!document.querySelector('#sw-end .sw-model-sum'), sumRows: document.querySelectorAll('#sw-end .sw-model-sum .sw-model').length, exported: SpaceWolf._exportData().players.map(p => p.model) }));
  assert.equal(end.tags, 7, '终局表每人应带模型标签');
  assert.ok(end.sum && end.sumRows === 2, '两个模型同桌应有按模型汇总：' + JSON.stringify(end));
  assert.deepEqual(end.exported.filter(Boolean).length, 7, '导出的回放应带每人的模型');

  await page.evaluate(() => SpaceWolf.close());
  assert.ok(await page.$eval('#mm', e => e.style.display !== 'none'), '关闭后应回到大厅');

  const bad = errors.filter(e => !/favicon|ERR_FAILED|supabase/i.test(e));
  assert.equal(bad.length, 0, '页面报错：' + bad.join('\n'));
  console.log('spacewolf: wiring, demo game to the end, replay, stub-API brains, meeting and per-seat models OK');
});
