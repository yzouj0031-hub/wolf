// 群聊·赛后复盘的逻辑测试。
//
//   node scripts/test-gchat-review.mjs
//
// 群聊模块整个包在一个 IIFE 里、又深度依赖 DOM，没法直接 import。这里把那段 IIFE
// 从 index.html 里抠出来，末尾追一行把内部函数挂到 globalThis，再喂一份假的对局数据跑。
// 这样测的是真·线上代码，不是复制粘贴的副本——index.html 改坏了这个测试就会红。
//
// 重点保的是最后一组断言：开着终局盲复盘时，群聊【绝对不能】把身份和夜间行动漏出去。
// 那是用户特意藏起来的信息，从这条路泄底等于把盲复盘功能废掉。
import { readFileSync } from 'node:fs';

const FILES = ['index.html', 'en/index.html'];
let failures = 0;

function extractModule(html, file) {
  const lines = html.split('\n');
  const start = lines.findIndex(l => l.includes('群聊模式 (独立视图)') || l.includes('Group chat mode (standalone view)'));
  if (start < 0) throw new Error(`${file}: 找不到群聊模块的起始注释`);
  let end = -1;
  for (let i = start + 2; i < lines.length; i++) {
    if (lines[i].trimEnd() === '})();') { end = i; break; }
  }
  if (end < 0) throw new Error(`${file}: 找不到群聊模块的结尾`);
  const src = lines.slice(start + 2, end + 1).join('\n');
  // 把闭包里的内部函数暴露出来供断言
  return src.replace(/\}\)\(\);\s*$/,
    '  globalThis.__gc = { gcReviewTopics, gcMyView, gcReviewFacts, gcSysFor, gcMatchId, gcLoad };\n})();');
}

// ── 一局假对局：P4(好人) 被冤枉投出，女巫毒了好人 P1，最后抓到狼 P3 ──
function makeMatch() {
  const mk = (name, id, roleName, team, emoji, alive) =>
    ({ name, alive, role: { id, name: roleName, team, emoji } });
  const players = [
    mk('P1', 'seer',     '预言家', 'good', '🔮', false),
    mk('P2', 'witch',    '女巫',   'good', '🧙‍♀️', true),
    mk('P3', 'werewolf', '狼人',   'bad',  '🐺', false),
    mk('P4', 'villager', '村民',   'good', '👨‍🌾', false),
    mk('P5', 'werewolf', '狼人',   'bad',  '🐺', true),
    mk('P6', 'guard',    '守卫',   'good', '🛡️', false)
  ];
  const record = [
    { type:'night_action', role:'seer',  round:1, target:'P3', result:'wolf' },
    { type:'night_action', role:'wolf',  round:1, target:'P6' },
    { type:'night_action', role:'guard', round:1, target:'P2' },
    { type:'death', name:'P6', role:'守卫', team:'good', cause:'被狼人杀害', round:1 },
    { type:'speech', name:'P5', round:1, game:'我觉得P4很可疑，发言一直在划水。' },
    { type:'vote', subtype:'day', round:1, result:'P4',
      votes:{ 'P4':['P1','P2','P5(警长票×1.5)'], 'P3':['P4'] } },
    { type:'night_action', role:'witch', round:2, saved:null, poisoned:'P1' },
    { type:'death', name:'P1', role:'预言家', team:'good', cause:'被女巫毒杀', round:2 },
    { type:'vote', subtype:'day', round:2, result:'P3', votes:{ 'P3':['P2','P5'] } }
  ];
  return { players, record };
}

function run(file, blind) {
  const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const { players, record } = makeMatch();

  const store = {};
  const noop = () => {};
  const stubEl = { style:{}, value:'', textContent:'', classList:{ toggle:noop, add:noop, remove:noop },
                   addEventListener:noop, querySelectorAll:() => [], appendChild:noop, onclick:null };
  globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => stubEl,
    addEventListener: noop,
    body: stubEl
  };
  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  };
  globalThis.S = { gameOver:true, players, round:2, _winType:'good', _matchUid:'m-test-1', gameId:1,
                   blindReviewMode: blind };
  globalThis.gameRecord = record;
  globalThis.playerConfigs = {};
  globalThis.curNames = players.map(p => p.name);
  globalThis.blindReviewOn = () => blind;
  globalThis._buildGodViewReport = () =>
    '\n【第1天/夜】\n  🔮 预言家查验 P3→狼\n  🐺 狼队刀 P6\n  💀 P6(🛡️守卫) 死亡（被狼人杀害）\n  🗳️ 白天投票放逐：P4';

  new Function(extractModule(html, file))();
  return globalThis.__gc;
}

