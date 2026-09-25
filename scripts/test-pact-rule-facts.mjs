// 狼盟密约的提案与投票必须看得到"对今晚战术有影响的硬规则"。
//
// 实测：真人狼提了"自刀队友 P10；女巫救→银水骗药，不救→隐死亡不翻牌、他照样上警起跳"。
// 方案本身成立——第一夜死者在警长竞选阶段仍被当作在场，死讯竞选结束才公布——
// 但投票的 AI 队友手里的规则说明里"警长竞选"出现 0 次，于是把"死了还能上警"当成漏洞，
// 没人投。另有一句"明显超过失去一名狼的成本时才值得执行"把举证责任全压在自刀一边。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('  const pactRuleFacts = (() => {');
  const b = src.indexOf('  })();\n', a) + 8;
  assert.ok(a >= 0 && b > a, `${file}: pactRuleFacts 未找到`);

  // 注入点：AI 提案、网页 AI 提案（中/英）、AI 投票（BLIND_NOTE）、真人投票复制（中/英）、真人手写提示
  for (const [needle, label] of [
    ["mechPactNote + pactRuleFacts.zh + '\\n\\n【方案要求】", 'AI 提案'],
    ["localizedTargets + mechPactNote + pactRuleFacts.zh + '\\n\\n'", '网页 AI 提案（中）'],
    ["localizedTargets + pactRuleFacts.en + '\\n\\n'", '网页 AI 提案（英）'],
    ['两头一起比，最稳的那条不自动赢。写得最像口号的那条通常最不能用。\' + pactRuleFacts.zh;', 'AI 投票'],
    [".join('\\n') + pactRuleFacts.zh + '\\n\\n'", '真人投票复制（中）'],
    [".join('\\n') + pactRuleFacts.en + '\\n\\n'", '真人投票复制（英）'],
    ["pactTargetCandidates(w, false) + pactRuleFacts.zh + '\\n\\n'", '真人手写提示'],
  ]) assert.ok(src.includes(needle), `${file}: ${label}没有带上本局硬规则`);
  assert.ok(!src.includes('例：明暗双线|让 P3 前排带节奏'), `${file}: 真人手写提示里还留着被照抄的模板示例`);

  const facts = ({round, n, hdeath}) => {
    const ctx = {S: {round, players: Array.from({length: n}, (_, i) => ({id: i}))},
      $: id => id === 'm-hdeath' ? {checked: hdeath} : null};
    vm.createContext(ctx);
    vm.runInContext(src.slice(a, b) + 'this.f = pactRuleFacts;', ctx);
    return ctx.f;
  };
  let f = facts({round: 1, n: 12, hdeath: true});
  assert.match(f.zh, /警长竞选/, `${file}: 第一夜 12 人局没告诉 AI 竞选在死讯之前`);
  assert.match(f.zh, /不影响他明天上警起跳/, `${file}: 没落到"死了照样能上警"`);
  assert.match(f.zh, /隐死亡/, `${file}: 开了隐死亡却没说`);
  assert.match(f.en, /Sheriff election/, `${file}: 英文版缺竞选时序`);
  f = facts({round: 2, n: 12, hdeath: false});
  assert.equal(f.zh, '', `${file}: 第二夜起没有警长竞选，不该再提`);
  f = facts({round: 1, n: 9, hdeath: false});
  assert.equal(f.zh, '', `${file}: 不足 12 人没有警长竞选，不该提`);
}

const twb = fs.readFileSync('teaching-worldbooks.js', 'utf8');
assert.ok(!twb.includes('明显超过失去一名狼的成本时才值得执行'), 'teaching-worldbooks: 交易类打法的单边举证回流了');
assert.ok(twb.includes('哪边都不预设赢'), 'teaching-worldbooks: 交易类打法没有写成同一张账');

console.log('pact rule facts: proposals and votes see the sheriff-before-death-news rule and hidden deaths only when they apply');
