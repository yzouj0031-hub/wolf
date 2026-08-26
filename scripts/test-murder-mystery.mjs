// AI 剧本杀模块的回归测试。
//
//   node scripts/test-murder-mystery.mjs
//
// MurderMystery 是个 IIFE，只往外露 open/close/parseReply/_state。这里把整段源码从
// index.html 里抠出来，替换掉 return 那一行把内部函数一并暴露，再喂假数据跑——
// 测的是真·线上代码，index.html 改坏了这里就会红。
//
// 重点保三件事：
//   ① 中文名指认不能被吞成弃票（旧正则字符类只有 ASCII，这一票会无声消失）
//   ② 事件日志必须有上限（每个角色每次发言都要重发整份日志，不封顶是平方级涨）
//   ③ 私密线索绝不能进公开日志或别人的上下文，否则"我知道你不知道"就不成立
import { readFileSync } from 'node:fs';

const FILES = ['mystery.js'];
let failures = 0;

function extract(html, file) {
  const lines = html.split('\n');
  const st = lines.findIndex(l => l.startsWith('const MurderMystery'));
  if (st < 0) throw new Error(`${file}: 找不到 MurderMystery 模块`);
  let ed = -1;
  for (let i = st + 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === '})();') { ed = i; break; }
  }
  if (ed < 0) throw new Error(`${file}: 找不到 MurderMystery 模块结尾`);
  const src = lines.slice(st, ed + 1).join('\n');
  const ret = '  return {open:open,close:close,parseReply:parseReply,_state:J};';
  if (!src.includes(ret)) throw new Error(`${file}: return 语句和预期不符，测试需要同步更新`);
  return src.replace(ret,
    '  return {open,close,parseReply,_state:J,SCRIPTS,setScript:s=>{SCRIPT=s;},getScript:()=>SCRIPT,' +
    'resolveVote,resolveSearch,compressLog,contextPrompt,clue,speakOrder,clueById,clueTaken,record,' +
    'resolveAsk,resolveQuiz,parseSuspect,noteSuspect,topSuspect,suspicionBoard,quizScore,systemPrompt,' +
    'mysteryEndpoint,mysteryApiNeedsKey,inferMysteryProvider};');
}

function stubDom() {
  const node = () => ({
    className: '', innerHTML: '', textContent: '', style: {}, dataset: {}, options: [],
    classList: { toggle(){}, add(){}, remove(){}, contains(){ return true; } },
    appendChild(){}, scrollIntoView(){}, querySelectorAll(){ return []; }, focus(){}
  });
  globalThis.document = {
    getElementById: () => node(),
    querySelectorAll: () => [],
    createElement: node,
    addEventListener(){}
  };
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem(){ return null; }, setItem(){} };
}

function check(label, cond) {
  if (cond) console.log(`  ✓ ${label}`);
  else { console.error(`  ✗ ${label}`); failures++; }
}

