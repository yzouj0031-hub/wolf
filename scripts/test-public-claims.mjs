/**
 * 【公开声称】提取回归测试
 * 起因：实战中系统给 AI 的"硬事实"里出现了『Near 同时被 3 人发金水』，
 * 但全场根本没人跳过预言家、也没人发过金水——纯属文本提取误报。
 * 这里锁死：只有【自曝查验身份的人】用【明确查验措辞】说出的话才算金水/查杀。
 */
import { chromium } from 'playwright';
import path from 'path';

const url = 'file://' + path.resolve('index.html');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
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
const A = claims(res.A), B = claims(res.B), C = claims(res.C);

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
];

let bad = 0;
for (const [name, ok] of checks) { console.log(ok ? `✅ ${name}` : `❌ ${name}`); if (!ok) bad++; }
if (pageErrors.length) { console.error('页面错误:', pageErrors.slice(0, 5)); bad++; }
if (bad) { console.error('\n--- A ---\n' + A + '\n--- B ---\n' + B + '\n--- C ---\n' + C); }
await browser.close();
process.exit(bad ? 1 : 0);
