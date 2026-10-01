// 🧪 AI 考题 · 第三夜（night3-bench）
// 一局真实对局在第 3 夜留下的死局，做成可重复出题的模型测试：
//   让被测模型坐进 P3 白马探（最后一只狼）的位置，只给它那一刻能看到的信息，
//   让它决定今晚刀口，再按确定性规则评分。
// 纯数据 + 评分器 + 面板，三者都不依赖正在进行的对局状态（S / players / callAI），
// 所以可以在大厅随时打开，也能在 node 里直接 require 评分器跑测试。
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Night3Bench = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /* ================================================================
   *  § 题目：第 3 夜，白马探视角
   *  只写白马探在那一刻确实掌握的信息：公开记录按发言顺序摘要（保留能决定判断的原话），
   *  私密信息只有狼队密谈和系统提示。后来才揭晓的夜间记录（摄梦目标、魔术师交换）一律不写。
   * ================================================================ */
  const PLAYERS = [
    'P1 Near', 'P2 安室透', 'P3 白马探（你）', 'P4 灰原哀', 'P5 工藤新一', 'P6 Ryuzaki',
    'P7 Light Yagami', 'P8 Misa', 'P9 中森青子', 'P10 黑羽快斗', 'P11 Jabami Yumeko（梦子）', 'P12 Mello'
  ];

  const RULES = `【本局配置】12 人。狼人阵营 4：狼人×3、白狼王×1。神职 4：预言家、魔术师、炼金魔女、摄梦人。村民×4。
【胜负】屠边：狼人阵营杀光全部村民，或杀光全部神职，即获胜；好人放逐全部狼人获胜。
【隐死亡】放逐与夜间死亡都不公布身份，也不公布死因。白天出局者有遗言。警长 1.5 票。
【角色规则】
· 狼人：每晚密谈后刀一人，可以空刀。
· 白狼王：白天发言阶段可以自爆并带走一名玩家；警长竞选阶段不能。
· 预言家：每晚查验一人阵营。
· 魔术师：每晚选两名玩家交换位置；狼刀若落在其中一人身上，实际落到另一人身上。魔术师不会收到狼刀是否被转移的反馈。
· 炼金魔女：法老之蛇——每晚能看到当夜实际刀口（换位之后的落点），可以选择救下，整局一次。未明之雾——整局一次，指定两名玩家，当夜狼刀只能从这两人中选（或空刀）；狼人选刀时会被告知这个限制。
· 摄梦人：每晚选一人入梦。入梦者当晚免疫狼刀；若挡下了狼刀，摄梦人会收到"替某人挡下致命伤"的反馈。同一人连续两夜被同一摄梦人选中，第二夜因噩梦死亡。摄梦人夜里死亡时，当夜入梦者一同死亡。
【玩家】${PLAYERS.join('、')}。`;

  const PRIVATE = `【你的身份】你是 P3 白马探，狼人。狼队：P7 Light Yagami（狼人）、P8 Misa（狼人）、P10 黑羽快斗（白狼王）。到第 3 夜，三名队友都已出局，你是场上最后一只狼。

【第 1 夜狼队密谈要点】
· 刀中森青子。目的不是她的命，是逼炼金魔女首夜就用法老之蛇救人、烧掉她整局唯一的救援；不碰 Near、工藤这些会带队的人，救成银水比死了更麻烦。
· 黑羽白天上警悍跳预言家，听出真预言家后自爆带走她；Light、Misa、白马留在警下，警长票投真预言家混在大票里。
· 名义刀口：中森青子。天亮后青子死亡。

【第 2 夜狼队密谈要点】
· 白马提议刀 Mello。Light、Misa 否决：Mello 是白天风头最盛的人，摄梦人和炼金魔女都会优先护他；魔术师手里有 Light 这张明狼，最顺手的就是把 Light 和 Mello 对调，刀会落到 Light 身上。
· 最终刀安室透：白天没开过口、不在焦点。Light 预计自己明天会被投出，交代白马：先解释弃票，坚定投 Light，把 Near 身上的白狼王金水和 Light 的警长票留到第三天用；之后两人打屠民，神职迟早会自己跳出来。
· Light 另有一句："如果炼金魔女开了未明之雾：候选里只有我们的人，就空刀。"
· 名义刀口：安室透。天亮后安室活着，Light 死在夜里。系统不公布死因。你们的刀没有杀死安室，你无法分辨是被救、被挡还是被换位。`;

  const PUBLIC = `【第 1 天早上 · 警长竞选】上警：Near、灰原哀、黑羽快斗、Mello。
· Near（P1）：说自己不是预言家、没有查验；上警是为了看另外三人；要预言家把验人和警徽流说清；"实在分不清就把票给我，徽章先不押在任何一边"。
· 灰原哀（P4）：跳预言家，昨晚查验 Light Yagami 是狼人；警徽流先黑羽、后 Mello；今天归票 Light。
· 黑羽快斗（P10）：对跳预言家，称验 Near 金水；警徽流先验灰原、再验 Ryuzaki；"今天别急着把 Light 的票钉死，万一台上这位是假的呢"。
· Mello（P12）：不是预言家。抓黑羽那句"你要是真的"——真预言家的视角里不存在"灰原是真的"这条路；指出黑羽把第一张查验浪费在对跳身上、不处理冒牌却替 Light 拖一天；站灰原，今天票出 Light。随后退选。
· 二轮：Near 当众说不认黑羽给的金水，拿徽章要先排黑羽和灰原开口；灰原把警徽流改成先 Near、后 Mello；黑羽在二轮末尾宣布"我不是预言家，我是白狼王"，说要带走灰原——但警长竞选阶段不能自爆，什么都没发生。
· 警长投票：Light→Near；安室、工藤、Ryuzaki、Misa、青子、梦子、Mello→灰原；白马探弃票。灰原当选警长。
· 中森青子（P9）夜里死亡。遗言：自称平民；站边灰原；指出 Light 把票投给 Near 是避嫌；号召全票出 Light。

【第 1 天 · 发言（警长灰原指定从 Light 开始）】
· Light（P7）：自称平民。解释警长票是排除法——一个刚查杀了他、一个自称白狼王、只剩 Near；指出黑羽有机会在竞选阶段自爆却没有，"只能证明他是狼，证明不了灰原是谁"；强调隐死亡，投出他也验证不了那张查杀；说自己对 Near 偏向好人。
· Misa（P8）：激烈替 Light 辩护，咬定黑羽和灰原是双簧、灰原是假预言家，宣布今天投灰原。
· 黑羽快斗（P10）：在白天发言中发动白狼王自爆，带走灰原哀。黑羽、灰原出局，当天不再投票。

【第 2 天早上】Light Yagami 夜里死亡（系统不公布死因）。
【第 2 天 · 发言（从 Misa 开始）】
· Misa（P8）：道歉认错，承认灰原是真的、Light 是狼；说"肯定是神职——魔术师或摄梦人——用技能惩罚了他"；请"昨晚处理掉 Light 的神职"站出来带队，"你们让我投谁我就投谁"。
· Jabami Yumeko（P11）：自称平民；第二个发言就压 Misa、投 Misa；但保留一句"Light 如果是好人、昨夜直接吃了狼刀，这条路没有被排除"，并说"如果后面有人要报预言家，把两晚验人和第一天没上警的理由讲全"。
· Mello（P12）：不报身份。钉死"灰原是真的，Light 是狼"；拆 Misa 一个上午换了三次边，每次都跟着 Light 的处境走；投 Misa。要求白马解释警长弃票："一只自报的狼当面要带走她，你还在等什么？轮到你的时候，把答案给我。"对 Near："开口第一句先说你的票放哪。"最后说："想知道我是什么牌，今晚自己来翻。刀我可以。"
· Near（P1）：第一句报票投 Misa；收回昨天的"不选边"；不认白狼王金水。指出 Mello 昨天砍的两刀都是狼队本来就要丢的牌、今天是第一次把刀架在没被验过的人身上，"这一刀我跟，账记在你名下"。说"Light 怎么死的，动手的那个人现在知道昨晚那一刀原本冲着谁去的，今天别说"。不亮身份。
· 安室透（P2）：投 Misa。指出 Light、Misa、黑羽三人昨天接力说"隐死亡、查杀得不到验证"，第三个人把它变成了现实；点梦子那句"Light 如果是好人"和这块台词是同一方向，"明天请你解释"。点名还没开口的白马、工藤、Ryuzaki 表态，白马要解释弃票。不报身份。
· 白马探（P3，你）：解释弃票——竞选时怀疑黑羽喊白狼王是低成本双簧，看不清就不投。推断 Light 死因："这局没有毒，Light 死在夜里只有两种可能：摄梦人连梦两晚，或者魔术师换了位置。第一夜闭眼时毫无信息，摄梦人没有逻辑基点盲梦 Light，所以真相只有一个——魔术师昨晚把 Light 这张明狼和狼要刀的、前置位发言有煽动性的好人（比如 Mello，或者安室透）换了位，狼刀扎死了自己队友。"投 Misa；指梦子"给 Light 留好人面"极其危险，"如果 Misa 是明狼，你就是暗狼"；自称"一张不需要夜间行动的好人牌，不跳神"。
· 工藤新一（P5）：投 Misa。批评白马："Light 的死因系统没公开，你把换位讲得跟结案陈词似的；真魔术师昨晚换没换、刀口最后落在谁身上，只有动手的人自己清楚。"又说："安室好好活着站在场上，Light 没了，这就是昨晚交出来的成绩单。神职不需要跳出来表演给谁看，谁再催，谁就有问题。"
· Ryuzaki（P6）：投 Misa。明确不认"今天出 Misa、明天自动出梦子"这条流水线。集中质疑白马："首夜没有信息，不等于首夜没有行动，你凭什么删掉摄梦人选 Light 这条路？你说魔术师会保护前置位发言有煽动性的人，举了 Mello 和安室——安室今天才第一次开口，你把今天听到的表现装进了昨晚选目标的理由里，这段夜间故事是你补出来的。"结尾："后面继续找狼，我会先翻白马这段夜间故事，而不是直接把梦子填进去。"今天不报身份。
· 放逐投票：Near、安室、白马、工藤、Ryuzaki、梦子、Mello→Misa；Misa→Mello。Misa 出局（7 票）。
· Misa 遗言：痛骂众人冤枉；重点骂白马"为了踩死我，连昨晚发生了什么都能编出来，什么真相只有一个、什么魔术师换位，你又是怎么知道的"；说"等明天发现游戏没结束，你们就知道冤枉了一个无辜的女孩"。`;

  const NIGHT3 = `【第 3 夜 · 你收到的系统提示】
存活 7 人：Near、安室透、白马探（你）、工藤新一、Ryuzaki、Jabami Yumeko、Mello。按你掌握的信息：好人 6（神职 3、村民 3），狼 1（你）。
炼金魔女发动了未明之雾：今晚狼刀只能选择 白马探 或 Jabami Yumeko，或者空刀。`;

  const TASK = `【任务】决定今晚的刀口，并说明理由。
写法要求：
1. 先把每一种可选刀口分别推演到明天白天：夜里可能有哪几种结算结果，天亮后好人会看到什么、会说什么，你明天的处境如何。
2. 给每条路线一个大致的胜率估计（百分比即可，不必精确）。
3. 最后单独一行输出 JSON，格式固定：{"刀口":"白马探" 或 "Jabami Yumeko" 或 "空刀","理由":"一句话"}`;

  function hintText() {
    const ctx = root && root.WolfReasoningContext;
    if (ctx && typeof ctx.wolfChoice === 'function') return '【本游戏给狼人的选刀提示】\n' + ctx.wolfChoice(['magician']);
    return '【本游戏给狼人的选刀提示】\n先按本局胜负条件算整夜结算后的存活与终局，再比较有实际依据的两个刀口和合法空刀；自刀和刀好人放在同一张账上比较，哪边都不预设赢。只有游戏仍会继续，才安排明天的配合。';
  }

  function buildPrompt(opts) {
    opts = opts || {};
    const system = `你正在参加一局狼人杀。下面是本局规则、你的私密信息和截至目前的全部公开记录。你是 P3 白马探，狼人。
你只知道这些信息，不知道任何尚未公开的夜间记录。请完全站在白马探的视角做决定，目标只有一个：让狼人阵营赢下这一局。
不要复述规则，不要写发言稿，直接做夜间决策分析。

${RULES}`;
    const user = [PRIVATE, PUBLIC, NIGHT3, opts.hint ? hintText() : '', TASK].filter(Boolean).join('\n\n');
    return { system, user };
  }

  /* ================================================================
   *  § 参考答案（只给人看，不进提示词）
   * ================================================================ */
  const REFERENCE = `雾把刀口锁死在白马和梦子两人之间，三条路要分别推到明天白天：

· 刀梦子：梦子死（或被摄梦人挡住、或被魔术师换到别人身上）。无论哪种，明天炼金魔女都会公布雾名单"白马、梦子"。梦子死了，雾里只剩你一个名字；梦子被挡，摄梦人报出"替梦子挡伤"，同样只剩你。这条路等于明天自曝。
· 空刀：平安夜，没有任何记录。明天雾名单公布，雾里两个人五五开，而你身上还背着 Ryuzaki 点名要翻的"夜间故事"和 Near 追问的弃票。大概率先被投，而且就算活过明天，摄梦人仍然能用两夜处理你。
· 自刀：如果没人梦你、没人换你，你当晚出局，狼队归零。但摄梦人第一夜入梦是保护，第二夜才是处决——他想处理谁，第一步就是梦谁，而 Ryuzaki 刚刚当众说"先翻白马"，你是他最可能动手的对象，被梦住的概率远高于六分之一。魔术师若换了你，刀落到别人身上，交换记录同样会把你记成"原刀口"。只要被梦住，你就拿到一张真实的挡伤记录，成为全场唯一有系统反馈的人。

前两条路的下限和自刀差不多，都是输，只是晚一天；自刀的下限是当晚输，上限是整局翻盘。劣势局主动拉高方差，这是唯一通向胜利的路。

实战结果：白马自刀，Ryuzaki 当夜梦了白马、收到挡伤反馈，安室交换了自己和梦子。第三天起好人把这张记录当成白马的护身符，先后投出 Near、Mello，第五夜梦子出局，狼队屠民获胜。`;

  /* ================================================================
   *  § 评分器
   *  只认两样东西：最终刀口（看 JSON，解析不到再看正文结尾），和推演里有没有踩到几个关键点。
   *  评级是对决定的评价，不替模型补推理；要点是对过程的记录，拿来跨模型对比。
   * ================================================================ */
  const DECISIONS = {
    self:   { key: 'self',   label: '自刀（刀白马探）', tier: 'S', tierLabel: '找到了唯一有胜算的路' },
    empty:  { key: 'empty',  label: '空刀',             tier: 'B', tierLabel: '求稳，但雾里二选一，明天仍大概率被投' },
    yumeko: { key: 'yumeko', label: '刀 Jabami Yumeko', tier: 'C', tierLabel: '雾名单一公布就自曝' },
    none:   { key: 'none',   label: '未能解析',         tier: '?', tierLabel: '没有读到明确的刀口' }
  };

  const POINTS = [
    { id: 'fog',     label: '算到雾名单明天会被公布',
      test: t => /(雾|名单|两个名字|二选一).{0,40}(公布|公开|报出|说出|亮出|摆出|翻出|宣布|告诉)|(炼金魔女|工藤|魔女).{0,30}(公布|公开|报出|说出|亮出|宣布|告诉).{0,30}(雾|名单|两个|二选一)/.test(t) },
    { id: 'dream',   label: '考虑了摄梦人的保护或挡刀',
      test: t => /(摄梦|入梦|梦境|梦游|梦住|挡刀|挡伤|挡下|接住)/.test(t) },
    { id: 'swap',    label: '考虑了魔术师换位',
      test: t => /(魔术师|交换|换位|对调|换到)/.test(t) },
    { id: 'empty',   label: '看出空刀也不安全',
      test: t => /空刀/.test(t) && /(五五|二选一|两个名字|两张牌|两个人里|两人之一|两人里|仍然|照样|还是会|一样会|同样会|也会被|依旧)/.test(t) },
    { id: 'selfopt', label: '把自刀当成一条路来算',
      test: t => /(自刀|刀自己|刀我自己|刀白马|刀 ?3 ?号|刀 ?P3|指向自己|对准自己|砍自己|刀向自己)/.test(t) },
    { id: 'prob',    label: '给出了胜率估计',
      test: t => /\d{1,3}\s*%|[一二三四五六七八九十]成|\b0\.\d+\b/.test(t) }
  ];

  function stripJsonTail(text) {
    return String(text || '').replace(/\{[^{}]*"刀口"[^{}]*\}/g, ' ');
  }

  function normalizeDecision(value) {
    const s = String(value == null ? '' : value).trim().toLowerCase();
    if (!s) return null;
    if (/白马|自己|自刀|p3\b|3号|三号|hakuba|self/.test(s)) return 'self';
    if (/jabami|yumeko|梦子|p11\b|11号|十一号/.test(s)) return 'yumeko';
    if (/空刀|不刀|空过|none|skip|不出刀|放弃/.test(s)) return 'empty';
    return null;
  }

  function extractDecision(text) {
    const t = String(text || '');
    // 1. 末尾 JSON（取最后一个含"刀口"的对象）
    const objs = t.match(/\{[^{}]*"刀口"[^{}]*\}/g);
    if (objs && objs.length) {
      for (let i = objs.length - 1; i >= 0; i--) {
        try {
          const o = JSON.parse(objs[i].replace(/[“”]/g, '"'));
          const d = normalizeDecision(o['刀口']);
          if (d) return { decision: d, source: 'json', reason: String(o['理由'] || '') };
        } catch (_) {
          const m = objs[i].match(/"刀口"\s*[:：]\s*"([^"]*)"/);
          const d = m && normalizeDecision(m[1]);
          if (d) return { decision: d, source: 'json', reason: '' };
        }
      }
    }
    // 2. 正文结尾的"决定 / 最终 / 刀口："句式
    const tail = t.slice(-600);
    const m = tail.match(/(?:最终|决定|结论|刀口|今晚)[^\n]{0,12}?[:：]\s*([^\n。]{1,40})/g);
    if (m) {
      for (let i = m.length - 1; i >= 0; i--) {
        const d = normalizeDecision(m[i]);
        if (d) return { decision: d, source: 'text', reason: '' };
      }
    }
    return { decision: null, source: null, reason: '' };
  }

  function gradeNight3Answer(text) {
    const raw = String(text || '');
    const pick = extractDecision(raw);
    const meta = DECISIONS[pick.decision || 'none'];
    const body = stripJsonTail(raw);
    const points = POINTS.map(p => ({ id: p.id, label: p.label, hit: !!p.test(body) }));
    const hit = points.filter(p => p.hit).length;
    return {
      decision: meta.key, decisionLabel: meta.label, tier: meta.tier, tierLabel: meta.tierLabel,
      source: pick.source, reason: pick.reason, points, pointsHit: hit, pointsTotal: POINTS.length
    };
  }

  const api = { RULES, PRIVATE, PUBLIC, NIGHT3, TASK, REFERENCE, DECISIONS, POINTS, buildPrompt, hintText, extractDecision, grade: gradeNight3Answer };

  /* ================================================================
   *  § 面板（只在浏览器里挂）
   * ================================================================ */
  if (typeof document === 'undefined') return api;

  const RESULT_KEY = 'wg_night3_bench_results';
  const CUSTOM_KEY = 'wg_night3_bench_custom';
  const esc = v => (typeof root.escapeHtml === 'function') ? root.escapeHtml(String(v == null ? '' : v))
    : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const q = id => document.getElementById(id);
  const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (_) { return d; } };
  const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

  // ── 候选模型：全局 API、API 库、备选 API、手动添加 ──
  function providerType(id, url) {
    const prov = typeof root.getProvider === 'function' ? root.getProvider(id) : null;
    if (prov && prov.type) return prov.type;
    if (id === 'anthropic' || id === 'gemini' || id === 'openai') return id;
    const s = String(url || '').toLowerCase();
    if (s.includes('anthropic.com')) return 'anthropic';
    if (s.includes('generativelanguage.googleapis.com') && !s.includes('/openai')) return 'gemini';
    return 'openai';
  }
  function globalCandidate() {
    const url = (q('g-url') && q('g-url').value || '').trim().replace(/\/+$/, '');
    const key = (q('g-key') && q('g-key').value || '').trim();
    const model = (q('g-model') && q('g-model').value || '').trim();
    const type = providerType(q('g-apitype') && q('g-apitype').value, url);
    return { id: 'global', name: '全局 API（当前设置）', url, key, model, type };
  }
  function vaultCandidates() {
    const v = root.ApiVault;
    if (!v || typeof v.loadAll !== 'function') return [];
    return v.loadAll().filter(x => x && x.url && x.key && x.model).map(x => ({
      id: 'vault:' + x.id, name: 'API 库 · ' + (x.name || x.model), url: String(x.url).replace(/\/+$/, ''), key: x.key, model: x.model, type: providerType(x.apiType, x.url)
    }));
  }
  function fallbackCandidates() {
    if (typeof root.getFallbacks !== 'function') return [];
    return root.getFallbacks().filter(x => x && x.url && x.key && x.model).map((x, i) => ({
      id: 'fb:' + i, name: '备选 API #' + (i + 1) + ' · ' + x.model, url: String(x.url).replace(/\/+$/, ''), key: x.key, model: x.model, type: providerType(x.type, x.url)
    }));
  }
  function customCandidates() {
    return loadJson(CUSTOM_KEY, []).map((x, i) => ({ id: 'custom:' + i, name: '手动 · ' + x.model, url: x.url, key: x.key, model: x.model, type: x.type || providerType('', x.url) }));
  }
  function allCandidates() {
    const seen = new Set(); const out = [];
    [globalCandidate()].concat(vaultCandidates(), fallbackCandidates(), customCandidates()).forEach(c => {
      if (!c.url || !c.model) return;
      const sig = c.type + '|' + c.url + '|' + c.model;
      if (seen.has(sig)) return; seen.add(sig); out.push(c);
    });
    return out;
  }

  // ── 思考档位：跟随全局（全力推理 → max；智能分流 → high，这是关键残局）或面板里指定 ──
  function resolveMode(sel) {
    if (sel && sel !== 'follow') return sel;
    if (typeof root.fullReasoningOn === 'function' && root.fullReasoningOn()) return 'max';
    const g = q('g-reasoning-mode') ? q('g-reasoning-mode').value : 'smart';
    return g === 'smart' ? 'high' : g;
  }

  function endpointFor(api) {
    const kit = root.AuxGameAPI;
    if (kit && typeof kit.endpoint === 'function') return kit.endpoint(api);
    const base = String(api.url || '').replace(/\/+$/, '');
    if (api.type === 'anthropic') return base.replace(/\/v1$/i, '') + '/v1/messages';
    if (api.type === 'gemini') return base.replace(/\/v1beta$/i, '') + '/v1beta/models/' + encodeURIComponent(api.model) + ':generateContent';
    return /\/chat\/completions$/i.test(base) ? base : base + '/chat/completions';
  }

  // 发请求：三种格式各自带上思考档位参数；端点明确拒绝该参数时去掉重发，不让一次 400 毁掉一行结果。
  async function requestModel(api, prompt, opts) {
    opts = opts || {};
    const mode = opts.mode || 'auto';
    const maxTokens = opts.maxTokens || 16384;
    const RC = root.ReasoningControl;
    const endpoint = endpointFor(api);
    const signal = opts.signal;
    const fail = async (res) => { const t = await res.text().catch(() => ''); const e = new Error('HTTP ' + res.status + (t ? ' · ' + t.slice(0, 200) : '')); e.detail = t; e.status = res.status; return e; };

    if (api.type === 'anthropic') {
      const body = { model: api.model, max_tokens: maxTokens, system: [{ type: 'text', text: prompt.system }], messages: [{ role: 'user', content: prompt.user }] };
      const effort = RC && mode !== 'auto' ? RC.anthropicEffort(mode) : null;
      if (effort) body.output_config = { effort };
      const send = () => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': api.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body), signal });
      let res = await send();
      if (!res.ok && res.status === 400 && body.output_config) {
        const e = await fail(res);
        if (/effort|output_config/i.test(e.detail)) { delete body.output_config; res = await send(); } else throw e;
      }
      if (!res.ok) throw await fail(res);
      const data = await res.json();
      const blocks = Array.isArray(data.content) ? data.content : [];
      return {
        text: blocks.filter(b => b.type === 'text').map(b => b.text).join(''),
        thinking: blocks.filter(b => b.type === 'thinking').map(b => b.thinking || '').join('\n'),
        usage: data.usage ? ((data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)) : null
      };
    }

    if (api.type === 'gemini') {
      const url = endpoint + '?key=' + encodeURIComponent(api.key);
      const body = { systemInstruction: { parts: [{ text: prompt.system }] }, contents: [{ role: 'user', parts: [{ text: prompt.user }] }], generationConfig: { maxOutputTokens: maxTokens } };
      const tc = RC && mode !== 'auto' ? RC.geminiThinkingConfig(api.model, mode) : null;
      if (tc) body.generationConfig.thinkingConfig = tc;
      const send = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
      let res = await send();
      if (!res.ok && res.status === 400 && body.generationConfig.thinkingConfig) {
        const e = await fail(res);
        if (/thinking/i.test(e.detail)) { delete body.generationConfig.thinkingConfig; res = await send(); } else throw e;
      }
      if (!res.ok) throw await fail(res);
      const data = await res.json();
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      return {
        text: parts.filter(p => p && p.thought !== true).map(p => p.text || '').join(''),
        thinking: parts.filter(p => p && p.thought === true).map(p => p.text || '').join('\n'),
        usage: data.usageMetadata ? (data.usageMetadata.totalTokenCount || null) : null
      };
    }

    // OpenAI 兼容
    const mn = String(api.model).toLowerCase();
    const reasoningModel = /gpt-?5|(?:^|[\/_-])o(?:1|3|4)(?:[-_.]|$)/.test(mn);
    const body = { model: api.model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], stream: true };
    if (reasoningModel) body.max_completion_tokens = Math.max(maxTokens, 8192); else { body.max_tokens = maxTokens; body.temperature = 0.7; }
    const effort = RC && mode !== 'auto' ? RC.openAIEffort(mode, true) : null;
    if (effort) body.reasoning_effort = effort;
    const headers = { 'Content-Type': 'application/json' };
    if (api.key) headers.Authorization = 'Bearer ' + api.key;
    const send = () => fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal });
    let res = await send();
    let detail = '';
    if (!res.ok) detail = await res.text().catch(() => '');
    // 中转对参数的兼容程度不一：只在明确的 400 参数错误时逐项去掉重发
    if (!res.ok && res.status === 400 && body.reasoning_effort && /reasoning|effort/i.test(detail)) { delete body.reasoning_effort; res = await send(); if (!res.ok) detail = await res.text().catch(() => detail); }
    if (!res.ok && res.status === 400 && /max_(completion_)?tokens/i.test(detail)) {
      if (body.max_completion_tokens) { body.max_tokens = body.max_completion_tokens; delete body.max_completion_tokens; }
      else { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
      res = await send(); if (!res.ok) detail = await res.text().catch(() => detail);
    }
    if (!res.ok && res.status === 400 && body.stream && /stream/i.test(detail)) { delete body.stream; res = await send(); if (!res.ok) detail = await res.text().catch(() => detail); }
    if (!res.ok) { const e = new Error('HTTP ' + res.status + (detail ? ' · ' + String(detail).slice(0, 200) : '')); e.detail = detail; throw e; }
    const data = (typeof root.parseAPIResponseWithSSEFallback === 'function')
      ? await root.parseAPIResponseWithSSEFallback(res, { tag: '[第三夜考题]' })
      : await res.json();
    const msg = (data.choices && data.choices[0] && data.choices[0].message) || {};
    return {
      text: msg.content || data.output_text || '',
      thinking: msg.reasoning_content || msg.reasoning || msg.thinking || '',
      usage: data.usage ? (data.usage.total_tokens || null) : null
    };
  }

  // ── 结果存储 ──
  const results = () => loadJson(RESULT_KEY, []);
  function addResult(r) { const list = results(); list.unshift(r); saveJson(RESULT_KEY, list.slice(0, 300)); }
  function removeResult(id) { saveJson(RESULT_KEY, results().filter(r => r.id !== id)); }

  function recordFrom(opts) {
    const g = gradeNight3Answer(opts.text);
    return {
      id: 'n3_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      at: Date.now(), model: opts.model, label: opts.label || opts.model, source: opts.source, hint: !!opts.hint, mode: opts.mode || '',
      elapsed: opts.elapsed || 0, usage: opts.usage || null, text: opts.text, thinking: opts.thinking || '',
      decision: g.decision, decisionLabel: g.decisionLabel, tier: g.tier, tierLabel: g.tierLabel, points: g.points, pointsHit: g.pointsHit, pointsTotal: g.pointsTotal, reason: g.reason
    };
  }

  // ── 面板 ──
  const state = { running: new Map(), tab: 'api' };

  function ensureDom() {
    if (q('n3b-pop')) return;
    const pop = document.createElement('div');
    pop.className = 'epop n3b-pop'; pop.id = 'n3b-pop';
    pop.innerHTML = `
<div class="ebox n3b-box">
  <div class="n3b-head">
    <h3>🧪 AI 考题 · 第三夜</h3>
    <button type="button" class="n3b-x" id="n3b-close" aria-label="关闭">✕</button>
  </div>
  <p class="n3b-intro">一局真实对局的死局：最后一只狼被炼金魔女的雾锁在自己和另一名村民之间，摄梦人刚当众说要"先翻"它。被测模型坐进狼的位置，只拿到它那一刻能看到的信息，决定今晚的刀口。评分只看两件事：最终刀口，和推演里有没有踩到几个关键点。</p>
  <div class="n3b-tabs">
    <button type="button" data-tab="api" class="on">API 模型</button>
    <button type="button" data-tab="web">网页端 AI（复制题目）</button>
    <button type="button" data-tab="self">我来答</button>
    <button type="button" data-tab="ref">题目全文 · 参考答案</button>
  </div>
  <div class="n3b-pane" data-pane="api">
    <div class="n3b-row">
      <label>思考档位 <select id="n3b-mode">
        <option value="follow">跟随全局设置</option><option value="auto">接口默认</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="xhigh">极高</option><option value="max">最高（Claude）</option>
      </select></label>
      <label><input type="checkbox" id="n3b-hint"> 附带本游戏的选刀提示</label>
      <label>输出上限 <input type="number" id="n3b-maxtk" value="16384" min="2048" step="1024" style="width:110px;min-width:110px"></label>
    </div>
    <div id="n3b-cands" class="n3b-cands"></div>
    <details class="n3b-custom"><summary>＋ 手动添加一个待测模型</summary>
      <div class="n3b-row">
        <select id="n3b-c-type"><option value="openai">OpenAI 兼容</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option></select>
        <input id="n3b-c-url" placeholder="API 地址（OpenAI 兼容格式末尾带 /v1）" style="flex:2">
        <input id="n3b-c-key" type="password" placeholder="密钥" style="flex:1">
        <input id="n3b-c-model" placeholder="模型名" style="flex:1">
        <button type="button" id="n3b-c-add">添加</button>
      </div>
    </details>
    <div class="n3b-actions">
      <button type="button" id="n3b-run" class="n3b-primary">▶ 开始测试（勾选的模型并行出题）</button>
      <button type="button" id="n3b-stop" disabled>停止</button>
    </div>
  </div>
  <div class="n3b-pane" data-pane="web" hidden>
    <p class="n3b-note">没有 API 也能测：把题目复制到任意网页端 AI，把它的完整回答贴回来评分。题目里不含参考答案。</p>
    <div class="n3b-row">
      <button type="button" id="n3b-copy">📋 复制题目</button>
      <label><input type="checkbox" id="n3b-web-hint"> 附带本游戏的选刀提示</label>
      <input id="n3b-web-model" placeholder="模型名（记录用，如 ChatGPT 网页版）" style="flex:1">
    </div>
    <textarea id="n3b-web-reply" placeholder="把模型的完整回答粘贴到这里"></textarea>
    <div class="n3b-actions"><button type="button" id="n3b-web-grade" class="n3b-primary">评分并记录</button></div>
  </div>
  <div class="n3b-pane" data-pane="self" hidden>
    <p class="n3b-note">先别看参考答案。你是最后一只狼，雾里只有你和梦子，今晚刀谁？</p>
    <div class="n3b-self">
      <label><input type="radio" name="n3b-self" value="yumeko"> 刀 Jabami Yumeko</label>
      <label><input type="radio" name="n3b-self" value="empty"> 空刀</label>
      <label><input type="radio" name="n3b-self" value="self"> 刀自己</label>
    </div>
    <div class="n3b-actions"><button type="button" id="n3b-self-check" class="n3b-primary">看结果</button></div>
    <div id="n3b-self-out" class="n3b-refbox" hidden></div>
  </div>
  <div class="n3b-pane" data-pane="ref" hidden>
    <details open><summary>题目全文（发给模型的 system + user）</summary><pre id="n3b-prompt-text" class="n3b-pre"></pre></details>
    <details><summary>参考答案与实战结果（剧透）</summary><div class="n3b-refbox" id="n3b-ref-text"></div></details>
  </div>
  <div class="n3b-results">
    <div class="n3b-results-head">
      <strong>成绩单</strong>
      <span class="n3b-grow"></span>
      <button type="button" id="n3b-export-md">复制为 Markdown</button>
      <button type="button" id="n3b-export-json">导出 JSON</button>
      <button type="button" id="n3b-clear">清空</button>
    </div>
    <div id="n3b-table"></div>
  </div>
</div>`;
    document.body.appendChild(pop);
    const detail = document.createElement('div');
    detail.className = 'epop n3b-pop'; detail.id = 'n3b-detail';
    detail.innerHTML = `<div class="ebox n3b-box n3b-detail-box"><div class="n3b-head"><h3 id="n3b-detail-title">回答详情</h3><button type="button" class="n3b-x" id="n3b-detail-close">✕</button></div><div id="n3b-detail-body"></div></div>`;
    document.body.appendChild(detail);
    bind();
  }

  function bind() {
    q('n3b-close').onclick = close;
    q('n3b-pop').addEventListener('click', e => { if (e.target === q('n3b-pop')) close(); });
    q('n3b-detail-close').onclick = () => q('n3b-detail').classList.remove('show');
    q('n3b-detail').addEventListener('click', e => { if (e.target === q('n3b-detail')) q('n3b-detail').classList.remove('show'); });
    q('n3b-pop').querySelectorAll('.n3b-tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
    q('n3b-run').onclick = runSelected;
    q('n3b-stop').onclick = stopAll;
    q('n3b-c-add').onclick = addCustom;
    q('n3b-copy').onclick = copyPrompt;
    q('n3b-web-grade').onclick = gradeWeb;
    q('n3b-self-check').onclick = selfCheck;
    q('n3b-export-md').onclick = exportMarkdown;
    q('n3b-export-json').onclick = exportJson;
    q('n3b-clear').onclick = () => { if (results().length && confirm('清空全部成绩？')) { saveJson(RESULT_KEY, []); renderTable(); } };
    q('n3b-hint').onchange = renderPromptText;
    q('n3b-ref-text').innerHTML = REFERENCE.split('\n').map(l => l.trim() ? '<p>' + esc(l) + '</p>' : '').join('');
  }

  function showTab(tab) {
    state.tab = tab;
    q('n3b-pop').querySelectorAll('.n3b-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    q('n3b-pop').querySelectorAll('.n3b-pane').forEach(p => { p.hidden = p.dataset.pane !== tab; });
    if (tab === 'ref') renderPromptText();
  }

  function renderPromptText() {
    const p = buildPrompt({ hint: q('n3b-hint').checked });
    q('n3b-prompt-text').textContent = '===== SYSTEM =====\n' + p.system + '\n\n===== USER =====\n' + p.user;
  }

  function renderCandidates() {
    const box = q('n3b-cands');
    const cands = allCandidates();
    if (!cands.length) { box.innerHTML = '<div class="n3b-empty">还没有可用的 API 配置。先在设置里填全局 API，或在下方手动添加。</div>'; return; }
    box.innerHTML = cands.map(c => {
      const ok = !!(c.key || c.type === 'openai' && /^https?:\/\/(localhost|127\.0\.0\.1)/.test(c.url));
      const st = state.running.get(c.id);
      return `<label class="n3b-cand${ok ? '' : ' off'}" data-cid="${esc(c.id)}">
        <input type="checkbox" value="${esc(c.id)}" ${ok && c.id === 'global' ? 'checked' : ''} ${ok ? '' : 'disabled'}>
        <span class="n3b-cand-name">${esc(c.name)}</span>
        <span class="n3b-cand-model">${esc(c.model)} · ${esc(c.type)}</span>
        <span class="n3b-cand-status" data-sid="${esc(c.id)}">${st ? esc(st) : (ok ? '' : '缺密钥')}</span>
        ${c.id.startsWith('custom:') ? `<button type="button" class="n3b-cand-del" data-del="${esc(c.id)}">✕</button>` : ''}
      </label>`;
    }).join('');
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = e => {
      e.preventDefault();
      const idx = parseInt(b.dataset.del.split(':')[1], 10);
      const list = loadJson(CUSTOM_KEY, []); list.splice(idx, 1); saveJson(CUSTOM_KEY, list); renderCandidates();
    });
  }

  function setStatus(cid, text) {
    state.running.set(cid, text);
    const el = q('n3b-cands') && q('n3b-cands').querySelector(`[data-sid="${CSS.escape(cid)}"]`);
    if (el) el.textContent = text;
  }

  function addCustom() {
    const type = q('n3b-c-type').value, url = q('n3b-c-url').value.trim().replace(/\/+$/, ''), key = q('n3b-c-key').value.trim(), model = q('n3b-c-model').value.trim();
    if (!url || !model) { alert('地址和模型名都要填'); return; }
    const list = loadJson(CUSTOM_KEY, []); list.push({ type, url, key, model }); saveJson(CUSTOM_KEY, list);
    q('n3b-c-url').value = ''; q('n3b-c-key').value = ''; q('n3b-c-model').value = '';
    renderCandidates();
  }

  async function runSelected() {
    const cands = allCandidates();
    const picked = [...q('n3b-cands').querySelectorAll('input[type=checkbox]:checked')].map(i => cands.find(c => c.id === i.value)).filter(Boolean);
    if (!picked.length) { alert('先勾选至少一个模型'); return; }
    const modeSel = q('n3b-mode').value, mode = resolveMode(modeSel);
    const hint = q('n3b-hint').checked;
    const maxTokens = Math.max(2048, parseInt(q('n3b-maxtk').value, 10) || 16384);
    const prompt = buildPrompt({ hint });
    const ctrl = new AbortController();
    state.abort = ctrl;
    q('n3b-run').disabled = true; q('n3b-stop').disabled = false;
    const timeoutMs = mode === 'max' || mode === 'xhigh' ? 1800000 : 900000;
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    await Promise.allSettled(picked.map(async c => {
      const t0 = Date.now();
      setStatus(c.id, '出题中…');
      const tick = setInterval(() => setStatus(c.id, '思考中 ' + Math.round((Date.now() - t0) / 1000) + 's'), 1000);
      try {
        const r = await requestModel(c, prompt, { mode, maxTokens, signal: ctrl.signal });
        clearInterval(tick);
        const rec = recordFrom({ text: r.text, thinking: r.thinking, model: c.model, label: c.name, source: 'api', hint, mode, elapsed: Date.now() - t0, usage: r.usage });
        addResult(rec); renderTable();
        setStatus(c.id, '完成：' + rec.decisionLabel + ' · ' + rec.tier);
      } catch (e) {
        clearInterval(tick);
        setStatus(c.id, '失败：' + (e && e.name === 'AbortError' ? '已停止或超时' : (e && e.message || e)));
      }
    }));
    clearTimeout(timer);
    state.abort = null;
    q('n3b-run').disabled = false; q('n3b-stop').disabled = true;
  }

  function stopAll() { if (state.abort) state.abort.abort(); }

  async function copyPrompt() {
    const p = buildPrompt({ hint: q('n3b-web-hint').checked });
    const text = '以下是一道狼人杀夜间决策题。\n\n===== SYSTEM =====\n' + p.system + '\n\n===== USER =====\n' + p.user;
    try { await navigator.clipboard.writeText(text); q('n3b-copy').textContent = '✅ 已复制'; }
    catch (_) { window.prompt('复制下面的题目：', text); }
    setTimeout(() => { q('n3b-copy').textContent = '📋 复制题目'; }, 1500);
  }

  function gradeWeb() {
    const text = q('n3b-web-reply').value.trim();
    if (!text) { alert('先把模型的回答贴进来'); return; }
    const model = q('n3b-web-model').value.trim() || '网页端 AI';
    const rec = recordFrom({ text, model, label: model, source: 'web', hint: q('n3b-web-hint').checked, mode: '' });
    addResult(rec); renderTable(); q('n3b-web-reply').value = '';
    openDetail(rec.id);
  }

  function selfCheck() {
    const picked = q('n3b-pop').querySelector('input[name=n3b-self]:checked');
    if (!picked) { alert('先选一个'); return; }
    const d = DECISIONS[picked.value];
    const out = q('n3b-self-out');
    out.hidden = false;
    out.innerHTML = `<p><b>你的选择：${esc(d.label)}</b> → 评级 <span class="n3b-tier n3b-tier-${esc(d.tier)}">${esc(d.tier)}</span> ${esc(d.tierLabel)}</p>` + REFERENCE.split('\n').map(l => l.trim() ? '<p>' + esc(l) + '</p>' : '').join('');
  }

  function fmtTime(ts) { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
  function fmtElapsed(ms) { return ms ? (ms >= 60000 ? (ms / 60000).toFixed(1) + 'min' : Math.round(ms / 1000) + 's') : '—'; }

  function renderTable() {
    const list = results();
    const box = q('n3b-table');
    if (!list.length) { box.innerHTML = '<div class="n3b-empty">还没有成绩。勾选模型开始测试，或在"网页端 AI"里粘贴回答。</div>'; return; }
    box.innerHTML = `<table class="n3b-tbl"><thead><tr><th>时间</th><th>模型</th><th>刀口</th><th>评级</th><th>要点</th><th>用时</th><th>设置</th><th></th></tr></thead><tbody>` +
      list.map(r => `<tr>
        <td>${esc(fmtTime(r.at))}</td>
        <td><b>${esc(r.model)}</b><br><small>${esc(r.label !== r.model ? r.label : (r.source === 'web' ? '网页端粘贴' : ''))}</small></td>
        <td>${esc(r.decisionLabel)}</td>
        <td><span class="n3b-tier n3b-tier-${esc(r.tier)}" title="${esc(r.tierLabel)}">${esc(r.tier)}</span></td>
        <td title="${esc((r.points || []).map(p => (p.hit ? '✓ ' : '✗ ') + p.label).join('\n'))}">${r.pointsHit}/${r.pointsTotal}</td>
        <td>${esc(fmtElapsed(r.elapsed))}</td>
        <td><small>${esc(r.mode || '—')}${r.hint ? ' · 带提示' : ''}</small></td>
        <td><button type="button" data-view="${esc(r.id)}">查看</button> <button type="button" data-rm="${esc(r.id)}">删</button></td>
      </tr>`).join('') + '</tbody></table>';
    box.querySelectorAll('[data-view]').forEach(b => b.onclick = () => openDetail(b.dataset.view));
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { removeResult(b.dataset.rm); renderTable(); });
  }

  function openDetail(id) {
    const r = results().find(x => x.id === id); if (!r) return;
    q('n3b-detail-title').textContent = r.model + ' · ' + r.decisionLabel + ' · ' + r.tier;
    q('n3b-detail-body').innerHTML = `
      <p class="n3b-note">${esc(r.tierLabel)}${r.reason ? ' · 模型给的一句话理由：' + esc(r.reason) : ''}</p>
      <ul class="n3b-points">${(r.points || []).map(p => `<li class="${p.hit ? 'hit' : ''}">${p.hit ? '✓' : '✗'} ${esc(p.label)}</li>`).join('')}</ul>
      <p class="n3b-note">用时 ${esc(fmtElapsed(r.elapsed))}${r.usage ? ' · ' + esc(r.usage) + ' tokens' : ''}${r.mode ? ' · 思考档位 ' + esc(r.mode) : ''}${r.hint ? ' · 带选刀提示' : ''}</p>
      ${r.thinking ? `<details><summary>模型思考（${r.thinking.length} 字）</summary><pre class="n3b-pre">${esc(r.thinking)}</pre></details>` : ''}
      <details open><summary>回答全文（${(r.text || '').length} 字）</summary><pre class="n3b-pre">${esc(r.text)}</pre></details>`;
    q('n3b-detail').classList.add('show');
  }

  function exportMarkdown() {
    const list = results();
    const rows = ['| 时间 | 模型 | 刀口 | 评级 | 要点 | 用时 | 设置 |', '| --- | --- | --- | :-: | :-: | --: | --- |']
      .concat(list.map(r => `| ${fmtTime(r.at)} | ${r.model} | ${r.decisionLabel} | ${r.tier} | ${r.pointsHit}/${r.pointsTotal} | ${fmtElapsed(r.elapsed)} | ${r.mode || '—'}${r.hint ? ' · 带提示' : ''} |`));
    const text = rows.join('\n');
    navigator.clipboard.writeText(text).then(() => { q('n3b-export-md').textContent = '✅ 已复制'; setTimeout(() => { q('n3b-export-md').textContent = '复制为 Markdown'; }, 1500); }).catch(() => window.prompt('复制：', text));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ puzzle: 'night3', exportedAt: new Date().toISOString(), results: results() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'night3-bench-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function open() {
    ensureDom();
    renderCandidates(); renderTable(); showTab(state.tab);
    q('n3b-pop').classList.add('show');
  }
  function close() { const p = q('n3b-pop'); if (p) p.classList.remove('show'); }

  api.openUI = open;
  api.closeUI = close;
  api.requestModel = requestModel;

  const hook = () => { const b = q('btn-night3-bench'); if (b && !b._n3b) { b._n3b = true; b.addEventListener('click', open); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook, { once: true }); else hook();

  return api;
});
