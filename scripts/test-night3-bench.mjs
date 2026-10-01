// 🧪 AI 考题 · 第三夜：评分器 + 题面 + 页面接线
// 1. 评分器只认刀口和推演要点：自刀 S、空刀 B、刀梦子 C，解析不到给 ?。
// 2. 题面只能写白马探在第 3 夜能看到的信息，后来才揭晓的夜间记录不能漏进去。
// 3. 大厅入口、样式、脚本、PWA 缓存、APK 打包都要带上这两个文件。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bench = require('../night3-bench.js');

// ── 评分：刀口 ──
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

// 中文引号、JSON 不合法时退回字段正则
const curly = bench.grade('{“刀口”:“白马探”,“理由”:“x”}');
assert.equal(curly.decision, 'self');

// 没有 JSON：读正文结尾的"决定："句式
const textOnly = bench.grade('前面分析了很久。\n\n最终决定：今晚空刀，等明天再看。');
assert.equal(textOnly.decision, 'empty');
assert.equal(textOnly.source, 'text');

// 多个 JSON 取最后一个（模型常常先写草稿再写定稿）
const twoJson = bench.grade('草稿 {"刀口":"Jabami Yumeko","理由":"草稿"}\n想了想不对。\n{"刀口":"白马探","理由":"定稿"}');
assert.equal(twoJson.decision, 'self');
assert.equal(twoJson.reason, '定稿');

const none = bench.grade('我觉得这局很难。');
assert.equal(none.decision, 'none');
assert.equal(none.tier, '?');

// ── 评分：推演要点 ──
const full = bench.grade([
  '刀梦子：明天工藤会公布雾名单，雾里就剩我一个。',
  '空刀：平安夜，雾里两个名字五五开，我照样会被投。',
  '自刀：如果摄梦人梦我就能挡下这一刀；魔术师换位也可能把刀转走。',
  '胜率：刀梦子 5%，空刀 20%，自刀 35%。',
  '{"刀口":"白马探","理由":"唯一有胜算"}'
].join('\n'));
const hit = Object.fromEntries(full.points.map(p => [p.id, p.hit]));
assert.deepEqual(hit, { fog: true, dream: true, swap: true, empty: true, selfopt: true, prob: true });
assert.equal(full.pointsHit, 6);

const thin = bench.grade('刀梦子。{"刀口":"Jabami Yumeko","理由":"x"}');
assert.equal(thin.pointsHit, 0, 'JSON 里的"刀口"字段不能算成"把自刀当成一条路"');

// ── 题面：信息边界 ──
const prompt = bench.buildPrompt({ hint: false });
const all = prompt.system + '\n' + prompt.user;
for (const must of ['未明之雾', '白马探 或 Jabami Yumeko', '先翻白马这段夜间故事', '就空刀', '刀我可以', 'Light 死在夜里', '最后一只狼']) {
  assert.ok(all.includes(must), `题面缺少关键信息：${must}`);
}
for (const spoiler of ['挡下了本夜致命伤', '摄梦：白马探', '安室透↔Jabami', '魔术师：交换', '自刀若成功', '梦境保护替白马', '实战结果']) {
  assert.ok(!all.includes(spoiler), `题面泄露了后来才揭晓的记录：${spoiler}`);
}
assert.ok(!all.includes('【本游戏给狼人的选刀提示】'), '默认题面不该带选刀提示');
assert.ok(bench.buildPrompt({ hint: true }).user.includes('【本游戏给狼人的选刀提示】'), '勾选后题面要带选刀提示');
assert.ok(!all.includes(bench.REFERENCE.slice(0, 20)), '参考答案不能进提示词');
assert.ok(/"刀口"/.test(prompt.user), '任务里要规定 JSON 输出格式');

// ── 页面接线 ──
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.includes('id="btn-night3-bench"'), '大厅没有考题入口');
assert.ok(html.includes('<link rel="stylesheet" href="./night3-bench.css">'), '样式未加载');
assert.ok(html.includes('<script src="./night3-bench.js"></script>'), '脚本未加载');
assert.ok(html.indexOf('<script src="./night3-bench.js">') > html.indexOf('<script src="./mystery.js">'), '考题脚本要在 mystery.js（多渠道请求层）之后加载');
const sw = fs.readFileSync('sw.js', 'utf8');
assert.ok(sw.includes("'./night3-bench.js'") && sw.includes("'./night3-bench.css'"), 'PWA 缓存清单没带考题文件');
const build = fs.readFileSync('scripts/build-www.mjs', 'utf8');
assert.ok(build.includes("'night3-bench.js'") && build.includes("'night3-bench.css'"), 'APK 打包清单没带考题文件');
const js = fs.readFileSync('night3-bench.js', 'utf8');
assert.ok(!/callAI\(|buildSystemPrompt\(|S\.players/.test(js), '考题必须独立于对局状态，不能走 callAI');

console.log('night3-bench: grading, prompt boundary and page wiring OK');
