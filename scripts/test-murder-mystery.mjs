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

const FILES = ['index.html', 'en/index.html'];
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
    'resolveVote,resolveSearch,compressLog,contextPrompt,clue,speakOrder,clueById,clueTaken,record};');
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
      s.cast.every(c => c.name && c.emoji && c.public && c.goal && c.secret) &&
      s.title && s.tagline && s.badge && s.intro && s.world && s.solution.story;
    check(`《${s.title}》数据完整（唯一凶手/真相对得上/公私线索齐全）`, ok);
    check(`《${s.title}》的凶手就是 solution 指的那个`,
      killers[0] && killers[0].id === s.solution.killer);
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
}

if (failures) {
  console.error(`\n❌ 剧本杀：${failures} 项检查未通过`);
  process.exit(1);
}
console.log('\n剧本杀：剧本数据、指认解析、日志封顶、私密线索隔离与发言轮换全部通过');
