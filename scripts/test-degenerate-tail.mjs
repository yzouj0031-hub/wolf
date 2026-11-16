// 崩溃输出止损不能误伤正常发言。
//   实际对局：Claude Opus 5.5 一份 3800 字的正常发言被判成"崩溃输出"整段截掉，接着报"发言过短"弹窗。
//   原因是旧规则只看"200 字里有没有句末标点"，而中文长句靠逗号、顿号、破折号能写过 200 字。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const a = src.indexOf('function stripDegenerateTail(text) {');
const b = src.indexOf('\n}\n', a) + 3;
assert.ok(a > 0 && b > a, '找不到 stripDegenerateTail');
const logs = [];
const ctx = vm.createContext({ Render: { devLog: (k, t) => logs.push(String(t)) } });
vm.runInContext(src.slice(a, b), ctx);
const strip = t => vm.runInContext('stripDegenerateTail', ctx)(t);

// 1. 正常发言：一个长句只用逗号、顿号、破折号、括号连到 300 多字，前后是普通句子
const clause = '我先说我的看法，8号昨天在警上报了9号查杀，9号反手跳预言家给了10号金水，这两个人里必有一狼——但光凭对跳我不站边，我要看的是票型、警徽流和他们对后置位的态度，';
const longSentence = clause.repeat(4) + '所以今天我先听后面的人怎么说';
assert.ok(longSentence.length > 300 && !/[。！？!?.；;\n]/.test(longSentence), '样例应是一个 300 字以上、没有句末标点的长句');
const normal = '*垂着眼睛，把手里的积木转了半圈*' + longSentence + '。' + '我今天的票先挂在8号身上。'.repeat(20);
assert.equal(strip(normal), normal, '靠逗号写长的正常发言不该被截');
assert.equal(logs.length, 0, '正常发言不该报退化止损：' + logs.join(' | '));

// 2. 英文长段（逗号多、句号少）同样不动
const en = 'I think we should look at seat eight first, because the claim came too fast, and the badge plan was vague, and nobody pushed back, '.repeat(4) + 'so I will vote for seat eight today. ' + 'That is my read. '.repeat(20);
assert.equal(strip(en), en, '英文长句不该被截');

// 3. 真崩溃：正常一句之后是空格分隔、没有任何标点的词表喷吐
const salad = Array.from({ length: 120 }, (_, i) => ['椅子', 'quantum', 'テーブル', '超算', 'lamp', '沙发'][i % 6]).join(' ');
assert.ok(salad.length > 400 && !/[，,、：:。！？.；;\n]/.test(salad));
const collapsed = '我是好人，今天先听前置位怎么说。' + salad + ' ' + salad;
const cut = strip(collapsed);
assert.equal(cut, '我是好人，今天先听前置位怎么说。', '词表喷吐应截到崩溃前最后一句：' + cut.slice(0, 60));
assert.ok(logs.some(t => /200 字没有任何标点/.test(t)), '应说明是哪条线命中：' + logs.join(' | '));

// 4. 带逗号的乱码：600 字没有一个句末标点
logs.length = 0;
const commaSalad = Array.from({ length: 260 }, (_, i) => ['椅子', '量子', '桌子', '超算', '台灯'][i % 5]).join('，');
assert.ok(commaSalad.length > 700);
const cut2 = strip('我先说结论。' + commaSalad);
assert.equal(cut2, '我先说结论。', '带逗号的超长乱码也应截掉');
assert.ok(logs.some(t => /600 字没有句末标点/.test(t)), '应说明是第二条线：' + logs.join(' | '));

// 5. 短文本不查
assert.equal(strip('好'.repeat(300)), '好'.repeat(300));
console.log('degenerate-tail: long normal sentences kept, word salad and comma salad cut OK');
