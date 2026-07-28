import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const players = [
  {id: 0, name: 'Light Yagami'},
  {id: 4, name: 'Mello'},
  {id: 6, name: 'Ryuzaki'}
];
const context = {
  findPlayerBySeatRef(value, pool) {
    const match = String(value).match(/P\s*#?\s*(\d+)/i);
    return match ? pool.find(player => player.id === Number(match[1]) - 1) || null : null;
  }
};
vm.createContext(context);
vm.runInContext([
  functionSource('_cleanMachineAction'),
  functionSource('_isExplicitMachinePass'),
  functionSource('_extractMachineTargets'),
  functionSource('_extractExactMachineTargets'),
  functionSource('_stripConditionalActionClauses'),
  functionSource('_hasExplicitExplodeIntent')
].join('\n'), context);

const yes = [
  '我现在自爆，带走P5。',
  '立即引爆自己，目标是P3。',
  'I will self-destruct and take P5 with me.',
  'I detonate myself now. Target P3.'
];
const no = [
  '如果今天推我，我就自爆带走P5。',
  '我暂时不自爆，继续观察。',
  'If you vote me, I will self-destruct and take P5.',
  "I won't self-destruct. Keep the ability.",
  'P5 might self-destruct later.'
];

for (const value of yes) {
  if (!context._hasExplicitExplodeIntent(value)) throw new Error(`Expected execute: ${value}`);
}
for (const value of no) {
  if (context._hasExplicitExplodeIntent(value)) throw new Error(`Expected no action: ${value}`);
}

const targetCases = [
  ['P5', 4],
  ['VOTE|P5', 4],
  ['KILL:P7', 6],
  ['EXPLODE P1', 0],
  ['Mello', 4]
];
for (const [value, id] of targetCases) {
  const result = context._extractExactMachineTargets(value, players, 1);
  if (result.length !== 1 || result[0].id !== id) throw new Error(`Wrong target for ${value}`);
}
if (context._extractExactMachineTargets('VOTE|P5 or P7', players, 1).length !== 0) {
  throw new Error('Ambiguous multi-target action must be invalid');
}
for (const value of ['PASS', 'None', 'NO_ACTION']) {
  if (!context._isExplicitMachinePass(value)) throw new Error(`Expected pass: ${value}`);
}

console.log(`action protocol: ${yes.length + no.length + targetCases.length + 4} cases passed`);
