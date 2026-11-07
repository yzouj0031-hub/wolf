// 裸规则整局审计：用一个按格式作答的假 API 把整局从第一夜打到结束，记录每一次真正发出去的请求
// （系统提示、历史里的系统通知、当前题目），确认没有劝告和免责声明混进去。
// 两套配置：A = 屠边、单轮、警长定序、狼美人/骑士；B = 屠城、两轮、隐死亡、狼王/白狼王/猎人/骑士，
// 并让骑士真的决斗、猎人真的开枪。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

// 这些都是曾经在裸规则请求里实际出现过的说教片段；出现任何一个就算回归。
const BANNED = [
  '高污染', '低污染', '白天绝对不能', '白天不得泄露', '狼队对跳核验', '不能当作怀疑理由', '不能当作"一直不表态',
  '【发言记录的顺序】', '权威事件时间轴', '权威时间轴', '不验证其身份', '不验证其阵营', '（不验阵营）', '不因此被认定',
  '不代表名单中的先后死亡顺序', '优先于任何人的说法', '不要再等待或引用', '谁先跳身份、谁后跳', '不是任何人的主动选择',
  '顺序会影响信息量', '两种打法各有得失', '把机会让给别人', '不能根据本阶段猜测', '必须记住', '绝对准确',
  '不容置疑', '不要质疑', '不要投他', '绝对不能投票', '下次注意', '说明关键收益', '决策数据包', '机制铁律',
  '统计上几乎一定要咬', '私密决策锚点', '至少比较首选', '比较至少两个', '退出或改线条件', '公开发言要说完整',
  '这是你唯一的情报来源', '挂得越值', '预言家通常上警', '投票前证据校验', '战术性自刀', '同一张账上',
  '所以今晚刀口死不死', '严重警告', '本局能力索引', '铁律', '口气', '说人话', '辅导腔',
  '获利方向最像狼', '人数线与次日票型', '值不值得现在决斗'
];

async function playOne(file, variant, seed) {
  let result;
  await withOfflinePage(async (page, origin) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.goto(origin + '/' + file); await page.waitForTimeout(2500);
    await page.evaluate(([seed, variant]) => {
      TeachingWorldbooks.load({ mode: 'bare', liteMigrated: true });
      $('g-url').value = 'https://api.example.test/v1'; $('g-key').value = 'k'; $('g-model').value = 'm';
      if ($('g-apitype')) $('g-apitype').value = 'openai';
      const B = variant === 'b';
      for (const [id, v] of [['m-kill-edge', !B], ['m-single-round', !B], ['m-sheriff-daily-order', !B], ['m-hdeath', B]]) if ($(id)) $(id).checked = v;
      MODE_CONFIGS.auditBare = { name: 'audit', count: 12, roles: B
        ? ['werewolf','werewolf','wolfking','whitewolf','seer','witch','hunter','guard','knight','villager','villager','villager']
        : ['werewolf','werewolf','werewolf','wolfbeauty','seer','witch','knight','guard','villager','villager','villager','villager'] };
      for (const k in playerConfigs) delete playerConfigs[k];
      S.mode = 'auditBare'; S.pureAI = true;
      let rnd = seed * 9301 + 49297; const rand = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
      window.__reqs = [];
      window.fetch = async (url, init) => {
        const body = JSON.parse(init.body || '{}');
        const msgs = body.messages || [];
        window.__reqs.push(msgs.map(m => typeof m.content === 'string' ? m.content : '').join('\n'));
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
        else if (/DUEL[|:]P数字 或 PASS|DUEL:名字 或 PASS/.test(last)) action = 'PASS';
        else if (/P编号 或 None/.test(last)) action = P;
        else if (/猎人开枪/.test(last)) action = B ? pick : 'None';
        let game = `我觉得${pick}有点可疑，先听后面的。`;
        if (B && /决斗确认/.test(last)) game = `我决斗${pick}`;
        const content = `<thinking>想好了</thinking>\n<game>${game}</game>\n<action>${action}</action>\n<interrupt>no</interrupt>`;
        if (body.stream) return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content } }] }) + '\n\ndata: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      };
      window.sleep = async () => {};
      startGame();
      S.auto = true; nextStep();
    }, [seed, variant]);
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
    const reqs = await page.evaluate(() => window.__reqs);
    result = { over, reqs, errors };
  });
  return result;
}

for (const [variant, seed] of [['a', 1], ['b', 11]]) {
  const { over, reqs, errors } = await playOne('index.html', variant, seed);
  assert.ok(over, `配置${variant}: 整局没有打完（${reqs.length} 次请求）`);
  assert.ok(reqs.length > 80, `配置${variant}: 请求太少，审计没覆盖到整局（${reqs.length}）`);
  const hits = [];
  for (const text of reqs) for (const w of BANNED) if (text.includes(w)) hits.push(w + ' ← ' + text.slice(Math.max(0, text.indexOf(w) - 60), text.indexOf(w) + 60).replace(/\n/g, ' '));
  assert.deepEqual([...new Set(hits)], [], `配置${variant}: 裸规则请求里还有说教：\n${[...new Set(hits)].join('\n')}`);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(`bare audit ${variant}: ${reqs.length} requests, game finished, no lecture phrases`);
}
console.log('bare rules whole-game audit OK');
