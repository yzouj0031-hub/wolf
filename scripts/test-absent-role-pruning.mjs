// 教学内容按本局配置下发：本局没有的角色，提到它的句子不发。
//
// 实测（改前）：2狼+预言家+3民的局里，村民收到的提示词在护栏之外提到女巫/守卫/骑士等
// 不存在的角色 52 次；4 种常见配置 21 个视角合计 519 次。护栏说"本局没有，不许提"，
// 教学却几十遍拿它们举例，AI 自然会顺着提。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {withOfflinePage} from './lib/offline-browser.mjs';

// ── 1. 过滤器行为（vm） ────────────────────────────────────────────────────────
const ROLES = {werewolf:'狼人', villager:'村民', seer:'预言家', witch:'女巫', guard:'守卫', hunter:'猎人',
  knight:'骑士', wolfking:'狼王', whitewolf:'白狼王', wolfconcubine:'蚀时狼妃', merchant:'奇迹商人', youshang:'游商'};
for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('const PRUNE_ROLE_ALIASES');
  const b = src.indexOf('\nfunction buildSystemPrompt(p, taskContext) {', a);
  assert.ok(a >= 0 && b > a, `${file}: 过滤器未找到`);
  const ctx = {ALL_ROLES: Object.fromEntries(Object.entries(ROLES).map(([id, name]) => [id, {id, name}]))};
  vm.createContext(ctx);
  vm.runInContext(src.slice(a, b) + ';this.make = buildAbsentRolePruner;', ctx);
  const board = (...ids) => ids.map((id, i) => ({id: i, role: {id}}));
  const prune = ctx.make(board('werewolf', 'werewolf', 'seer', 'villager', 'villager'));

  assert.equal(prune('谁可能是预言家/女巫/守卫?狼今晚会刀谁?'), '谁可能是预言家?狼今晚会刀谁?', `${file}: 并列清单没有只留在场角色`);
  assert.equal(prune('问清楚来源。平安夜不是女巫或守卫的独占功劳；公开死讯人人都能复述。'),
    '问清楚来源。公开死讯人人都能复述。', `${file}: 中间提到不存在角色的句子没删`);
  assert.equal(prune('守卫这类角色要藏。其他人照常。'), '', `${file}: 开头第一句就在讲不存在角色，整行应不发`);
  assert.equal(prune('· 帮神职做建议。如果你指挥"女巫别交药?"反而像狼。这样更好。'), '', `${file}: 要点提到不存在角色应整条不发`);
  assert.equal(prune('- 合理剪枝不是狼点（例：场上有狼妃时，女巫的死也可能另有原因），才值得处理。'),
    '- 合理剪枝不是狼点，才值得处理。', `${file}: 只在括号举例里提到的，应只删括号`);
  assert.equal(prune('【女巫：跳藏按诉求】\n· 跳与不跳都是标准打法。\n· 部分披露要有计划。\n\n【找狼】\n看票型。'),
    '\n【找狼】\n看票型。', `${file}: 小标题讲不存在角色时，下面那段没有一起跳过`);
  assert.equal(prune('【找狼】\n看票型，预言家的查验最硬。'), '【找狼】\n看票型，预言家的查验最硬。', `${file}: 只讲在场角色的内容被改动了`);

  // 最长优先：有白狼王、没有狼王
  const p2 = ctx.make(board('whitewolf', 'werewolf', 'seer', 'villager'));
  assert.equal(p2('白狼王可以白天自爆。'), '白狼王可以白天自爆。', `${file}: 白狼王被当成了不在场的狼王`);
  assert.equal(p2('狼王死后能开枪。其余照常。'), '', `${file}: 不在场的狼王没被过滤`);

  // 按名字判断不可靠的配置：整体跳过
  assert.equal(ctx.make([{id: 0, role: {id: 'x', customId: 'c1', customAbilities: ['protect']}}, ...board('seer')]), null,
    `${file}: 有自创角色时应跳过过滤`);
  assert.equal(ctx.make(board('merchant', 'seer', 'werewolf')), null, `${file}: 有奇迹商人（会中途赐予技能）时应跳过过滤`);

  // 只接在教学层；护栏（modelAdapt）、局势、记录不经过过滤
  for (const k of ['wb', 'guide', 'winRuleBlock', 'styleBlock'])
    assert.ok(src.includes('${_tp(' + k + ')}'), `${file}: ${k} 没有经过按配置下发`);
  assert.ok(src.includes('${modelAdapt}') && !src.includes('${_tp(modelAdapt)}'), `${file}: 护栏不该被过滤`);
  assert.ok(src.includes("(currentTeachingMode === 'custom' || currentTeachingMode === 'clean') ? null : buildAbsentRolePruner(S.players)"),
    `${file}: 自定义/纯净教学模式（玩家自己写的教学）不该被过滤`);

  // 5 个角色说明曾把换行写成双重转义，AI 收到的是字面 "\n"
  for (const id of ['wolfking', 'wolfbeauty', 'knight', 'villager', 'whitewolf']) {
    const line = src.split('\n').find(l => l.startsWith(`reg({id:'${id}'`));
    assert.ok(line && !line.includes('\\\\n'), `${file}: ${id} 的说明里又出现了双重转义的换行`);
  }
  assert.ok(!src.includes("? '\\\\n\\\\n【本局胜负规则·屠边局（重要）】"), `${file}: 胜负规则开头又成了字面 \\n`);
}

