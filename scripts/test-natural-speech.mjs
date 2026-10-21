// 🗣️ 说人话：提示词层面的三处体验修复必须同时落在中英两页。
//   ① 世界书内部术语（账本/标尺/排他性…）只许用来思考，不许进公开发言；
//   ② 密谈/技能格式块的说明文字不能写在 <game> 标签里面（曾被模型当台词原样念出来）；
//   ③ 不再用"不得少于80字""纯附和=负分""刷存在感""完整度·最高优先级"逼模型硬凑发言。
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  // ① 说人话块
  assert.ok(html.includes('【说人话·上面的规则只管你怎么想，不管你怎么说】'), `${file}: 缺少说人话块`);
  assert.ok(html.includes('不说"自报平民没有排他性"'), `${file}: 说人话块缺少对照例子`);
  assert.ok(html.includes('可以说"我今天没看出谁有问题，先听听"'), `${file}: 必须允许"没看出问题"这种结论`);
  // ② 标签里不许放长说明：<game>…</game> 里超过 8 个字的占位文字只允许白名单里这几种
  const allowed = /^(spoken in-game statement|当面说出来的发言|对队友简短说明你的方案（一两句话）|简短说你投谁、为什么|临终警徽决定与基于当时信息的理由|我最终选XXX，并说明关键收益|简短说明最终选择|（此阶段无需公开发言）|最终陈词，直接开口)$/;
  const long = [...html.matchAll(/<game>([^<\n]{8,})<\/game>/g)].map(m => m[1]).filter(t => !/[$']/.test(t) && !allowed.test(t));
  assert.deepEqual(long, [], `${file}: <game> 标签里不要放说明文字（会被当台词念出来）：${long.join(' | ')}`);
  for (const bad of ['对队友说的话（口语化', '对队友说的话(口语化', '你的回应(口语化', '宣布你的决定（开枪说明', '发言（咬人 = 戏剧性宣告']) {
    assert.ok(!html.includes(bad), `${file}: 旧的标签内说明仍在：${bad}`);
  }
  assert.ok(html.includes('标签里只放内容本身，不要把上面这些说明文字抄进标签'), `${file}: 密谈格式块缺少"只放内容"的提醒`);
  // ③ 不再硬凑
  for (const bad of ['不得少于80字', '纯附和=负分', '刷存在感', '公开发言完整度·最高优先级', '宁可多说也不要敷衍']) {
    assert.ok(!html.includes(bad), `${file}: 仍在逼模型硬凑发言：${bad}`);
  }
  assert.ok(html.includes('没有成立的狼点就直说"暂时没看出问题"，不要硬凑一个人来怀疑'), `${file}: 白天发言任务缺少"不要硬凑"`);
  assert.ok(html.includes('【尽量有自己的判断,但别硬凑】'), `${file}: 村民指南没有改成"别硬凑"`);
}
console.log('natural-speech: jargon ban, tag placeholders and no-padding rules present on both pages');

// ④ 过短发言的自动扩写：门槛降到 50 字、目标 80-200 字，且明确不许凑字数
for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('Number(opts.minSpeechChars) || 50)'), `${file}: 短发言门槛应为 50 字`);
  assert.ok(html.includes('80至200字就够') && html.includes('不要为了凑字数复述别人的发言'), `${file}: 扩写提示仍在逼模型凑字数`);
  assert.ok(!html.includes('重新写成120至300字'), `${file}: 旧的 120-300 字扩写目标仍在`);
}
console.log('natural-speech: short-speech expansion floor lowered and padding forbidden');

