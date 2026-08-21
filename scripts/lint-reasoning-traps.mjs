#!/usr/bin/env node
/*
 * 推理反模式扫描器 —— 防止 "挡刀/假身份/对跳 ⇒ 直接判狼 / 必须出他" 这类
 * 硬编码规则再混进角色 guide 或世界书。
 *
 * 背景：狼人杀里一个好人假跳身份来挡刀(替真神吸引狼刀)是正当策略。但历史上
 * 守卫 guide 里写死过 "记录不一致→他铁定是狼→你必须立刻对跳" 这种绝对句，
 * 导致 AI 把挡刀好人当狼投出。这类句子每加一个新角色都可能再引入，靠人眼扫
 * 几万字 guide 不现实，所以固化成一个可复跑的检查。
 *
 * 用法：  node scripts/lint-reasoning-traps.mjs
 * 退出码：0 = 干净；1 = 发现可疑句(需人工确认)。可挂进 CI / 加角色后手动跑。
 *
 * 判据：一句话同时命中【诱因:挡刀/假跳/对跳/身份声明为假】和
 *       【错误结论:是狼 / 必须出他】，且不含【反转/否定 或 已知安全语境】。
 */
import fs from 'fs';
import path from 'path';

const file = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'index.html');
const src = fs.readFileSync(file, 'utf8');

const CAUSE = /(挡刀|假跳|悍跳|跳神|跳了神|穿.{0,6}衣服|穿神衣|冒充|身份.{0,3}假|声明.{0,3}假|记录不一致|对跳|抢.{0,4}身份|假身份|证伪.{0,3}身份)/;
const WOLF  = /(就是狼|是狼人|铁狼|铁定.{0,3}狼|一定.{0,3}狼|必然.{0,3}狼|必是狼|狼无疑|定他.{0,2}狼)/;
const EXEC  = /(必须对跳|必须立刻对跳|必须出|必须投|必须推|出掉他|投他|推他|把他出|该出他|处理他)/;

// 反转/否定 —— 正确的反例教学，安全
const NEGATE = /(不等于|不能|不是狼|不必|不该|未必|别当|先别|≠|非法|只证明|不代表|不一定|不能推|不能直接|不构成|不自动|而非|不要把|要盘|都要盘|先评估|先追问|可能是好人|也可能|好人.{0,4}挡刀|好人也|战略性撒谎)/;
// 已知安全语境：狼视角自保(好人会反推…)、元陈述(覆盖旧说明/绝对句)、狼自曝、代码/注释
const CONTEXT_SAFE = /(反推|好人会|好人立刻|覆盖|旧说明|绝对句|我是狼人阵营|来悍跳|LABEL_WORDS|定性词|const |=>\s|=\s*\[)/;

const hits = [];
src.split(/[。！!？?\n；;]/).forEach(s => {
  const t = s.trim();
  if (t.length < 6) return;
  if (!CAUSE.test(t)) return;
  if (!WOLF.test(t) && !EXEC.test(t)) return;
  if (NEGATE.test(t) || CONTEXT_SAFE.test(t)) return;
  hits.push(t.slice(0, 180));
});

if (!hits.length) {
  console.log('✅ 未发现「挡刀/假身份/对跳 ⇒ 判狼 / 必须出他」的硬编码反模式');
  process.exit(0);
} else {
  console.log(`⚠️ 发现 ${hits.length} 条可疑句 —— 请确认是否把"假身份/挡刀"直接判成了狼：\n`);
  hits.forEach((h, i) => console.log(`[${i + 1}] ${h}\n`));
  console.log('若确属反模式，改成"假声明只证伪身份、不等于是狼"；若是误报，把其语境词加进 CONTEXT_SAFE。');
  process.exit(1);
}
