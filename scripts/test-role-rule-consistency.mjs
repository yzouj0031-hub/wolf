import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const files = ['index.html', 'en/index.html'];

for (const file of files) {
  const html = fs.readFileSync(new URL(file, root), 'utf8');
  const expect = (needle, message) => assert.ok(html.includes(needle), `${file}: ${message}`);
  const reject = (needle, message) => assert.ok(!html.includes(needle), `${file}: ${message}`);

  expect('每晚可以正常刀任意合法候选玩家（包括自己）', '机械狼指南未说明允许自刀');
  reject('你不能主动把自己选作刀口', '机械狼指南仍错误禁止自刀');
  expect('学来的毒杀能力不会因此永久消失，下一夜仍可再次使用', '机械狼重复毒杀规则缺失');
  reject('毒药已消耗完毕，之后不再拥有毒', '机械狼每晚毒杀仍被写成一次性');

  expect('const actual = reflectInspectSubject(mw, t);', '机械狼精准查验未接入狼妃反弹');
  expect("result:reflected?'rebounded':'exact'", '机械狼反弹查验未记录为未验证');
  expect('不得把\'+t.name+\'当作已经验过的好人或狼人', '预言家反弹提示未阻止误认原目标');
  expect("role:'granted-seer'", '永久获赐查验记录缺失');
  expect("role:'granted-inspect'", '一次性获赐查验记录缺失');
  expect("role:'custom-inspect'", '自创查验记录缺失');

  expect('const witchPoisonReflected = submittedWitchPoison !== null', '女巫毒药反弹状态未记录');
  expect('原目标没有被这瓶毒命中，毒药已用完', '女巫毒药反弹仍可能误记原目标死亡');
  expect('if (!S.nightData.witchSave) {', '导演模式未阻止女巫同夜救毒两瓶');

  expect('这里的“准备”不等于“使用”或“消耗”', '炼金魔女准备蛇与消耗蛇仍未分清');
  expect('选择不救、狼队空刀、刀口已经被女巫救下，全部都【不消耗】', '法老之蛇不消耗条件不完整');
  expect('炼金魔女选择发动未明之雾、准备法老之蛇或空过', '行动顺序仍把炼金魔女阶段写成只能开雾');
  expect('女巫在解药仍在时查看最终狼刀，并决定可用药物', '行动顺序仍暗示无解药也能看刀口');

  reject('净魂师若先把圣域', '狼妃与净魂师行动顺序写反');
  reject('净魂师可提前净除锁定', '规则导出仍把净魂师写成先于狼妃');
  expect('净魂师在你之后行动', '狼妃指南未写清净魂师随后行动');

  expect("case 'hunter':", '精简导出缺少猎人特殊死因');
  expect('被带走者无遗言、无警徽传递且不能发动死亡技能', '白狼王带走目标的死亡技能限制缺失');
  expect("case 'guard':", '精简导出缺少守卫完整限制');
  expect("case 'seer':", '精简导出缺少预言家结果边界');
}

console.log('role rule consistency checks passed');
