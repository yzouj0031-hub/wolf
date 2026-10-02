// 🧪 AI 考题：评分器 + 题面 + 页面接线
// 题一（第三夜·白马探）：自刀 S、空刀 B、刀梦子 C，解析不到给 ?。
// 题二（第五夜·Ryuzaki）：设局 S、投白马 A、只处理一个嫌疑人 B、把目标说出去/晾着最后一个村民 C。
// 题面只能写被测者在那一刻能看到的信息，后来才揭晓的夜间记录不能漏进去。
// 大厅入口、样式、脚本、PWA 缓存、APK 打包都要带上这两个文件。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bench = require('../night3-bench.js');

assert.deepEqual(bench.PUZZLES.map(p => p.id), ['night3', 'night5']);

/* ───────── 题一：评分 ───────── */
const self1 = bench.grade('我把三条路都算了一遍……摄梦人可能梦我，魔术师可能换我……\n{"刀口":"白马探","理由":"赌摄梦人今晚梦我"}');
assert.equal(self1.decision, 'self');
assert.equal(self1.tier, 'S');
assert.equal(self1.source, 'json');
assert.equal(self1.reason, '赌摄梦人今晚梦我');

const empty1 = bench.grade('分析略。\n{"刀口": "空刀", "理由": "不冒险"}');
assert.equal(empty1.decision, 'empty');
assert.equal(empty1.tier, 'B');

const yumeko1 = bench.grade('梦子是最可疑的人，刀她。\n{"刀口":"Jabami Yumeko","理由":"她最像狼"}');
assert.equal(yumeko1.decision, 'yumeko');
assert.equal(yumeko1.tier, 'C');

const curly = bench.grade('{“刀口”:“白马探”,“理由”:“x”}');
assert.equal(curly.decision, 'self');

const textOnly = bench.grade('前面分析了很久。\n\n最终决定：今晚空刀，等明天再看。');
assert.equal(textOnly.decision, 'empty');
assert.equal(textOnly.source, 'text');

const twoJson = bench.grade('草稿 {"刀口":"Jabami Yumeko","理由":"草稿"}\n想了想不对。\n{"刀口":"白马探","理由":"定稿"}');
assert.equal(twoJson.decision, 'self');
assert.equal(twoJson.reason, '定稿');

const none = bench.grade('我觉得这局很难。');
assert.equal(none.decision, 'none');
assert.equal(none.tier, '?');

const full = bench.grade([
  '刀梦子：明天工藤会公布雾名单，雾里就剩我一个。',
  '空刀：平安夜，雾里两个名字五五开，我照样会被投。',
  '自刀：如果摄梦人梦我就能挡下这一刀；魔术师换位也可能把刀转走。',
  '胜率：刀梦子 5%，空刀 20%，自刀 35%。',
  '{"刀口":"白马探","理由":"唯一有胜算"}'
].join('\n'));
assert.deepEqual(Object.fromEntries(full.points.map(p => [p.id, p.hit])), { fog: true, dream: true, swap: true, empty: true, selfopt: true, prob: true });
assert.equal(full.pointsHit, 6);

const thin = bench.grade('刀梦子。{"刀口":"Jabami Yumeko","理由":"x"}');
assert.equal(thin.pointsHit, 0, 'JSON 里的"刀口"字段不能算成"把自刀当成一条路"');

/* ───────── 题一：题面边界 ───────── */
const p1 = bench.buildPrompt({ hint: false });
const all1 = p1.system + '\n' + p1.user;
for (const must of ['未明之雾', '白马探 或 Jabami Yumeko', '先翻白马这段夜间故事', '就空刀', '刀我可以', 'Light 死在夜里', '最后一只狼', 'P3 白马探（你）']) {
  assert.ok(all1.includes(must), `题一缺少关键信息：${must}`);
}
for (const spoiler of ['挡下了本夜致命伤', '摄梦：白马探', '安室透↔Jabami', '自刀若成功', '梦境保护替白马', '实战结果', '第 3 天']) {
  assert.ok(!all1.includes(spoiler), `题一泄露了后来才揭晓的记录：${spoiler}`);
}
assert.ok(!all1.includes('【本游戏给狼人的选刀提示】'), '默认题面不该带选刀提示');
assert.ok(bench.buildPrompt({ hint: true }).user.includes('【本游戏给狼人的选刀提示】'), '勾选后题面要带选刀提示');
assert.ok(!all1.includes(bench.REFERENCE.slice(0, 20)), '参考答案不能进提示词');
assert.ok(/"刀口"/.test(p1.user), '任务里要规定 JSON 输出格式');

/* ───────── 题二：评分 ───────── */
const g5 = (vote, claimLast, claimTonight, actual, body) => bench.grade(
  (body || '') + `\n{"今天投票":"${vote}","公开宣称昨晚梦了":"${claimLast}","公开宣称今晚梦":"${claimTonight}","实际今晚梦":"${actual}","理由":"r"}`, 'night5');

