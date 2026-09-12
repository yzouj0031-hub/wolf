// 「启用AI主持人」必须默认关。
//
// 这不只是默认值的偏好问题，此前是个真会花钱的坑：
//   · host-enable 默认 checked，而 callHost() 只要求 api.key 存在（而且会回落到全局 key），
//     所以任何配好全局 API 的用户，每局都白多 30-50 次调用；
//   · 设置面板里那个「主持人」chip 是【另一个】开关（m-mc，默认关，只管主持人操作面板），
//     于是面板上看起来主持人是关着的，后台却在跑。两个名字相近的开关，可见的那个关着、
//     藏着的那个开着——这是最难自己发现的一类浪费。
//
// 光改默认值救不了老用户：他们的存档里早就写着 hostEnable:true，那是当初的默认值被
// saveCfg 顺手存下来的，不是他们主动选的。所以还要一次性迁移，并且说清楚。
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html', 'en/index.html']) {
  const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

  // ── 1. 默认不勾 ─────────────────────────────────────────────────────────────
  const box = src.match(/<input type="checkbox" id="host-enable"[^>]*>/);
  assert.ok(box, `${file}: 找不到「启用AI主持人」开关`);
  assert.ok(!/\bchecked\b/.test(box[0]), `${file}: 「启用AI主持人」仍然是默认勾选的 → ${box[0]}`);

  // 标签上要直接写出代价，否则用户没有依据判断该不该开
  assert.match(src, /30-50/, `${file}: 没有在开关旁写出每局多出的调用次数`);

  // ── 2. 元素缺失时的兜底也必须是关 ───────────────────────────────────────────
  // 此前是 :true —— 读不到元素就当用户开着，等于把一个花钱的功能交给了兜底值
  assert.ok(
    src.includes("hostEnable:$('host-enable')?$('host-enable').checked:false,"),
    `${file}: 读不到开关时的兜底值不是关`,
  );
  assert.ok(!src.includes("hostEnable:$('host-enable')?$('host-enable').checked:true"), `${file}: 旧的兜底值仍在`);

  // ── 3. ★ 老存档一次性迁移，而且不能静默 ──────────────────────────────────────
  assert.ok(src.includes('hostDefaultOffV2:true,'), `${file}: 存档没有写入迁移标记`);
  assert.ok(src.includes("if (d.hostDefaultOffV2 === undefined && $('host-enable')) {"), `${file}: 没有对老存档做迁移`);
  assert.ok(
    src.includes("      $('host-enable').checked = false;"),
    `${file}: 迁移时没有真的把它关掉`,
  );
  // 关掉别人已经存着的设置属于"替用户做决定"，必须当场说明，并且告诉他怎么打开
  assert.match(src, /「启用AI主持人」已默认关闭/, `${file}: 迁移是静默的，用户不会知道设置被改了`);
  assert.match(src, /重新打开，之后会一直记住/, `${file}: 没有告诉用户怎么恢复`);
  // 有标记的存档要尊重用户自己的选择，不能每次启动都强关
  assert.ok(
    src.includes("} else if (d.hostEnable!==undefined&&$('host-enable')) $('host-enable').checked=d.hostEnable;"),
    `${file}: 迁移过之后没有尊重用户后来的选择`,
  );

  // ── 4. 花钱的入口仍然被这个开关挡着 ──────────────────────────────────────────
  assert.ok(src.includes('  if (!isHostEnabled()) return null;'), `${file}: callHost 没有先检查开关`);
  assert.ok(
    src.includes("function isHostEnabled() { if (humanViewLocked()) return false; const el = $('host-enable'); return el ? el.checked : false; }"),
    `${file}: isHostEnabled 的读取方式被改动了`,
  );

  // ── 5. 不能误伤「发言分诊」——它是另一件事，而且很多人不开主持人只想要它 ────────
  const judge = src.match(/<select id="m-speech-judge"[\s\S]*?<\/select>/);
  assert.ok(judge, `${file}: 找不到发言分诊开关`);
  assert.match(judge[0], /<option value="triage" selected>/, `${file}: 发言分诊的默认档位被改动了`);
  // 判官有自己的配置，主持人关着也要能用
  assert.ok(src.includes('function getJudgeAPI() {'), `${file}: 判官仍然没有独立配置`);
  assert.ok(src.includes("model: own.model || host.model || ''"), `${file}: 判官配置没有回落链`);
}

console.log('host default off: unchecked by default, safe fallback, one-time migration announced, triage untouched');
