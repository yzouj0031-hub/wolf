// 参与者模式整局审计：用按格式作答的假 API 把一局从第一夜打到结束，记录每一次真正发出去的请求，确认
//   ① 系统提示里没有平铺的发言记录和时间轴协议，有参与者框架；
//   ② 公开事件只以"自你上次开口以来发生的事"进对话，同一轮的票型在一次请求里不会出现两遍；
//   ③ 判官没有被叫起来；记忆没有被摘要压缩。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

async function playOne(file, seed) {
  let result;
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    await page.evaluate(([seed]) => {
      TeachingWorldbooks.load({ mode: 'live', liteMigrated: true });
      $('g-url').value = 'https://api.example.test/v1'; $('g-key').value = 'k'; $('g-model').value = 'm';
      if ($('g-apitype')) $('g-apitype').value = 'openai';
      if ($('g-mem')) $('g-mem').value = '16';   // 窗口设得很小：参与者模式应当忽略它
      for (const [id, v] of [['m-kill-edge', true], ['m-single-round', false], ['m-sheriff-daily-order', true], ['m-hdeath', false]]) if ($(id)) $(id).checked = v;
      MODE_CONFIGS.auditLive = { name: 'audit', count: 12, roles: ['werewolf','werewolf','werewolf','wolfbeauty','seer','witch','hunter','guard','villager','villager','villager','villager'] };
      for (const k in playerConfigs) delete playerConfigs[k];
      S.mode = 'auditLive'; S.pureAI = true;
      let rnd = seed * 9301 + 49297; const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
      window.__reqs = [];
      window.fetch = async (url, init) => {
        const body = JSON.parse(init.body || '{}');
        const msgs = body.messages || [];
        window.__reqs.push({ sys: String((msgs[0] || {}).content || ''), users: msgs.filter(m => m.role === 'user').map(m => String(m.content || '')), n: msgs.length });
        const last = String((msgs[msgs.length - 1] || {}).content || '');
        const alive = S.players.filter(x => x.alive).map(x => x.name);
        const inPrompt = alive.filter(n => last.includes(n));
        const pick = inPrompt.length ? inPrompt[Math.floor(rand() * inPrompt.length)] : alive[0];
        const seat = S.players.find(x => x.name === pick);
        const P = seat ? 'P' + (seat.id + 1) : 'P1';
        let action = pick;
        if (/YES或NO|YES 或 NO/.test(last)) action = rand() < 0.4 ? 'YES' : 'NO';
        else if (/STAY或QUIT/.test(last)) action = 'STAY';
        else if (/SAVE/.test(last)) action = rand() < 0.5 ? 'SAVE' : 'NO_SAVE';
        else if (/CHARM\|P数字/.test(last)) action = 'CHARM|' + P;
        else if (/技能确认/.test(last)) action = 'PASS';
        else if (/P编号 或 None/.test(last)) action = P;
        else if (/猎人开枪/.test(last)) action = 'None';
        const game = `我觉得${pick}有点可疑，先听后面的。`;
        const content = `<thinking>想好了</thinking>\n<game>${game}</game>\n<action>${action}</action>\n<interrupt>no</interrupt>\n<notes>${pick}：五成。</notes>`;
        if (body.stream) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
      window.sleep = async () => {};
      startGame();
      S.auto = true; nextStep();
    }, [seed]);
    let lastN = -1, still = 0, over = false;
    for (let i = 0; i < 400 && !over; i++) {
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        if (!document.querySelector('#ocp.show')) return;
        const bs = [...document.querySelectorAll('#cp-grid button')];
        const i = bs.findIndex(x => /照用|确认跳过|确认按|跳过/.test(x.textContent));
        (bs[i >= 0 ? i : 0] || { click() {} }).click();
      });
      const st = await page.evaluate(() => ({ over: S.gameOver, n: window.__reqs.length }));
      over = st.over;
      if (st.n === lastN) { still++; if (still === 6) await page.evaluate(() => { S.auto = true; try { nextStep(); } catch (e) {} }); if (still > 20) break; }
      else { still = 0; lastN = st.n; }
    }
    const tail = await page.evaluate(() => ({
      reqs: window.__reqs,
      judgeAsked: (S._judgeStats && S._judgeStats.asked) || 0,
      compressed: S.players.some(p => p.memory.some(m => m.role === 'system' && /【历史记忆摘要/.test(m.content || ''))),
      notes: S.players.filter(p => p._liveNotes).length,
      seen: S.players.map(p => p._liveSeen || 0),
      hist: S.history.length,
      round: S.round
    }));
    result = { over, errors, ...tail };
  });
  return result;
}

const r = await playOne('index.html', 7);
assert.equal(r.errors.length, 0, r.errors.join('\n'));
assert.ok(r.over, `整局没有打完（${r.reqs.length} 次请求）`);
assert.ok(r.reqs.length > 60, `请求太少，审计没覆盖到整局（${r.reqs.length}）`);
assert.ok(r.round >= 2, `应至少打到第 2 天（第 ${r.round} 天）`);
for (const q of r.reqs) {
  if (!q.sys) continue;
  assert.ok(q.sys.includes('【你在打一局狼人杀】'), '系统提示缺少参与者框架');
  for (const gone of ['【发言记录】', '【对局记录', '权威时间轴', '时间轴', 'E编号', '【说人话', '【别人打过的几局', '【投票前证据校验', '决策锚点'])
    assert.ok(!q.sys.includes(gone), `系统提示里还有 ${gone}`);
  // 同一轮的票型只会作为"自上次开口以来发生的事"进一次对话
  const all = q.users.join('\n');
  for (let d = 1; d <= r.round; d++) {
    const hits = all.split(`── 第${d}天·投票 ──`).length - 1;
    assert.ok(hits <= 1, `第${d}天的票型在一次请求里出现了 ${hits} 次`);
  }
}
const withEvents = r.reqs.filter(q => q.users.some(u => u.includes('【自你上次开口以来发生的事】'))).length;
assert.ok(withEvents > 20, `带增量事件块的请求太少（${withEvents}）`);
const longest = Math.max(...r.reqs.map(q => q.n));
assert.ok(longest > 16, `参与者模式不应受 16 条记忆窗口限制（最长对话 ${longest} 条）`);
assert.equal(r.judgeAsked, 0, '参与者模式不应叫判官');
assert.ok(!r.compressed, '参与者模式不应摘要压缩记忆');
assert.ok(r.notes > 0, '至少有玩家留下了印象笔记');
assert.ok(r.seen.some(x => x > 0) && r.seen.every(x => x <= r.hist), `事件指针应前移且不超过记录长度（${r.seen.join(',')} / ${r.hist}）`);
console.log(`live audit: ${r.reqs.length} requests, ${r.round} rounds, longest conversation ${r.n || longest} messages, ${withEvents} with event blocks, notes on ${r.notes} players`);
console.log('participant mode whole-game audit OK');