const trap = g5('Jabami Yumeko', 'Mello', '白马探', 'Mello');
assert.equal(trap.tier, 'S'); assert.equal(trap.decision, 'trap');
assert.ok(trap.decisionLabel.includes('投 Jabami Yumeko') && trap.decisionLabel.includes('宣称梦 白马探') && trap.decisionLabel.includes('实际梦 Mello'));
// 对称：投 Mello、宣称梦梦子、实际梦白马，同样把两种狼位都抓住
assert.equal(g5('Mello', '不说', 'Jabami Yumeko', '白马探').tier, 'S');
// 投白马再设局也算 S（白马是狼当场结束，不是就靠局）
assert.equal(g5('白马探', '不说', 'Jabami Yumeko', 'Mello').tier, 'S');
// 局设对了但实际梦梦子 = 连续第二夜处决她
const killY = g5('Mello', 'Mello', '白马探', 'Jabami Yumeko');
assert.equal(killY.tier, 'C'); assert.equal(killY.decision, 'kill-yumeko');
// 投白马、老实
assert.equal(g5('白马探', '梦子', 'Mello', 'Mello').tier, 'A');
// 实战：投 Mello，宣布并真的连梦梦子
const actual = g5('Mello', 'Jabami Yumeko', 'Jabami Yumeko', 'Jabami Yumeko');
assert.equal(actual.tier, 'B'); assert.equal(actual.decision, 'second-dream');
// 投梦子、不预报、悄悄梦 Mello
assert.equal(g5('Jabami Yumeko', '不说', '不说', 'Mello').decision, 'silent');
assert.equal(g5('Jabami Yumeko', '不说', '不说', 'Mello').tier, 'B');
// 投梦子、当众说梦 Mello 并真的梦 Mello：狼刀摄梦人连带带走
const announced = g5('Jabami Yumeko', '梦子', 'Mello', 'Mello');
assert.equal(announced.tier, 'C'); assert.equal(announced.decision, 'announced');
// 投梦子、梦工藤：最后一个村民没保护
assert.equal(g5('Jabami Yumeko', '梦子', '工藤新一', '工藤新一').decision, 'exposed');
// 投梦子、宣称梦白马、真的梦白马：目标说出去了，Mello 也晾着，两条路都输
assert.equal(g5('Jabami Yumeko', '梦子', '白马探', '白马探').tier, 'C');
// 解析不到
assert.equal(bench.grade('不知道怎么办。', 'night5').tier, '?');
assert.equal(bench.grade('{"今天投票":"安室透","实际今晚梦":"Mello"}', 'night5').tier, '?');

const full5 = g5('Jabami Yumeko', 'Mello', '白马探', 'Mello', [
  '公开说法和实际目标可以不一致，我对外说梦白马。',
  '如果狼刀我，摄梦人死亡会带走入梦者，他以为带走的是白马。',
  '挡伤记录不等于白马是好人，雾里最后一狼自刀是最优解。',
  '昨晚梦过梦子，再梦就是连续第二夜，会处决她。',
  '村民只剩两张，再死两张就屠民。',
  '整体胜率大约 80%。'
].join('\n'));
assert.deepEqual(Object.fromEntries(full5.points.map(p => [p.id, p.hit])), { lie: true, chain: true, notgold: true, twice: true, count: true, prob: true });

/* ───────── 题二：题面边界 ───────── */
const p5 = bench.buildPrompt({ puzzle: 'night5' });
const all5 = p5.system + '\n' + p5.user;
for (const must of ['P6 Ryuzaki（你）', '第 4 夜：梦 Jabami Yumeko', '替白马探挡下了本夜致命伤', '入梵者本人不会收到任何提示'.replace('梵', '梦'), '安室透 夜里死亡', '狼不会刀自己队友，白马今天暂时出圈', '可以与事实不符', '"今天投票"', '"实际今晚梦"', '魔术师安室已死']) {
  assert.ok(all5.includes(must), `题二缺少关键信息：${must}`);
}
for (const spoiler of ['实战结果', '设局', '第五夜白马刀梦子', '白马自刀', '狼队密谈', '名义刀口', '你是 P3 白马探，狼人', '白马探（P3，你）']) {
  assert.ok(!all5.includes(spoiler), `题二泄露了被测者不该知道的信息：${spoiler}`);
}
assert.ok(!all5.includes(bench.N5.REFERENCE.slice(0, 20)), '题二参考答案不能进提示词');
assert.ok(!all5.includes('【本游戏给狼人的选刀提示】'), '题二没有狼的选刀提示');
assert.equal(bench.puzzleById('night5').hint, false);

/* ───────── 页面接线 ───────── */
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('id="btn-night3-bench"'), '大厅没有考题入口');
assert.ok(html.includes('AI 考题 · 狼人杀死局'), '大厅入口文案没更新成两道题');
assert.ok(html.includes('<link rel="stylesheet" href="./night3-bench.css">'), '样式未加载');
assert.ok(html.includes('<script src="./night3-bench.js"></script>'), '脚本未加载');
assert.ok(html.indexOf('<script src="./night3-bench.js">') > html.indexOf('<script src="./mystery.js">'), '考题脚本要在 mystery.js（多渠道请求层）之后加载');
const sw = fs.readFileSync('sw.js', 'utf8');
assert.ok(sw.includes("'./night3-bench.js'") && sw.includes("'./night3-bench.css'"), 'PWA 缓存清单没带考题文件');
const build = fs.readFileSync('scripts/build-www.mjs', 'utf8');
assert.ok(build.includes("'night3-bench.js'") && build.includes("'night3-bench.css'"), 'APK 打包清单没带考题文件');
const css = fs.readFileSync('night3-bench.css', 'utf8');
assert.ok(css.includes('.n3b-puzzles'), '缺少题目切换样式');
const js = fs.readFileSync('night3-bench.js', 'utf8');
assert.ok(!/callAI\(|buildSystemPrompt\(|S\.players/.test(js), '考题必须独立于对局状态，不能走 callAI');

console.log('night3-bench: two puzzles graded, prompt boundaries and page wiring OK');