function check(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); }
  else { console.error(`  ✗ ${label}`); failures++; }
}

for (const file of FILES) {
  console.log(`\n── ${file} ──`);
  const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  check('空群聊不再自动创建柯南与 L', !source.includes("members = [\n          {name:'柯南'") && !source.includes("{name:'L',"));
  check('群聊角色头像不再使用 emoji 数组', !source.includes('var EMOJIS ='));
  check('新增成员保持空白等待玩家填写', source.includes("members.push({name:'',model:'',url:'',key:'',persona:''})"));
  check('角色名与人设均有必填校验', source.includes("请补全角色 '+String(invalid+1).padStart(2,'0')+' 的角色名和人设"));
  check('群聊空状态提供创建指引', source.includes('先创建你的群聊角色') && source.includes('开始配置角色'));

  // ① 正常复盘：事实、个人视角、议题都要齐
  const gc = run(file, false);
  check('识别出已结束的对局', !!gc.gcMatchId());

  const facts = gc.gcReviewFacts();
  check('战报写明了胜负', /好人阵营获胜|Good team|获胜|win/i.test(facts));
  check('战报带上了全员身份', facts.includes('P3') && facts.includes('狼人'));
  check('战报带上了逐轮经过', facts.includes('第1天/夜'));

  const view = gc.gcMyView('P1');
  check('个人视角含自己的查验记录', view.includes('你尝试查验 P3'));
  check('个人视角含自己投过谁', view.includes('你投了 P4'));
  check('个人视角含自己的死法', view.includes('被女巫毒杀'));
  check('个人视角提醒"当时不知道"', view.includes('当时'));

  const topics = gc.gcReviewTopics();
  const texts = topics.map(t => t.text).join('\n');
  check('扫出了"冤枉好人"议题', texts.includes('P4') && texts.includes('好人'));
  check('冤枉议题带上了投票的人', (topics.find(t => t.text.includes('P4')) || {people:[]}).people.join(',').includes('P1'));
  check('警长票后缀已剥掉', !(topics.find(t => t.text.includes('P4')) || {people:[]}).people.some(n => n.includes('(')));
  check('扫出了"女巫毒错人"议题', texts.includes('毒药') && texts.includes('P1'));
  check('扫出了"抓对狼"议题', texts.includes('P3'));
  check('议题队列以自由发挥收尾', topics.length > 1 && topics[topics.length - 1].w === 0);

  // gcLoad() 是 openGChat() 的第一步，复盘模式就是在那里按对局自动打开的
  gc.gcLoad();
  const sys = gc.gcSysFor({ name:'P1', persona:'你是P1。' });
  check('复盘提示词注入了战报', sys.includes('这局到底发生了什么'));
  check('复盘提示词注入了个人视角', sys.includes('你尝试查验 P3'));
  check('复盘提示词注入了当前议题', sys.includes('正在吵的'));

  // ② 盲复盘：身份和夜间行动一个字都不能漏
  const gcb = run(file, true);
  const bFacts = gcb.gcReviewFacts();
  check('盲复盘·不输出身份表', !bFacts.includes('=🐺狼人') && !bFacts.includes('P3=') );
  check('盲复盘·不输出夜间查验', !bFacts.includes('预言家查验'));
  check('盲复盘·明确告知身份未揭晓', bFacts.includes('盲复盘'));
  check('盲复盘·保留公开票型', bFacts.includes('白天放逐'));
  check('盲复盘·不生成泄底议题', gcb.gcReviewTopics().length === 0);
}

if (failures) {
  console.error(`\n❌ 群聊复盘：${failures} 项检查未通过`);
  process.exit(1);
}
console.log('\n群聊复盘：战报注入、个人视角、议题生成与盲复盘防泄底全部通过');
