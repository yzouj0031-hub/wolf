// 存档要还原的玩家持久状态覆盖检查。
//
// 背景：buildSnap 只把 SKILL_STATE_KEYS 里列出的字段序列化进存档（_sk）。漏掉一个
// 不会报错，只会让读档或时间线回溯后那条状态悄悄归零——炼金魔女的未明之雾和法老之蛇
// 都是"整局一次"，漏存就等于读一次档白送一瓶药；净魂师、摄梦人、石像鬼、守墓人的
// "不能连续两夜 / 已处理过谁"同理，断链后规则限制形同虚设。
//
// 所以这里反过来扫代码：凡是往【玩家对象】上写 _xxx 持久标记的地方，都必须在
// SKILL_STATE_KEYS 里出现，否则测试失败。挂在 window / S.nightData / opts 这类
// 非玩家对象上的字段不进存档是正常的，在 NON_PLAYER_RECEIVERS 里显式声明即可——
// 保持这份名单是"显式豁免"而不是"猜测过滤"，新增角色漏字段才拦得住。
import fs from 'node:fs';

const clients = ['index.html', 'en/index.html'];
const fail = [];
const expect = (ok, message) => { if (!ok) fail.push(message); };

// 非玩家对象的接收者：这些对象上的 _xxx 字段本来就不该进玩家存档。
const NON_PLAYER_RECEIVERS = new Set([
  'window',      // 全局配置（_customRolesDefs / _customModes / _specIndexGlobal / _onUndoSpeak）
  'nightData',   // 单夜临时状态，随 S.nightData 整体存档（_concubineTriggered / _pendingResolve）
  'S',           // 对局状态，buildSnap 单独逐字段序列化
  'opts',        // 函数入参（_nativeThinking）
  'folded',      // DOM 元素（_hidden）
  'MatchReplay', // 回放 UI 状态（_demo）
  'WebRelay',    // 网页端接力复制水位线（_gameId），不是玩家技能状态
  'lb',          // 排行榜，跨局累计，与单局存档无关（_mvpMatches / _totalGames）
  'buildSystemPrompt', // 函数自身的一次性告警标记（_capWarned）
]);

// 玩家对象上的字段，但 buildSnap 已经单独序列化，不需要再进 _sk。
const SERIALIZED_ELSEWHERE = new Set(['_plan', '_planRound', '_sk']);

for (const file of clients) {
  const src = fs.readFileSync(file, 'utf8');

  const declared = src.match(/const SKILL_STATE_KEYS = \[([\s\S]*?)\];/);
  expect(!!declared, `${file}: 找不到 SKILL_STATE_KEYS 声明`);
  if (!declared) continue;
  const keys = new Set((declared[1].match(/'(_[A-Za-z][A-Za-z0-9]*)'/g) || []).map(s => s.slice(1, -1)));
  expect(keys.size > 0, `${file}: SKILL_STATE_KEYS 解析为空`);

  // 匹配 `<接收者>._flag =` 与 `<接收者>._flag ||=`
  const assigned = new Map();
  for (const m of src.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\.(_[A-Za-z][A-Za-z0-9]*)\s*(?:\|\|)?=(?!=)/g)) {
    const [, receiver, flag] = m;
    if (NON_PLAYER_RECEIVERS.has(receiver) || SERIALIZED_ELSEWHERE.has(flag)) continue;
    if (!assigned.has(flag)) assigned.set(flag, { count: 0, receivers: new Set() });
    const e = assigned.get(flag);
    e.count++; e.receivers.add(receiver);
  }

  for (const [flag, info] of assigned) {
    expect(keys.has(flag),
      `${file}: ${flag} 被赋值 ${info.count} 处（${[...info.receivers].join('/')}）但不在 SKILL_STATE_KEYS 里` +
      `——读档/回溯后这条状态会丢失。若它不是玩家持久状态，请把接收者加进 NON_PLAYER_RECEIVERS。`);
  }

  // 这七个是历史上真的漏过的，钉死防止回退
  for (const must of ['_mistUsed', '_serpentUsed', '_sanctuaryLastTarget',
                      '_dreamLastTarget', '_gargoyleAwake', '_gargoyleSeen', '_gravekeeperSeen']) {
    expect(keys.has(must), `${file}: SKILL_STATE_KEYS 缺少 ${must}`);
  }

  // 序列化确实按这张表走，且写进了存档
  expect(src.includes('for(const k of SKILL_STATE_KEYS)'),
    `${file}: serializeSkillFlags 没有遍历 SKILL_STATE_KEYS`);
  expect(src.includes('_sk: serializeSkillFlags(p)'),
    `${file}: buildSnap 没有把技能状态写进存档`);
  expect(/_sk\b/.test(src) && src.includes('serializeSkillFlags'),
    `${file}: 技能状态序列化链路缺失`);
}

if (fail.length) {
  console.error('技能状态存档覆盖检查未通过：');
  fail.forEach(f => console.error('  ✗ ' + f));
  process.exit(1);
}
console.log(`技能状态存档覆盖检查通过（${clients.length} 份客户端，逐一核对玩家持久状态字段）`);
