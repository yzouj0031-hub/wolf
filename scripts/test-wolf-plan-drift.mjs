/**
 * 狼队计划黏性回归测试
 * 起因：狼第一夜定的方向被逐轮重复喂回 prompt，落款还写着"不要自相矛盾"，
 * 于是狼抱着一份早就作废的剧本打到死。这里锁死三件事：
 *   ① 保留的是每夜收尾那条，不是可能已被否决的开场提议；
 *   ② 每条标了距今多少轮；
 *   ③ 没有任何"必须坚持既定计划"的措辞，且第2轮起有强制重估题。
 */
import { chromium } from 'playwright';
import path from 'path';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
await page.goto('file://' + path.resolve('index.html'));
await page.waitForTimeout(2000);

const res = await page.evaluate(() => {
  const R = (typeof ALL_ROLES !== 'undefined') ? ALL_ROLES : null;
  if (!R || !R.werewolf) return { fatal: 'ALL_ROLES 不可用' };
  const mk = (id, n, k) => ({ id, name: n, alive: true, role: R[k], memory: [], deathRound: null, deathPhase: null, deathCause: null });

  const setup = round => {
    S.players = [mk(0,'阿狼','werewolf'), mk(1,'小狼','werewolf'), mk(2,'预言','seer'), mk(3,'女巫','witch'),
                 mk(4,'猎人','hunter'), mk(5,'村甲','villager'), mk(6,'村乙','villager'), mk(7,'村丙','villager')];
    S.round = round; S.phase = 'day'; S.gameId = 777; S.history = [];
    if (typeof gameRecord !== 'undefined') gameRecord.length = 0;
    S.wolfStrategyName = '压村甲';
    S.wolfStrategy = '压村甲进抗推位，阿狼悍跳预言家做他查杀';
    S.wolfStrategyLog = [
      { round: 1, name: '阿狼', text: '开场提议：压村甲进抗推位' },
      { round: 1, name: '小狼', text: '否掉了，村甲还没发言压他太生硬，改压猎人' },   // 当夜收尾 = 真正的共识
      { round: 2, name: '小狼', text: '村甲已经被发金水了，压不动，换方向' },
    ];
    return S.players[0];
  };

  const r3 = buildSystemPrompt(setup(3));
  const r1 = buildSystemPrompt(setup(1));
  return { r3, r1 };
});

if (res.fatal) { console.error('❌', res.fatal); process.exit(1); }
const { r3, r1 } = res;

const checks = [
  ['保留当夜收尾的共识而非开场提议', /否掉了，村甲还没发言压他太生硬/.test(r3)],
  ['不再把被否决的开场提议当本夜策略', !/开场提议：压村甲进抗推位/.test(r3)],
  ['过往条目标注了距今轮数', /2 轮前/.test(r3) && /1 轮前/.test(r3)],
  ['落款不再要求"不要自相矛盾"', !/不要自相矛盾/.test(r3)],
  ['明说这是记录不是承诺', /这是记录，不是承诺/.test(r3)],
  ['明说保持一致本身不加分', /本身不加任何分/.test(r3)],
  ['第2轮起注入强制重估三题', /动手之前，先在 thinking 里答这三题/.test(r3)],
  ['重估题要求从零再想一遍', /假装你今天才醒过来/.test(r3)],
  ['第1夜不注入重估题（还没有可重估的东西）', !/动手之前，先在 thinking 里答这三题/.test(r1)],
  ['密约块的"该切就切"仍在', /该切就切/.test(r3)],
];

let bad = 0;
for (const [n, ok] of checks) { console.log(ok ? `✅ ${n}` : `❌ ${n}`); if (!ok) bad++; }
if (pageErrors.length) { console.error('页面错误:', pageErrors.slice(0, 5)); bad++; }
if (bad) {
  const i = r3.indexOf('【狼队过往商议记录');
  console.error('\n--- 第3轮狼 prompt 片段 ---\n' + r3.slice(i, i + 1600));
}
await browser.close();
process.exit(bad ? 1 : 0);