for (const file of FILES) {
  console.log(`\n── ${file} ──`);
  stubDom();
  const MM = new Function(extract(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), file)
    + '\nreturn MurderMystery;')();
  const J = MM._state;

  // ① 剧本数据完整性——写新本最容易漏的就是这几项
  check(`剧本库有 ${MM.SCRIPTS.length} 个本（至少 3 个）`, MM.SCRIPTS.length >= 3);
  for (const s of MM.SCRIPTS) {
    const killers = s.cast.filter(c => c.role === 'killer');
    const ids = s.cast.map(c => c.id), clueIds = s.clues.map(c => c.id);
    const ok =
      killers.length === 1 &&
      s.cast.some(c => c.role === 'good') &&
      s.cast.find(c => c.id === s.solution.killer) &&
      new Set(ids).size === ids.length &&
      new Set(clueIds).size === clueIds.length &&
      s.clues.some(c => c.stage === 1) && s.clues.some(c => c.stage === 2) &&
      s.clues.some(c => c.secret) &&
      s.cast.every(c => c.name && c.emoji && c.public && c.goal && c.secret && c.mustAvoid) &&
      s.title && s.tagline && s.badge && s.intro && s.world && s.solution.story;
    check(`《${s.title}》数据完整（唯一凶手/真相对得上/公私线索齐全/人人有 mustAvoid）`, ok);
    check(`《${s.title}》的凶手就是 solution 指的那个`,
      killers[0] && killers[0].id === s.solution.killer);
    // 小测题：选项数一致、正确答案下标合法。答案下标写错是最容易犯又最难发现的错。
    const quiz = s.quiz || [];
    check(`《${s.title}》有小测题且答案下标都合法`,
      quiz.length >= 3 && quiz.every(x =>
        x.q && Array.isArray(x.o) && x.o.length >= 2 &&
        Number.isInteger(x.a) && x.a >= 0 && x.a < x.o.length &&
        new Set(x.o).size === x.o.length));
  }

  // ② 指认解析——这是原来会静默丢票的地方
  const script = MM.SCRIPTS[0];
  MM.setScript(script);
  const cands = script.cast.map((x, i) => Object.assign({ slot: i }, x));
  const killer = cands.find(c => c.role === 'killer');
  check('ACCUSE|英文id 能解析', MM.resolveVote('ACCUSE|' + killer.id, cands) === killer);
  check('ACCUSE|中文名 能解析（旧版会记成弃票）', MM.resolveVote('ACCUSE|' + killer.name, cands) === killer);
  check('ACCUSE：中文冒号 能解析', MM.resolveVote('ACCUSE：' + killer.name, cands) === killer);
  check('带标点和引号的也能解析', MM.resolveVote('ACCUSE|「' + killer.name + '」。', cands) === killer);
  check('光写名字也能解析', MM.resolveVote(killer.name, cands) === killer);
  check('一段提到多人的论述不当成指认',
    MM.resolveVote('我觉得' + cands[0].name + '和' + cands[1].name + '都很可疑', cands) === null);
  check('NONE 记为弃票', MM.resolveVote('NONE', cands) === null);

  // ③ 搜证解析
  const c1 = script.clues[0];
  check('SEARCH|线索id 能解析', MM.resolveSearch('SEARCH|' + c1.id, script.clues) === c1);
  check('SEARCH|线索标题 能解析', MM.resolveSearch('SEARCH|' + c1.title, script.clues) === c1);

  // ④ 日志必须封顶
  J.events = []; J.seq = 0; J.phase = '圆桌交锋'; J.round = 2;
  for (let i = 0; i < 120; i++) MM.record('say', '这是一段很长的发言。'.repeat(30), '角色' + (i % 6));
  const log = MM.compressLog();
  check('长日志被压到上限以内', log.length <= 7200);
  check('压缩后仍保留最近的发言全文', log.includes('这是一段很长的发言。'.repeat(30)));
  check('压缩后仍带事件编号（时序铁律不受影响）', /\[E\d{4}\|/.test(log));

  // ⑤ 私密线索不能外泄——这条最要紧
  J.events = []; J.seq = 0; J.found = []; J.known = {}; J.youId = null;
  J.players = cands;
  const secret = script.clues.find(c => c.secret);
  const pub = script.clues.find(c => !c.secret);
  const A = cands[0], B = cands[1];
  MM.clue(pub, A);
  MM.clue(secret, A);
  check('公开线索进了公开池', J.found.includes(pub.id));
  check('私密线索没进公开池', !J.found.includes(secret.id));
  check('私密线索记在搜到的人名下', (J.known[A.id] || []).includes(secret.id));
  const logText = J.events.map(e => e.text).join('\n');
  check('公开事件日志不含私密线索正文', !logText.includes(secret.text));
  check('公开事件日志不含私密线索标题', !logText.includes(secret.title));
  check('公开事件日志说明了有人私下搜过', logText.includes('单独去查了一处'));
  const ctxA = MM.contextPrompt(A, '发言'), ctxB = MM.contextPrompt(B, '发言');
  check('搜到的人能看到私密线索', ctxA.includes(secret.text));
  check('别人看不到私密线索', !ctxB.includes(secret.text));
  check('两人都能看到公开线索', ctxA.includes(pub.text) && ctxB.includes(pub.text));
  check('线索被搜走后不能再被搜', MM.clueTaken(secret.id) && MM.clueTaken(pub.id));

  // ⑥ 发言顺序轮换
  const o0 = MM.speakOrder(0).map(p => p.id).join(','), o1 = MM.speakOrder(1).map(p => p.id).join(',');
  check('每轮换人起头', o0 !== o1);
  check('轮换不丢人也不重复', MM.speakOrder(3).length === cands.length &&
    new Set(MM.speakOrder(3).map(p => p.id)).size === cands.length);

  // ⑦ 定向问答解析
  const others = cands.filter(x => x.id !== A.id);
  const ask1 = MM.resolveAsk(`ASK|${killer.id}|你说你在厨房，那灶台为什么是冷的？`, others);
  check('ASK|id|问题 能解析', ask1 && ask1.target === killer && ask1.question.includes('灶台'));
  const ask2 = MM.resolveAsk(`ASK|${killer.name}|你几点离开的书房？`, others);
  check('ASK|中文名|问题 能解析', ask2 && ask2.target === killer);
  check('残缺的 ASK 返回 null（交给调用方兜底）', MM.resolveAsk('ASK|' + killer.id, others) === null);
  check('不是 ASK 的 action 返回 null', MM.resolveAsk('NONE', others) === null);

  // ⑧ 嫌疑度
  J.players = cands; J.suspicion = {};
  check('NONE 解析成空', Object.keys(MM.parseSuspect('NONE')).length === 0);
  const sp = MM.parseSuspect(`${killer.id}:80, ${cands[1].name}:35`);
  check('suspect 用 id 和中文名都能解析', sp[killer.id] === 80 && sp[cands[1].id] === 35);
  check('分数被夹到 0-100', MM.parseSuspect(`${killer.id}:999`)[killer.id] === 100);
  MM.noteSuspect(A, { [killer.id]: 85, [cands[2].id]: 20 });
  check('嫌疑度记在了发出怀疑的人名下', (J.suspicion[A.id] || {})[killer.id] === 85);
  check('topSuspect 挑出最可疑的', MM.topSuspect(A, cands) === killer);
  MM.noteSuspect(cands[1], { [A.id]: 10 });
  check('低于阈值时 topSuspect 返回 null（交给随机）', MM.topSuspect(cands[1], cands) === null);
  check('不会把自己算进嫌疑', (() => {
    MM.noteSuspect(A, { [A.id]: 99 }); return (J.suspicion[A.id] || {})[A.id] === undefined;
  })());
  const board = MM.suspicionBoard();
  check('嫌疑度榜按平均分降序', board[0].p === killer && board[0].avg >= board[1].avg);

  // ⑨ 小测判分
  const qs = script.quiz;
  check('QUIZ|A,C,B,D 能解析', (MM.resolveQuiz('QUIZ|A,C,B,D', 4) || []).join(',') === '0,2,1,3');
  check('没有分隔符也能解析', (MM.resolveQuiz('QUIZ|ACBD', 4) || []).join(',') === '0,2,1,3');
  check('题数对不上返回 null（记 0 分）', MM.resolveQuiz('QUIZ|A,B', 4) === null);
  check('全对得满分', MM.quizScore(qs.map(x => x.a), qs) === qs.length);
  check('全错得 0 分', MM.quizScore(qs.map(x => (x.a + 1) % x.o.length), qs) === 0);

  // ⑩ mustAvoid 必须进提示词
  const sys = MM.systemPrompt(killer);
  check('mustAvoid 进了系统提示词', sys.includes(killer.mustAvoid));
  check('凶手提示词讲了说谎的代价，不只是禁令', sys.includes('说谎是有代价的'));
  check('输出格式里有 suspect 段', sys.includes('<suspect>'));

  // ⑪ 剧本杀独立 API：显式渠道决定请求格式，不再靠反代域名猜。
  check('OpenAI 兼容地址补 /chat/completions',
    MM.mysteryEndpoint({type:'openai',url:'https://relay.example/v1',model:'gpt-x'}) === 'https://relay.example/v1/chat/completions');
  check('已填完整 OpenAI 路径不会重复追加',
    MM.mysteryEndpoint({type:'openai',url:'https://relay.example/v1/chat/completions',model:'gpt-x'}) === 'https://relay.example/v1/chat/completions');
  check('Anthropic 地址即使误带 /v1 也能纠正',
    MM.mysteryEndpoint({type:'anthropic',url:'https://relay.example/v1',model:'claude-x'}) === 'https://relay.example/v1/messages');
  check('已填完整 Anthropic 路径不会重复追加',
    MM.mysteryEndpoint({type:'anthropic',url:'https://relay.example/v1/messages',model:'claude-x'}) === 'https://relay.example/v1/messages');
  check('Gemini 地址即使误带 /v1beta 也能纠正',
    MM.mysteryEndpoint({type:'gemini',url:'https://relay.example/v1beta',model:'gemini-x'}) === 'https://relay.example/v1beta/models/gemini-x:generateContent');
  check('本地 OpenAI 兼容服务允许无密钥',
    !MM.mysteryApiNeedsKey({type:'openai',url:'http://localhost:11434/v1'}));
  check('公网 OpenAI 兼容服务仍要求密钥',
    MM.mysteryApiNeedsKey({type:'openai',url:'https://relay.example/v1'}));
}

