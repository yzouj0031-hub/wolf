/**
 * 【公开声称】提取回归测试
 * 起因：实战中系统给 AI 的"硬事实"里出现了『Near 同时被 3 人发金水』，
 * 但全场根本没人跳过预言家、也没人发过金水——纯属文本提取误报。
 * 这里锁死：只有【自曝查验身份的人】用【明确查验措辞】说出的话才算金水/查杀。
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const url = pathToFileURL(path.resolve('index.html')).href;
// Optional browser integration suite (install Playwright separately). The default
// test:public-claims suite runs offline without a platform-specific browser path.
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
const page = await browser.newPage();
await page.route(/^https?:\/\//, route => route.abort());
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto(url);
await page.waitForTimeout(2000);

const res = await page.evaluate(() => {
  const R = (typeof ALL_ROLES !== 'undefined') ? ALL_ROLES : null;
  if (!R || !R.seer) return { fatal: 'ALL_ROLES 不可用' };
  const mk = (id, name, key) => ({ id, name, alive: true, role: R[key], memory: [], deathRound: null, deathPhase: null, deathCause: null });

  const build = (speeches) => {
    S.players = [
      mk(0, '赤井秀一', 'villager'),
      mk(1, 'Ryuzaki', 'villager'),
      mk(2, 'Mello', 'villager'),
      mk(3, 'Near', 'villager'),
      mk(4, '白马探', 'villager'),
      mk(5, '安室透', 'seer'),
      mk(6, '工藤新一', 'werewolf'),
      mk(7, '怪盗基德', 'werewolf'),
    ];
    S.round = 2; S.phase = 'day'; S.gameId = 4242;
    S.history = speeches.map(([name, text]) => ({ round: 2, phase: 'day', name, text }));
    if (typeof gameRecord !== 'undefined') gameRecord.length = 0;
    return buildPublicClaimsBlock(S.players[5]);
  };

  const out = {};

  // ── 场景 A：复现线上误报。没人跳预言家，只有主观信任 / 守卫自曝 ──
  out.A = build([
    ['Ryuzaki', '我是守卫，昨晚我守的是 Near，他没出事，我觉得 Near 是好人。'],
    ['赤井秀一', 'Near 发言很稳，我相信他是好人，今天别投他。'],
    ['Mello', '我继续观察 Near，感觉他是好人。'],
    ['Near', '我就是个平民，没什么信息。'],
    ['白马探', '我建议今天投 Near 试试水。'],
  ]);

  // ── 场景 B：真的有预言家报金水/查杀 ──
  out.B = build([
    ['赤井秀一', '我是预言家，我昨晚验的 Near 是金水。'],
    ['Mello', '我是预言家，我验了 Near，金水；工藤新一 查杀。'],
    ['Ryuzaki', '我是守卫，我守了 Near。'],
  ]);

  // ── 场景 C：否定 / 假设句不能被读成正面背书 ──
  out.C = build([
    ['赤井秀一', '我是预言家，Near 不是我的金水，我根本没验过他。'],
    ['Mello', '我是预言家，如果 Near 是金水，那昨晚就说不通了。'],
  ]);

  // ── 场景 D：转述 / 假设句不得被记成自曝身份 ──
  out.D = build([
    ['赤井秀一', '凭什么说我是预言家？我什么都不是。'],
    ['Mello', '如果我是预言家，我早就跳了。'],
    ['Ryuzaki', '你们别当我是女巫。'],
    ['白马探', '我第一个发言，我是预言家，我验的 Near 是金水。'],
  ]);

  // ── 场景 E：seerKillAlertBlock 必须只认台面查杀，不许读预言家私密夜间记录 ──
  {
    build([['Mello', '我是预言家，我验了 工藤新一，查杀。']]);
    S.seerLog = { 1: { target: '怪盗基德', actualTarget: '怪盗基德', reflected: false, result: '🐺狼人显示' } };
    const kidPrompt  = buildSystemPrompt(S.players[7]);   // 怪盗基德：被私下验到，但没人公开报过
    const kudoPrompt = buildSystemPrompt(S.players[6]);   // 工藤新一：台面上被公开查杀
    out.E = {
      privateNotLeaked: !/公开报你查杀/.test(kidPrompt),
      publicAlerts: /Mello 已在台面上公开报你查杀/.test(kudoPrompt),
    };
    S.seerLog = {};
  }

  // ── 场景 F：机械狼开的枪不得被写成"已证实身份的猎人不是狼人" ──
  {
    build([]);
    S.hunterLog = [{ round: 2, hunter: '怪盗基德', target: '白马探', mech: true,
      msg: '怪盗基德（机械狼(习得猎人技能)）死亡并开枪带走了白马探。开枪一事已公开证实，不容置疑！' }];
    const mechPrompt = buildSystemPrompt(S.players[0]);
    S.hunterLog = [{ round: 2, hunter: '白马探', target: '工藤新一', mech: false,
      msg: '白马探（猎人）死亡并开枪带走了工藤新一。开枪一事已公开证实，不容置疑！' }];
    const realPrompt = buildSystemPrompt(S.players[0]);
    S.hunterLog = [];
    out.F = {
      mechNotWhitewashed: !/已证实身份的猎人不是狼人/.test(mechPrompt) && /属于狼人阵营/.test(mechPrompt),
      realHunterStillVouched: /好人身份已被证实/.test(realPrompt) && !/属于狼人阵营/.test(realPrompt),
    };
  }

  return out;
});

if (res.fatal) { console.error('❌', res.fatal); process.exit(1); }

// 只截取【公开声称】那一段——后面的固定劝导文案本身就含"金水"二字，不能拿来判定
const claims = txt => {
  const i = txt.indexOf('公开声称');
  if (i < 0) return '';
  const j = txt.indexOf('【⚠️', i);
  return txt.slice(i, j < 0 ? undefined : j);
};
const A = claims(res.A), B = claims(res.B), C = claims(res.C), D = claims(res.D);

const checks = [
  ['A: 无人跳预言家时不得凭空造金水', !/金水/.test(A)],
  ['A: 不得把主观信任读成查杀', !/查杀/.test(A)],
  ['A: 守卫自曝仍被记录', /Ryuzaki 自称【守卫】/.test(A)],
  ['B: 真预言家的金水被采纳', /Near/.test(B) && /金水/.test(B)],
  ['B: 双来源金水合并成一条', /被 .*、.* 都报过金水/.test(B)],
  ['B: 查杀被采纳', /工藤新一 查杀/.test(B)],
  ['B: 守卫不产生金水条目', !/Ryuzaki（自称查验位）/.test(B)],
  ['B: 对跳预言家被识别', /对跳【预言家】/.test(B)],
  ['C: 否定句不产生金水', !/金水/.test(C)],
  ['C: 假设句不产生金水', !/都报过金水/.test(C)],
  ['公开声称区标注以发言记录为准', /以发言记录为准/.test(B)],
  ['D: "凭什么说我是预言家"不算自曝', !/赤井秀一 自称/.test(D)],
  ['D: "如果我是预言家"不算自曝', !/Mello 自称/.test(D)],
  ['D: "别当我是女巫"不算自曝', !/Ryuzaki 自称/.test(D)],
  ['D: 正常自曝不被误杀', /白马探 自称【预言家】/.test(D) && /报 Near 金水/.test(D)],
  ['E: 预言家的私密查验不泄漏给被验的狼', res.E.privateNotLeaked],
  ['E: 台面公开查杀仍触发警报', res.E.publicAlerts],
  ['F: 机械狼开枪不被洗成好人', res.F.mechNotWhitewashed],
  ['F: 真猎人开枪仍被背书', res.F.realHunterStillVouched],
];

let bad = 0;
for (const [name, ok] of checks) { console.log(ok ? `✅ ${name}` : `❌ ${name}`); if (!ok) bad++; }
if (pageErrors.length) { console.error('页面错误:', pageErrors.slice(0, 5)); bad++; }
if (bad) { console.error('\n--- A ---\n' + A + '\n--- B ---\n' + B + '\n--- C ---\n' + C + '\n--- D ---\n' + D + '\n--- E/F ---\n' + JSON.stringify(res.E) + JSON.stringify(res.F)); }
await browser.close();
process.exit(bad ? 1 : 0);