// ⑤ 魔术师相关的狼队提示词不再用"名义刀口 / 落点"这种自造术语（模型会原样照说）
for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  for (const bad of ['可讨论名义刀口', '说清名义刀口', '名义刀其中一人', '反算名义刀口', '最终名义刀口', '两种可能落点', '重定向当晚狼刀的落点', '双向落点博弈', '名义刀队友']) {
    assert.ok(!html.includes(bad), `${file}: 狼队提示词仍在用自造术语：${bad}`);
  }
  assert.ok(html.includes('名义刀口、落点"这些是规则书里帮你思考的词'), `${file}: 说人话块没把名义刀口/落点列进去`);
  assert.ok(html.includes('不说"名义刀口""落点"，说"今晚刀谁""最后死的是谁"'), `${file}: 说人话块缺少密谈的对照例子`);
}
console.log('natural-speech: magician wolf-chat wording uses plain language');

// ⑥ 规则层：口误/算错数不进嫌疑账、好核对≠重要、单轮发言不合唱、预言家验人优先级
for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('别人算错了数，一句纠正就过'), `${file}: C 级证据没写"算错数当场纠正即可"`);
  assert.ok(html.includes('不算"说出了不该知道的信息"'), `${file}: 狼数估算仍可能被当成私密信息`);
  assert.ok(html.includes('好核对不等于重要'), `${file}: 缺少"好核对≠重要"`);
  assert.ok(html.includes('一句"同意谁，理由同他"带过'), `${file}: 单轮发言任务仍会逼出合唱`);
  assert.ok(html.includes('先验没验过、且票型或获利链指向的位置') && html.includes('别把查验花在对方讨着要验的位置上'), `${file}: 预言家指南缺少验人优先级`);
}
console.log('natural-speech: evidence-level, anti-chorus and seer-priority rules present');

// ⑦ 口气与身份：结论先说、理由一条；没事别报身份、全桌一个词、不半跳；密谈不抬杠；独狼不写计划书；平民可挡刀
for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('【口气·结论先说，理由只给最硬的一条】'), `${file}: 缺少口气块`);
  assert.ok(html.includes('【身份·没事别报，要提就全桌一个词】') && html.includes('要么跳全，要么藏全'), `${file}: 缺少身份块`);
  assert.ok(!html.includes('推谁出局、保谁、跳不跳身份、要谁回答什么'), `${file}: 白天任务仍在催"跳不跳身份"`);
  assert.ok(html.includes('给一条最硬的依据就够，别把想到的理由全摆出来'), `${file}: 表达底线仍要求堆依据`);
  assert.ok(html.includes('同意就一句同意，不用把队友的理由再讲一遍') && !html.includes('装作一致会让这一轮被直接跳过'), `${file}: 密谈仍在逼狼人制造分歧`);
  assert.ok(html.includes('队友都不在了，这是你自己的盘算'), `${file}: 独狼密谈没有专门的任务说明`);
  assert.ok(html.includes('但【挡刀】是另一回事'), `${file}: 村民指南没有把挡刀写成选项`);
}
console.log('natural-speech: voice, identity, wolf-chat and decoy rules present');

// ⑧ 事实不说教：狼队夜里选刀口时，本局硬规则（竞选时序 / 隐死亡 / 守墓人只看放逐 / 女巫 / 魔术师）合成一份、密约和每晚密谈共用；"非常规"标签去掉
for (const file of ['index.html', 'en/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.includes('function buildWolfNightRuleFacts()'), `${file}: 缺少共享的狼队夜间规则事实`);
  assert.ok(html.includes("if (_has('gravekeeper')) {") && html.includes('夜里死的人，不管怎么死的，他都看不到'), `${file}: 规则事实里没有守墓人只看放逐`);
  assert.ok(html.includes('${buildWolfChoiceHint()}${buildWolfNightRuleFacts().zh}'), `${file}: 每晚密谈开场没带规则事实`);
  assert.ok(html.includes('const pactRuleFacts = buildWolfNightRuleFacts();'), `${file}: 狼盟密约没有复用同一份事实`);
  for (const bad of ['从非常规的刀法出发', '从非常规的身份安排出发', '若有一条非常规线', '最强的一条非常规线']) assert.ok(!html.includes(bad), `${file}: 仍在用"非常规"给打法贴标签：${bad}`);
}
console.log('natural-speech: wolf-night rule facts shared and unlabelled');