// ⑫ API 设置必须能在剧本杀进行中打开，且角色卡可直达自己的覆盖配置。
const mysteryUiSource = readFileSync('mystery.js', 'utf8');
const mysteryPages = [readFileSync('index.html', 'utf8'), readFileSync('en/index.html', 'utf8')];
check('中英文页面都有常驻 API 设置按钮和游戏内弹层', mysteryPages.every(page =>
  page.includes('id="jbs-api-open"') && page.includes('id="jbs-api-overlay"') && page.includes('id="jbs-api-overlay-body"')));
check('API 面板在弹层关闭后会回到设置页', mysteryUiSource.includes("home.appendChild(panel)") && mysteryUiSource.includes("overlay.classList.remove('on')"));
check('对局角色卡可以直达该角色 API 覆盖', mysteryUiSource.includes('data-api-role') && mysteryUiSource.includes('openApiSettings(btn.dataset.apiRole)'));
check('游戏内修改说明下一次请求生效', mysteryPages.every(page => page.includes('新配置从下一次请求开始生效')));

if (failures) {
  console.error(`\n❌ 剧本杀：${failures} 项检查未通过`);
  process.exit(1);
}
console.log('\n剧本杀：剧本数据、指认解析、日志封顶、私密线索隔离与发言轮换全部通过');
