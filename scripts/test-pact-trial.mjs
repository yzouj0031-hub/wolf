// 「试密约」：按当前设置只跑第一夜狼队写方案和投票，不打整局。
// 要点：跑完阶段回到 waiting，自动存档不会把试跑状态写成存档、覆盖真实进度；
// 之后点「开局」先清掉试跑内容再正式开局；狼盟投票与写方案同为 deep 思考档。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withOfflinePage} from './lib/offline-browser.mjs';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('id="btn-pact-trial"'), `${file}: 没有「试密约」按钮`);
  assert.ok(src.includes("$('btn-pact-trial').addEventListener('click', trialWolfPact)"), `${file}: 「试密约」按钮没绑定`);
  assert.equal((src.match(/【狼盟密约·投票】[\s\S]{0,600}?reasoningStage:'deep'/g) || []).length, 2, `${file}: 两处狼盟投票应与写方案同为 deep 思考档`);
  assert.ok(!/【狼盟密约·投票】[\s\S]{0,600}?reasoningStage:'normal'/.test(src), `${file}: 狼盟投票还是 normal 思考档`);
}

await withOfflinePage(async (page, origin) => {
  for (const path of ['/index.html', '/en/index.html']) {
    const errors = [];
    page.removeAllListeners('pageerror'); page.on('pageerror', e => errors.push(e.message));
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
    await page.goto(origin + path); await page.waitForTimeout(1000);
    const r = await page.evaluate(async () => {
      const sleep = ms => new Promise(res => setTimeout(res, ms));
      const calls = [];
      window._callAIImpl = async (p, prompt, opts) => {
        calls.push({who: p.name, kind: /独立提案/.test(prompt) ? 'propose' : /狼盟密约·投票/.test(prompt) ? 'vote' : 'other', opts});
        await sleep(5);
        if (/独立提案/.test(prompt)) return {thinking:'算账', strategy:'线' + p.id + '|今晚刀某人（救了会怎样／没救会怎样）；明天谁起什么身份、其他狼怎么配合；成了拿到警徽，失败亏一狼、退路是倒钩。', game:'按方案执行', action:'None'};
        if (/狼盟密约·投票/.test(prompt)) { const m = prompt.match(/「([^」]+)」/); return {thinking:'比较', game:'投它', action: m ? m[1] : ''}; }
        return {thinking:'', game:'', action:'None'};
      };
      // 关掉方案结果弹窗的等待
      const tick = setInterval(() => { const o = document.getElementById('wsOverlay'); if (o && o.classList.contains('show')) document.getElementById('wsClose').click(); }, 50);
      selectMode('super', true);
      $('g-url').value = 'http://127.0.0.1:9/v1'; $('g-key').value = 'k'; $('g-model').value = 'm'; try { saveCfg(); } catch (e) {}
      // 一份"真实存档"，试跑后不能被覆盖
      localStorage.setItem('wg_savegame', '{"marker":"real-save"}');
      await trialWolfPact();
      clearInterval(tick);
      const saved = AutoSave.save('试跑后', true);
      const raw = [...document.querySelectorAll('#gl .le')].map(n => n.textContent);
      const after = {
        phase: S.phase, running: S.running, trialDone: !!S._pactTrialDone,
        proposes: calls.filter(c => c.kind === 'propose').length,
        votes: calls.filter(c => c.kind === 'vote').length,
        voteStage: (calls.find(c => c.kind === 'vote') || {opts:{}}).opts.reasoningStage,
        proposeCreative: (calls.find(c => c.kind === 'propose') || {opts:{}}).opts.creative,
        wolves: S.players.filter(p => p.role.team === 'bad' && p.role.id !== 'mechwolf').length,
        strategy: S.wolfStrategyName || '',
        autosaved: saved, savegame: localStorage.getItem('wg_savegame'),
        bst: $('bst').disabled, logHasStart: raw.some(t => /只试狼盟密约|Pact trial/.test(t)),
      };
      // 之后点「开局」：先清掉试跑，再正式开局
      $('bst').click(); await sleep(300);
      const start = {phase: S.phase, trialDone: !!S._pactTrialDone, trialLogLeft: [...document.querySelectorAll('#gl .le')].some(n => /只试狼盟密约|Pact trial/.test(n.textContent)),
        strategy: S.wolfStrategyName || '', records: gameRecord.length};
      return {after, start};
    });
    assert.deepEqual(errors, [], `${path}: 页面报错`);
    const {after, start} = r;
    assert.ok(after.logHasStart, `${path}: 日志里没有试跑提示`);
    assert.equal(after.proposes, after.wolves, `${path}: 每只狼都该写一份方案（${after.proposes}/${after.wolves}）`);
    assert.equal(after.votes, after.wolves, `${path}: 每只狼都该投一票（${after.votes}/${after.wolves}）`);
    assert.equal(after.voteStage, 'deep', `${path}: 投票不是 deep 思考档`);
    assert.equal(after.proposeCreative, true, `${path}: 写方案没有放开随机性`);
    assert.ok(after.strategy, `${path}: 没有选出狼队方案`);
    assert.equal(after.phase, 'waiting', `${path}: 试跑后阶段没回到 waiting`);
    assert.equal(after.running, false, `${path}: 试跑后还标着在运行`);
    assert.equal(after.autosaved, false, `${path}: 试跑后自动存档仍会写入（会覆盖真实存档）`);
    assert.equal(after.savegame, '{"marker":"real-save"}', `${path}: 真实存档被试跑覆盖了`);
    assert.equal(after.bst, false, `${path}: 试跑后「开局」按钮不可用`);
    assert.equal(start.phase, 'night', `${path}: 试跑后点「开局」没有正式开局`);
    assert.equal(start.trialDone, false, `${path}: 正式开局后还带着试跑标记`);
    assert.equal(start.trialLogLeft, false, `${path}: 正式开局后试跑日志没清掉`);
    assert.equal(start.strategy, '', `${path}: 正式开局沿用了试跑选出的狼队方案`);
  }
});

console.log('pact trial: runs only the first-night pact with current settings, leaves the real save untouched, and a following Start is clean');
