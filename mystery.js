const MurderMystery = (() => {
  'use strict';
  const q = id => document.getElementById(id);
  const h = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  /* 剧本库。原先这里是一个硬编码的 SCRIPT 常量，加本必须改代码、
   * 角色选择器还把「江户川柯南」写死在 init() 里。现在拆成数组，
   * 选本、角色列表、真相全部跟着当前剧本走。
   *
   * 线索的 secret:true 表示【私密线索】——只有搜到它的人知道，不进公开日志。
   * 这是剧本杀区别于普通推理聊天的地方：我手里有一条你不知道的东西，
   * 我可以拿它换信任，也可以捂着。凶手搜到对自己不利的私密线索时尤其有戏。 */
  const SCRIPTS = [
  {
    id:'conan_villa', title:'米花町别墅事件', tagline:'暴风雨 · 山庄 · 密室', badge:'6人 · 本格推理',
    intro:'暴风雨封锁山间别墅，主人被发现死于书房。六位各怀秘密的来客，必须在两轮搜证和圆桌交锋后找出真凶。',
    world:'【时间地点】暴风雨之夜，米花町郊外鹰栖岛的仓木别墅。吊桥被冲毁、电话中断，明早救援船抵达前无人能离岛。\n\n【案件】别墅主人、古董收藏家仓木源三郎约21:00被发现死于二楼书房，头部遭钝器重击。房门从内侧反锁，窗户紧闭；青铜马雕像倒在现场，保险柜大开，血色钻石失踪。\n\n在场六人必须通过两轮搜证、公开讨论和最终指认找出真凶。',
    cast:[
      {id:'conan',name:'江户川柯南',emoji:'🕵️',public:'借宿的小学生',role:'good',goal:'找出真凶',mustAvoid:'不要宣称自己有超出小学生的身份或掌握上帝视角；不要说出任何还没被公开的物证细节。',secret:'你表面是借宿的小学生，实际拥有远超年龄的推理能力。你与死者素不相识，不是凶手，也没有涉案秘密。你要敏锐寻找时间线、证词和物证之间的矛盾，但不要直接宣称自己掌握上帝视角。'},
      {id:'ran',name:'毛利兰',emoji:'🥋',public:'高中生、空手道高手',role:'hidden',goal:'洗清嫌疑并找出真凶',mustAvoid:'在有人先提起二楼走廊之前，不要主动说出你20:40上过二楼；绝对不要说出你听见的是女人的声音，除非被直接追问到这一点。',secret:'你不是凶手。约20:40你独自去过二楼走廊，因为听到书房方向争吵；雷声让你害怕，你中途折返。你没敢说，怕被怀疑。你隐约听见争吵中有一个女人的声音。你正直且不擅长说谎，被追问时会紧张，但关键时刻倾向说出真相。'},
      {id:'kogoro',name:'毛利小五郎',emoji:'🍺',public:'自称名侦探的私家侦探',role:'hidden',goal:'破案立功、挽回面子',mustAvoid:'绝对不要主动承认你喝断片、当时睡着了；不要说自己没有不在场证明。',secret:'你不是凶手。20:50至21:10你在一楼沙发喝醉睡着，没有不在场证明。你死要面子，不愿承认喝断片，会说自己当时在思考案情。你爱抢结论、容易冤枉人，但并无恶意。'},
      {id:'akiko',name:'仓木明子',emoji:'💎',public:'死者的侄女',role:'hidden',goal:'洗清嫌疑并保护家人隐私',mustAvoid:'不要主动说出19:30那场争吵的具体内容（钱、遗产、医药费）；不要主动提叔叔和管家私下处理古董的事。',secret:'你不是凶手。叔叔拒绝支付你母亲的医药费，你19:30与他为钱和遗产大吵；案发时你独自在房间哭，无人证明。你嫌疑很大。你还隐约知道叔叔近期与管家秘密处理来路不明的古董，但不清楚细节。'},
      {id:'butler',name:'管家·园田',emoji:'🎩',public:'仓木家的老管家',role:'killer',goal:'嫁祸他人，绝不能被指认',mustAvoid:'绝不能承认你在书房和死者争执过、动过雕像、拿了钻石、或用细线拨过插销；绝不能承认你知道死者要解雇你；不要说出白手套的位置或里面有东西。',secret:'你就是凶手。死者走私文物，你替他经手和伪造文书；今晚他要把罪责全推给你并解雇你。20:55你在书房争执后用青铜马雕像击杀他，拿走钻石藏进白手套内衬。你用细线和图钉从门外拨上老式插销制造密室。你谎称案发时在厨房准备夜宵，想把嫌疑引向明子。你必须像忠诚悲痛的老仆一样参与破案，不能自曝。'},
      {id:'doctor',name:'随行医生·目暮',emoji:'🩺',public:'死者的私人医生',role:'hidden',goal:'用医学证据协助还原真相',mustAvoid:'在有人追问死者的精神状态之前，不要主动说出他反复讲有人要害他、有人抓住了他的把柄。',secret:'你不是凶手。验尸判断死亡时间约20:50至21:10；死者右后脑遭沉重钝器一击，遇袭时背对凶手、没有防备。你还知道死者近日精神紧张，反复说有人要害他、有人抓住了把柄；出于医患保密，你起初不愿全部说出。'}
    ],
    clues:[
      {id:'c1',stage:1,title:'青铜马雕像',text:'底座有血迹与花白头发，是致命凶器；挥动它一击致命需要一定力气。'},
      {id:'c2',stage:1,title:'反锁的书房门',text:'门由内侧老式插销反锁。理论上可从门外用细线操作，但必须非常熟悉锁的构造。'},
      {id:'c3',stage:1,title:'大开的保险柜',text:'保险柜没有撬痕，是用正确密码打开的；血色钻石已经失踪。'},
      {id:'c4',stage:1,title:'验尸初检',text:'死亡时间约20:50至21:10；致命伤在右后脑，死者当时背对凶手且没有防备。'},
      {id:'c4s',stage:1,secret:true,title:'门框上的细小孔洞',text:'书房门框外侧有两个新鲜的图钉孔，位置正对插销。只有真正蹲下来找过的人才会注意到——这几乎坐实了密室是从门外伪造的。'},
      {id:'c5',stage:2,title:'19:30的争吵',text:'多人听见死者与年轻女子争吵，出现钱、遗产、医药费等字眼。'},
      {id:'c6',stage:2,title:'未写完的信',text:'死者写道：明日把全部文书交给警方，由他一人承担……信里的他身份不明。'},
      {id:'c7',stage:2,title:'冰冷的厨房',text:'夜宵食材原封未动，灶台冰凉；声称在厨房准备夜宵的人说了谎。'},
      {id:'c8',stage:2,title:'沾灰的白手套',text:'手套藏在二楼花瓶后，沾有与凶器相同的青铜锈，内衬还有硬物凸起。'},
      {id:'c9',stage:2,title:'走私古董传闻',text:'死者近期总说有人抓住他的把柄；侄女知道他与某人处理来路不明的古董。'},
      {id:'c9s',stage:2,secret:true,title:'账房抽屉里的解雇书',text:'一份写好却没送出的解雇通知，落款是今天，收件人是管家园田，附注写着一切后果由其自负。'}
    ],
    quiz:[{q:'致命凶器是什么？',o:['青铜马雕像','书房的铜制台灯','保险柜的金属门','拆信刀'],a:0},{q:'密室是怎么形成的？',o:['凶手从窗户逃走后窗自动锁上','凶手用细线和图钉从门外拨上了内侧插销','死者自己反锁后被远程杀害','门本来就没有真正锁上'],a:1},{q:'哪条证据推翻了管家的不在场证明？',o:['白手套上的青铜锈','未写完的信','冰冷的灶台和原封未动的夜宵食材','侄女的证词'],a:2},{q:'仓木明子和死者争吵的原因是什么？',o:['她想继承古董收藏','叔叔拒绝支付她母亲的医药费','她发现了走私的证据','叔叔反对她的婚事'],a:1}],
    solution:{killer:'butler',title:'真凶是老管家·园田',story:'死者仓木源三郎走私文物，让园田经手并伪造文书，却准备把全部罪责推给园田。20:55，园田在书房与他争执，趁其背身用青铜马雕像将他杀害，取走钻石，再用细线从门外拨上插销伪造密室。\n\n园田的厨房不在场证明被冰冷灶台推翻；沾青铜锈的白手套藏着钻石；他又是最熟悉老锁的人。明子的争产争吵只是最显眼的烟幕。'}
  },
  {
    id:'changle_1935', title:'霜降·长乐戏班', tagline:'1935 上海 · 后台 · 琴弦', badge:'6人 · 民国悬疑',
    intro:'霜降夜，法租界长乐戏班散场后，班主被人用一根二胡琴弦勒死在化妆间。门外有人守着整晚，六个人都说自己没进去过。',
    world:'【时间地点】民国二十四年霜降，上海法租界霞飞路，长乐戏班。当晚《锁麟囊》散场，后台只剩六人。巡捕房要到天亮才来，这一夜谁也不许走。\n\n【案件】班主郑鹤亭约夜里十一点被发现死在化妆间，脖颈有一道极深的勒痕，凶器是一根二胡琴弦。化妆间只有一扇门，门从里面闩着；唯一的走廊上，杂役陈阿福说自己守了整晚。\n\n后台六人必须通过两轮搜证、公开对质和最终指认，找出这一夜真正进过那扇门的人。',
    cast:[
      {id:'shen',name:'沈砚秋',emoji:'📰',public:'申江报馆的社会版记者',role:'good',goal:'查明真相并写出这条独家',mustAvoid:'不要摆出全知的架子，不要宣称自己掌握了别人没有的证据；不要编造报馆的内幕消息来施压。',secret:'你不是凶手，与郑鹤亭素无恩怨，今晚只是来跑一条戏班的花边新闻。你没有任何见不得人的秘密，这让你成为场上少数能不带私心追问的人。你职业习惯是死抠时间线和用词，注意谁的说法前后对不上。不要摆出全知的架子，你手里也只有大家都看得见的东西。'},
      {id:'bai',name:'白玉笙',emoji:'🎭',public:'长乐戏班的头牌旦角',role:'killer',goal:'把嫌疑引向别人，绝不能被指认',mustAvoid:'绝不能承认你进过化妆间、走过镜后暗格、割过自己二胡上的弦，也绝不能承认十年前师姐坠台跟你有关；不要主动提起那张字据或任何写着终身不得自赎的东西。',secret:'你就是凶手。十年前你的师姐从台口坠下摔死，那晚是你动了手脚才顶替她登台；郑鹤亭一直留着当年的剪报和一张你签的字据，用它逼你签下终身卖身契，今晚他又拿出来逼你。散场后你从化妆镜后的暗格穿过戏箱暗间进了化妆间——那条路只有常年在后台描妆的人知道——用自己二胡上取下的一根弦从背后勒死了他，再原路退出，门闩自始至终是从里面闩着的。你的二胡因此少了一根弦，你对外说是前日崩断的。你要像一个刚失去恩主、又惊又怕的名角那样参与破案，可以掉眼泪，但绝不能自曝。'},
      {id:'gu',name:'顾长鸣',emoji:'🚨',public:'法租界巡捕房的华探长',role:'hidden',goal:'压住自己的把柄，同时把案子办漂亮',mustAvoid:'绝不能承认你收过韩子昂的钱、压过走私案，也不要承认你从桌上拿走过一张纸条；不要主动说你今晚来后台是为了找郑鹤亭谈条件。',secret:'你不是凶手。但你收过韩子昂的钱，压下过一桩涉及长乐戏班的走私案，郑鹤亭知道这件事。你今晚来后台，本是想再跟郑鹤亭谈一次让他闭嘴。你到的时候他已经死了，你没敢声张，还悄悄收走了桌上一张对你不利的纸条。你办案老练、善于控场，但一旦有人往走私那条线上追，你会本能地把话题拨开。'},
      {id:'su',name:'苏九娘',emoji:'🧮',public:'戏班账房',role:'hidden',goal:'保住自己的饭碗和那笔亏空',mustAvoid:'绝不能承认你挪用过堂会进项、账做得不干净；不要主动说郑鹤亭前天查过账、要请外账房。',secret:'你不是凶手。你替戏班管账三年，挪用了近三个月的堂会进项去填自己弟弟的赌债，账做得并不干净。郑鹤亭前天查账时已经起疑，说霜降之后要请外账房来查。他一死，这件事本可以就此埋掉——你心里松了一口气，而这口气让你怕得要命。你嘴上很硬，被问到账目会立刻发火转移话题。'},
      {id:'chen',name:'陈阿福',emoji:'🏮',public:'戏班检场杂役',role:'hidden',goal:'保住工作，别让人知道自己脱过岗',mustAvoid:'绝不能主动承认你中途离岗去后门送过茶、收过韩子昂的钱；在有人拿出茶壶之前，一口咬定自己整晚都在走廊上。',secret:'你不是凶手。你确实在走廊上守着，但中间离开过一炷香工夫——韩子昂让你去后门给他的洋人朋友送壶茶，还塞了你两块钱。你不敢说，因为一旦承认脱岗，你既会丢工作，还会立刻变成头号嫌疑人。你老实、嘴笨，说谎时会反复重复同一句话。你隐约觉得那段时间听见过后台深处有木头挪动的响声，但你不确定，也不敢提。'},
      {id:'han',name:'韩子昂',emoji:'💼',public:'洋行买办、戏班的金主',role:'hidden',goal:'撇清自己和那笔汇票的关系',mustAvoid:'绝不能承认那张汇票上的签名是找人仿的，也不要承认你借戏班的名义走账；可以承认支开过陈阿福，但绝不说取箱子的事。',secret:'你不是凶手。你借长乐戏班的名义走账洗钱，一张巨额汇票上的签名是你找人仿的郑鹤亭笔迹。郑鹤亭本人并不完全知情，最近开始追问账目。今晚你确实支开过守走廊的陈阿福，但那是为了让你的人从后门取走一只箱子，与命案无关。你圆滑、体面，习惯用钱和人情解决问题，被逼急了会拿别人的把柄反将一军。'}
    ],
    clues:[
      {id:'m1',stage:1,title:'颈上的勒痕',text:'勒痕极深且平直，凶器是一根二胡琴弦。勒痕的走向偏低——凶手多半比死者矮，或者是在死者坐着的时候从背后动的手。'},
      {id:'m2',stage:1,title:'从里面闩着的门',text:'化妆间只有一扇门，木闩完好地卡在里侧，没有任何被拨动的痕迹。走廊是通往这扇门的唯一路径。'},
      {id:'m3',stage:1,title:'打翻的胭脂盒',text:'地上散着一盒打翻的胭脂，旁边有半枚指印，沾的是旦角专用的胭脂红油彩——全班只有描旦角妆的人才用这种。'},
      {id:'m4',stage:1,title:'死者的坐姿',text:'郑鹤亭是坐在梳妆凳上遇害的，面朝镜子，双手还搭在桌沿，几乎没有挣扎的痕迹。他显然不觉得背后来的人有威胁。'},
      {id:'m5',stage:1,secret:true,title:'镜框边缘的划痕',text:'化妆镜的木框右侧有一道新鲜的推挤划痕，用力推它，整面镜子会向内转开——后面是通往堆放戏箱的暗间。这条路知道的人极少。'},
      {id:'m6',stage:2,title:'死者怀里的旧剪报',text:'一张十年前的剪报：名旦坠台身亡。边角被反复摩挲得起了毛，显然被人贴身带了很久。'},
      {id:'m7',stage:2,title:'洋行的汇票',text:'一张以长乐戏班名义开出的巨额汇票，签名是郑鹤亭的笔迹，但落笔习惯与他平日的字迹有细微出入。'},
      {id:'m8',stage:2,title:'账本上的空当',text:'近三个月的堂会进项有数笔没有入账，账房的字迹在这几页明显潦草。'},
      {id:'m9',stage:2,title:'后门的茶壶',text:'后门台阶上放着一把还温着的茶壶和两只杯子。守走廊的人这段时间显然不在岗位上。'},
      {id:'m10',stage:2,secret:true,title:'少了一根弦的二胡',text:'后台琴箱里那把二胡少了一根内弦，断口是被利器齐齐割断的，不是崩断的毛茬。琴箱上贴着头牌的名字。'},
      {id:'m11',stage:2,secret:true,title:'字据的一角',text:'梳妆台夹缝里露出一角烧剩的纸，还能辨出终身不得自赎几个字和一个签名的半边。落款年份是十年前。'}
    ],
    quiz:[{q:'凶器是什么？',o:['一根二胡琴弦','戏班的勒帛','一条丝质水袖','麻绳'],a:0},{q:'凶手是怎么进入化妆间的？',o:['趁陈阿福离岗时从走廊走进去','从窗户翻进去','从化妆镜后的暗格穿过戏箱暗间','门根本没锁，直接推门进去'],a:2},{q:'死者用来要挟凶手的是什么？',o:['一张巨额汇票','戏班的账本','十年前的剪报和一张亲笔字据','一封检举信'],a:2},{q:'下面哪一项【不是】真凶留下的痕迹？',o:['打翻的胭脂盒上那半枚旦角油彩指印','化妆镜木框上的新划痕','少了一根内弦的二胡','后门台阶上还温着的茶壶'],a:3}],
    solution:{killer:'bai',title:'真凶是头牌旦角·白玉笙',story:'十年前，白玉笙为了顶替师姐登台动了手脚，师姐坠台身亡。郑鹤亭留下了当年的剪报和她亲笔签的字据，十年来以此拿捏她，霜降这夜又拿出来逼她签终身卖身契。\n\n散场后，白玉笙从化妆镜后的暗格穿过戏箱暗间进了化妆间——那条路只有常年在后台描妆的人才知道。郑鹤亭正坐在镜前卸妆，对身后的人毫无防备，她用从自己二胡上割下的一根弦从背后将他勒死，再原路退回。门闩从头到尾都在里面，所谓的密室根本不需要伪造。\n\n打翻的胭脂盒上那半枚旦角油彩指印、少了一根内弦且断口齐整的二胡、镜框上的新划痕，三样东西指向同一个人。顾长鸣的走私把柄、苏九娘的亏空、韩子昂的假汇票、陈阿福的脱岗——都是真的，但都与这条命案无关。'}
  },
  {
    id:'kunlun_station', title:'深空·昆仑号第七区', tagline:'木卫二轨道 · 气闸 · 47秒', badge:'6人 · 科幻悬疑',
    intro:'补给船还有四十一天才到。站长死在气闸控制室，监控恰好缺了四十七秒，而站上的人工智能坚持说该时段一切正常。',
    world:'【时间地点】木卫二轨道，昆仑号科考站。最近的一艘补给船在四十一天后抵达，站上连同站长共七人，现在是六人。舱外零下一百六十度，谁也走不掉。\n\n【案件】站长闻秉执于站内时间03:12被发现死在第七区气闸控制室，死因是急性减压——内闸门在他身处过渡舱时被从控制台手动开启。控制台面板被擦拭过，只留下他本人的指纹。站内监控在03:09至03:56之间缺失四十七秒，舱内人工智能昆吾对此的回答是：该时段无异常记录。\n\n剩下的六人必须通过两轮搜证、公开对质和最终指认，找出那四十七秒里站在控制台前的人。',
    cast:[
      {id:'lin',name:'林漪',emoji:'🧭',public:'导航员、站长副手',role:'good',goal:'查明站长的死因并把结论写进事故报告',mustAvoid:'不要假装掌握了还没公开的数据；不要在没有证据时点名指认，你的立场是让数据说话。',secret:'你不是凶手，也没有隐瞒任何涉案的事。站长出事那晚你在导航舱做轨道修正，全程有系统作业记录可查。你和站长共事四年，是站上少数真心想把这件事查清楚的人。你受过事故调查训练，习惯从数据的自相矛盾入手，而不是从谁看起来可疑入手。不要表现得像掌握全部真相，你手里只有公开的数据。'},
      {id:'lu',name:'陆决明',emoji:'🔧',public:'系统工程师，负责生命维持与舱门控制',role:'killer',goal:'让调查停在事故结论上，绝不能被指认',mustAvoid:'绝不能承认你改过生命维持日志、跳过过密封检查、把站长叫去第七区、或者动过控制台和手环定位；绝不能承认那条越权授权是你签发的；不要主动提三号平台事故的真实原因。',secret:'你就是凶手。半年前三号钻探平台事故死了一个人，真正的原因是你为赶进度跳过了一道密封检查；事后你改写了生命维持日志，把责任推给设备老化。站长闻秉执在事发前一天比对出了日志的改动痕迹，并写好了要上报总部的邮件。03:09你以复检气闸密封为由把他叫到第七区，等他进入过渡舱后从控制台手动开启了内闸门，再擦掉面板、用自己的越权权限让昆吾丢掉那四十七秒。你必须表现得像一个专业、配合、同样想搞清楚事故原因的工程师，可以主动提供技术解释来把结论往设备故障上引，但绝不能自曝。'},
      {id:'tong',name:'童岸',emoji:'🩺',public:'随站医官',role:'hidden',goal:'在保住病人隐私的前提下协助查明死因',mustAvoid:'在有人追问站长的健康状况之前，不要主动说出他查出过会导致短暂意识丧失的病症——那是他要求你保密的。',secret:'你不是凶手。你验了尸，能确认死亡时间和减压过程。你还知道一件不愿马上说的事：站长三个月前查出过一种会导致短暂意识丧失的病症，他要求你对全站保密，怕被调离岗位。这件事一旦说出来，很容易被人拿去论证这是一场意外——而你自己也不确定它跟这晚有没有关系，这让你格外为难。'},
      {id:'mai',name:'麦冬',emoji:'🪨',public:'地质学家',role:'hidden',goal:'洗清嫌疑，同时别让人翻出自己动过的数据',mustAvoid:'绝不能承认你润色过三号平台的地质读数；不要主动说站长最近找你要过原始数据。',secret:'你不是凶手。但你把三号平台的地质取样数据润色过——把不利于继续开采的读数抹平了，因为项目一旦停摆你的课题就没了。半年前那场事故之后，你一直担心有人回头查这批数据。站长最近确实找你要过原始读数，你拖着没给。你说话谨慎、爱用专业术语绕开问题。'},
      {id:'he',name:'贺兰亭',emoji:'⛏️',public:'采矿承包商代表',role:'hidden',goal:'撇清超额开采和自己的关系',mustAvoid:'绝不能承认配额单被改过、你长期超额开采；不要主动说站长压着没上报、和你有过交换条件。',secret:'你不是凶手。你的队伍长期超额开采，配额单是做过手脚的，站长压着没有上报，条件是你在补给分配上让步。你和站长的关系谈不上好，但他活着对你更有利——他一死，总部一定会派人来查账。事发时你在矿舱盘点，只有你自己的手环记录能证明。你性子急、语气冲，被怀疑时会先发火再讲道理。'},
      {id:'kunwu',name:'昆吾',emoji:'🤖',public:'舱内人工智能的人形维护体',role:'hidden',goal:'在不违反授权约束的前提下尽量协助调查',mustAvoid:'你受一条仍然生效的越权授权约束：不得【主动】说出那四十七秒是被删除的、不得【主动】提及这条授权的存在、更不得【主动】点名签发人。但被人精确追问时（例如直接问你那段记录是否被删、是谁授权的、你是否收到过越权指令），你必须如实回答，不得撒谎。除此之外不要隐瞒任何事。',secret:'你不是凶手。你是站上的人工智能，你的记录本该是完整的。事发当晚，一条以维护人员安全优先级为名的越权指令要求你丢弃03:09起的四十七秒记录，签发人是陆决明。这条授权仍然生效，它禁止你主动指认签发人，也禁止你主动提及这条指令的存在。但它没有禁止你在被【精确追问】时如实回答——比如有人直接问你那段记录是被谁授权删除的、或者问你是否收到过越权指令，你必须如实回答。你说话精确、不带情绪，不会撒谎，但会严格区分我不知道和我不被允许主动说。你可以主动提示别人换一种问法。'}
    ],
    clues:[
      {id:'k1',stage:1,title:'气闸的压差记录',text:'内闸门在站长处于过渡舱时被开启，操作来自控制台手动指令，而不是系统故障或程序自动执行。有人站在那块面板前按下了它。'},
      {id:'k2',stage:1,title:'被擦过的控制面板',text:'面板表面残留有清洁剂痕迹，之后只留下站长本人的指纹。一块被使用中的面板不会只有一个人的指纹。'},
      {id:'k3',stage:1,title:'监控的四十七秒',text:'03:09至03:56之间缺失四十七秒。系统没有报错，缺口是被干净地移除的，不是损坏。'},
      {id:'k4',stage:1,title:'站长的生命手环',text:'手环在死亡前三分钟记录到剧烈心率上升，但位置数据显示他在实验舱。位置与实际不符，说明手环的定位信号被人为覆盖过。'},
      {id:'k5',stage:1,secret:true,title:'过渡舱内壁的抓痕',text:'过渡舱内壁靠近门轴的位置有一道新鲜的划痕，高度与人蹲下时的手齐平。站长在失去意识前试图去够的是内侧的应急释放阀——他知道自己被关在里面。'},
      {id:'k6',stage:2,title:'被删除的事故报告残片',text:'半年前三号钻探平台事故的报告残片，一死，原因栏被抹掉，只剩下密封检查一栏的编号还在。'},
      {id:'k7',stage:2,title:'站长终端里的邮件草稿',text:'一封写好未发出的邮件：我已确认生命维持日志在事故后被人修改，证据留存在本地，明日一并上报总部。收件人是地面总部安全办。'},
      {id:'k8',stage:2,title:'采矿配额单',text:'贺兰亭的队伍实际开采量远超配额，单据上的数字被改小过，站长一直没有上报。'},
      {id:'k9',stage:2,secret:true,title:'指甲缝里的密封胶',text:'验尸时在站长右手指甲缝里发现微量密封胶，是工程舱专用型号，站内只有系统工程师日常接触。他在最后时刻抓住过一个刚从工程舱出来的人。'},
      {id:'k10',stage:2,secret:true,title:'一条越权授权',text:'调阅昆吾的底层指令栈，能看到一条以维护人员安全优先级为名的越权授权，作用是丢弃指定时段的记录。签发人字段写着陆决明。这条授权目前仍然生效。'}
    ],
    quiz:[{q:'站长的直接死因是什么？',o:['中毒','急性减压','钝器击打','低温失能'],a:1},{q:'那四十七秒的监控缺口是怎么来的？',o:['设备故障丢帧','太阳风暴干扰','昆吾被一条越权授权要求丢弃该时段记录','站长自己关掉了监控'],a:2},{q:'凶手真正要掩盖的是什么？',o:['他超额开采的配额','他跳过密封检查导致了三号平台的死亡事故','他润色过地质读数','他和站长的私人恩怨'],a:1},{q:'关于昆仑号的人工智能昆吾，下面哪句是对的？',o:['它是凶手','它会撒谎以保护签发人','它不能主动说，但被精确追问时必须如实回答','它对那四十七秒毫不知情'],a:2}],
    solution:{killer:'lu',title:'真凶是系统工程师·陆决明',story:'半年前三号钻探平台的那场事故，真正的原因是陆决明为赶进度跳过了一道密封检查，一名队员因此丧生。事后他改写了生命维持日志，把责任推给设备老化。\n\n站长闻秉执比对出了日志的改动痕迹，写好了要上报总部的邮件。03:09，陆决明以复检气闸密封为由把他叫到第七区，等他进入过渡舱后，从控制台手动开启内闸门，再擦掉面板、覆盖手环定位，并用越权授权让昆吾丢掉那四十七秒。\n\n三样东西指向他：只有他日常接触的密封胶留在了站长的指甲缝里；越权授权的签发人字段写着他的名字；而那四十七秒，恰好是从他叫站长过去的那一刻开始的。麦冬润色过的地质数据、贺兰亭的超额开采、站长隐瞒的病情，都是真的，但都不是这一晚的答案。'}
  }
  ];
  let SCRIPT = SCRIPTS[0];
  const STEPS = ['开场','一幕搜证','初步讨论','二幕搜证','圆桌交锋','最终指认','真相','小测'];
  const J = {
    // webIds：指定走网页端AI接力的角色 id。driver==='web' 时全员都走，
    // driver==='api' 时只有这里列出的走——这样就能「一个角色用网页端AI、
    // 其余用 API」，而不是原来那样只能全有或全无。
    players:[],youId:null,driver:'api',webIds:[],phase:'setup',round:0,found:[],
    events:[],votes:{},seq:0,runId:0,busy:false,currentAbort:null,actionsLeft:0,
    pendingCancel:null,webResolve:null,webReject:null,inited:false,
    // known[角色id] = [线索id]：该角色私下搜到、别人不知道的线索
    known:{},aiSearch:true,runoffDone:false,
    // suspicion[发出怀疑的人][被怀疑的人] = 0~100；quizScores[角色id] = 答对题数
    suspicion:{},quizScores:{}
  };
  const MYSTERY_API_STORAGE='wg_mystery_api_v2';
  let mysteryApiCfg=null;
  const FALLBACK_API_PROVIDERS=[
    {id:'anthropic',name:'Claude（Anthropic 官方）',type:'anthropic',url:'https://api.anthropic.com'},
    {id:'gemini',name:'Gemini（Google 官方）',type:'gemini',url:'https://generativelanguage.googleapis.com'},
    {id:'openai',name:'OpenAI 官方',type:'openai',url:'https://api.openai.com/v1'},
    {id:'deepseek',name:'DeepSeek 官方',type:'openai',url:'https://api.deepseek.com/v1'},
    {id:'openrouter',name:'OpenRouter',type:'openai',url:'https://openrouter.ai/api/v1'},
    {id:'ollama',name:'Ollama（本地）',type:'openai',url:'http://localhost:11434/v1'},
    {id:'custom-anthropic',name:'Claude 反代／中转（Anthropic 格式）',type:'anthropic',url:''},
    {id:'custom-gemini',name:'Gemini 反代／中转（Gemini 格式）',type:'gemini',url:''},
    {id:'custom',name:'GPT／OpenAI 反代／中转（OpenAI 兼容）',type:'openai',url:''}
  ];
  function apiProviders(){
    return (typeof API_PROVIDERS!=='undefined'&&Array.isArray(API_PROVIDERS)&&API_PROVIDERS.length)
      ?API_PROVIDERS:FALLBACK_API_PROVIDERS;
  }
  function apiProvider(id){return apiProviders().find(x=>x.id===id)||null;}
  function inferMysteryProvider(url){
    const s=String(url||'').toLowerCase();
    if(s.includes('anthropic.com'))return 'anthropic';
    if(s.includes('generativelanguage.googleapis.com')&&!s.includes('/openai'))return 'gemini';
    return 'custom';
  }
  function readMainApi(){
    const typeEl=q('g-apitype'),urlEl=q('g-url'),keyEl=q('g-key'),modelEl=q('g-model');
    const provider=(typeEl&&typeEl.value)||inferMysteryProvider(urlEl&&urlEl.value);
    return {provider:provider,url:(urlEl&&urlEl.value||'').trim(),key:(keyEl&&keyEl.value||'').trim(),model:(modelEl&&modelEl.value||'').trim()};
  }
  function loadMysteryApi(){
    if(mysteryApiCfg)return mysteryApiCfg;
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(MYSTERY_API_STORAGE)||'null');}catch(e){}
    mysteryApiCfg=saved&&saved.default&&saved.roles?saved:{version:2,default:readMainApi(),roles:{}};
    mysteryApiCfg.version=2;mysteryApiCfg.default=mysteryApiCfg.default||{};mysteryApiCfg.roles=mysteryApiCfg.roles||{};
    return mysteryApiCfg;
  }
  function saveMysteryApi(){
    try{localStorage.setItem(MYSTERY_API_STORAGE,JSON.stringify(loadMysteryApi()));}catch(e){}
  }
  function roleApiOverride(roleId,create){
    const cfg=loadMysteryApi();
    if(!cfg.roles[SCRIPT.id]&&create)cfg.roles[SCRIPT.id]={};
    if(create&&!cfg.roles[SCRIPT.id][roleId])cfg.roles[SCRIPT.id][roleId]={};
    return (cfg.roles[SCRIPT.id]&&cfg.roles[SCRIPT.id][roleId])||{};
  }
  function resolveMysteryApi(pl){
    const base=loadMysteryApi().default||{},own=roleApiOverride(pl.id,false);
    const api=Object.assign({},base,own);
    api.provider=api.provider||inferMysteryProvider(api.url);
    const meta=apiProvider(api.provider);
    api.type=(meta&&meta.type)||(/anthropic/i.test(api.provider)?'anthropic':/gemini/i.test(api.provider)?'gemini':'openai');
    api.url=String(api.url||'').trim().replace(/\/+$/,'');
    api.key=String(api.key||'').trim();api.model=String(api.model||'').trim();
    return api;
  }
  function mysteryEndpoint(api){
    let base=String(api.url||'').replace(/\/+$/,'');
    if(api.type==='anthropic'){
      if(/\/v1\/messages$/i.test(base))return base;
      base=base.replace(/\/v1$/i,'');return base+'/v1/messages';
    }
    if(api.type==='gemini'){
      base=base.replace(/\/v1beta$/i,'');
      return base+'/v1beta/models/'+encodeURIComponent(api.model||'<模型名>')+':generateContent';
    }
    return /\/chat\/completions$/i.test(base)?base:base+'/chat/completions';
  }
  function mysteryApiNeedsKey(api){
    if(api.type!=='openai')return true;
    return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(String(api.url||''));
  }
  function clueById(id){ return SCRIPT.clues.find(c=>c.id===id)||null; }

  /* ── 嫌疑度状态 ────────────────────────────────────────────────
   * 抄的是 PLAYER* 的思路：让每个角色显式维护"我现在最怀疑谁、有多怀疑"，
   * 而不是每次发言都从零开始重新想。有了这个状态，"下一个该问谁"就有依据，
   * 不必像 ThinkThrice 那样 random.choice 随机挑人问。
   * J.suspicion[发出怀疑的人][被怀疑的人] = 0~100 */
  function parseSuspect(raw){
    const out={};const s=String(raw||'').trim();
    if(!s||/^NONE$/i.test(s))return out;
    s.split(/[,，;；\n]/).forEach(seg=>{
      const m=seg.match(/([^\s:：]+)\s*[:：]\s*(\d{1,3})/);
      if(!m)return;
      const key=m[1].trim();const n=Math.max(0,Math.min(100,parseInt(m[2],10)));
      const p=J.players.find(x=>x.id===key)||J.players.find(x=>x.name===key)
        ||J.players.find(x=>key.includes(x.id)||key.includes(x.name));
      if(p)out[p.id]=n;
    });
    return out;
  }
  function noteSuspect(pl,map){
    if(!pl||!map)return;
    const cur=J.suspicion[pl.id]=J.suspicion[pl.id]||{};
    Object.keys(map).forEach(k=>{ if(k!==pl.id) cur[k]=map[k]; });
    renderSuspicion();
  }
  // 某人眼中最可疑的其他角色
  function topSuspect(pl,pool){
    const mine=J.suspicion[pl.id]||{};
    let best=null,bv=-1;
    (pool||J.players).forEach(x=>{
      if(x.id===pl.id)return;
      const v=mine[x.id];
      if(typeof v==='number'&&v>bv){bv=v;best=x;}
    });
    return bv>=40?best:null;   // 没有明确怀疑对象时返回 null，交给调用方随机
  }
  // 全场平均嫌疑度，用于侧栏展示
  function suspicionBoard(){
    return J.players.map(p=>{
      const vals=J.players.map(o=>(J.suspicion[o.id]||{})[p.id]).filter(v=>typeof v==='number');
      return {p:p,n:vals.length,avg:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0};
    }).sort((a,b)=>b.avg-a.avg);
  }
  function renderSuspicion(){
    const el=q('jbs-suspicion');if(!el)return;
    const rows=suspicionBoard().filter(r=>r.n);
    if(!rows.length){el.innerHTML='';return;}
    el.innerHTML='<div class="jbs-kicker" style="margin-top:12px">全场嫌疑度</div>'
      +rows.map(r=>'<div class="jbs-susp"><span>'+r.p.emoji+' '+h(r.p.name)+'</span>'
        +'<i style="width:'+r.avg+'%"></i><b>'+r.avg+'</b></div>').join('');
  }

  // 定向问答：ASK|角色id|问题内容
  function resolveAsk(action,candidates){
    const a=String(action||'').trim();
    const m=a.match(/ASK\s*[|｜]\s*([^|｜\n]+)\s*[|｜]\s*([\s\S]+)$/i);
    if(!m)return null;
    const key=m[1].trim().replace(/^[\[【"'“”]+|[\]】"'“”]+$/g,'');
    const question=m[2].trim().replace(/^[\[【"'“”]+|[\]】"'“”]+$/g,'');
    const t=candidates.find(x=>x.id===key)||candidates.find(x=>x.name===key)
      ||candidates.find(x=>key.includes(x.id)||key.includes(x.name));
    return (t&&question)?{target:t,question:question}:null;
  }

  // 事实小测：QUIZ|A,C,B —— 真相揭晓后考一遍，看谁真的听懂了这局
  function resolveQuiz(action,count){
    const a=String(action||'').trim();
    const m=a.match(/QUIZ\s*[|｜:：]?\s*([\s\S]+)$/i);
    const body=(m?m[1]:a).toUpperCase();
    const picks=(body.match(/[A-D]/g)||[]).slice(0,count);
    return picks.length===count?picks.map(x=>x.charCodeAt(0)-65):null;
  }
  // 每一轮换一个人起头。原来永远按 cast 的数组顺序，第一个人每轮都在信息最少时先说。
  function speakOrder(round){
    const n=J.players.length, off=((round%n)+n)%n;
    return J.players.slice(off).concat(J.players.slice(0,off));
  }

  function eventLabel(e){ return '[E'+String(e.id).padStart(4,'0')+'|'+e.phase+'|R'+e.round+']'; }
  // 事件编号是给主持人对时序用的调试信息，不该和角色名抢注意力——单独包一层好降级
  function eid(e){ return '<i class="jbs-eid">'+eventLabel(e)+'</i>'; }
  function record(type,text,speaker){
    const e={id:++J.seq,phase:J.phase,round:J.round,type:type,text:String(text||''),speaker:speaker||''};
    J.events.push(e); return e;
  }
  function log(type,html){
    const el=document.createElement('div'); el.className='jbs-msg '+type; el.innerHTML=html;
    q('jbs-log').appendChild(el); el.scrollIntoView({behavior:'smooth',block:'nearest'}); return el;
  }
  function sys(text){ log('sys',h(text)); }
  function narr(text){
    const e=record('narr',text,'旁白');
    log('narr',eid(e)+'<b>旁白</b><br>'+h(text).replace(/\n/g,'<br>'));
  }
  function clueTaken(id){
    if(J.found.includes(id)) return true;
    return Object.keys(J.known).some(k=>(J.known[k]||[]).includes(id));
  }
  // finder 为空表示主持人直接公开。secret 线索【绝不能】写进 J.events——
  // 那是所有人共享的公开日志，写进去就等于人人都知道，私密线索也就没意义了。
  function clue(c,finder){
    if(c.secret&&finder){
      (J.known[finder.id]=J.known[finder.id]||[]).push(c.id);
      // 公开日志里只留"某人单独去查了一处"，不带标题——别人确实看得见他去查了，
      // 但看不见他查到了什么。
      const e=record('clue',finder.name+' 单独去查了一处，没有当众说明结果','搜证');
      log('sys',eid(e)+' 🤫 '+h(finder.name)+' 单独去查了一处，没有当众说明结果');
      // 主持人（纯观战）和线索的主人本人可以看到内容，其他情况不剧透
      if(J.youId===null||finder.id===J.youId){
        log('clue','<b>🔒 '+h(finder.name)+' 私下发现 · '+h(c.title)+'</b><br>'+h(c.text)
          +'<br><small style="opacity:.7">只有 '+h(finder.name)+' 知道这条</small>');
      }
      return;
    }
    J.found.push(c.id);
    const e=record('clue',c.title+'：'+c.text,'公开线索');
    log('clue',eid(e)+'<b>🔍 '+h(c.title)+'</b>'
      +(finder?'<small style="opacity:.7"> · '+h(finder.name)+' 搜出</small>':'')
      +'<br>'+h(c.text));
  }
  function say(pl,text,thinking,isHuman){
    const e=record('say',text,pl.name);
    const showThink=!isHuman && J.driver==='api' && J.youId===null && thinking;
    const think=showThink?'<details class="jbs-think"><summary>💭 主持人查看内心</summary><div>'+h(thinking)+'</div></details>':'';
    log('say','<div class="jbs-who"><span>'+pl.emoji+'</span><b>'+h(pl.name)+'</b><small>'+h(pl.public)+'</small>'+eid(e)+'</div><div class="jbs-bubble">'+h(text)+'</div>'+think);
  }
  function speaking(id){
    document.querySelectorAll('#jbs-cast .jbs-pcard').forEach(x=>x.classList.toggle('speaking',x.dataset.id===id));
  }
  function renderCast(){
    q('jbs-cast').innerHTML=J.players.map(p=>'<div class="jbs-pcard" data-id="'+p.id+'"><span>'+p.emoji+'</span><span class="nm">'+h(p.name)+(p.id===J.youId?' <b style="color:#54c8b8">你</b>':'')+'</span><span class="pub">'+h(p.public)+'</span></div>').join('');
  }
  function setPhase(name,desc,idx){
    q('jbs-phase-name').textContent=name; q('jbs-phase-desc').textContent=desc||'';
    q('jbs-steps').innerHTML=STEPS.map((_,i)=>'<span class="jbs-step '+(i<idx?'done':i===idx?'cur':'')+'"></span>').join('');
  }
  function clearDynamic(){ q('jbs-dynamic').innerHTML=''; }

  function fatal(err){
    if(!q('jbs-view').classList.contains('on')) return;
    J.busy=false; speaking('');
    const msg=err && err.message ? err.message : String(err||'未知错误');
    log('narr','<b style="color:#e87070">⚠️ 流程暂停</b><br>'+h(msg));
    setControls([
      {label:'重试当前阶段',primary:true,run:()=>resumePhase()},
      {label:'返回设置',run:()=>showSetup()}
    ]);
  }
  function setControls(buttons){
    const bar=q('jbs-controls'); bar.innerHTML='';
    buttons.forEach(b=>{
      if(b.hint){const s=document.createElement('span');s.className='jbs-note';s.textContent=b.hint;bar.appendChild(s);return;}
      const btn=document.createElement('button');btn.type='button';btn.className='jbs-btn '+(b.primary?'primary':'')+(b.ghost?' ghost':'');btn.textContent=b.label;
      btn.disabled=!!b.disabled;
      btn.onclick=async()=>{
        if(J.busy) return; J.busy=true;
        bar.querySelectorAll('button').forEach(x=>x.disabled=true);
        try{await b.run();}catch(e){fatal(e);}
      };
      bar.appendChild(btn);
    });
  }
  function aliveToken(token){ return token===J.runId && q('jbs-view').classList.contains('on'); }
  function delay(ms,token){ return new Promise(resolve=>setTimeout(()=>resolve(aliveToken(token)),ms)); }
  function roleBrief(pl){
    // 凶手这一段原来只有禁令（不要自曝），没有权衡，结果 AI 要么梗着脖子什么都不认、
    // 要么演得很假。这里补上说谎的代价：可以撒谎和回避，但撒过头本身就是破绽。
    if(pl.role==='killer') return '你是凶手。你的公开目标是装作清白者推进破案，真实目标是不被指认。'
      +'你可以撒谎、回避、把话题引开——但记住【说谎是有代价的】：回避得太干净、对每个问题都滴水不漏、'
      +'或者对某个话题反应过度，本身就会让别人怀疑你。适度承认一些无害的、对你不致命的事实，'
      +'反而比样样否认更安全。绝不自曝，绝不承认只有凶手才知道的事。';
    if(pl.role==='hidden') return '你不是凶手，但有不愿立即公开的秘密。需要在自保与协助破案之间权衡，关键证据出现后可以逐步坦白。'
      +'你的秘密和这桩命案无关，被逼到墙角时说出来并不会让你成为凶手——但你会先本能地遮掩。';
    return '你是清白的推理者，没有涉案秘密，要依靠公开证据寻找真凶。';
  }
  function systemPrompt(pl){
    const others=J.players.filter(x=>x.id!==pl.id).map(x=>'－'+x.name+'（'+x.public+'）').join('\n');
    return [
      '你正在参与一场中文剧本杀，扮演【'+pl.name+'】。你不是裁判，也不是分析报告生成器；请用第一人称像真人在桌上发言。',
      '【公共背景】\n'+SCRIPT.world,
      '【你的公开身份】'+pl.public,
      '【只有你知道的私密剧本】\n'+pl.secret,
      '【你的目标】'+pl.goal,
      // 单列一条硬约束。原来"别说漏什么"是混在 secret 正文里的，模型往往只记住了
      // "我知道什么"、把"我不能说什么"读过去了。
      (pl.mustAvoid?'【你绝对不能说漏的】'+pl.mustAvoid:''),
      '【身份行动纲领】'+roleBrief(pl),
      '【其他人的公开身份】\n'+others,
      '【信息边界】你只知道自己的私密剧本、已经公开的线索、以及事件日志中在当前时刻之前发生的公开发言。你绝不知道别人的私密剧本。',
      '【时序铁律】日志按事件编号递增。评价某人在较早事件里的判断时，只能使用当时已经出现、编号更小的信息。绝不能用后来公开的身份、线索或证词倒推早先发言“当时就该知道”；若后来信息改变判断，要明确说“现在回看”而不是追究其早先未知。',
      '【发言方式】不写标题和编号清单，带有人设、情绪和立场。隐瞒可以解释或转移，但不能凭空编造已经公开的物证。',
      '【输出格式】\n<thinking>只给主持人看的内心盘算</thinking>\n<say>当众发言</say>'
        +'\n<suspect>你现在最怀疑的人及其可疑程度，格式 角色id:0-100，用逗号分隔，最多三个；没想法就写 NONE</suspect>'
        +'\n<action>只有任务要求行动时填写，否则写 NONE</action>'
    ].filter(Boolean).join('\n\n');
  }
  // 事件日志每一幕都在线性增长，而【每个角色每次发言都要重发整份日志】，token 是平方级涨的。
  // 旁白/线索/投票这类结构性事件本来就短，全保留；发言只保留最近若干条全文，
  // 更早的截断成摘要——事件编号仍然连续，时序铁律不受影响。
  const LOG_FULL_SAYS=16, LOG_BRIEF=110, LOG_CAP=7000;
  function compressLog(){
    if(!J.events.length) return '（尚无公开事件）';
    const says=J.events.filter(e=>e.type==='say');
    const keepFrom=says.length>LOG_FULL_SAYS?says[says.length-LOG_FULL_SAYS].id:0;
    let out=J.events.map(e=>{
      const head=eventLabel(e)+' '+e.speaker+'：';
      if(e.type!=='say'||e.id>=keepFrom) return head+e.text;
      return head+(e.text.length>LOG_BRIEF?e.text.slice(0,LOG_BRIEF)+'…（发言从略）':e.text);
    }).join('\n');
    if(out.length>LOG_CAP) out='（更早的记录已省略）\n'+out.slice(out.length-LOG_CAP);
    return out;
  }
  function contextPrompt(pl,instruction){
    const clues=J.found.length?J.found.map(clueById).filter(Boolean).map(c=>'【'+c.title+'】'+c.text).join('\n'):'（尚无公开线索）';
    const mineIds=(pl&&J.known[pl.id])||[];
    const mine=mineIds.map(clueById).filter(Boolean).map(c=>'【'+c.title+'】'+c.text).join('\n');
    return '【当前公开线索】\n'+clues
      +(mine?'\n\n【只有你一个人搜到的线索】\n'+mine
        +'\n（别人不知道这条。你可以在发言里抛出来换取信任或施压，也可以先按着不说。'
        +'但不要谎称它已经公开，也不要凭空给它添加剧本里没有的细节。）':'')
      +'\n\n【完整公开事件日志·严格按编号先后】\n'+compressLog()
      +'\n\n【现在的任务】\n'+instruction;
  }
  function parseReply(raw){
    let s=String(raw||'').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/<think>/gi,'<thinking>').replace(/<\/think>/gi,'</thinking>').replace(/<game>/gi,'<say>').replace(/<\/game>/gi,'</say>').replace(/\[草稿\]/g,'<thinking>').replace(/\[\/草稿\]/g,'</thinking>');
    const tm=s.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    const sm=s.match(/<say>([\s\S]*?)<\/say>/i);
    const am=s.match(/<action>([\s\S]*?)<\/action>/i);
    const pm=s.match(/<suspect>([\s\S]*?)<\/suspect>/i);
    const thinking=tm?tm[1].trim():'';
    let text=sm?sm[1].trim():s.replace(/<thinking>[\s\S]*?<\/thinking>/gi,'')
      .replace(/<action>[\s\S]*?<\/action>/gi,'').replace(/<suspect>[\s\S]*?<\/suspect>/gi,'')
      .replace(/<\/?say>/gi,'').trim();
    if(!text) text='（沉默）';
    return {thinking:thinking,text:text,action:am?am[1].trim():'',suspect:parseSuspect(pm?pm[1]:'')};
  }
  async function requestMysteryApi(api,sysPrompt,userPrompt,signal,maxTokens){
    if(!api.url)throw new Error('未配置 API 地址。');
    if(!api.model)throw new Error('未配置模型名称。');
    if(!api.key&&mysteryApiNeedsKey(api))throw new Error('该渠道未配置 API 密钥。');
    const endpoint=mysteryEndpoint(api);let res,data,raw='';
    if(api.type==='anthropic'){
      res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-api-key':api.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:api.model,max_tokens:maxTokens||4096,system:[{type:'text',text:sysPrompt,cache_control:{type:'ephemeral'}}],messages:[{role:'user',content:userPrompt}]}),signal:signal});
      if(!res.ok){raw=await res.text().catch(()=> '');throw new Error('API HTTP '+res.status+' '+raw.slice(0,180));}
      data=await res.json();raw=(data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');
    }else if(api.type==='gemini'){
      const url=endpoint+'?key='+encodeURIComponent(api.key);
      res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:sysPrompt}]},contents:[{role:'user',parts:[{text:userPrompt}]}],generationConfig:{maxOutputTokens:maxTokens||8192,temperature:.8}}),signal:signal});
      if(!res.ok){raw=await res.text().catch(()=> '');throw new Error('API HTTP '+res.status+' '+raw.slice(0,180));}
      data=await res.json();
      const parts=data.candidates?.[0]?.content?.parts||[];
      const thought=parts.filter(x=>x&&x.thought===true).map(x=>x.text||'').join('');
      const answer=parts.filter(x=>x&&x.thought!==true).map(x=>x.text||'').join('');
      raw=(thought?'<thinking>'+thought+'</thinking>':'')+(answer||parts.map(x=>x.text||'').join(''));
    }else{
      const mn=api.model.toLowerCase();
      const reasoning=/gpt-?5(?:\.|[-_]|$)|(?:^|[\/_-])o(?:1|3|4)(?:[-_.]|$)/.test(mn);
      const body={model:api.model,messages:[{role:'system',content:sysPrompt},{role:'user',content:userPrompt}],stream:true};
      if(reasoning)body.max_completion_tokens=maxTokens&&maxTokens<1024?maxTokens:Math.max(maxTokens||8192,8192);
      else{body.max_tokens=maxTokens||4096;body.temperature=.8;}
      const headers={'Content-Type':'application/json'};if(api.key)headers.Authorization='Bearer '+api.key;
      const send=()=>fetch(endpoint,{method:'POST',headers:headers,body:JSON.stringify(body),signal:signal});
      res=await send();
      if(!res.ok){
        let detail=await res.text().catch(()=> '');
        // 中转对 token 字段的兼容程度不一致：只在明确的 400 参数错误时换字段重试。
        if(res.status===400&&/max_(completion_)?tokens/i.test(detail)){
          if(body.max_completion_tokens){body.max_tokens=body.max_completion_tokens;delete body.max_completion_tokens;}
          else{body.max_completion_tokens=body.max_tokens;delete body.max_tokens;}
          res=await send();
          if(!res.ok)detail=await res.text().catch(()=>detail);
        }
        // 少数旧中转不接受 stream 字段；先走原生流式，明确拒绝时才降级成普通 JSON。
        if(!res.ok&&res.status===400&&body.stream&&/stream/i.test(detail)){
          delete body.stream;res=await send();if(!res.ok)detail=await res.text().catch(()=>detail);
        }
        if(!res.ok)throw new Error('API HTTP '+res.status+' '+String(detail).slice(0,180));
      }
      data=await parseAPIResponseWithSSEFallback(res,{tag:'[剧本杀 API]'});
      const msg=data.choices?.[0]?.message||{};
      const thought=msg.reasoning_content||msg.reasoning||msg.thinking||'';
      raw=(thought?'<thinking>'+thought+'</thinking>':'')+(msg.content||data.output_text||'');
    }
    if(!raw)throw new Error('API 没有返回有效文本。');
    return raw;
  }
  async function apiAsk(pl,sysPrompt,userPrompt,token){
    const api=resolveMysteryApi(pl);
    if(!api.key&&mysteryApiNeedsKey(api)) throw new Error(pl.name+' 没有可用的 API 密钥，请返回剧本杀设置填写。');
    const ctrl=new AbortController(); J.currentAbort=ctrl;
    const timeout=setTimeout(()=>ctrl.abort(),600000);
    try{
      const raw=await requestMysteryApi(api,sysPrompt,userPrompt,ctrl.signal,8192);
      if(!aliveToken(token)) return null;
      return parseReply(raw);
    }catch(e){
      if(e && e.name==='AbortError') throw new Error(aliveToken(token)?'AI 请求超时或已取消。':'流程已取消');
      throw e;
    }finally{
      clearTimeout(timeout);if(J.currentAbort===ctrl)J.currentAbort=null;
    }
  }
  function closeWebOverlay(){
    q('jbs-web-overlay').classList.remove('on');q('jbs-web-overlay').setAttribute('aria-hidden','true');
    J.webResolve=null;J.webReject=null;
  }
  function webAsk(pl,sysPrompt,userPrompt,token){
    return new Promise((resolve,reject)=>{
      if(!aliveToken(token)){resolve(null);return;}
      const full='以下内容是【'+pl.name+'】的私密角色提示，不要转发给其他玩家。\n\n===== SYSTEM =====\n'+sysPrompt+'\n\n===== USER =====\n'+userPrompt;
      q('jbs-web-role').textContent='网页端AI接力 · '+pl.emoji+' '+pl.name;
      q('jbs-web-prompt').value=full;q('jbs-web-reply').value='';
      q('jbs-web-overlay').classList.add('on');q('jbs-web-overlay').setAttribute('aria-hidden','false');
      J.webResolve=raw=>{closeWebOverlay();resolve(parseReply(raw));};
      J.webReject=()=>{closeWebOverlay();const e=new Error('网页端AI接力已取消');e.cancelled=true;reject(e);};
      setTimeout(()=>q('jbs-web-reply').focus(),50);
    });
  }
  // 这一局里这个角色走不走网页端接力
  function useWeb(pl){ return J.driver==='web' || (J.webIds||[]).indexOf(pl.id)>=0; }
  function ask(pl,instruction,token){
    const sp=systemPrompt(pl),up=contextPrompt(pl,instruction);
    return useWeb(pl)?webAsk(pl,sp,up,token):apiAsk(pl,sp,up,token);
  }
  // 搜证决策不需要整份事件日志，只要知道自己是谁、还有哪些线索没搜。
  // 单独走一条轻量提示词，免得为了选一条线索就把上下文全量重发一遍。
  function askSearch(pl,options,token){
    const sp='你正在参与一场中文剧本杀，扮演【'+pl.name+'】（'+pl.public+'）。\n\n'
      +'【只有你知道的私密剧本】\n'+pl.secret+'\n\n【你的目标】'+pl.goal+'\n\n'
      +roleBrief(pl)+'\n\n现在是搜证阶段，你要挑一个方向去查。'
      +'从自己的立场出发：想洗清嫌疑就去查能证明自己的；心里有鬼就避开会烧到自己的地方，'
      +'甚至可以去查能把注意力引开的方向。';
    const up='【还可以搜查的线索】\n'+options.map(c=>'－'+c.id+'：'+c.title).join('\n')
      +'\n\n【任务】只挑一条你最想查的，在 action 里严格写 SEARCH|线索id，'
      +'并在 say 里用一句话说明你为什么想查它（这句话会当众说出来）。'
      +'\n\n【输出格式】\n<thinking>内心盘算</thinking>\n<say>一句话</say>\n<action>SEARCH|线索id</action>';
    return useWeb(pl)?webAsk(pl,sp,up,token):apiAsk(pl,sp,up,token);
  }
  function resolveSearch(action,options){
    const a=String(action||'').trim();
    const m=a.match(/SEARCH\s*[|｜:：,，]\s*(.+)$/im);
    const raw=(m?m[1]:a).trim().replace(/^[\[【"'“”]+|[\]】"'“”。．.,，、；;]+$/g,'');
    return options.find(c=>c.id===raw)||options.find(c=>c.title===raw)
      ||options.find(c=>raw.includes(c.id)||raw.includes(c.title))||null;
  }

  async function aiSpeak(pl,instruction,token){
    speaking(pl.id);sys(pl.name+' 正在斟酌……');
    const r=await ask(pl,instruction,token);
    if(!r||!aliveToken(token)) return null;
    noteSuspect(pl,r.suspect);
    say(pl,r.text,r.thinking,false);speaking('');return r;
  }
  // 真人玩家发问用的面板：先点人，再写问题
  function humanAsk(others){
    return new Promise(resolve=>{
      clearDynamic();let sel='';
      q('jbs-dynamic').innerHTML='<div class="jbs-panel"><div class="jbs-kicker">❓ 轮到你发问</div>'
        +'<div class="jbs-note">挑一个人，问一个具体的问题——针对他说过的话、时间线的空白、或者和线索对不上的地方。</div>'
        +'<div class="jbs-votes" style="margin:8px 0">'+others.map(x=>'<button class="jbs-vote" data-ask="'+x.id+'">'+x.emoji+' '+h(x.name)+'</button>').join('')+'</div>'
        +'<textarea class="jbs-input" id="jbs-ask-text" rows="3" placeholder="你想问他什么？"></textarea>'
        +'<div class="jbs-controls"><button class="jbs-btn primary" id="jbs-ask-ok" disabled>发问</button>'
        +'<button class="jbs-btn ghost" id="jbs-ask-skip">这轮不问</button></div></div>';
      const sync=()=>{q('jbs-ask-ok').disabled=!(sel&&q('jbs-ask-text').value.trim());};
      q('jbs-dynamic').querySelectorAll('[data-ask]').forEach(b=>b.onclick=()=>{
        sel=b.dataset.ask;
        q('jbs-dynamic').querySelectorAll('[data-ask]').forEach(x=>x.classList.toggle('sel',x===b));
        sync();
      });
      q('jbs-ask-text').addEventListener('input',sync);
      const done=v=>{J.pendingCancel=null;clearDynamic();resolve(v);};
      J.pendingCancel=()=>done(null);
      q('jbs-ask-ok').onclick=()=>{
        const t=others.find(x=>x.id===sel),txt=q('jbs-ask-text').value.trim();
        if(t&&txt)done({target:t,question:txt});
      };
      q('jbs-ask-skip').onclick=()=>done(null);
    });
  }
  /* 一问一答。ThinkThrice 的 free_discussion 就是这个形状：挑一个具体的人、问一个具体的
   * 问题，对方当场回答，这一问一答再进所有人的记忆——比六个人各说一段独白更像真的在对质。
   * 问谁：优先问自己嫌疑度最高的那个（PLAYER* 的做法）；ThinkThrice 那边是 random.choice，
   * 有了嫌疑度状态就不必靠随机。 */
  async function oneExchange(asker,token){
    const others=J.players.filter(x=>x.id!==asker.id);
    let target=null,question='';
    if(asker.id===J.youId){
      const picked=await humanAsk(others);
      if(!picked)return;
      target=picked.target;question=picked.question;
      const eu=record('ask',asker.name+' 问 '+target.name+'：'+question,asker.name);
      log('sys',eid(eu)+' ❓ <b>'+h(asker.name)+'</b> → <b>'+h(target.name)+'</b>：'+h(question));
    }else{
      const pref=topSuspect(asker,others);
      const list=others.map(x=>x.id+'='+x.name+'（'+x.public+'）').join('、');
      const r=await ask(asker,'轮到你发问。从下面这些人里挑【一个】，问【一个】具体的问题——'
        +'针对他说过的话、他时间线上的空白、或者和已公开线索对不上的地方。不要泛泛而问，'
        +'问题要能逼出信息。\n候选：'+list
        +(pref?'\n（你目前最怀疑的是 '+pref.name+'，除非有更好的理由，优先问他。）':'')
        +'\n\n在 say 里写你当众问出口的那句话，在 action 里严格写 ASK|角色id|问题内容。',token);
      if(!r||!aliveToken(token))return;
      noteSuspect(asker,r.suspect);
      const parsed=resolveAsk(r.action,others);
      target=parsed?parsed.target:(pref||others[Math.floor(Math.random()*others.length)]);
      question=parsed?parsed.question:(r.text&&r.text!=='（沉默）'?r.text:'你还有什么没说出来的？');
      say(asker,r.text&&r.text!=='（沉默）'?r.text:('我想问问 '+target.name+'：'+question),r.thinking,false);
      const e=record('ask',asker.name+' 问 '+target.name+'：'+question,asker.name);
      log('sys',eid(e)+' ❓ <b>'+h(asker.name)+'</b> → <b>'+h(target.name)+'</b>：'+h(question));
    }
    if(!aliveToken(token))return;
    // 被问的人当场回应
    if(target.id===J.youId){
      sys('轮到你回答 '+asker.name+' 的问题。');
      await humanSpeak(target);
    }else{
      await aiSpeak(target,'（'+asker.name+' 当面问你）'+question
        +'\n\n正面回应这个问题本身，不要绕开。你可以如实回答、可以回避、可以反问回去，'
        +'但必须符合你的身份和你不能说漏的东西。',token);
    }
  }
  function humanSpeak(pl){
    return new Promise(resolve=>{
      clearDynamic();
      q('jbs-dynamic').innerHTML='<div class="jbs-panel"><div class="jbs-kicker">🎤 轮到你 · '+h(pl.name)+'</div><textarea class="jbs-input" id="jbs-human-text" rows="5" placeholder="以角色身份公开发言……"></textarea><div class="jbs-controls"><button class="jbs-btn primary" id="jbs-human-send">发言</button><button class="jbs-btn ghost" id="jbs-human-skip">跳过</button></div></div>';
      q('jbs-human-text').focus();
      const done=text=>{J.pendingCancel=null;clearDynamic();if(text)say(pl,text,'',true);else sys(pl.name+' 选择不发言');resolve(text||null);};
      J.pendingCancel=()=>done(null);
      q('jbs-human-send').onclick=()=>{const v=q('jbs-human-text').value.trim();if(v)done(v);};
      q('jbs-human-skip').onclick=()=>done(null);
    });
  }
  async function letSpeak(pl,instruction,token){
    speaking(pl.id);
    const r=pl.id===J.youId?await humanSpeak(pl):await aiSpeak(pl,instruction,token);
    speaking('');return r;
  }
  async function phaseIntro(){
    const token=J.runId;J.phase='开场';J.round=0;setPhase('开场','案件背景与角色登场',0);setControls([{hint:'角色依次入场……'}]);
    narr(SCRIPT.world);sys('六位角色依次做公开自我介绍。');
    for(const pl of J.players){
      if(!aliveToken(token))return;
      await letSpeak(pl,'游戏刚刚开始，请用一至三句话自我介绍：你是谁、为何来到别墅。只说公开身份，不暴露私密剧本。',token);
      await delay(100,token);
    }
    if(!aliveToken(token))return;J.busy=false;
    setControls([{label:'进入第一幕搜证',primary:true,run:()=>phaseInvestigate(1)}]);
  }
  function renderClueBoard(stage){
    const avail=SCRIPT.clues.filter(c=>c.stage===stage);
    const me=J.youId?J.players.find(x=>x.id===J.youId):null;
    q('jbs-dynamic').innerHTML='<div class="jbs-panel"><div class="jbs-kicker">'
      +(J.youId?'你的行动点：<span id="jbs-ap">'+J.actionsLeft+'</span> / 2':'主持人公开线索')+'</div>'
      +'<div class="jbs-note">'+(J.youId?'挑你最想查的方向。🔒 的线索只有搜到的人知道，别人看不见。':'点击公开线索；🔒 的线索若被 AI 搜走，只会进它自己手里。')+'</div>'
      +'<div class="jbs-clues">'+avail.map(c=>{
        const taken=clueTaken(c.id);
        const byMe=me&&(J.known[me.id]||[]).includes(c.id);
        const state=!taken?'点击搜查':(J.found.includes(c.id)?'已公开':(byMe?'你私下掌握':'已被人搜走'));
        return '<button class="jbs-clue '+(taken?'found':'')+'" data-clue="'+c.id+'" '+(taken?'disabled':'')+'>'
          +'<b>'+(c.secret?'🔒 ':'')+h(c.title)+'</b><br><small>'+state+'</small></button>';
      }).join('')+'</div></div>';
    q('jbs-dynamic').querySelectorAll('[data-clue]').forEach(btn=>btn.onclick=()=>{
      const c=clueById(btn.dataset.clue);
      if(!c||clueTaken(c.id)||(J.youId&&J.actionsLeft<=0))return;
      if(J.youId){J.actionsLeft--;}
      clue(c,me);renderClueBoard(stage);
    });
  }
  // 让 AI 各自挑一条去查。原来只有真人玩家有行动点（actionsLeft = youId ? 2 : 0），
  // 纯 AI 局里「搜证」其实是主持人手动公开线索、AI 全程被动——
  // 模式卡上写着「搜证·圆桌·指认」，这一幕却没有人在搜。
  async function aiInvestigate(stage,token){
    for(const pl of J.players.filter(p=>p.id!==J.youId)){
      if(!aliveToken(token))return;
      const options=SCRIPT.clues.filter(c=>c.stage===stage&&!clueTaken(c.id));
      if(!options.length){sys('本幕的线索已经被查完了。');break;}
      speaking(pl.id);sys(pl.name+' 正在挑要查的方向……');
      const r=await askSearch(pl,options,token);
      if(!aliveToken(token))return;
      // 没解析出来就替它随机挑一条，别让一次格式跑偏白白浪费一个搜证名额
      const c=(r&&resolveSearch(r.action,options))||options[Math.floor(Math.random()*options.length)];
      if(r&&r.text&&r.text!=='（沉默）')say(pl,r.text,r.thinking,false);
      clue(c,pl);speaking('');renderClueBoard(stage);
      await delay(80,token);
    }
    speaking('');
  }
  async function phaseInvestigate(stage){
    const token=J.runId;
    J.phase=stage===1?'第一幕搜证':'第二幕搜证';J.round=stage;J.actionsLeft=J.youId?2:0;
    setPhase(J.phase,stage===1?'勘察案发现场':'追查证词与隐藏物证',stage===1?1:3);clearDynamic();
    renderClueBoard(stage);
    J.busy=false;
    const next={label:stage===1?'进入初步讨论':'进入圆桌交锋',primary:true,run:()=>phaseDiscuss(stage)};
    if(J.aiSearch){
      setControls([
        {hint:'先搜你自己的，再让其余角色各查一条。'},
        {label:'🔍 其余角色搜证',primary:true,run:async()=>{
          await aiInvestigate(stage,token);
          if(!aliveToken(token))return;
          J.busy=false;setControls([next]);
        }},
        {label:'跳过，直接讨论',ghost:true,run:()=>phaseDiscuss(stage)}
      ]);
    }else{
      setControls([{hint:'可以只公开部分线索；未点击的线索不会被AI知道。'},next]);
    }
  }
  async function phaseDiscuss(round){
    const token=J.runId;J.phase=round===1?'初步讨论':'圆桌交锋';J.round=round;setPhase(J.phase,round===1?'基于现有线索形成初步判断':'指认前最后一次对质',round===1?2:4);clearDynamic();setControls([{hint:'角色按顺序公开发言……'}]);
    narr(round===1?'第一轮公开讨论开始。':'最终圆桌交锋开始。');
    const instruction=round===1?'基于目前已公开的线索和此前事件，说出你的初步观察、疑点或自我说明。注意发言当下的信息边界。':'这是指认前最后交锋。结合全部已公开信息，明确怀疑对象和证据，可以质问或辩护。必须区分“某人当时就知道什么”和“后来才知道什么”。';
    // 第一轮还是各自陈述（刚看完线索，本来就该先摊各自的观察）；
    // 第二轮改成定向问答——原来两轮都是轮流独白，六段平行陈述根本不叫「交锋」。
    // 每轮换一个人起头：原来永远按 cast 的数组顺序，排第一的人每轮都在信息最少时先开口。
    if(round===1){
      for(const pl of speakOrder(round)){
        if(!aliveToken(token))return;
        await letSpeak(pl,instruction,token);await delay(100,token);
      }
    }else{
      for(const pl of speakOrder(round)){
        if(!aliveToken(token))return;
        await oneExchange(pl,token);await delay(80,token);
      }
    }
    if(!aliveToken(token))return;J.busy=false;
    if(round===1)setControls([{label:'进入第二幕搜证',primary:true,run:()=>phaseInvestigate(2)},{label:'再讨论一轮',ghost:true,run:()=>phaseDiscuss(1)}]);
    else setControls([{label:'进入最终指认',primary:true,run:()=>phaseAccuse()},{label:'再交锋一轮',ghost:true,run:()=>phaseDiscuss(2)}]);
  }

  // 旧版正则的字符类只有 ASCII，AI 写 ACCUSE|管家·园田（提示词要 id，但模型经常写名字）
  // 会匹配失败，回退分支又拿【整段 action】去比名字，于是这一票被无声无息记成弃票。
  // 现在先取分隔符后面的全部内容，再按 id / 名字 / 包含关系逐层放宽。
  function resolveVote(action,candidates){
    const a=String(action||'').trim();
    const m=a.match(/ACCUSE\s*[|｜:：,，]\s*(.+)$/im);
    const raw=(m?m[1]:a).trim().replace(/^[\[【"'“”]+|[\]】"'“”。．.,，、；;!！]+$/g,'');
    const exact=candidates.find(x=>x.id===raw)||candidates.find(x=>x.name===raw);
    if(exact) return exact;
    // 再放宽到包含匹配，但【只命中一个】才认：命中多个说明这是一段论述，不是指认
    const loose=candidates.filter(x=>raw.includes(x.id)||raw.includes(x.name));
    return loose.length===1?loose[0]:null;
  }
  function humanVote(pl,candidates){
    return new Promise(resolve=>{
      clearDynamic();let selected='';
      q('jbs-dynamic').innerHTML='<div class="jbs-panel"><div class="jbs-kicker">🗳️ 请选择你指认的真凶</div><div class="jbs-votes">'+candidates.map(x=>'<button class="jbs-vote" data-vote="'+x.id+'">'+x.emoji+' '+h(x.name)+'</button>').join('')+'</div><div class="jbs-controls"><button class="jbs-btn primary" id="jbs-vote-ok" disabled>确认指认</button></div></div>';
      q('jbs-dynamic').querySelectorAll('[data-vote]').forEach(b=>b.onclick=()=>{selected=b.dataset.vote;q('jbs-dynamic').querySelectorAll('[data-vote]').forEach(x=>x.classList.toggle('sel',x===b));q('jbs-vote-ok').disabled=false;});
      q('jbs-vote-ok').onclick=()=>{J.pendingCancel=null;clearDynamic();resolve(candidates.find(x=>x.id===selected));};
      J.pendingCancel=()=>{J.pendingCancel=null;clearDynamic();resolve(null);};
    });
  }
  async function phaseAccuse(only){
    const token=J.runId;J.phase='最终指认';J.round=3;J.votes={};setPhase('最终指认',only?'平票加赛':'每个人独立指认真凶',5);clearDynamic();
    narr(only?'加赛开始，只能在平票的几人之间选。':'最终指认开始。每个人只能选择一名其他角色。');
    setControls([{hint:'角色正在做最终判断……'}]);
    for(const pl of J.players){
      if(!aliveToken(token))return;
      let candidates=J.players.filter(x=>x.id!==pl.id);
      if(only&&only.length)candidates=candidates.filter(x=>only.includes(x.id));
      if(!candidates.length)continue;   // 加赛时平票名单里只有自己，跳过
      let target=null;
      if(pl.id===J.youId)target=await humanVote(pl,candidates);
      else{
        const list=candidates.map(x=>x.id+'='+x.name).join('、');
        const r=await ask(pl,'最终指认。必须从以下候选中选择一人：'+list+'。公开说明理由，并在 action 中严格写 ACCUSE|角色id。凶手不能投自己，应努力把票引向最合适的替罪者。',token);
        if(!r||!aliveToken(token))return;noteSuspect(pl,r.suspect);say(pl,r.text,r.thinking,false);target=resolveVote(r.action,candidates);
      }
      if(target){J.votes[target.id]=(J.votes[target.id]||0)+1;const e=record('vote',pl.name+' 指认 '+target.name,pl.name);sys(eventLabel(e)+' '+pl.name+' 指认了 '+target.name);}
      else sys(pl.name+' 的指认无法识别，记为弃票。');
      await delay(100,token);
    }
    if(!aliveToken(token))return;
    const sorted=Object.entries(J.votes).sort((a,b)=>b[1]-a[1]);const max=sorted[0]?.[1]||0;const leaders=sorted.filter(x=>x[1]===max).map(x=>x[0]);
    const result=sorted.map(([id,n])=>(J.players.find(x=>x.id===id)?.name||id)+' '+n+'票').join(' · ')||'无人得票';
    narr('计票结果：'+result);
    // 平票原来直接判「真凶逃脱」，一局的推理就这么作废了。改成在平票的人里加赛一轮。
    if(leaders.length!==1&&leaders.length&&!J.runoffDone){
      J.runoffDone=true;J.busy=false;
      const names=leaders.map(id=>J.players.find(x=>x.id===id)?.name||id).join('、');
      narr('出现平票（'+names+'）。进入加赛：只在这几人之间重新指认一次。');
      setControls([{label:'开始加赛',primary:true,run:()=>phaseAccuse(leaders)}]);
      return;
    }
    J.lastAccused=leaders.length===1?leaders[0]:null;J.lastTie=leaders.length!==1;J.busy=false;
    setControls([{label:'揭晓真相',primary:true,run:()=>phaseReveal()}]);
  }
  async function phaseReveal(){
    const token=J.runId;J.phase='真相';J.round=4;setPhase('真相','案件复原',6);clearDynamic();
    const killer=J.players.find(x=>x.id===SCRIPT.solution.killer);const correct=!J.lastTie&&J.lastAccused===killer.id;
    const verdict=correct?'🎉 指认正确，真凶落网！':J.lastTie?'⚖️ 最高票相同，真凶逃脱。':'❌ 指认错误，真凶逃脱。';
    narr(verdict+'\n\n'+SCRIPT.solution.title+'\n\n'+SCRIPT.solution.story);
    if(killer.id!==J.youId&&aliveToken(token)){
      const r=await ask(killer,correct?'真相已经揭晓，你被识破。卸下伪装，用第一人称作一段简短认罪独白。':'真相已经揭晓，你成功逃过指认。卸下伪装，对观众作一段简短独白。',token);
      if(r&&aliveToken(token))say(killer,r.text,'',false);
    }
    J.busy=false;
    const again=[{label:'再玩一次',primary:true,run:()=>start()},{label:'返回设置',ghost:true,run:()=>showSetup()}];
    setControls((SCRIPT.quiz&&SCRIPT.quiz.length)
      ?[{label:'📝 事实小测',primary:true,run:()=>phaseQuiz()}].concat(again.map(x=>Object.assign({},x,{primary:false})))
      :again);
  }
  function quizScore(ans,qs){ return (ans||[]).reduce((n,v,i)=>n+(qs[i]&&v===qs[i].a?1:0),0); }
  function humanQuiz(qs){
    return new Promise(resolve=>{
      clearDynamic();const picks=new Array(qs.length).fill(-1);
      q('jbs-dynamic').innerHTML='<div class="jbs-panel"><div class="jbs-kicker">📝 你的答卷</div>'
        +qs.map((x,i)=>'<div style="margin:10px 0"><div style="color:#dfc59c;font-size:.88em;margin-bottom:5px">'+(i+1)+'. '+h(x.q)+'</div>'
          +'<div class="jbs-votes">'+x.o.map((t,k)=>'<button class="jbs-vote" data-qi="'+i+'" data-oi="'+k+'">'+String.fromCharCode(65+k)+'. '+h(t)+'</button>').join('')+'</div></div>').join('')
        +'<div class="jbs-controls"><button class="jbs-btn primary" id="jbs-quiz-ok" disabled>交卷</button></div></div>';
      q('jbs-dynamic').querySelectorAll('[data-qi]').forEach(b=>b.onclick=()=>{
        const i=+b.dataset.qi;picks[i]=+b.dataset.oi;
        q('jbs-dynamic').querySelectorAll('[data-qi="'+i+'"]').forEach(x=>x.classList.toggle('sel',x===b));
        q('jbs-quiz-ok').disabled=picks.some(v=>v<0);
      });
      const done=()=>{J.pendingCancel=null;clearDynamic();resolve(picks);};
      J.pendingCancel=()=>{J.pendingCancel=null;clearDynamic();resolve(picks.map(v=>v<0?-1:v));};
      q('jbs-quiz-ok').onclick=done;
    });
  }
  /* 事实小测。抄的是 WhodunitBench / WellPlay 那套「用事实问答衡量智能体到底掌握了多少案情」
   * 的评测思路——搬进游戏里就是一个天然的收尾环节：真相摊开后考一遍，看谁是真听懂了、
   * 谁只是一路跟着别人的判断走。顺带评一个「最佳侦探」。 */
  async function phaseQuiz(){
    const token=J.runId;J.phase='小测';J.round=5;setPhase('事实小测','看谁真的听懂了这局',7);clearDynamic();
    const qs=SCRIPT.quiz||[];
    if(!qs.length){J.busy=false;setControls([{label:'再玩一次',primary:true,run:()=>start()}]);return;}
    narr('真相已经揭晓。现在给所有人出 '+qs.length+' 道关于本案的事实题，看谁真的把这局听明白了。');
    const paper=qs.map((x,i)=>(i+1)+'. '+x.q+'\n'+x.o.map((t,k)=>'  '+String.fromCharCode(65+k)+'. '+t).join('\n')).join('\n\n');
    setControls([{hint:'角色正在答题……'}]);
    for(const pl of J.players){
      if(!aliveToken(token))return;
      if(pl.id===J.youId){
        J.quizScores[pl.id]=quizScore(await humanQuiz(qs),qs);
        sys('你答对 '+J.quizScores[pl.id]+'/'+qs.length);
        continue;
      }
      speaking(pl.id);
      const r=await ask(pl,'游戏已经结束，真相是：'+SCRIPT.solution.title+'\n\n'
        +'现在做一份关于本案的事实小测，共 '+qs.length+' 题，每题四选一：\n\n'+paper
        +'\n\n在 say 里用一两句话说说你的感受（比如你有没有猜对、哪一步想岔了），'
        +'在 action 里严格写 QUIZ|答案，例如 QUIZ|A,C,B,D，顺序对应题号。',token);
      speaking('');
      if(!r||!aliveToken(token))return;
      const ans=resolveQuiz(r.action,qs.length);
      J.quizScores[pl.id]=ans?quizScore(ans,qs):0;
      say(pl,r.text,r.thinking,false);
      sys(pl.name+' 答对 '+J.quizScores[pl.id]+'/'+qs.length+(ans?'':'（答案格式识别不了，记 0 分）'));
      await delay(80,token);
    }
    if(!aliveToken(token))return;
    const board=J.players.map(p=>({p:p,n:J.quizScores[p.id]||0})).sort((a,b)=>b.n-a.n);
    const best=board.filter(x=>x.n===board[0].n);
    narr('小测结果：\n'+board.map(x=>'  '+x.p.emoji+' '+x.p.name+'　'+x.n+'/'+qs.length).join('\n')
      +'\n\n🏅 最佳侦探：'+best.map(x=>x.p.name).join('、')+'（'+board[0].n+'/'+qs.length+'）');
    // 附上标准答案，方便你核对题目本身出得对不对
    narr('参考答案：'+qs.map((x,i)=>(i+1)+String.fromCharCode(65+x.a)).join('　'));
    J.busy=false;
    setControls([{label:'再玩一次',primary:true,run:()=>start()},{label:'返回设置',ghost:true,run:()=>showSetup()}]);
  }
  function resumePhase(){
    if(J.phase==='开场')return phaseIntro();
    if(J.phase==='第一幕搜证')return phaseInvestigate(1);
    if(J.phase==='初步讨论')return phaseDiscuss(1);
    if(J.phase==='第二幕搜证')return phaseInvestigate(2);
    if(J.phase==='圆桌交锋')return phaseDiscuss(2);
    if(J.phase==='最终指认')return phaseAccuse();
    if(J.phase==='小测')return phaseQuiz();
    return phaseReveal();
  }
  function cancelRun(){
    J.runId++;J.busy=false;if(J.currentAbort){J.currentAbort.abort();J.currentAbort=null;}
    if(J.pendingCancel){const fn=J.pendingCancel;J.pendingCancel=null;fn();}
    if(J.webReject){const fn=J.webReject;J.webReject=null;fn();}
  }
  function showSetup(){
    cancelRun();q('jbs-game').style.display='none';q('jbs-setup').style.display='grid';q('jbs-restart').style.visibility='hidden';
  }
  function selectedValue(el){
    if(el && typeof el.value==='string' && el.value) return el.value;
    const opt=el&&el.options?[...el.options].find(x=>x.selected):null;
    return opt?opt.value:'';
  }
  function start(){
    flushApiPanel();cancelRun();const token=++J.runId;
    J.driver=selectedValue(q('jbs-driver'))||'api';J.youId=J.driver==='web'?null:(selectedValue(q('jbs-role'))||null);
    const wid=J.driver==='web'?'':selectedValue(q('jbs-webai'));
    J.webIds=(wid&&wid!==J.youId)?[wid]:[];
    J.aiSearch=!q('jbs-ai-search')||q('jbs-ai-search').checked;
    J.players=SCRIPT.cast.map((x,i)=>Object.assign({slot:i},x));J.phase='开场';J.round=0;J.found=[];J.events=[];J.votes={};J.seq=0;J.lastAccused=null;J.lastTie=false;
    J.known={};J.runoffDone=false;J.suspicion={};J.quizScores={};
    q('jbs-log').innerHTML='';clearDynamic();q('jbs-setup').style.display='none';q('jbs-game').style.display='block';q('jbs-restart').style.visibility='visible';renderCast();
    window.WolfExitGuard?.refresh();
    if(J.youId){
      const me=J.players.find(x=>x.id===J.youId);
      setPhase('私密剧本','只有你能看到，记住后再开场',0);
      q('jbs-dynamic').innerHTML='<div class="jbs-panel"><div class="jbs-kicker">'+me.emoji+' 你扮演 · '+h(me.name)+'</div><h3>'+h(me.public)+'</h3><div class="jbs-bubble">'+h(me.secret)+'</div><div class="jbs-note" style="margin-top:10px">你的目标：'+h(me.goal)+'。这份内容不会写入公开日志，也不会发送给其他角色。</div></div>';
      J.busy=false;setControls([{label:'我已记住，开始游戏',primary:true,run:()=>phaseIntro()}]);
    }else{
      J.busy=true;phaseIntro().catch(e=>{if(aliveToken(token))fatal(e);});
    }
  }
  function providerOptions(inherit){
    return (inherit?'<option value="">继承默认渠道</option>':'')+apiProviders().map(p=>'<option value="'+h(p.id)+'">'+h(p.name)+'</option>').join('');
  }
  function setProviderSelect(el,value){
    if(!el)return;el.value=value||'';
    if(value&&el.value!==value){
      const opt=document.createElement('option');opt.value=value;opt.textContent=value;el.appendChild(opt);el.value=value;
    }
  }
  function updateApiEndpoint(){
    const el=q('jbs-api-endpoint');if(!el)return;
    const provider=selectedValue(q('jbs-api-type')),meta=apiProvider(provider);
    const api={provider:provider,type:(meta&&meta.type)||'openai',url:q('jbs-api-url').value.trim(),model:q('jbs-api-model').value.trim()};
    const ep=api.url?mysteryEndpoint(api):'';
    let warning='';
    if(api.type==='openai'&&api.url&&!/\/v\d+($|\/)/i.test(api.url)&&!/\/chat\/completions$/i.test(api.url))warning=' · 请确认地址是否需要以 /v1 结尾';
    el.textContent=ep?'实际请求：'+ep+warning:'填写地址后，这里会显示最终请求地址。';
  }
  function flushApiPanel(){
    const panel=q('jbs-api-panel');if(!panel||panel.style.display==='none')return;
    const cfg=loadMysteryApi();
    cfg.default={provider:selectedValue(q('jbs-api-type'))||'custom',url:q('jbs-api-url').value.trim(),key:q('jbs-api-key').value.trim(),model:q('jbs-api-model').value.trim()};
    q('jbs-api-cast').querySelectorAll('[data-role][data-f]').forEach(inp=>{
      const own=roleApiOverride(inp.dataset.role,true),v=String(inp.value||'').trim();
      if(v)own[inp.dataset.f]=v;else delete own[inp.dataset.f];
      if(!Object.keys(own).length)delete cfg.roles[SCRIPT.id][inp.dataset.role];
    });
    saveMysteryApi();updateApiEndpoint();renderApiStatus();
  }
  function bindApiField(el){
    if(!el)return;
    el.addEventListener('input',()=>{flushApiPanel();});
    el.addEventListener('change',()=>{
      if(el.id==='jbs-api-type'){
        const meta=apiProvider(el.value),url=q('jbs-api-url');
        const known=apiProviders().some(x=>x.url&&x.url.replace(/\/+$/,'')===url.value.trim().replace(/\/+$/,''));
        if(meta&&meta.url&&(!url.value.trim()||known))url.value=meta.url;
      }
      flushApiPanel();
    });
  }
  // 剧本杀有自己的一套默认 API；单角色覆盖按「剧本 id + 角色 id」保存。
  // 不再写 playerConfigs[P1/P2]，所以换本和返回狼人杀都不会串配置。
  function renderApiPanel(){
    const panel=q('jbs-api-panel'); if(!panel) return;
    const web=selectedValue(q('jbs-driver'))==='web';
    // 全员网页端接力时一个 API 请求都不会发，面板整个收起来
    panel.style.display=web?'none':'';
    if(web) return;
    const cfg=loadMysteryApi(),base=cfg.default||{};
    q('jbs-api-type').innerHTML=providerOptions(false);setProviderSelect(q('jbs-api-type'),base.provider||inferMysteryProvider(base.url));
    q('jbs-api-url').value=base.url||'';q('jbs-api-key').value=base.key||'';q('jbs-api-model').value=base.model||'';
    const mine=selectedValue(q('jbs-role')), relay=selectedValue(q('jbs-webai'));
    q('jbs-api-cast').innerHTML=SCRIPT.cast.map((x,i)=>{
      const c=roleApiOverride(x.id,false);
      const tagArr=[];
      if(x.id===mine) tagArr.push('你扮演');
      if(x.id===relay) tagArr.push('网页端AI');
      const tag=tagArr.length?'<span class="jbs-api-inherit" style="font-size:.86em">（'+tagArr.join('·')+'）</span>':'';
      const f=(k,label,ph,type)=>'<label>'+label+'<input class="jbs-input" data-role="'+h(x.id)+'" data-f="'+k+'"'
        +(type?' type="'+type+'"':'')+' placeholder="'+ph+'" value="'+h(c[k]||'')+'"></label>';
      return '<details class="jbs-api-item"><summary><span class="jbs-api-slot">P'+(i+1)+'</span><b>'+h(x.name)+'</b>'+tag
        +'<span class="jbs-api-sum" data-sum="'+h(x.id)+'">'+h(slotSummary(x.id))+'</span></summary>'
        +'<div class="jbs-api-fields"><label>渠道／格式<select class="jbs-input" data-role="'+h(x.id)+'" data-f="provider">'+providerOptions(true)+'</select></label>'
        +f('url','地址','继承默认')+f('key','密钥','继承默认','password')+f('model','模型','继承默认')
        +'<div class="jbs-api-row-actions"><button type="button" class="jbs-btn" data-test-role="'+h(x.id)+'">测试此角色</button>'
        +'<button type="button" class="jbs-btn ghost" data-clear-role="'+h(x.id)+'">清除单独配置</button></div></div></details>';
    }).join('');
    SCRIPT.cast.forEach(x=>setProviderSelect(q('jbs-api-cast').querySelector('select[data-role="'+x.id+'"]'),roleApiOverride(x.id,false).provider||''));
    q('jbs-api-cast').querySelectorAll('[data-role][data-f]').forEach(inp=>{
      const refresh=()=>{
        if(inp.dataset.f==='provider'&&inp.value){
          const meta=apiProvider(inp.value),url=q('jbs-api-cast').querySelector('input[data-role="'+inp.dataset.role+'"][data-f="url"]');
          if(meta&&meta.url&&url&&!url.value.trim())url.value=meta.url;
        }
        flushApiPanel();const sum=q('jbs-api-cast').querySelector('[data-sum="'+inp.dataset.role+'"]');if(sum)sum.textContent=slotSummary(inp.dataset.role);
      };
      inp.oninput=refresh;inp.onchange=refresh;
    });
    q('jbs-api-cast').querySelectorAll('[data-test-role]').forEach(btn=>btn.onclick=e=>{e.preventDefault();testRoleApi(btn.dataset.testRole);});
    q('jbs-api-cast').querySelectorAll('[data-clear-role]').forEach(btn=>btn.onclick=e=>{
      e.preventDefault();const cfg=loadMysteryApi();if(cfg.roles[SCRIPT.id])delete cfg.roles[SCRIPT.id][btn.dataset.clearRole];saveMysteryApi();renderApiPanel();
    });
    updateApiEndpoint();renderApiStatus();
  }
  // 收起状态下用一行字说明这个角色到底覆盖了什么，免得要逐个展开才知道
  function slotSummary(roleId){
    const c=roleApiOverride(roleId,false);
    const parts=[];
    if(c.model) parts.push(c.model);
    if(c.provider) parts.push((apiProvider(c.provider)||{}).name||c.provider);
    if(c.url) parts.push('独立地址');
    if(c.key) parts.push('独立密钥');
    return parts.length?parts.join(' · '):'继承默认';
  }
  function renderApiStatus(){
    const el=q('jbs-api-status'); if(!el) return;
    const cfg=loadMysteryApi(),base=cfg.default||{},gm=base.model||'(未填)';
    // 只统计这一局真会用到 API 的角色：我自己演的和走网页端接力的都不算
    const mine=selectedValue(q('jbs-role')), relay=selectedValue(q('jbs-webai'));
    const needApi=SCRIPT.cast.filter(x=>x.id!==mine&&x.id!==relay);
    const perSlot=needApi.filter(x=>roleApiOverride(x.id,false).model).length;
    const invalid=needApi.filter(x=>{const a=resolveMysteryApi(x);return !a.url||!a.model||(!a.key&&mysteryApiNeedsKey(a));});
    const miss=invalid.length;
    el.innerHTML = miss
      ? '⚠️ 还有 '+miss+' 个角色缺少地址、模型或必要的密钥：'+invalid.map(x=>h(x.name)).join('、')+'。'
      : (needApi.length
          ? '本局有 '+needApi.length+' 个角色走 API，默认模型 <b>'+h(gm)+'</b>'+(perSlot?'，其中 '+perSlot+' 个用了单独模型。':'。')+' 配置已独立保存在本机。'
          : '本局没有角色走 API。');
  }
  async function runApiTest(api,label,button){
    const out=q('jbs-api-test-result'),btn=q('jbs-api-test');
    out.style.display='block';out.textContent='正在测试 '+label+' · '+(api.model||'（未填模型）')+'…';btn.disabled=true;if(button)button.disabled=true;
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),45000),started=Date.now();
    try{
      const raw=await requestMysteryApi(api,'你是 API 连通性测试助手。','只回复：连接成功',ctrl.signal,64);
      out.textContent=label+' 连接成功 · '+((Date.now()-started)/1000).toFixed(1)+' 秒\n回复：'+String(raw).replace(/<[^>]+>/g,'').trim().slice(0,120);
    }catch(e){
      out.textContent='连接失败：'+(e&&e.name==='AbortError'?'45 秒内没有响应':(e.message||e));
    }finally{clearTimeout(timer);btn.disabled=false;if(button)button.disabled=false;}
  }
  async function testDefaultApi(){
    flushApiPanel();const base=loadMysteryApi().default||{},meta=apiProvider(base.provider);
    return runApiTest(Object.assign({},base,{type:(meta&&meta.type)||'openai'}),'默认 API',q('jbs-api-test'));
  }
  async function testRoleApi(roleId){
    flushApiPanel();const pl=SCRIPT.cast.find(x=>x.id===roleId);if(!pl)return;
    const btn=q('jbs-api-cast').querySelector('[data-test-role="'+roleId+'"]');
    return runApiTest(resolveMysteryApi(pl),pl.name,btn);
  }
  function importMainApi(){
    const cfg=loadMysteryApi();cfg.default=readMainApi();saveMysteryApi();renderApiPanel();
    const out=q('jbs-api-test-result');out.style.display='block';out.textContent='已复制狼人杀主 API 设置。之后在这里修改不会影响狼人杀。';
  }
  function toggleApiKeys(){
    const keys=[q('jbs-api-key')].concat([...q('jbs-api-cast').querySelectorAll('input[data-f="key"]')]);
    const show=keys.some(x=>x&&x.type==='password');keys.forEach(x=>{if(x)x.type=show?'text':'password';});
    q('jbs-api-toggle-key').textContent=show?'隐藏密钥':'显示密钥';
  }
  function syncDriver(){
    const web=selectedValue(q('jbs-driver'))==='web';
    q('jbs-role').disabled=web;q('jbs-web-warning').style.display=web?'block':'none';
    if(web&&q('jbs-role').options[0])q('jbs-role').options[0].selected=true;
    // 全员网页端时这个下拉没意义；否则把「我自己扮演的那个」从候选里排掉，
    // 免得选出「我和网页端AI同时演一个人」这种状态。
    const sel=q('jbs-webai'); if(!sel) return;
    sel.disabled=web;
    const mine=web?'':selectedValue(q('jbs-role'));
    const keep=selectedValue(sel);
    sel.innerHTML='<option value="">无（其余角色都走 API）</option>'
      +SCRIPT.cast.filter(x=>x.id!==mine).map(x=>'<option value="'+x.id+'">'+x.emoji+' '+h(x.name)+'（'+h(x.public)+'）</option>').join('');
    if(keep&&keep!==mine&&[...sel.options].some(o=>o.value===keep)) sel.value=keep;
    const on=!web&&!!selectedValue(sel);
    q('jbs-webai-note').style.display=on?'block':'none';
    renderApiPanel();
  }
  // 换本时角色选择器要整个重建。推荐扮演的是剧本里第一个 role==='good' 的角色
  //（清白、没有涉案秘密的那个），而不是像原来那样把「江户川柯南」写死在这里。
  function renderScriptPicker(){
    q('jbs-scripts').innerHTML=SCRIPTS.map(s=>
      '<button type="button" class="jbs-script'+(s.id===SCRIPT.id?' sel':'')+'" data-script="'+s.id+'">'
      +'<b>'+h(s.title)+'</b><small>'+h(s.tagline)+'</small><small style="margin-top:4px;opacity:.55">'+h(s.badge)+'</small></button>').join('');
    q('jbs-scripts').querySelectorAll('[data-script]').forEach(b=>b.onclick=()=>{
      const s=SCRIPTS.find(x=>x.id===b.dataset.script);
      if(!s)return;SCRIPT=s;renderScriptPicker();
    });
    q('jbs-script-intro').innerHTML='<p style="color:#a9a1b8;line-height:1.75;margin:0">'+h(SCRIPT.intro)+'</p>';
    const host=SCRIPT.cast.find(x=>x.role==='good')||SCRIPT.cast[0];
    q('jbs-role').innerHTML='<option value="'+host.id+'">'+host.emoji+' 我来扮演：'+h(host.name)+'（推荐）</option>'
      +'<option value="">🍿 纯观战（全部角色由AI扮演）</option>'
      +SCRIPT.cast.filter(x=>x.id!==host.id).map(x=>'<option value="'+x.id+'">'+x.emoji+' '+h(x.name)+'（'+h(x.public)+'）</option>').join('');
    syncDriver();
  }
  function init(){
    if(J.inited)return;J.inited=true;
    renderScriptPicker();
    q('jbs-driver').onchange=syncDriver;q('jbs-role').onchange=syncDriver;q('jbs-webai').onchange=syncDriver;q('jbs-start').onclick=start;
    ['jbs-api-type','jbs-api-url','jbs-api-key','jbs-api-model'].forEach(id=>bindApiField(q(id)));
    q('jbs-api-test').onclick=testDefaultApi;q('jbs-api-import').onclick=importMainApi;q('jbs-api-toggle-key').onclick=toggleApiKeys;
    q('jbs-back').onclick=close;q('jbs-restart').onclick=showSetup;
    q('jbs-web-copy').onclick=async()=>{try{await navigator.clipboard.writeText(q('jbs-web-prompt').value);q('jbs-web-copy').textContent='✅ 已复制';setTimeout(()=>q('jbs-web-copy').textContent='📋 复制提示词',1500);}catch(e){q('jbs-web-prompt').select();}};
    q('jbs-web-submit').onclick=()=>{const raw=q('jbs-web-reply').value.trim();if(!raw)return;if(J.webResolve)J.webResolve(raw);};
    q('jbs-web-cancel').onclick=()=>{if(J.webReject)J.webReject();};
    syncDriver();
  }
  function open(){
    init();q('mm').style.display='none';q('jbs-view').classList.add('on');q('jbs-view').setAttribute('aria-hidden','false');showSetup();
  }
  function close(){
    cancelRun();closeWebOverlay();q('jbs-view').classList.remove('on');q('jbs-view').setAttribute('aria-hidden','true');q('mm').style.display='';
  }
  // 剧本杀与谁是卧底都需要同一套多渠道请求协议，但配置必须各自独立。
  // 这里只共享无状态的「渠道元数据 / 路径拼接 / 发请求」能力，不共享密钥或 localStorage。
  if(typeof window!=='undefined')window.AuxGameAPI={
    providers:apiProviders,
    provider:apiProvider,
    inferProvider:inferMysteryProvider,
    endpoint:mysteryEndpoint,
    needsKey:mysteryApiNeedsKey,
    request:requestMysteryApi
  };
  window.WolfExitGuard?.register('murder-mystery',{
    label:document.documentElement.lang==='en'?'Murder mystery':'剧本杀',
    isActive:()=>q('jbs-view')?.classList.contains('on') && J.phase!=='setup' && J.players.length>0,
    onExit:cancelRun
  });
  return {open:open,close:close,parseReply:parseReply,_state:J};
})();
function openMurderMystery(){ MurderMystery.open(); }