// ── 2. 真实提示词（浏览器）：护栏之外，不存在的角色一次都不出现 ─────────────
const BOARDS = {
  '6人·2狼+预言家+3民': ['werewolf','werewolf','seer','villager','villager','villager'],
  '9人·预女猎': ['werewolf','werewolf','werewolf','seer','witch','hunter','villager','villager','villager'],
  '12人·预女猎守': ['werewolf','werewolf','werewolf','werewolf','seer','witch','hunter','guard','villager','villager','villager','villager'],
  '12人·狼美人+魔术师+摄梦人': ['werewolf','seer','villager','witch','werewolf','villager','magician','villager','dreamwalker','werewolf','villager','wolfbeauty'],
};
await withOfflinePage(async (page, origin) => {
  for (const path of ['/index.html', '/en/index.html']) {
    const errors = [];
    page.removeAllListeners('pageerror'); page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + path); await page.waitForTimeout(1200);
    const leaks = await page.evaluate(BOARDS => {
      const out = [];
      for (const [bn, roles] of Object.entries(BOARDS)) {
        S.players = roles.map((r, i) => ({id:i, name:'玩家'+(i+1), alive:true, isPlayer:false, role:ALL_ROLES[r], memory:[], mbti:null}));
        S.round = 1; S.phase = 'day'; S.pureAI = true;
        const present = new Set(roles);
        const names = Object.values(ALL_ROLES).filter(r => r && r.id && !present.has(r.id) && r.id !== 'werewolf' && r.id !== 'villager')
          .map(r => r.name.replace(/（.*?）/g, '')).sort((x, y) => y.length - x.length);
        const presentNames = [...present].map(id => ALL_ROLES[id].name);
        for (const idx of [...new Set(roles)].map(r => roles.indexOf(r))) {
          let t = buildSystemPrompt(S.players[idx], {prompt:'【白天发言】请发言', opts:{}});
          t = t.replace(/【⚠️ 严重警告·绝对禁止脑补】[\s\S]*?(?=\n\n【标签边界】)/, '');   // 护栏本身要点名"本局没有X"
          t = t.replace(/⛔\[THESE ROLE NAMES DO NOT EXIST THIS GAME\][^\n]*/g, '');           // 英文页的同一道护栏
          presentNames.forEach(n => { t = t.split(n).join('＿'); });                        // 在场角色名不算（白狼王 ⊃ 狼王）
          if (t.includes('\\n')) out.push(`${bn}｜${ALL_ROLES[roles[idx]].name}：提示词里有字面的 \\n`);
          for (const n of names) {
            const i = t.indexOf(n);
            if (i >= 0) out.push(`${bn}｜${ALL_ROLES[roles[idx]].name}：提到不存在的「${n}」…${t.slice(Math.max(0, i - 30), i + 30)}…`);
          }
        }
      }
      return out;
    }, BOARDS);
    assert.deepEqual(errors, [], `${path}: 页面报错`);
    assert.deepEqual(leaks, [], `${path}: 教学内容里还有本局不存在的角色：\n` + leaks.slice(0, 8).join('\n'));
  }
});

console.log('absent role pruning: teaching mentions only roles in this game (4 boards × every role, 0 leaks); guardrails, custom modes and custom/merchant boards untouched');
