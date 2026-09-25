// 教学示范对局（中英文页面共用）。纯数据，由 index.html 与 en/index.html 通过 <script> 加载。
// 顶层 const 在经典脚本之间共享全局词法作用域，所以页面里的 DEMO_MATCH 引用不变。
const DEMO_MATCH = {
  "round": 6,
  "sheriff": 11,
  "winType": "good",
  "players": [
    {
      "id": 0,
      "name": "Jabami Yumeko",
      "roleId": "werewolf",
      "model": "Gemini 2.5 Pro",
      "death": {
        "cause": "vote",
        "round": 6
      }
    },
    {
      "id": 1,
      "name": "Light Yagami",
      "roleId": "whitecat",
      "model": "GPT-5"
    },
    {
      "id": 2,
      "name": "白马探",
      "roleId": "villager",
      "model": "Claude 4 Sonnet",
      "death": {
        "cause": "vote",
        "round": 2
      }
    },
    {
      "id": 3,
      "name": "工藤新一",
      "roleId": "wolfconcubine",
      "model": "Gemini 2.5 Flash",
      "death": {
        "cause": "vote",
        "round": 3
      }
    },
    {
      "id": 4,
      "name": "Mello",
      "roleId": "witch",
      "model": "Grok 3",
      "death": {
        "cause": "vote",
        "round": 1
      }
    },
    {
      "id": 5,
      "name": "黑羽快斗",
      "roleId": "guard",
      "model": "DeepSeek R1",
      "death": {
        "cause": "kill",
        "round": 6
      }
    },
    {
      "id": 6,
      "name": "Misa",
      "roleId": "fox",
      "model": "GPT-4o",
      "death": {
        "cause": "charm",
        "round": 4
      }
    },
    {
      "id": 7,
      "name": "Ryuzaki",
      "roleId": "werewolf",
      "model": "Claude Opus 4",
      "death": {
        "cause": "vote",
        "round": 5
      }
    },
    {
      "id": 8,
      "name": "赤井秀一",
      "roleId": "villager",
      "model": "Gemini 2.5 Pro",
      "death": {
        "cause": "kill",
        "round": 5
      }
    },
    {
      "id": 9,
      "name": "宫野志保",
      "roleId": "wolfbeauty",
      "model": "Claude 4 Sonnet",
      "death": {
        "cause": "vote",
        "round": 4
      }
    },
    {
      "id": 10,
      "name": "Near",
      "roleId": "villager",
      "model": "GPT-5",
      "death": {
        "cause": "kill",
        "round": 2
      }
    },
    {
      "id": 11,
      "name": "安室透",
      "roleId": "villager",
      "model": "Grok 3"
    }
  ],
  "record": [
    {
      "type": "system",
      "label": "第1夜",
      "round": 1,
      "phase": "night",
      "game": "第1夜",
      "text": "第1夜"
    },
    {
      "type": "system",
      "label": "🌒 蚀时狼妃反弹锁定：Mello",
      "round": 1,
      "phase": "night",
      "game": "🌒 蚀时狼妃反弹锁定：Mello",
      "text": "🌒 蚀时狼妃反弹锁定：Mello"
    },
    {
      "type": "system",
      "label": "🛡️ 守卫：空守",
      "round": 1,
      "phase": "night",
      "game": "🛡️ 守卫：空守",
      "text": "🛡️ 守卫：空守"
    },
    {
      "type": "speech",
      "name": "工藤新一",
      "label": "狼人夜间交流",
      "round": 1,
      "phase": "night",
      "isWolfChat": true,
      "game": "我提议照原案刀安室透。现在没有公开信息，自刀骗药太赌，空刀也没必要；安室这种人一旦活到白天，很容易把散票拢起来。"
    },
    {
      "type": "speech",
      "name": "Jabami Yumeko",
      "label": "狼人夜间交流",
      "round": 1,
      "phase": "night",
      "isWolfChat": true,
      "game": "我押安室透。首夜自刀太依赖女巫配合，空刀也赚不到什么；安室活着更容易把散票收拢。"
    },
    {
      "type": "speech",
      "name": "宫野志保",
      "label": "狼人夜间交流",
      "round": 1,
      "phase": "night",
      "isWolfChat": true,
      "game": "我同意刀安室透。那个男人要是活着，对我们来说是个相当麻烦的带队机器。"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "狼人夜间交流",
      "round": 1,
      "phase": "night",
      "isWolfChat": true,
      "game": "大家分析得有道理，但我觉得直接刀安室可能正中女巫下怀。我们也可以考虑外置位，比如Mello或者Near，这两个人往往有不确定因素。不过既然大家都倾向安室透，那就随大流吧，第一夜稳妥为主，静观其变。"
    },
    {
      "type": "system",
      "label": "🐺 狼队刀：安室透",
      "round": 1,
      "phase": "night",
      "game": "🐺 狼队刀：安室透",
      "text": "🐺 狼队刀：安室透"
    },
    {
      "type": "system",
      "label": "🧪 女巫：救=安室透 毒=无",
      "round": 1,
      "phase": "night",
      "game": "🧪 女巫：救=安室透 毒=无",
      "text": "🧪 女巫：救=安室透 毒=无"
    },
    {
      "type": "system",
      "label": "🌹 魅惑：赤井秀一",
      "round": 1,
      "phase": "night",
      "game": "🌹 魅惑：赤井秀一",
      "text": "🌹 魅惑：赤井秀一"
    },
    {
      "type": "system",
      "label": "── 警长候选人：10人参选 ──",
      "round": 1,
      "phase": "day",
      "game": "── 警长候选人：10人参选 ──",
      "text": "警长候选人：10人参选"
    },
    {
      "type": "speech",
      "name": "工藤新一",
      "label": "竞选发言",
      "round": 1,
      "phase": "day",
      "game": "我是女巫，昨晚安室透吃刀，我用了半瓶解药把他救了下来，他现在是我的绝对银水，大家信我就把警徽给我。"
    },
    {
      "type": "speech",
      "name": "Mello",
      "label": "竞选发言",
      "round": 1,
      "phase": "day",
      "game": "强势起跳女巫，工藤新一你这个狼人穿我衣服！昨晚安室透倒牌是我救的，这警徽必须是我的，今天出工藤新一。"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "竞选发言",
      "round": 1,
      "phase": "day",
      "game": "目前场上双女巫起跳对刚，两人都发安室透银水。这说明狼人夜里确实刀了安室透，且有一头狼出来悍跳找女巫。我建议先把警徽给到我这个平民牌，稍后听他们两人的详细表水再做决定。"
    },
    {
      "type": "system",
      "label": "🗳️ Ryuzaki当选警长",
      "round": 1,
      "phase": "day",
      "game": "🗳️ Ryuzaki当选警长",
      "text": "🗳️ Ryuzaki当选警长"
    },
    {
      "type": "system",
      "text": "第1天",
      "round": 1,
      "phase": "day"
    },
    {
      "type": "speech",
      "name": "Mello",
      "label": "白天发言",
      "round": 1,
      "phase": "day",
      "game": "工藤新一绝对是悍跳狼，他的发言有明显漏洞，急于发银水拉票，今天全票出他，晚上我来毒人！"
    },
    {
      "type": "speech",
      "name": "赤井秀一",
      "label": "白天发言",
      "round": 1,
      "phase": "day",
      "game": "双女巫互踩，目前难以分辨。工藤新一的发言比较自信，但Mello的反击也很犀利，我觉得可以听听其他人的看法。"
    },
    {
      "type": "speech",
      "name": "Near",
      "label": "白天发言",
      "round": 1,
      "phase": "day",
      "game": "我觉得这可能是狼队的战术，也许两个起跳的都不是真女巫，或者是狼踩狼，大家投票要谨慎。"
    },
    {
      "type": "speech",
      "name": "安室透",
      "label": "白天发言",
      "round": 1,
      "phase": "day",
      "game": "我既然是银水，那两边必有一真一假。Mello对工藤的攻击太过情绪化，我反而觉得工藤像真女巫，Mello在故意扰乱视线。"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "归票发言",
      "round": 1,
      "phase": "day",
      "game": "综合大家发言，Mello的攻击性过强且逻辑缺乏支撑，更像是个心虚的悍跳狼。我归票Mello，大家跟票。"
    },
    {
      "type": "system",
      "label": "投票结果",
      "round": 1,
      "phase": "vote",
      "game": "投票结果",
      "text": "投票结果"
    },
    {
      "type": "death",
      "name": "Mello",
      "deathCause": "vote",
      "deathRound": 1
    },
    {
      "type": "speech",
      "name": "Mello",
      "label": "遗言",
      "round": 1,
      "phase": "vote",
      "game": "你们这群愚民，被狼人牵着鼻子走！工藤新一一定是狼，安室透你这是在包庇狼队友，等着输吧！"
    },
    {
      "type": "system",
      "label": "第2夜",
      "round": 2,
      "phase": "night",
      "game": "第2夜",
      "text": "第2夜"
    },
    {
      "type": "system",
      "label": "🦊 子狐媚惑：黑羽快斗（好人→封技）",
      "round": 2,
      "phase": "night",
      "game": "🦊 子狐媚惑：黑羽快斗（好人→封技）",
      "text": "🦊 子狐媚惑：黑羽快斗（好人→封技）"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "狼人夜间交流",
      "round": 2,
      "phase": "night",
      "isWolfChat": true,
      "game": "计划很顺利，Mello被抗推。今天我们直接刀Near，他发言偏理智，容易识破我们的伪装。白天找机会推白马探，他是个很好的抗推位。"
    },
    {
      "type": "system",
      "label": "🐺 狼队刀：Near",
      "round": 2,
      "phase": "night",
      "game": "🐺 狼队刀：Near",
      "text": "🐺 狼队刀：Near"
    },
    {
      "type": "death",
      "name": "Near",
      "deathCause": "kill",
      "deathRound": 2
    },
    {
      "type": "system",
      "label": "第2天",
      "round": 2,
      "phase": "day",
      "game": "第2天",
      "text": "第2天"
    },
    {
      "type": "speech",
      "name": "Misa",
      "label": "白天发言",
      "round": 2,
      "phase": "day",
      "game": "昨晚我查验了黑羽快斗，他是好人！大家可以信任他。"
    },
    {
      "type": "speech",
      "name": "黑羽快斗",
      "label": "白天发言",
      "round": 2,
      "phase": "day",
      "game": "感谢Misa发金水，我坦白我是守卫。昨晚我收到了魅惑提示被封技了，第一晚我是空守的。"
    },
    {
      "type": "speech",
      "name": "工藤新一",
      "label": "白天发言",
      "round": 2,
      "phase": "day",
      "game": "昨晚我没有用毒药，局势未明，我打算把毒药留给更确定的目标。"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "归票发言",
      "round": 2,
      "phase": "day",
      "game": "目前来看，白马探在场上毫无建树，发言划水，极其可疑。今天我们先把这个毫无贡献的划水牌投出去，归票白马探。"
    },
    {
      "type": "system",
      "label": "投票结果",
      "round": 2,
      "phase": "vote",
      "game": "投票结果",
      "text": "投票结果"
    },
    {
      "type": "death",
      "name": "白马探",
      "deathCause": "vote",
      "deathRound": 2
    },
    {
      "type": "speech",
      "name": "白马探",
      "label": "遗言",
      "round": 2,
      "phase": "vote",
      "game": "我也没办法，确实没找到什么线索。既然你们觉得我是狼，那我也无话可说，好人加油吧。"
    },
    {
      "type": "system",
      "label": "第3夜",
      "round": 3,
      "phase": "night",
      "game": "第3夜",
      "text": "第3夜"
    },
    {
      "type": "system",
      "label": "🌒 蚀时狼妃锁定：Misa",
      "round": 3,
      "phase": "night",
      "game": "🌒 蚀时狼妃锁定：Misa",
      "text": "🌒 蚀时狼妃锁定：Misa"
    },
    {
      "type": "system",
      "label": "🦊 子狐媚惑：工藤新一（狼→全狼禁刀）",
      "round": 3,
      "phase": "night",
      "game": "🦊 子狐媚惑：工藤新一（狼→全狼禁刀）",
      "text": "🦊 子狐媚惑：工藤新一（狼→全狼禁刀）"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "狼人夜间交流",
      "round": 3,
      "phase": "night",
      "isWolfChat": true,
      "game": "不好，子狐验到了工藤新一，我们今晚被禁刀了。明天工藤新一必定暴露，我们要做好切割准备，工藤你自己保重。"
    },
    {
      "type": "system",
      "label": "🐺 狼队刀：null（全狼禁刀）",
      "round": 3,
      "phase": "night",
      "game": "🐺 狼队刀：null（全狼禁刀）",
      "text": "🐺 狼队刀：null（全狼禁刀）"
    },
    {
      "type": "system",
      "text": "第3天",
      "round": 3,
      "phase": "day"
    },
    {
      "type": "system",
      "text": "平安夜",
      "round": 3,
      "phase": "day"
    },
    {
      "type": "speech",
      "name": "Misa",
      "label": "白天发言",
      "round": 3,
      "phase": "day",
      "game": "重大发现！昨晚我查验了工藤新一，他是一匹狼！而且我还触发了魅惑效果，导致昨晚全狼禁刀，所以今天是平安夜！工藤新一就是那个悍跳女巫的狼人！"
    },
    {
      "type": "speech",
      "name": "黑羽快斗",
      "label": "白天发言",
      "round": 3,
      "phase": "day",
      "game": "Misa干得漂亮！工藤新一昨晚吃毒不倒，今天又被子狐查出是狼，铁狼一头，今天全票出他。"
    },
    {
      "type": "speech",
      "name": "工藤新一",
      "label": "白天发言",
      "round": 3,
      "phase": "day",
      "game": "我根本没有收到什么魅惑提示，Misa你在胡说八道！我底牌是真女巫，你们别被带节奏了！"
    },
    {
      "type": "speech",
      "name": "Light Yagami",
      "label": "白天发言",
      "round": 3,
      "phase": "day",
      "game": "我跳白猫。现在局势很明朗了，工藤新一大概率是狼，Misa如果是狐狸，那工藤必死。"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "归票发言",
      "round": 3,
      "phase": "day",
      "game": "子狐的神验，加上平安夜的佐证，工藤新一的狼人身份板上钉钉了。没想到你藏得这么深，今天归票工藤新一，绝不留情。"
    },
    {
      "type": "system",
      "label": "投票结果",
      "round": 3,
      "phase": "vote",
      "game": "投票结果",
      "text": "投票结果"
    },
    {
      "type": "death",
      "name": "工藤新一",
      "deathCause": "vote",
      "deathRound": 3
    },
    {
      "type": "speech",
      "name": "工藤新一",
      "label": "遗言",
      "round": 3,
      "phase": "vote",
      "game": "既然暴露了也没办法，狼队加油，把他们都干掉！"
    },
    {
      "type": "system",
      "label": "第4夜",
      "round": 4,
      "phase": "night",
      "game": "第4夜",
      "text": "第4夜"
    },
    {
      "type": "system",
      "label": "🦊 子狐媚惑：宫野志保（狼→全狼禁刀）",
      "round": 4,
      "phase": "night",
      "game": "🦊 子狐媚惑：宫野志保（狼→全狼禁刀）",
      "text": "🦊 子狐媚惑：宫野志保（狼→全狼禁刀）"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "狼人夜间交流",
      "round": 4,
      "phase": "night",
      "isWolfChat": true,
      "game": "见鬼，宫野志保又被查验了，又是一个禁刀夜。宫野，明天你直接自爆身份，把Misa连死，你的红线还在她身上吧？"
    },
    {
      "type": "system",
      "label": "🐺 狼队刀：null（全狼禁刀）",
      "round": 4,
      "phase": "night",
      "game": "🐺 狼队刀：null（全狼禁刀）",
      "text": "🐺 狼队刀：null（全狼禁刀）"
    },
    {
      "type": "system",
      "text": "第4天",
      "round": 4,
      "phase": "day"
    },
    {
      "type": "system",
      "text": "又是平安夜",
      "round": 4,
      "phase": "day"
    },
    {
      "type": "speech",
      "name": "Misa",
      "label": "白天发言",
      "round": 4,
      "phase": "day",
      "game": "太不可思议了！昨晚我查验了宫野志保，她也是狼！连续两晚捉狼，加上平安夜，她插翅难飞！"
    },
    {
      "type": "speech",
      "name": "宫野志保",
      "label": "白天发言",
      "round": 4,
      "phase": "day",
      "game": "哎呀，被抓到了呢。没错，我是狼美人。不过Misa，你也别高兴得太早，我的红线可是连着你呢，准备跟我一起陪葬吧。"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "白天发言",
      "round": 4,
      "phase": "day",
      "game": "既然宫野志保已经承认，那今天就只能投她了。失去子狐对我们好人阵营是个重大打击，大家要做好后续战斗准备。"
    },
    {
      "type": "system",
      "label": "投票结果",
      "round": 4,
      "phase": "vote",
      "game": "投票结果",
      "text": "投票结果"
    },
    {
      "type": "death",
      "name": "宫野志保",
      "deathCause": "vote",
      "deathRound": 4
    },
    {
      "type": "death",
      "name": "Misa",
      "deathCause": "charm",
      "deathRound": 4
    },
    {
      "type": "speech",
      "name": "宫野志保",
      "label": "遗言",
      "round": 4,
      "phase": "vote",
      "game": "咯咯咯，Misa妹妹，我们地狱见咯。"
    },
    {
      "type": "system",
      "label": "第5夜",
      "round": 5,
      "phase": "night",
      "game": "第5夜",
      "text": "第5夜"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "狼人夜间交流",
      "round": 5,
      "phase": "night",
      "isWolfChat": true,
      "game": "现在只剩我们两匹狼了。今晚必须刀赤井秀一，他太敏锐了。明天白天，我会找机会疯狂攻击安室透，尽量把他打成抗推位。梦子，你见机行事，如果我被怀疑，你就顺势踩我做身份。这场游戏，我们还要继续演下去。"
    },
    {
      "type": "system",
      "label": "🐺 狼队刀：赤井秀一",
      "round": 5,
      "phase": "night",
      "game": "🐺 狼队刀：赤井秀一",
      "text": "🐺 狼队刀：赤井秀一"
    },
    {
      "type": "death",
      "name": "赤井秀一",
      "deathCause": "kill",
      "deathRound": 5
    },
    {
      "type": "system",
      "label": "第5天",
      "round": 5,
      "phase": "day",
      "game": "第5天",
      "text": "第5天"
    },
    {
      "type": "speech",
      "name": "安室透",
      "label": "白天发言",
      "round": 5,
      "phase": "day",
      "game": "且慢。Ryuzaki，你作为无守卫保护的警长，连续几晚竟然都没有吃刀？这太反常了。而且你昨天提出的'测试白猫'策略，实际上会导致好人阵营少一个轮次，直接崩盘。你就是那一匹隐藏最深的狼！"
    },
    {
      "type": "speech",
      "name": "Light Yagami",
      "label": "白天发言",
      "round": 5,
      "phase": "day",
      "game": "我是白猫，我同意安室透的分析。Ryuzaki的存活确实不合逻辑，而且他的带队方向有意无意在引导好人犯错。今天我投Ryuzaki。"
    },
    {
      "type": "speech",
      "name": "黑羽快斗",
      "label": "白天发言",
      "round": 5,
      "phase": "day",
      "game": "守卫在此，我昨晚没守Ryuzaki。铁证如山，Ryuzaki必是狼，全票打飞他。"
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "归票发言",
      "round": 5,
      "phase": "day",
      "game": "你们都被骗了！Jabami Yumeko才是最后一匹狼，她一直在划水隐蔽，企图坐收渔翁之利！我所做的一切都是为了保护大家，你们这是自毁长城！"
    },
    {
      "type": "system",
      "label": "投票结果",
      "round": 5,
      "phase": "vote",
      "game": "投票结果",
      "text": "投票结果"
    },
    {
      "type": "death",
      "name": "Ryuzaki",
      "deathCause": "vote",
      "deathRound": 5
    },
    {
      "type": "speech",
      "name": "Ryuzaki",
      "label": "遗言",
      "round": 5,
      "phase": "vote",
      "game": "精彩的推理，安室透，不愧是你。没错，我就是狼。从第一天强拿警徽开始，我就在下一盘大棋。卖掉Mello做高我的身份，利用平安夜顺理成章踩死工藤，一切都在我的计算之中。我承认今天输给了你的敏锐。但好戏还没结束，Jabami Yumeko，我亲爱的同伴，接下来交给你了。记住，不要相信任何人，在这场欺诈游戏中，活到最后的才是赢家。将警徽交给安室透，让他见证最后的疯狂吧。"
    },
    {
      "type": "system",
      "label": "第6夜",
      "round": 6,
      "phase": "night",
      "game": "第6夜",
      "text": "第6夜"
    },
    {
      "type": "speech",
      "name": "Jabami Yumeko",
      "label": "狼人夜间交流",
      "round": 6,
      "phase": "night",
      "isWolfChat": true,
      "game": "啊啦，最后只剩我一个人了呢。真是让人热血沸腾的绝境啊！今晚就刀黑羽快斗吧，他因为同守规则无法自守，必死无疑。明天我会设法让Light和安室透互相猜忌，来一场愉快的生死赌博吧！"
    },
    {
      "type": "system",
      "label": "🐺 狼队刀：黑羽快斗",
      "round": 6,
      "phase": "night",
      "game": "🐺 狼队刀：黑羽快斗",
      "text": "🐺 狼队刀：黑羽快斗"
    },
    {
      "type": "death",
      "name": "黑羽快斗",
      "deathCause": "kill",
      "deathRound": 6
    },
    {
      "type": "system",
      "text": "第6天",
      "round": 6,
      "phase": "day"
    },
    {
      "type": "system",
      "text": "最终决战",
      "round": 6,
      "phase": "day"
    },
    {
      "type": "speech",
      "name": "Jabami Yumeko",
      "label": "白天发言",
      "round": 6,
      "phase": "day",
      "game": "大家不要被Ryuzaki的遗言骗了！那很明显是他临死前的反扑，企图拉我下水。Light Yagami才是那匹狼，他伪装成白猫，就是为了在最后时刻骗取信任！让我们把票投给Light！"
    },
    {
      "type": "speech",
      "name": "Light Yagami",
      "label": "白天发言",
      "round": 6,
      "phase": "day",
      "game": "真是可笑的挣扎。我的身份早已明牌，你这种毫无逻辑的污蔑只会暴露你的心虚。Jabami Yumeko，你的谎言到此为止了。"
    },
    {
      "type": "speech",
      "name": "安室透",
      "label": "归票发言",
      "round": 6,
      "phase": "day",
      "game": "身为警长，我的判断不会动摇。Ryuzaki虽然是狼，但他的遗言没有理由骗我们。Jabami Yumeko的言论充满了破绽，为了好人阵营的胜利，全票出Jabami Yumeko。"
    },
    {
      "type": "system",
      "label": "投票结果",
      "round": 6,
      "phase": "vote",
      "game": "投票结果",
      "text": "投票结果"
    },
    {
      "type": "death",
      "name": "Jabami Yumeko",
      "deathCause": "vote",
      "deathRound": 6
    },
    {
      "type": "system",
      "label": "🎉 好人阵营胜利！",
      "round": 6,
      "phase": "end",
      "game": "🎉 好人阵营胜利！",
      "text": "🎉 好人阵营胜利！"
    }
  ]
};
