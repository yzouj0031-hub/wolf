// 打法多样性：让"非常规线"真的被算一遍，而不是一句话否掉。
//
// 两局上帝视角实测，狼队永远是同一套：一狼悍跳、其余深水、刀一个没人护的位置；
// 首夜自刀都被一句话否掉（"若女巫不救就白送一只狼""拿一条命去赌模糊反馈划不来"）。
// 可两局女巫首夜都救了——正是自刀悍跳位换银水会成功的局面。
//
// 根因不在模型，在教学层的记账方式：
//   · 自刀那段把举证责任全压在自刀一边——"只有…明确高于'该队友继续存活 + 今晚正常刀好人'
//     时才支持"。首夜什么都算不"明确"，默认选项不用算就赢。
//   · 狼盟提案唯一的示例（「明暗双线」：一人带节奏、其余中立观察、明天一人悍跳）恰好就是
//     实测里反复出现的那套模板；首夜战术点只问"谁来悍跳"，默认了只起一个。
//   · 全教学层唯一为方差背书的一条，只在"已经输定"时生效。
//
// 修法不加随机：两条线记在同一张账上（女巫救/不救两支都写），只写一支就下结论的两个方向都不算；
// 常规线也要交账。另外修正了狼美人 guide 里一条机制错误（"自刀守卫还守不到、100%成功"——
// 守卫能守任何人）。好人侧配平：女巫首夜"救"也要算被自刀骗的那一支。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FILES = ['index.html', 'en/index.html'];

const between = (src, a, b, from = 0) => {
  const i = src.indexOf(a, from);
  assert.ok(i >= 0, `anchor not found: ${a}`);
  const j = src.indexOf(b, i + a.length);
  assert.ok(j > i, `end anchor not found after ${a}: ${b}`);
  return src.slice(i, j);
};

