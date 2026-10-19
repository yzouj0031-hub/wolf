// 📖 经验库：别人打过的几局 + 几段说得好的发言。
//   思路：不讲道理，给模型看带结果的具体对局，让它自己从结果里悟；再给几段真人口气的范例让它模仿口吻。
//   每次发言按「本局有哪些角色、我是什么阵营、现在什么阶段、场上有没有对跳 / 我是否被查杀 / 是否残局」
//   挑 2 个案例 + 2 段范例注入，总量控制在 1600 字以内；同一局不同轮次会轮换，避免每次都看同一段。
//   案例里只出现本局真实存在的角色（needs），不然会撞上「本局没有的角色一次都不许提」的硬规则。
//   纯净 / 仅自定义世界书模式下不注入（那两个模式的意思就是"不要内置教学"）。
(function (root) {
  'use strict';

  // when: day 白天发言 / pk 平票自救 / sheriff 竞选演讲 / lastwords 遗言 / wolfnight 狼队密谈
  // team: good 好人 / bad 狼 / any 都看
  // tags: early 首日 / late 残局 / counterclaim 场上有对跳 / accused 我被查杀或被点名 / noinfo 我是没信息的民牌
  const CASES = [
    { id: 'seer_counterclaim', needs: ['seer'], team: 'good', when: ['day', 'sheriff', 'pk'], tags: ['counterclaim', 'early'],
      text: '有一局，4号首夜验出9号是狼，天亮直接跳预言家报查杀，顺手把警徽流说死："今晚验2号，后天验6号，我要是假的，明天这两个结果对不上你们就推我。"9号马上对跳，说自己验的4号是狼，警徽流只给了一句"看情况再验"。那天票很散，4号差一票出局。第二天4号报2号金水，2号整天的发言和票都跟4号对得上；9号报6号查杀，6号把9号前一天说过的三句话一句句顶回去。第三天9号出局翻狼。事后有人说：两个人都说自己是预言家，差别在谁敢把明天说死。' },
    { id: 'accused_villager', needs: ['seer'], team: 'good', when: ['day', 'pk'], tags: ['accused'],
      text: '5号平民首日被8号报查杀。他没喊"我是平民"，开口是："8号说我是狼，我不急着自证，这句话谁都会说。我今天的票跟8号的警徽流走，他明天验出来的人要是狼，我认他是真的，我出局也认；要是验出来的人对不上，大家明天回头看他。"这天5号没出局。第二天8号报的查杀，是前一天唯一一个明确说信5号的人，场上几个人同时皱了眉。8号第三天出局翻狼。5号后来说：被查杀的人最没用的话是喊冤，最有用的是把明天押上去。' },
    { id: 'witch_late_claim', needs: ['witch', 'seer'], team: 'good', when: ['day'], tags: ['counterclaim'],
      text: '女巫2号首夜看见刀口是7号，救了，天亮一个字没说。7号自己不知道被刀过，前两天都当普通民牌在打。第三天7号跳预言家，和3号对跳。2号这时才开口："首夜被刀的是7号，是我救的。狼第一夜就刀他，你们自己想。"3号当天出局翻狼。2号憋了两天没跳，换来的是一句谁也编不出来的话。' },
    { id: 'wolf_quiet_survive', needs: ['werewolf', 'seer'], team: 'bad', when: ['day', 'pk'], tags: ['counterclaim', 'late'],
      text: '狼10号那局，队友9号首日就被真预言家查杀。9号想拉他对跳，10号没接。他白天说的是："4号的警徽流我听着挺顺，我先跟一天，明天结果出来再看。"投票时他把票投给了自己队友9号，脸上不好看，但理由讲得清。后面两天他发言不多，每轮只点一个具体的话头，票总跟着大多数走。最后一天场上剩他、一个真神和两个民，他一票把真神投了出去，狼赢。复盘时好人说：从头到尾没觉得他可疑，因为他每天都在"认账"。' },
    { id: 'wolf_self_knife', needs: ['werewolf'], team: 'bad', when: ['wolfnight'], tags: [],
      text: '一局狼队夜聊，队友A白天被两个人盯上，眼看第二天要出局。B提议：今晚刀A，自己人。A死在刀下，白天所有人默认"狼不会刀自己人"，昨天踩A最凶的那两个好人反而成了焦点，当天确实推出去一个好人。但第三天有个民牌问了一句："刀口为什么突然从最有用的好人跳到一个被怀疑的人身上？狼怕他什么？"没人答得上来，B当天出局。自刀换来了一天，也留下了一个解释不了的刀口。' },
    { id: 'wolf_night_disagree', needs: ['werewolf', 'seer'], team: 'bad', when: ['wolfnight'], tags: [],
      text: '狼队夜聊，A提议刀明预言家。B觉得预言家明天才报第一张查验，现在刀他反而坐实了"他是真的"，提议刀跟预言家站得最紧的那个民牌，第二天好人内部会先吵"预言家为什么不护他"。两人有分歧，谈了两轮，最后刀了民牌。第二天好人果然先互相盘了半天，预言家的第二张查验被淹在吵架里。' },
    { id: 'wolf_fake_check', needs: ['werewolf', 'seer'], team: 'bad', when: ['day', 'wolfnight'], tags: ['counterclaim'],
      text: '狼11号悍跳预言家，第二天要报一张查杀。队友夜里想让他报最会盘的那个好人。他没有，报的是前一天把票投向自己队友的那个人，理由能接上昨天的票型："他昨天那票是往我队友身上投的，我今晚就验了他。"这张查杀场上一半人点头。悍跳撑了三天，最后是真预言家的第三张金水把他顶下去的，不是发言。' },
    { id: 'villager_noinfo', needs: ['villager'], team: 'good', when: ['day'], tags: ['noinfo', 'early'],
      text: '1号村民前置位，首日什么信息都没有。他没编故事，说的是："我1号，没信息，不给大家瞎编。我就记一件事：昨天竞选时8号说过要跟警长的票，最后那票投到别处去了，我想听他解释一句。"8号说"看错票了"。第二天8号又一次票没跟上自己说的话，1号把两天的话摆在一起，8号出局翻狼。他全程没说过一句"我觉得他像狼"。' },
    { id: 'lastwords_crying', needs: [], team: 'good', when: ['day', 'lastwords'], tags: ['late'],
      text: '9号被投出局，遗言是："我是平民，你们推错了，狼在4号和6号里面，你们自己想吧。"场上三个人当场动摇，开始回头怀疑4号。5号说了一句："他这段话里没有一条是查验、用药这种能对的东西，全是判断。他是狼也这么喊，是好人也这么喊。我按昨天的逻辑走。"第二天4号还活着，报出的东西又对上了。9号翻牌是狼。' },
    { id: 'sheriff_honest', needs: ['seer'], team: 'good', when: ['sheriff'], tags: ['early'],
      text: '3号上警，演讲只有三句："我不是预言家，不报身份。我上警是想拿发言顺序，今天让后置位先说，前置位最后收。谁要是预言家，警徽我可以让。"他拿了警徽，没骗一个人。后来真预言家跳出来，3号当天就把归票权交了出去。好人赢。那局几个狼后来说：他一上来就把"我不是神"说死，我们找不到他的漏。' },
    { id: 'change_vote', needs: [], team: 'any', when: ['day', 'pk'], tags: ['accused'],
      text: '6号被7号指着说"上午说投A，下午改投B，改票的就是狼"。6号没发火，回了一句："我改票是因为B下午那句\'我没说过要保A\'对不上他上午的话，我这里记着原话。你觉得改票就是狼，那你把我上午的逻辑哪一步错了指出来，我听。"7号没接上。那天出局的是B，翻狼。' },
    { id: 'hunter_shot', needs: ['hunter'], team: 'good', when: ['day', 'lastwords'], tags: ['late'],
      text: '猎人7号白天被投出局。开枪前他没找嗓门最大的，说："我枪12号。不是因为他投了我，是归票的时候他改票的理由，和他上午说的那句对不上。"12号翻狼。另一桌的猎人带走的是全场最凶的那个人，翻开是个平民，那局好人输了。' },
    { id: 'endgame_two_lines', needs: ['seer'], team: 'good', when: ['day', 'pk'], tags: ['late', 'counterclaim'],
      text: '残局两狼三好。A说自己是预言家、验了B是狼，B说自己是民。6号拿不准谁真，于是不算"谁像好人"，改算两边投错的后果：投B错了直接输，投A错了也输，一样。那就看票：A前一天那票投给了后来翻狼的人，B前一天那票投给了后来翻好人的人。他投了B。翻狼，好人赢。' },
    { id: 'guard_quiet', needs: ['guard', 'seer'], team: 'good', when: ['day'], tags: [],
      text: '守卫4号前两夜守的都是最像预言家的那个人，第二夜守中了，天亮是平安夜。他没跳，白天只说："平安夜，谁救的谁守的我不管，预言家你照常报。"第三天有人跳守卫说"第二夜守的是3号"，4号这才开口："第二夜守的是我，守的5号，不是3号。"对方当场出局翻狼。他说：守卫的记录只有一份是真的，留着，等人来撞。' }
  ];

  const EXAMPLES = [
    { id: 'ex_noinfo', needs: [], team: 'good', when: ['day'], tags: ['noinfo', 'early'],
      text: '我2号，昨晚平安夜，我手里没东西。先把话放这儿：我今天不会随便点人。1号刚才说"3号太冷静像狼"，这个我不接，冷静不是罪。我想听3号说一句，他昨天那票为什么投4号。',
      why: '没信息也说了一件具体的事，而且明确不接没依据的指控。' },
    { id: 'ex_accused', needs: [], team: 'any', when: ['day', 'pk'], tags: ['accused'],
      text: '7号说我洗8号，行，我把原话摆出来：我说的是"8号那句话我没听出问题"，不是"8号是好人"，这两句差得远。你要踩我，先把我哪句话错了说出来，别拿"感觉"打我。',
      why: '被踩时拿原话回击，不喊冤，不发火。' },
    { id: 'ex_seer', needs: ['seer'], role: 'seer', team: 'good', when: ['day', 'sheriff'], tags: ['counterclaim', 'early'],
      text: '我预言家，昨晚验的6号，狼。今晚我验9号，后天验3号，话说死在这儿，明天结果对不上你们直接推我。6号你现在怎么说都行，我只看明天的票。',
      why: '报信息、把明天押上去、不跟对方吵。' },
    { id: 'ex_wolf_plain', needs: [], team: 'bad', when: ['day'], tags: [],
      text: '我昨天那票投错了，认。4号那句话我当时听进去了，现在回头看是我急了。今天我不带节奏，先听5号把他的路线说完，我跟着走。',
      why: '认错、跟票、不抢戏，像个普通好人。' },
    { id: 'ex_push', needs: [], team: 'any', when: ['day', 'pk'], tags: ['late'],
      text: '说到这儿了，我归票：出8号。理由就一条，他第一天说"我绝对不投2号"，今天票在2号身上，而2号刚才翻了好人。你们可以不认，但别说没人提过。',
      why: '归票只给一条硬理由，说完就停。' },
    { id: 'ex_lastwords', needs: [], team: 'any', when: ['lastwords'], tags: [],
      text: '我走了。留一句能对的东西：我昨晚是被刀的，刀口选我，你们想想谁最怕我今天开口。别信我的判断，信这个事实。',
      why: '遗言只留能验的东西，不留一串名单。' },
    { id: 'ex_wolf_night', needs: [], team: 'bad', when: ['wolfnight'], tags: [],
      text: '我不同意刀4号。他明天报的东西要是对上了，我们刀他等于替他盖章。我提议刀6号，他是今天唯一一个明确说信4号的人，明天好人会先吵4号为什么不护他。你们要是觉得4号非刀不可，说个理由，我听。',
      why: '密谈里直接说分歧、给替代方案、留台阶。' }
  ];

  const PHASE_RE = [
    [/遗言/, 'lastwords'],
    [/竞选演讲|警长最终陈词|警长竞选追加发言/, 'sheriff'],
    [/狼队密谈|狼盟密约|狼队平票/, 'wolfnight'],
    [/PK发言/, 'pk']
  ];

  function phaseOf(task, S) {
    const t = task || {};
    const opts = t.opts || {};
    const prompt = String(t.prompt || '');
    if (opts.wolfOnly) return 'wolfnight';
    if (opts.skillConfirm || opts.plainResponse || opts.requireGame === false) return '';
    if (typeof root.promptTaskKind === 'function' && root.promptTaskKind(t) !== 'speech') return '';
    for (const [re, ph] of PHASE_RE) if (re.test(prompt)) return ph;
    if (/白天发言|额外发言/.test(prompt)) return 'day';
    if (S && S.phase === 'day') return 'day';
    return '';
  }

  const CLAIM_RE = /我(?:是|就是|才是)(预言家|女巫|守卫|猎人|骑士|魔术师|摄梦人)/g;

  function ctxOf(p, task, S) {
    S = S || root.S || {};
    const players = Array.isArray(S.players) ? S.players : [];
    const roles = new Set(players.map(x => x && x.role && x.role.id).filter(Boolean));
    const alive = players.filter(x => x && x.alive).length;
    const history = Array.isArray(S.history) ? S.history : [];
    const claims = {};
    let accused = false;
    const me = p ? [p.name, 'P' + (p.id + 1), (p.id + 1) + '号'].filter(Boolean) : [];
    for (const h of history) {
      const text = String(h && h.text || '');
      let m;
      CLAIM_RE.lastIndex = 0;
      while ((m = CLAIM_RE.exec(text))) (claims[m[1]] = claims[m[1]] || new Set()).add(h.name);
      if (p && h.name !== p.name && /查杀|是狼|出他|投他|推他/.test(text) && me.some(k => text.includes(k))) accused = true;
    }
    const counterclaim = Object.values(claims).some(s => s.size >= 2);
    const round = S.round || 0;
    const team = p && p.role ? (p.role.team || 'good') : 'good';
    return {
      phase: phaseOf(task, S), round, roles, alive, team,
      roleId: p && p.role ? p.role.id : '',
      tags: new Set([
        round <= 1 ? 'early' : '',
        round >= 3 || (round >= 2 && alive > 0 && alive <= 5) ? 'late' : '',
        counterclaim ? 'counterclaim' : '',
        accused ? 'accused' : '',
        p && p.role && p.role.id === 'villager' ? 'noinfo' : ''
      ].filter(Boolean)),
      salt: round * 7 + (p ? p.id : 0)
    };
  }

  function fits(item, ctx) {
    if (!item.when.includes(ctx.phase)) return false;
    if (item.team !== 'any' && item.team !== ctx.team) return false;
    if (item.role && item.role !== ctx.roleId) return false;   // 身份专属范例（如预言家报查验）只给那个座位看
    if (ctx.team === 'third' && item.team !== 'any') return false;
    for (const r of item.needs || []) if (!ctx.roles.has(r)) return false;
    return true;
  }

  function pick(list, ctx, n) {
    const cands = list.filter(it => fits(it, ctx));
    if (!cands.length) return [];
    const scored = cands.map((it, i) => ({ it, score: (it.tags || []).reduce((s, t) => s + (ctx.tags.has(t) ? 2 : 0), 0), rot: (i + ctx.salt) % cands.length }));
    scored.sort((a, b) => b.score - a.score || a.rot - b.rot);
    return scored.slice(0, n).map(x => x.it);
  }

  function enabled() {
    if (root.WOLF_EXPERIENCE_OFF) return false;
    const box = typeof document !== 'undefined' ? document.getElementById('m-experience') : null;
    if (box && !box.checked) return false;
    const twb = root.TeachingWorldbooks;
    const mode = twb && typeof twb.mode === 'function' ? twb.mode() : 'official';
    return mode === 'official' || mode === 'hybrid';
  }

  function select(p, task, S) {
    const ctx = ctxOf(p, task, S);
    if (!ctx.phase) return { ctx, cases: [], examples: [] };
    return { ctx, cases: pick(CASES, ctx, 2), examples: pick(EXAMPLES, ctx, 2) };
  }

  const MAX_CHARS = 1600;

  function build(p, task, S) {
    if (!enabled()) return '';
    const { cases, examples } = select(p, task, S);
    if (!cases.length && !examples.length) return '';
    let out = '';
    if (cases.length) {
      out += '\n\n【别人打过的几局·只是给你看看，不是教你照做】这些局和你这局不一样，结果也不一定可复制，自己掂量哪些能用。\n'
        + cases.map(c => '· ' + c.text).join('\n');
    }
    if (examples.length) {
      out += '\n\n【几段说得还行的发言·看看口气就好】\n'
        + examples.map(e => '· 「' + e.text + '」（' + e.why + '）').join('\n');
    }
    if (out.length > MAX_CHARS) {
      // 超出预算时先丢第二个案例，再丢第二段范例
      const c2 = cases.length > 1 ? cases.slice(0, 1) : cases;
      const e2 = examples.length > 1 ? examples.slice(0, 1) : examples;
      out = '';
      if (c2.length) out += '\n\n【别人打过的几局·只是给你看看，不是教你照做】这些局和你这局不一样，结果也不一定可复制，自己掂量哪些能用。\n' + c2.map(c => '· ' + c.text).join('\n');
      if (e2.length) out += '\n\n【几段说得还行的发言·看看口气就好】\n' + e2.map(e => '· 「' + e.text + '」（' + e.why + '）').join('\n');
    }
    return out;
  }

  root.WolfExperience = { CASES, EXAMPLES, ctxOf, phaseOf, pick, select, build, enabled, MAX_CHARS };
})(typeof window !== 'undefined' ? window : globalThis);
