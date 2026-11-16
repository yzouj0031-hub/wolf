// 参与者模式全角色审计：四套板子把 27 个角色全部放上场，用按格式作答的假 API 各打到第 3 天，
// 检查真正发出去的每一条消息（系统提示、记忆里的通知、题目）里没有跟在事实后面的告诫和强调词。
// 常见板子只覆盖七八个角色；冷门角色的私密结果通知曾经挂着"白天绝不能流露 / 不得编造 / 只有你知道"。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

// 这些都是在参与者模式请求里实际出现过的片段；出现任何一个就算回归。
const BANNED = [
  '绝不能流露', '不得泄露', '不能公开说漏', '不得声称', '不能当作成功', '编造', '只有你知道', '不得在未建立', '公开口径',
  '【不能】推出', '不验证他们', '不会验证任何一方', '不能证明其准确身份', '不等于准确身份', '只能作为私密推理依据',
  '带时点', '铁验证', '绝密', '永久记录', '永久私密', '硬时序', '硬信息', '硬事实', '铁证', '才公布）', '已经公布）',
  '最后的自救', '关键决战', '快速表态', '基于你上面的推演', '下注', '白学', '可能被守卫/女巫保护了',
  '本局有魔术师：', '本局有守墓人：', '本局有女巫：', '结合本局信息', '高污染', '战术性', '二阶反推', '不要默认空刀', '纯赌命', '务必', '想清楚', '专注学习', '请只讨论明天白天的配合', '不要浪费时间', '只谈明日战术'
];
const BOARDS = {
  A: ['werewolf','werewolf','wolfking','whitewolf','seer','witch','hunter','guard','magician','gravekeeper','villager','villager'],
  B: ['werewolf','werewolf','mechwolf','gargoyle','seer','witch','dreamwalker','fox','soulwarden','jester','villager','villager'],
  C: ['werewolf','werewolf','wolfconcubine','wolfbeauty','seer','alchemist','imitator','merchant','youshang','whitecat','villager','villager'],
  D: ['werewolf','werewolf','werewolf','seer','witch','knight','cupid','serialkiller','fool','guard','villager','villager'],
};
const seenRoles = new Set(); let total = 0;
for (const [key, seed] of [['A', 11], ['B', 3], ['C', 3], ['D', 11]]) {
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/index.html'); await page.waitForTimeout(2500);
    const started = await page.evaluate(([roles, seed]) => {
      TeachingWorldbooks.load({ mode: 'live', liteMigrated: true });
      $('g-url').value = 'https://api.example.test/v1'; $('g-key').value = 'k'; $('g-model').value = 'm';
      if ($('g-apitype')) $('g-apitype').value = 'openai';
      for (const [id, v] of [['m-kill-edge', true], ['m-single-round', true], ['m-sheriff-daily-order', true], ['m-hdeath', seed === 11]]) if ($(id)) $(id).checked = v;
      MODE_CONFIGS.cap = { name: 'cap', count: roles.length, roles };
      for (const k in playerConfigs) delete playerConfigs[k];
      S.mode = 'cap'; S.pureAI = true;
      let rnd = seed * 9301 + 49297; const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
      window.__reqs = [];
      window.fetch = async (url, init) => {
        const body = JSON.parse(init.body || '{}'); const msgs = body.messages || [];
        window.__reqs.push(msgs.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' })));
        const last = String((msgs[msgs.length - 1] || {}).content || '');
        const alive = S.players.filter(x => x.alive).map(x => x.name);
        const inPrompt = alive.filter(n => last.includes(n));
        const pick = inPrompt.length ? inPrompt[Math.floor(rand() * inPrompt.length)] : alive[0];
        const pick2 = inPrompt.filter(n => n !== pick)[0] || alive.filter(n => n !== pick)[0];
        const seat = S.players.find(x => x.name === pick); const P = seat ? 'P' + (seat.id + 1) : 'P1';
        let action = pick;
        if (/YES或NO|YES 或 NO/.test(last)) action = 'YES';
        else if (/STAY或QUIT/.test(last)) action = 'STAY';
        else if (/SAVE 或 PASS/.test(last)) action = rand() < 0.5 ? 'SAVE' : 'PASS';
        else if (/SAVE/.test(last)) action = rand() < 0.5 ? 'SAVE' : 'NO_SAVE';
        else if (/CHARM\|P数字/.test(last)) action = 'CHARM|' + P;
        else if (/名字A 和 名字B/.test(last)) action = pick + ' 和 ' + pick2;
        else if (/礼物\(盾\/查验\/毒\)/.test(last)) action = pick + ' | 查验';
        else if (/技能确认/.test(last)) action = rand() < 0.5 ? 'PASS' : (/DUEL/.test(last) ? 'DUEL:' + P : /EXPLODE/.test(last) ? 'EXPLODE:' + P : 'PASS');
        else if (/P编号 或 None/.test(last)) action = P;
        else if (/同意 或 反对/.test(last)) action = '同意';
        else if (/申请 或 None/.test(last)) action = rand() < 0.3 ? '申请' : 'None';
        const content = `<thinking>想好了</thinking>\n<game>我觉得${pick}有点可疑，先听后面的。</game>\n<action>${action}</action>\n<interrupt>no</interrupt>`;
        if (body.stream) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
      window.sleep = async () => {};
      try { startGame(); S.auto = true; nextStep(); } catch (e) { return 'ERR ' + e.message; }
      return S.players.map(p => p.role.id).join(',');
    }, [BOARDS[key], seed]);
    let lastN = -1, still = 0, over = false, st = {};
    for (let i = 0; i < 200 && !over; i++) {
      await page.waitForTimeout(1500);
      await page.evaluate(() => { if (!document.querySelector('#ocp.show')) return; const bs = [...document.querySelectorAll('#cp-grid button')]; const i = bs.findIndex(x => /照用|确认跳过|确认按|跳过/.test(x.textContent)); (bs[i >= 0 ? i : 0] || { click() {} }).click(); });
      st = await page.evaluate(() => ({ over: S.gameOver, n: window.__reqs.length, round: S.round }));
      over = st.over || st.round >= 3;
      if (st.n === lastN) { still++; if (still === 6) await page.evaluate(() => { S.auto = true; try { nextStep(); } catch (e) {} }); if (still > 20) break; } else { still = 0; lastN = st.n; }
    }
    const reqs = await page.evaluate(() => window.__reqs);
    assert.equal(errors.length, 0, key + ': ' + errors.join('\n'));
    assert.ok(!String(started).startsWith('ERR'), key + ': 开局失败 ' + started);
    assert.ok(reqs.length > 40, key + ': 请求太少，审计没覆盖到（' + reqs.length + '）');
    String(started).split(',').forEach(r => seenRoles.add(r)); total += reqs.length;
    for (const msgs of reqs) for (const m of msgs) {
      if (m.role === 'assistant') continue;
      for (const b of BANNED) if (m.content.includes(b)) { const at = m.content.indexOf(b); assert.fail(key + ': 参与者模式的请求里出现「' + b + '」：…' + m.content.slice(Math.max(0, at - 60), at + 60) + '…'); }
    }
  });
}
assert.equal(seenRoles.size, 27, '四套板子应覆盖全部 27 个角色（' + seenRoles.size + '）');
console.log('participant mode all-roles audit: ' + total + ' requests across 4 boards, ' + seenRoles.size + ' roles, no coaching phrases OK');