for (const file of FILES) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

  // ── 1. ★ 自刀账：两行对等，救/不救两支都写 ──────────────────────────────────
  const hint = between(src, 'const tacticalSacrificeHint = `', '`;');
  assert.ok(!hint.includes('${'), `${file}: tacticalSacrificeHint 必须是纯静态文本（原注释要求）`);
  assert.match(hint, /和刀好人记在同一张账上/, `${file}: 自刀没有和刀好人记在同一张账上`);
  assert.match(hint, /哪行都不预设赢：刀好人不因“常规”免算，刀自己人不因“新奇”加分/, `${file}: 缺少"两行都不预设赢"`);
  assert.match(hint, /她今晚会救/, `${file}: 没按女巫救人概率加权`);
  assert.match(hint, /她救——两行都烧掉解药，差别在银水落在好人身上还是你们的人身上/, `${file}: 没写出"救"那一支的真实差别`);
  assert.match(hint, /只写“不救就白送一只狼”去否决，或只写“救了就有银水”去硬上——都不算算过账/, `${file}: 单支结论没有被两个方向都禁止`);
  assert.match(hint, /有警长竞选的局首夜死讯在竞选后才公布/, `${file}: 没交代竞选局的时序`);
  // 反回流：一边倒的举证责任
  assert.ok(!hint.includes('明确高于'), `${file}: "明确高于"的单边举证责任回流了`);
  assert.ok(!hint.includes('花活'), `${file}: 只贴在自刀一边的"花活"标签回流了`);
  assert.ok(!src.includes('只在明确的战术牺牲收益成立时考虑'), `${file}: 开场提示里的循环门槛回流了`);
  assert.ok(src.includes('也属于合法刀口，和刀好人记在同一张账上比较（见下方【战术性自刀/刀队友】）'), `${file}: 开场提示没有指向同一张账`);

  // ── 2. ★ 首夜战术点：在 vm 里实际渲染各分支 ───────────────────────────────
  const block = between(src, "      let tacticsHint = '';", '      const isSingleWolf');
  const render = (isFirstNight, has, S) => {
    const ctx = vm.createContext({ isFirstNight, S, ...has });
    vm.runInContext(block + '\nglobalThis.__out = tacticsHint;', ctx);
    return ctx.__out;
  };
  const allHas = { hasSeer: true, hasWitch: true, hasGuard: true, hasHunter: false, hasKnight: false };
  const noHas = { hasSeer: false, hasWitch: false, hasGuard: false, hasHunter: false, hasKnight: false };
  const S0 = { round: 1, wolfStrategy: '', wolfStrategyName: '', wolfStrategyRound: 0 };
  const n1 = render(true, allHas, S0);
  assert.match(n1, /起不起、起几个、起什么、谁来起/, `${file}: 首夜战术点仍默认只起一个悍跳`);
  assert.match(n1, /倒钩/, `${file}: 首夜战术点没提倒钩`);
  assert.match(n1, /救\/不救两支/, `${file}: 首夜刀口没要求写救/不救两支`);
  assert.ok(!n1.includes('谁来悍跳预言家'), `${file}: 旧的"谁来悍跳预言家"回流了`);
  assert.ok(!n1.includes('今晚刚定的密约'), `${file}: 没有密约时不该出现密约提示`);
  const withPact = render(true, allHas, { round: 1, wolfStrategy: 'x', wolfStrategyName: '银水冲锋', wolfStrategyRound: 1 });
  assert.match(withPact, /今晚刚定的密约「银水冲锋」/, `${file}: 刚定的密约没有被带进夜刀提示`);
  assert.match(withPact, /只说“太冒险”而不指出哪一支算错，不算新理由/, `${file}: 非常规密约仍可被一句"太冒险"推翻`);
  const freePlay = render(true, allHas, { round: 1, wolfStrategy: 'x', wolfStrategyName: '自由发挥', wolfStrategyRound: 1 });
  assert.ok(!freePlay.includes('今晚刚定的密约'), `${file}: 兜底的"自由发挥"不该被当成密约保护`);
  const stale = render(true, allHas, { round: 2, wolfStrategy: 'x', wolfStrategyName: '银水冲锋', wolfStrategyRound: 1 });
  assert.ok(!stale.includes('今晚刚定的密约'), `${file}: 往夜的密约不该被当成"今晚刚定"`);
  assert.equal(render(true, noHas, S0), '', `${file}: 板子上没有相关角色时首夜战术点应为空`);
  assert.match(render(false, allHas, { ...S0, round: 3 }), /刀口也是明天的剧本/, `${file}: 第二夜起没有"刀口也是明天的剧本"`);

  // ── 3. 开场任务：刀口要配明天的线；首位发言者被邀请带账提非常规线 ─────────────
  assert.ok(!src.includes('白天配套战术(如有)'), `${file}: 白天打法仍是可选项`);
  assert.equal((src.match(/③ 这一刀配明天哪条线\(谁起身份、谁站边、谁倒钩\)/g) || []).length, 2, `${file}: 两个开场分支都应要求刀口配明天的线`);
  assert.match(src, /你的开场没有被任何队友锚住：算下来若有一条非常规线/, `${file}: 首位发言者没有被邀请提非常规线`);

  // ── 4. ★ 狼盟提案：删掉被照抄的模板示例，槽位打开 ────────────────────────────
  const pact = between(src, "    return '【狼盟密约·独立提案】", "';\n");
  assert.ok(!pact.includes('明暗双线|让汤姆'), `${file}: 被照抄的「明暗双线」示例回流了`);
  assert.ok(!pact.includes('保持中立观察'), `${file}: 示例里的"中立观察"回流了（werewolf guide 说它最差）`);
  assert.ok(!pact.includes('谁悍跳/谁潜水/谁做对子'), `${file}: 提案槽位仍默认只有一个悍跳`);
  assert.match(pact, /自刀、刀队友、空刀都能选/, `${file}: 提案没把刀口选项打开`);
  assert.match(pact, /这条线成了能拿到什么别的线拿不到的/, `${file}: 提案不要求写收益`);
  assert.match(pact, /只示范格式/, `${file}: 示例没有标成只示范格式`);
  assert.match(pact, /“一狼悍跳、其余深水、刀最像神的位置”谁都写得出来——写它可以，但要说清这局凭什么它比别的线好/, `${file}: 常规线不用交账`);
  assert.ok(src.includes('const mateSkills = aliveWolves'), `${file}: 提案里没有队友技能`);
  // 网页接力（喂给网页端 AI）的旧示例；真人输入框里的示例只锚定人类玩家，刻意保留
  assert.ok(!src.includes('让汤姆前排带节奏装鲁莽好人吸引神职'), `${file}: 网页接力的旧示例回流了`);
  assert.ok(!src.includes('Yamato stays neutral'), `${file}: 英文网页接力的旧示例回流了`);
  // 投票评判：收益也算分，最稳的不自动赢；原有 pact-blind 锚点还在
  assert.match(src, /最稳的那条不自动赢/, `${file}: 密约投票仍让最稳的自动赢`);
  assert.match(src, /只比较方案本身：条件分支是否完整/, `${file}: pact-blind 的评判锚点被删了`);
  assert.equal((src.match(/skillConfirm: true, reasoningStage:'normal'/g) || []).length, 2, `${file}: 两个密约投票调用都应提到 normal 档推理`);

  // ── 5. 狼人 / 狼美人 guide ─────────────────────────────────────────────────
  const wolf = between(src, "id:'werewolf'", 'reg({');
  assert.match(wolf, /被救不只是扑空/, `${file}: 狼人 guide 仍只把被救当扑空`);
  assert.match(wolf, /再起一个身份（比如假女巫\/假守卫）/, `${file}: 狼人 guide 没有双起身份的队形`);
  for (const kept of ['不要列招式名词、不要套模板', '是最差的一种', '狼队至少要有两个人在场上干活']) {
    assert.ok(wolf.includes(kept), `${file}: 狼人 guide 原有锚点「${kept}」被删了`);
  }
  const beauty = between(src, "id:'wolfbeauty'", 'reg({');
  // 机制错误：守卫能守任何人，自刀不是 100% 成功
  for (const gone of ['守卫还守不到', '100%成功', '舍不得自刀=承认1换1亏', '这才是狼美人的天选', '狼美人的天选玩法']) {
    assert.ok(!beauty.includes(gone), `${file}: 狼美人 guide 里的「${gone}」回流了`);
  }
  assert.match(beauty, /红线不顶替夜刀，自刀另算/, `${file}: 狼美人自刀没有另记一笔账`);
  assert.match(beauty, /你是全队最耐用的消耗品/, `${file}: 狼美人的消耗品定位缺失`);
  // 改前 21 处「悍跳」（一整段重复的「天选玩法」又推了一遍悍跳），改后 15 处；护栏防止再堆回去
  assert.ok((beauty.match(/悍跳/g) || []).length <= 15, `${file}: 狼美人 guide 里"悍跳"又堆起来了，比例会重新失衡`);

  // ── 6. 核心层：常规线也要交账 ──────────────────────────────────────────────
  const core = between(src, 'const WB_CORE_COMPACT = `', '\n\nconst WB_RULES_COMPACT');
  assert.match(core, /「照常规打」本身也是一注/, `${file}: 核心层没说常规线也是一注`);
  assert.match(core, /它可以输在算出来的净值上，不能只输在「不常规」上/, `${file}: 非常规线仍可只因"不常规"被否`);
  assert.match(core, /明显领先时贵，胶着或落后时便宜/, `${file}: 方差没有标价格`);
  assert.match(core, /【已经输定的时候，方差是免费的】/, `${file}: 原有的方差条被删了`);

  // ── 7. 好人侧配平：女巫首夜"救"也要算被自刀骗的那一支 ────────────────────────
  const witch = between(src, '【策略由本夜事实决定，不设首夜模板】', "'");
  assert.match(witch, /留给之后起跳、最可能挨刀的真预言家/, `${file}: 女巫"不救"那一支没有具体收益`);
  assert.match(witch, /首夜救人是狼算得到的常规，刀口也可能正是自刀的狼/, `${file}: 女巫首夜救人没算被自刀骗的那一支`);
  // 不能把"明天起身份的人就是自刀狼"种给好人——那是身份⇒狼的硬编码
  assert.ok(!src.includes('最值得自刀的是明天要起身份的那只'), `${file}: 好人侧被种下"被救后起身份=自刀狼"`);

  // ── 8. 白天第一轮：说清想推动什么，不强制人人列怀疑对象 ─────────────────────
  assert.match(src, /发言必须说清你这一轮想推动什么——推谁出局、保谁、跳不跳身份、要谁回答什么——以及凭什么；有成立的狼点就点名并给理由/, `${file}: 第一轮发言仍是单一模板`);
  assert.match(src, /吸刀、诱出悍跳、藏住真记录/, `${file}: 藏身份神职的公开假口径只算代价不算收益`);
  assert.ok(!src.includes('发言必须包含：你对当前局势的判断、至少一个具体怀疑对象和理由'), `${file}: 旧的单一发言模板回流了`);
  assert.ok(!src.includes('交出一条明天能验证的东西'), `${file}: 被搁置的"改票条件"那条混进来了`);
}

console.log('play variety: symmetric self-knife ledger, open pact slots, night-1 tactics rendered, wolfbeauty mechanics fixed, good-side counterweight');
