// 🧠 学习语料：真实页面里走一遍——局后按钮 → 上传弹窗 → 桩客户端收到 pending 负载；
//   管理员审核 → 桩模型提炼 → 通过入库 → 经验库拿到云端案例并进入 system prompt。
import assert from 'node:assert/strict';
import { withOfflinePage } from './lib/offline-browser.mjs';

await withOfflinePage(async (page, origin) => {
  for (const file of ['index.html', 'en/index.html']) {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/' + file);
    await page.waitForFunction(() => window.WolfLearning && window.CommunityMatches && window.WolfExperience && typeof ALL_ROLES === 'object' && typeof buildSystemPrompt === 'function');
    const r = await page.evaluate(async () => {
      window.alert = m => { window.__alert = m; };
      // 桩 Supabase 客户端
      const store = { inserted: [], updated: [], cases: [] };
      const table = name => ({
        insert: async row => { store.inserted.push({ table: name, row }); if (name === 'learning_cases') store.cases.push({ id: 'c' + store.cases.length, ...row }); return { error: null }; },
        update: row => ({ eq: async () => { store.updated.push({ table: name, row }); return { error: null }; } }),
        select: () => ({
          eq: () => ({ order: () => ({ limit: async () => ({ data: name === 'learning_cases' ? store.cases.map(c => ({ id: c.id, text: c.text, needs: c.needs, team: c.team, phases: c.phases, tags: c.tags })) : store.pending, error: null }) }) })
        })
      });
      const stub = { from: table, rpc: async () => ({ data: true, error: null }), auth: {} };
      window.CloudSave = { getClient: () => stub, getUser: () => ({ id: 'admin1' }), isAllowed: () => true };
      $('g-url').value = 'http://127.0.0.1:9/v1'; $('g-key').value = 'k'; $('g-model').value = 'stub';
      window.AuxGameAPI.request = async (api, sys, user) => { window.__distilSys = sys; window.__distilUser = user; return '{"text":"这局 P1 首夜验出 P6 是狼，天亮直接报查杀并说死了警徽流；P6 没对跳，只说自己是民，第一天就被全票放逐翻狼。预言家第一天敢把结果说死，是这局最快的一步。","needs":["seer"],"team":"good","phases":["day"],"tags":["early"]}'; };
      // 结束一局
      const keys = ['seer', 'witch', 'villager', 'villager', 'werewolf', 'werewolf'];
      S.players = keys.map((key, id) => ({ id, name: ['灰原哀', '工藤', '小明', '阿强', 'Near', '龙崎'][id], role: ALL_ROLES[key], alive: id !== 5, memory: [], deathRound: id === 5 ? 2 : 0 }));
      Object.assign(S, { playerId: -1, pureAI: true, gameOver: true, round: 3, phase: 'day', sheriff: 0, history: [], _winType: 'good', gameId: 'g-test-1', mode: 'customai' });
      gameRecord.length = 0;
      gameRecord.push({ type: 'system', text: '第1夜' }, { type: 'speech', name: '灰原哀', game: '我是预言家，验了龙崎是狼。', thinking: 'PRIVATE' }, { type: 'vote', subtype: 'day', round: 1, phase: 'vote', votes: { '龙崎': ['灰原哀', '工藤'] }, result: '龙崎', text: '龙崎 被放逐' });
      // 玩家上传
      document.getElementById('pg-learning-submit').click();
      const dialogShown = document.getElementById('lc-donate').classList.contains('show');
      document.getElementById('lc-note').value = '狼人第二天一直复读';
      document.getElementById('lc-send').click();
      await new Promise(r => setTimeout(r, 50));
      const needConsent = document.getElementById('lc-donate-status').textContent;
      document.getElementById('lc-consent').checked = true;
      document.getElementById('lc-send').click();
      await new Promise(r => setTimeout(r, 400));
      const up = store.inserted.find(x => x.table === 'learning_matches');
      const autoCase = store.inserted.find(x => x.table === 'learning_cases');
      const donateStatus = document.getElementById('lc-donate-status').textContent;
      // 管理员审核：第一条已自动入库（能撤下），第二条没案例（手动提炼）
      store.pending = [
        { id: 'm1', client_submission_id: up.row.client_submission_id, note: '狼人第二天一直复读', anonymized: true, mode_name: '测试', winner: '好人', rounds: 3, player_count: 6, roles: [], models: ['stub'], snapshot: up.row.snapshot, status: 'pending', created_at: '2026-10-20T00:00:00Z' },
        { id: 'm2', client_submission_id: 'sub-2', note: '', anonymized: true, mode_name: '测试二', winner: '狼人', rounds: 2, player_count: 6, roles: [], models: ['stub'], snapshot: up.row.snapshot, status: 'pending', created_at: '2026-10-20T01:00:00Z' }
      ];
      store.cases[0].source_submission_id = up.row.client_submission_id; store.cases[0].source = 'auto';
      const realFrom = stub.from;
      stub.from = name => name !== 'learning_cases' ? realFrom(name) : Object.assign(realFrom(name), { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: store.cases.filter(c => c.status !== 'retired'), error: null }) }) }), order: () => ({ limit: async () => ({ data: store.cases.filter(c => c.status !== 'retired'), error: null }) }) }) }) });
      await WolfLearning.openAdmin();
      await new Promise(r => setTimeout(r, 300));
      const cards = document.querySelectorAll('#lc-admin-list .lc-card').length;
      const firstCardAuto = document.querySelector('#lc-admin-list .lc-card').textContent.includes('🤖');
      document.querySelector('#lc-admin-list .lc-card').click();
      const autoShown = document.getElementById('lc-auto-case').style.display !== 'none' && document.getElementById('lc-auto-text').textContent.includes('P1 首夜验出');
      document.getElementById('lc-retire').click();
      await new Promise(r => setTimeout(r, 200));
      const retired = store.updated.find(x => x.table === 'learning_cases' && x.row.status === 'retired');
      document.getElementById('lc-admin-back').click();
      document.querySelectorAll('#lc-admin-list .lc-card')[1].click();
      const secondNoAuto = document.getElementById('lc-auto-case').style.display === 'none';
      const matchText = document.getElementById('lc-admin-match').textContent;
      document.getElementById('lc-distil').click();
      await new Promise(r => setTimeout(r, 200));
      const draft = document.getElementById('lc-case-text').value;
      document.getElementById('lc-approve').click();
      await new Promise(r => setTimeout(r, 300));
      const reviewStatus = document.getElementById('lc-review-status').textContent;
      const caseInsert = store.inserted.filter(x => x.table === 'learning_cases')[1];
      const matchUpdate = store.updated.find(x => x.table === 'learning_matches');
      await WolfLearning.loadRemoteCases(true);
      // 新的一局里，预言家的 system prompt 应能看到云端案例
      S.gameOver = false; S.round = 1; S.history = [];
      const sys = buildSystemPrompt(S.players[0], { prompt: '【第1天·白天发言·第一轮】', opts: {} });
      return {
        dialogShown, needConsent, alert: window.__alert || '', donateStatus,
        autoStatus: autoCase && autoCase.row.status, autoSource: autoCase && autoCase.row.source, autoTied: autoCase && autoCase.row.source_submission_id === up.row.client_submission_id, autoNeeds: autoCase && autoCase.row.needs.join(),
        firstCardAuto, autoShown, retired: !!retired, secondNoAuto,
        upStatus: up && up.row.status, anon: up && up.row.snapshot.players.map(p => p.name).join(','), noteInUpload: up && up.row.note,
        leak: up ? JSON.stringify(up.row.snapshot).includes('PRIVATE') : null,
        cards, matchTextHasSeat: matchText.includes('P1（预言家'), distilUserAnon: /P6/.test(window.__distilUser || '') && !/龙崎/.test(window.__distilUser || ''),
        draftOk: draft.includes('P1 首夜验出'), reviewStatus, caseStatus: caseInsert && caseInsert.row.status, caseNeeds: caseInsert && caseInsert.row.needs.join(),
        matchUpdated: matchUpdate && matchUpdate.row.status, remote: WolfExperience.remoteCount(), inPrompt: sys.includes('P1 首夜验出 P6'),
        donateDisabled: document.getElementById('pg-learning-submit').disabled
      };
    });
    assert.ok(r.dialogShown && !r.alert, `${file}: 上传弹窗没打开 ${r.alert}`);
    assert.ok(r.needConsent, `${file}: 未勾选说明就上传应被拦住`);
    assert.equal(r.upStatus, 'pending', `${file}: 上传负载不是 pending`);
    assert.equal(r.anon, 'P1,P2,P3,P4,P5,P6', `${file}: 默认应匿名化为座位号`);
    assert.equal(r.noteInUpload, '狼人第二天一直复读');
    assert.equal(r.leak, false, `${file}: 快照泄露了私密思维`);
    assert.ok(r.donateDisabled, `${file}: 上传后按钮应禁用防重复`);
    assert.equal(r.autoStatus, 'approved', `${file}: 上传后应自动提炼入库 ${r.donateStatus}`);
    assert.equal(r.autoSource, 'auto'); assert.ok(r.autoTied, `${file}: 自动案例要绑定到这次上传`); assert.equal(r.autoNeeds, 'seer');
    assert.ok(r.donateStatus.includes('已上传并提炼') || r.donateStatus.includes('distilled'), `${file}: 上传状态文案 ${r.donateStatus}`);
    assert.equal(r.cards, 2, `${file}: 审核列表应有 2 条`);
    assert.ok(r.firstCardAuto && r.autoShown, `${file}: 管理员应看到自动案例`);
    assert.ok(r.retired, `${file}: 撤下没有更新状态`);
    assert.ok(r.secondNoAuto, `${file}: 没案例的对局不该显示自动案例`);
    assert.ok(r.matchTextHasSeat, `${file}: 审核战报没渲染座位与身份`);
    assert.ok(r.distilUserAnon, `${file}: 提炼提示词应用匿名后的记录`);
    assert.ok(r.draftOk, `${file}: 模型草稿没填进表单`);
    assert.equal(r.caseStatus, 'approved', `${file}: 案例没有入库 ${r.reviewStatus}`);
    assert.equal(r.caseNeeds, 'seer'); assert.equal(r.matchUpdated, 'approved');
    assert.ok(r.remote >= 1, `${file}: 经验库没拿到云端案例`);
    assert.ok(r.inPrompt, `${file}: 云端案例没有进入 system prompt`);
    const bad = errors.filter(e => !/favicon|ERR_FAILED|supabase/i.test(e));
    assert.equal(bad.length, 0, `${file}: 页面报错 ${bad.join('\n')}`);
    console.log(file, 'ok');
  }
});
