// 预言家查验标记（移植自 claude/strict-no-peek）：
// 真人自己是预言家时，验过的人在命牌上标「好人 / 坏人」。只读自己的 S.seerLog，
// 别人报的查验不标；被反弹那次不出结论；不是真人预言家时什么都不标。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('function humanSeerMark(p) {');
  const b = src.indexOf('\n}\n', a) + 3;
  assert.ok(a >= 0 && b > a, `${file}: humanSeerMark 未找到`);
  assert.ok(src.includes('<div class="seer-tag" id="stg-${i}"></div>'), `${file}: 命牌缺少查验标记位`);
  assert.ok(src.includes("const seerMark = humanSeerMark(p);"), `${file}: Render.card 没有渲染查验标记`);
  assert.ok(src.includes('.seer-tag:empty { display: none; }'), `${file}: 空标记会渲染出色块`);

  const run = (players, seerLog, english = false) => {
    const ctx = {S: {players, seerLog}, uiEnglish: () => english};
    vm.createContext(ctx);
    vm.runInContext(src.slice(a, b) + ';this.f=humanSeerMark;', ctx);
    return p => ctx.f(p);
  };
  const seer = {id: 0, name: '甲', isPlayer: true, role: {id: 'seer'}};
  const wolf = {id: 1, name: '乙', role: {id: 'werewolf'}};
  const good = {id: 2, name: '丙', role: {id: 'villager'}};
  const other = {id: 3, name: '丁', role: {id: 'guard'}};
  const log = {
    1: {target: '乙', actualTarget: '乙', reflected: false, result: '🐺狼人显示'},
    2: {target: '丙', actualTarget: '丙', reflected: false, result: '✅好人显示'},
    3: {target: '丁', actualTarget: '甲', reflected: true, result: '被反弹，原目标未验证'},
  };

  let m = run([seer, wolf, good, other], log);
  assert.deepEqual({...m(wolf)}, {text: '坏人', cls: 'seer-bad'}, `${file}: 验到狼没有标坏人`);
  assert.deepEqual({...m(good)}, {text: '好人', cls: 'seer-good'}, `${file}: 验到好人没有标好人`);
  assert.equal(m(other), null, `${file}: 被反弹的那次不该出结论`);
  assert.equal(m(seer), null, `${file}: 不该给自己打标记`);

  m = run([{...seer, isPlayer: false}, wolf, good, other], log);
  assert.equal(m(wolf), null, `${file}: AI 预言家的查验不能标给真人看`);
  m = run([{...seer, role: {id: 'villager'}}, wolf, good, other], log);
  assert.equal(m(wolf), null, `${file}: 真人不是预言家时不该有标记`);

  m = run([seer, wolf, good, other], log, true);
  assert.equal(m(wolf).text, 'Wolf', `${file}: 英文界面标记没翻译`);
  assert.equal(m(good).text, 'Good', `${file}: 英文界面标记没翻译`);
}
console.log('seer mark: only the human seer sees own results on cards; rebounds and AI seers are not marked');
