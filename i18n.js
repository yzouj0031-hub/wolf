(function () {
  'use strict';

  const STORAGE_KEY = 'wolf-ui-language';
  const ROLE_EN = {
    werewolf:{name:'Werewolf',desc:'Wolf team. Discusses and votes with the pack to attack one player each night.'},
    wolfking:{name:'Wolf King',desc:'Wolf team. Joins the nightly attack; when eliminated by vote or a night attack, may bite one player. Poison and a Knight duel suppress the bite.'},
    wolfbeauty:{name:'Wolf Beauty',desc:'Wolf team. Joins the nightly attack and charms one player each night; when she leaves the game, the current target dies with her unless the game has already ended.'},
    seer:{name:'Seer',desc:'Good team. Checks one player each night and learns whether that player is good or wolf-aligned.'},
    witch:{name:'Witch',desc:'Good team. Has one antidote and one poison. Each potion can be used once.'},
    hunter:{name:'Hunter',desc:'Good team. When eliminated by vote or a night attack, may shoot one player. Poison suppresses the shot.'},
    guard:{name:'Guard',desc:'Good team. Protects one player from night attacks each night and cannot protect the same target on consecutive nights.'},
    knight:{name:'Knight',desc:'Good team. May publicly duel a player: a wolf target dies; against a good target, only the Knight dies.'},
    magician:{name:'Magician',desc:'Good team. Acts first each night and may swap two living seat numbers. The swap redirects only the wolf attack.'},
    whitecat:{name:'White Cat',desc:'Good team. The first time it would die at night, death is delayed until the next day unless healed.'},
    fox:{name:'Fox Cub',desc:'Good team. Each night may block a target’s skill or block a wolf attack aimed at that target.'},
    fool:{name:'Fool',desc:'Good team. Has one shared survival charge: survive the first daytime exile, or place a nightly shield that returns to the Fool if its target is not attacked.'},
    merchant:{name:'Miracle Merchant',desc:'Good team. Once per game grants a trusted player a shield, recurring investigation, or poison. Granting a wolf backfires and eliminates the Merchant.'},
    youshang:{name:'Traveling Merchant',desc:'Good team. Each night may grant a different trusted player a shield, investigation, or poison for that night only. Granting a wolf backfires.'},
    wolfconcubine:{name:'Eclipse Consort',desc:'Wolf team. Each night marks a player; the first investigation, protection, or poison aimed there reflects to its user. Reflected investigation/protection is not lethal.'},
    villager:{name:'Villager',desc:'Good team. Has no night ability and relies on discussion, voting, and behavioral reads.'},
    whitewolf:{name:'White Wolf King',desc:'Wolf team. Joins the nightly attack and may self-destruct during daytime discussion or voting to take one player along.'},
    mechwolf:{name:'Mechanical Wolf',desc:'Wolf team but unknown to the pack. Once per game learns and copies a role; gains its own attack only after all other wolf roles are gone.'},
    jester:{name:'Jester',desc:'Independent. Wins immediately only when exiled by daytime vote or convicted by trial.'},
    cupid:{name:'Cupid',desc:'Good team. On the first night links two players as lovers; cross-team lovers form a hidden lovers faction.'},
    serialkiller:{name:'Serial Killer',desc:'Independent. Attacks separately each night and must be eliminated before either main faction can win.'}
  };
  const ROLE_ZH = {werewolf:'狼人',wolfking:'狼王',wolfbeauty:'狼美人',seer:'预言家',witch:'女巫',hunter:'猎人',guard:'守卫',knight:'骑士',magician:'魔术师',whitecat:'白猫',fox:'子狐',fool:'愚者',merchant:'奇迹商人',youshang:'游商',wolfconcubine:'蚀时狼妃',villager:'村民',whitewolf:'白狼王',mechwolf:'机械狼',jester:'小丑',cupid:'丘比特（爱神）',serialkiller:'连环杀手'};

  const EXACT = {
    '🐺 AI狼人杀 · 多个大模型在线自动对局·可观战':'🐺 AI Werewolf · multi-model autonomous games · spectator mode',
    '未登录 · 当前仅保存到本机':'Not signed in · saved locally only','登录 / 注册':'Sign in / Register','云存档':'Cloud saves',
    '上传':'Upload','恢复':'Restore','上传配置':'Upload config','下载配置':'Download config','退出':'Sign out',
    '先看一局 Demo':'Watch a demo first','无需 API Key · 点击即自动观战':'No API key required · click to spectate automatically',
    '十人局':'10 players','十二人局':'12 players','十四人局':'14 players','经典局':'Classic','经典大局':'Large classic',
    '诡术局':'Trickster game','血案局':'Bloodbath','红线局':'Red Thread','自定':'Custom','自由配置':'Free setup','角色与人数':'Roles & players',
    '天机':'Director','纯AI十人':'10-player AI','上帝视角观战':'Omniscient spectator','斗蛐蛐':'AI arena','自定义配置':'Custom setup',
    '群聊':'Group chat','自由群聊':'Open chat','随便聊什么都行':'Talk about anything','剧本杀':'Murder mystery','搜证·圆桌·指认':'Investigate · discuss · accuse',
    '观众席':'Audience','启用':'Enable','话多':'Talkative','适中':'Balanced','话少':'Quiet','编辑观众':'Edit audience',
    '好人阵营':'Good team','消灭所有狼人':'Eliminate every wolf','狼人阵营':'Wolf team','好人存活≤狼人即胜':'Win when wolves reach parity',
    '隐藏身份与心声':'Hide roles and inner thoughts','死亡后揭示身份':'Reveal roles after death','死者身份不公开':'Dead roles stay hidden',
    '增加推理难度':'Harder deduction','随机分配性格':'Assign personalities randomly','影响说话风格':'Changes speaking style',
    '十分怀疑时可发起审判':'Start a trial under strong suspicion','全员投票决定去留':'Everyone votes on the verdict','并发':'Concurrency','多路同时请求':'Run multiple requests at once',
    '书写速度可调':'Adjustable response speed','自创角色':'Custom roles','角色生成器':'Role generator','壁纸':'Wallpaper','名字库':'Name library','人设库':'Persona library',
    '名称':'Name','人设':'Persona','保存':'Save','清空':'Clear','取消':'Cancel','返回':'Back','添加':'Add','当前使用默认背景':'Using default background',
    '透明度':'Opacity','模糊度':'Blur','暗化':'Darken','移除壁纸':'Remove wallpaper','总人数':'Total players','存为模式':'Save as mode',
    'AI运行方式':'AI control mode','API 自动扮演（纯AI）':'Automatic API players','网页端AI（复制提示词／粘贴回复）':'Web AI (copy prompt / paste reply)',
    '你的参与方式':'Your participation','纯观战（全部角色由AI扮演）':'Spectate only (all roles are AI)','开始剧本杀':'Start mystery','重新开局':'Restart',
    '开场':'Opening','在场角色':'Characters','复制私密提示词，再粘贴回复':'Copy the private prompt, then paste the reply','提交回复':'Submit reply',
    '角色名':'Role name','第三方':'Independent','技能模板':'Ability template','积木技能':'Ability blocks','可多选叠加':'Combine multiple abilities',
    '无（只有人设，夜里无技能）':'None (persona only; no night ability)','能力简介':'Ability summary','AI行动指南':'AI action guide','保存角色':'Save role',
    '最多4位，只有你能看到观众评论，AI玩家完全不知情。':'Up to 4. Only you can see audience comments; AI players never know about them.',
    '添加观众':'Add spectator','成员':'Members','添加成员':'Add member','导入上局角色':'Import last game’s cast','狼人杀复盘':'Werewolf review',
    '下午茶闲聊':'Afternoon tea','推理讨论':'Deduction','自由对话':'Free conversation','回到最新':'Jump to latest','开始自聊':'Start auto chat','间隔':'Interval','插话':'Interject',
    'AI 剧本杀':'AI murder mystery','首发剧本 · 6人 · 本格推理':'Launch story · 6 players · classic mystery','米花町别墅事件':'Beika Villa Case',
    '网页端AI接力':'Web AI relay','等待中':'Waiting','展开设置':'Show settings','导演模式':'Director mode','备选API（主API失败时依次尝试）':'Fallback APIs (used in order)',
    '摘要模型（记忆压缩专用）':'Summary model (memory compression)','启用记忆压缩':'Enable memory compression','关掉':'Disable',
    '摘要专用模型：建议填便宜小模型（如 gpt-4o-mini、claude-haiku-4-5）。留空则用玩家自己的模型。':'Summary model: use an inexpensive small model. Leave blank to use the player model.',
    'OpenAI兼容':'OpenAI compatible','自定义…':'Custom…','不限':'Unlimited','AI主持人':'AI host','启用AI主持人':'Enable AI host','主持模式':'Host mode',
    '解说员（只点评，不参与流程）':'Commentator (comments only)','司仪（引导流程+戏剧性宣布）':'Emcee (guides flow and announcements)','简短':'Brief','详细':'Detailed',
    '并发设置':'Concurrency','发言':'Speech','狼议':'Wolf discussion','狼票':'Wolf vote','审判票':'Trial vote','感言':'Closing remarks','AI 思考时间（秒）':'AI thinking time (seconds)',
    '单次请求上限':'Request timeout','密约·提案':'Wolf pact · proposal','密约·投票':'Wolf pact · vote','名讳':'Names','点击命牌可单独设名字和API':'Click a role card to set its name and API',
    '座位排序（拖拽调整）':'Seat order (drag to reorder)','随机打乱':'Shuffle','恢复默认':'Restore default','仅第一夜':'First day only','每次都有':'Always','从不':'Never',
    '盲名Cosplay':'Blind-name cosplay','硬核':'Hardcore','导演刀口主控':'Director controls wolf target','准备就绪':'Ready','提问':'Ask','读档':'Load save','朗读':'Read aloud',
    '设置':'Settings','重置本局':'Reset game','向角色提问':'Ask a character','选择角色':'Choose character','发送':'Send','全员互评 · MVP':'All-player review · MVP','开始评选':'Start voting','知悉':'Understood',
    '身份(随机)':'Role (random)','API地址':'API URL','从库选':'Choose from library','API密钥':'API key','模型':'Model','永久记忆':'Persistent memory','已启用':'Enabled',
    '开启后，该角色将带着上一局的记忆进入新局':'When enabled, this character remembers the previous game','上一局记忆摘要：':'Previous-game memory:','暂无上一局记忆':'No previous memory',
    '清除记忆':'Clear memory','头像':'Avatar','角色BGM':'Character music','搜库':'Search library','AI参数调节（勾选启用，不勾则用默认值）':'AI parameters (check to override defaults)',
    '频率惩罚':'Frequency penalty','存在惩罚':'Presence penalty','上下文记忆条数':'Context memory entries','默认':'Default','确定':'Confirm',
    '简体中文':'Simplified Chinese','语言':'Language','设置面板':'Settings','更多功能':'More actions',
    '对局、显示与音效设置':'Game, display & audio','展开':'Expand','收起':'Collapse','开局':'Start game','继续':'Continue','自动':'Auto',
    '暂停':'Pause','导出':'Export','规则':'Rules','存档':'Saves','复盘':'Review','重置':'Reset','分享':'Share','观战Demo':'Watch demo',
    '匿名':'Anonymous','审判':'Trial','隐死亡':'Hidden deaths','遗言':'Last words','事实校验':'Fact check','性情':'Personality',
    '精简特效':'Reduced effects','主持人':'Host','音效':'Sound','模型标签':'Model labels','思维链':'Reasoning','自由输出':'Natural output',
    '手动重试':'Manual retry','屠边':'Edge victory','骑士连斩':'Knight streak','单轮发言':'Single speech round','警长每日定序':'Daily sheriff order',
    '人设随机池':'Random persona pool','夜间BGM':'Night music','白天BGM':'Day music','无音乐':'None','自定义上传':'Upload','自定义链接':'URL',
    '拉取':'Fetch','测试':'Test','全部应用':'Apply all','批量分配':'Batch assign','全选':'Select all','反选':'Invert','应用':'Apply',
    '关闭':'Close','复制':'Copy','下载':'Download','导入':'Import','排行榜':'Leaderboard','聊天摘要':'Chat summary','导出记录':'Export record',
    '导出配置':'Export config','导入配置':'Import config','复盘页面':'Review page','本局规则':'Game rules','完整角色百科':'Full role encyclopedia',
    '── 本局规则（可复制给外部AI）──':'— Active game rules (for external AI) —','── 完整角色与规则百科 ──':'— Complete role & rules encyclopedia —',
    '只包含当前对局实际生效的角色和交互，适合直接复制给网页端 AI。':'Contains only roles and interactions active in this game; suitable for web AI.',
    '包含全部可用角色，供查阅或准备下一场使用；正常网页端 AI 接力不需要复制这一整本。':'Lists every available role for reference and future games. Normal web-AI relay does not need the whole encyclopedia.',
    '返回本局规则':'Back to game rules','复制提示词':'Copy prompt','取消本次接力':'Cancel relay','确认提交':'Submit','重新选择':'Choose again',
    '准备就绪':'Ready','今日发言顺序':'Today’s speaking order','展开命牌':'Show role cards','收起命牌':'Hide role cards',
    '轮到你':'Your turn','落笔此处...':'Type here…','呈上':'Submit','身份':'Role','存活':'Alive','已出局':'Eliminated','警长':'Sheriff',
    '白天':'Day','夜晚':'Night','投票':'Vote','平安夜':'No deaths','候选人':'Candidates','退选':'Withdraw','最终陈词':'Final statement',
    '慢':'Slow','中':'Normal','快':'Fast','疾':'Very fast','书写速度':'Typing speed','回复上限':'Response limit','记忆':'Memory',
    'API 地址':'API URL','API 密钥':'API key','模型名称':'Model name','留空随机 | 逗号分隔':'Leave blank for random · comma separated'
  };

  const PHRASES = [
    [/第(\d+)回合/g, 'Round $1'], [/第(\d+)夜/g, 'Night $1'], [/第(\d+)天/g, 'Day $1'],
    [/存活：(\d+)人/g, '$1 alive'], [/已出局：/g, 'Eliminated: '], [/警长：/g, 'Sheriff: '],
    [/白天/g, 'Day'], [/夜晚/g, 'Night'], [/投票/g, 'Vote'], [/平安夜/g, 'No deaths'],
    [/被投票放逐/g, 'was exiled by vote'], [/被放逐/g, 'was exiled'], [/已死亡/g, 'is dead'], [/死亡/g, 'death'], [/出局/g, 'eliminated'],
    [/守护/g, 'protect'], [/查验/g, 'inspect'], [/毒药/g, 'poison'], [/解药/g, 'antidote'], [/魅惑/g, 'charm'], [/决斗/g, 'duel'],
    [/狼人刀口/g, 'wolf attack target'], [/狼队夜刀/g, 'wolf attack'], [/自爆/g, 'self-destruct'], [/开枪/g, 'shoot'], [/平票/g, 'tie'],
    [/好人/g, 'good'], [/狼人/g, 'wolf'], [/阵营/g, 'team'], [/技能/g, 'ability'], [/目标/g, 'target'], [/结果/g, 'result'],
    [/昨晚：平安夜/g, 'Last night: no deaths'], [/当前回合：/g, 'Current round: '],
    [/设置面板/g, 'Settings'], [/更多设置与音效/g, 'More settings & audio'],
    [/复制给网页端AI/g, 'Copy for web AI'], [/生成规则失败/g, 'Failed to generate rules']
  ];

  function normalizeLang(value) { return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'zh-CN'; }
  let lang = normalizeLang(localStorage.getItem(STORAGE_KEY) || navigator.language || 'zh-CN');
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();
  function isEnglish() { return lang === 'en'; }
  function role(id, fallback) { return isEnglish() && ROLE_EN[id] ? ROLE_EN[id] : fallback; }
  function translateText(input) {
    if (!isEnglish() || !input || !String(input).trim()) return input;
    const raw = String(input);
    const lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0], core = raw.trim();
    if (EXACT[core]) return lead + EXACT[core] + tail;
    const decorated = core.match(/^([^A-Za-z0-9\u3400-\u9fff]*)([\s\S]+)$/);
    if (decorated && decorated[1] && EXACT[decorated[2].trim()]) {
      return lead + decorated[1] + EXACT[decorated[2].trim()] + tail;
    }
    let out = core;
    for (const [id, info] of Object.entries(ROLE_EN).sort((a,b) => ROLE_ZH[b[0]].length - ROLE_ZH[a[0]].length)) {
      const zh = ROLE_ZH[id];
      if (zh) out = out.replace(new RegExp(zh.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), info.name);
    }
    for (const [re, value] of PHRASES) out = out.replace(re, value);
    return lead + out + tail;
  }

  function translateNode(root) {
    if (!isEnglish() || !root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (!root.parentElement || /^(SCRIPT|STYLE|TEXTAREA)$/i.test(root.parentElement.tagName)) return;
      if (!originalText.has(root)) originalText.set(root, root.nodeValue);
      const next = translateText(root.nodeValue);
      if (next !== root.nodeValue) root.nodeValue = next;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      for (const attr of ['placeholder','title','aria-label']) {
        if (root.hasAttribute(attr)) {
          if (!originalAttrs.has(root)) originalAttrs.set(root, {});
          const saved = originalAttrs.get(root);
          if (!(attr in saved)) saved[attr] = root.getAttribute(attr);
          root.setAttribute(attr, translateText(root.getAttribute(attr)));
        }
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateNode);
    if (root.querySelectorAll) root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(translateNode);
  }

  function makePicker() {
    if (document.getElementById('wolf-language-picker')) return;
    const wrap = document.createElement('label');
    wrap.id = 'wolf-language-picker';
    wrap.innerHTML = '<span>🌐</span><select aria-label="Language"><option value="zh-CN">简体中文</option><option value="en">English</option></select>';
    Object.assign(wrap.style, {position:'fixed',left:'10px',right:'auto',top:'auto',bottom:'max(8px, env(safe-area-inset-bottom))',zIndex:'1200',display:'flex',alignItems:'center',gap:'4px',padding:'4px 7px',border:'1px solid rgba(245,160,184,.22)',borderRadius:'8px',background:'rgba(15,13,27,.9)',color:'#d8d0e8',fontSize:'12px',backdropFilter:'blur(8px)'});
    const select = wrap.querySelector('select');
    Object.assign(select.style, {background:'transparent',border:'0',color:'inherit',font:'inherit',outline:'none'});
    select.value = lang;
    select.addEventListener('change', () => setLang(select.value));
    document.body.appendChild(wrap);
  }

  function apply() {
    document.documentElement.lang = isEnglish() ? 'en' : 'zh-CN';
    makePicker();
    if (isEnglish()) translateNode(document.body);
  }
  function restoreChinese(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    const nodes = [root]; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && originalText.has(node)) node.nodeValue = originalText.get(node);
      if (node.nodeType === Node.ELEMENT_NODE && originalAttrs.has(node)) {
        const attrs = originalAttrs.get(node); Object.keys(attrs).forEach(k => node.setAttribute(k, attrs[k]));
      }
    });
  }
  function setLang(next) {
    lang = normalizeLang(next); localStorage.setItem(STORAGE_KEY, lang);
    restoreChinese(document.body);
    apply();
    const picker = document.querySelector('#wolf-language-picker select'); if (picker) picker.value = lang;
    document.dispatchEvent(new CustomEvent('wolf-language-change', {detail:{lang}}));
  }

  function buildEnglishRules(opts) {
    const players = opts.players || [], ids = [...new Set(players.map(p => p.role && p.role.id).filter(Boolean))];
    const counts = {};
    players.forEach(p => { if (p.role) { const n=(ROLE_EN[p.role.id]||p.role).name; counts[n]=(counts[n]||0)+1; } });
    const config = Object.entries(counts).map(([n,c]) => c > 1 ? `${c} ${n}` : n).join(' + ');
    const lines = ['[ACTIVE GAME RULES · CONCISE EXPORT]', `Setup: ${players.length} players | ${config}`, '', '— Victory and flow —',
      opts.edge ? '• Edge victory: wolves win by eliminating every god-role, every Villager, or by reaching parity. Good wins by eliminating every wolf.' : '• City victory: wolves win only at parity. Eliminating one role category alone does not end the game. Good wins by eliminating every wolf.',
      `• Flow: night actions → first-day sheriff election → deaths announced → ${opts.singleRound ? 'one' : 'two'} daytime speech round(s) → vote. Extra speeches occur only when the system explicitly opens a tie/PK stage.`,
      opts.hiddenDeath ? '• Hidden deaths: ordinary night deaths reveal neither identity nor private cause. Public skill events remain public.' : '• Public deaths: identities revealed by the system are factual.',
      '• A night choice may only be explained with information available before that night action. A future plan is not an executed action.', '', '— Roles in this game —'];
    ids.forEach(id => { const r=ROLE_EN[id]; if(r) lines.push(`• ${r.name}: ${r.desc}`); });
    lines.push('', '— Evidence discipline —','• System verification and your own explicit private action results have highest priority; claims and last words are not automatic proof.','• A single slip, wording issue, rule-summary mismatch, or speaking style is suspicion only—not a standalone conviction.','• Repetition by several players is still one argument. Use voting patterns, sustained behavior, information access, and faction benefit.');
    return lines.join('\n');
  }
  function buildEnglishRulebook(roleIds) {
    const lines=['[WEREWOLF ROLE ENCYCLOPEDIA]','This reference lists every role available in the app. A particular game uses only the roles shown in its setup.',''];
    roleIds.forEach(id => { const r=ROLE_EN[id]; if(r) lines.push(`• ${r.name}: ${r.desc}`); });
    return lines.join('\n');
  }

  window.WolfI18n = {get lang(){return lang;},isEnglish,role,translateText,apply,setLang,buildEnglishRules,buildEnglishRulebook,roles:ROLE_EN};
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    const observer = new MutationObserver(list => { if (!isEnglish()) return; list.forEach(m => m.addedNodes.forEach(translateNode)); });
    observer.observe(document.body, {subtree:true,childList:true});
  });
})();
