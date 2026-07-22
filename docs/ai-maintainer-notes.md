# 给后续维护 AI 的须知（改这个项目前务必先读）

本项目是一个 AI 狼人杀（单文件 `index.html`，约 2 万行，85% 是内联 JS，游戏逻辑**无构建步骤**）。
下面这些坑是实战中反复踩到的，**改动前对照检查，能避开一大半返工**。按"最常犯"排序。

---

## 1. 从 AI 回复里解析"选项/布尔"时，只认 `action` 字段，别碰 `thinking`

**最高频的一类 bug。** AI 的回复分 `<thinking>`（内心独白）和 `<action>`（最终决定）两段。

- ❌ 错误写法：`const raw = (r.action||'') + ' ' + (r.thinking||'')` 再去正则匹配。
  - 因为 thinking 里会把**所有选项都讨论一遍**（"到底选毒还是盾…"），正则会把讨论到的词误当成决定。
  - 真实事故：愚者 action 明明填了「盾」，但 thinking 提过「毒」，结果被判成毒药。
- ✅ 正确写法：**权威字段是 `action`**，action 为空才回退 thinking：
  ```js
  const act = (r.action||'').trim();
  const raw = act || (r.thinking||'');
  ```
- ⚠️ 区分：**提取"玩家名"是安全的**（名字是唯一锚点，thinking 里出现队友名不影响），可以 action+thinking 一起找。
  **提取"枚举/布尔"（毒/盾/查验、SAVE/NO、YES/NO、方向、救不救）必须只从 action 取。**
- 布尔还要防"否定词被正向词命中"：`/救/` 会命中「不救」，所以要 `/救/.test(x) && !/不救|no|别救|放弃/i.test(x)`。

已审计过的点：`pickGift`、女巫救药方向、狼妃/愚者/积木各块。新增角色照此办理。

---

## 2. 新增角色 = 必须接进"所有"导出/渲染链路，否则它在战报里隐形

夜间行动写进 `gameRecord`（`{type:'night_action', role, target, ...}`）只是第一步。
有 **6+ 处**各自 `switch(role)` 的渲染点，都是硬编码只认内置角色，新角色不接就被静默丢弃：

| 渲染点 | 作用 |
|---|---|
| `_buildChatSummary` | 聊天摘要（上帝视角 + 个人视角） |
| `openExport` | 完整上帝视角记录导出 |
| `_buildGodViewReport` | MVP 评选用的上帝战报 |
| `generateReplay` | 复盘 HTML |
| `_buildPrivateInfoLines` | **「你的私密信息」块**（见第 5 条，最容易漏） |
| `buildSystemPrompt` / `buildWebPrompt` | 玩家/网页AI 的 prompt |

现在自创角色统一走 `_formatCustomNightAction(r)`（一处格式化、多处兜底调用）。
**新增角色时：要么让事件 role 命中它、要么在该函数里加分支，然后确认上面每一处都能显示。**

---

## 3. 没写进 `gameRecord` 的行动 = 永远无法出现在任何导出/复盘

`gameRecord` 是唯一权威事件流。曾经积木自创角色的守护/毒/解药/封技等只做了 `Render.log`（只刷屏），
**没 push `night_action`**，导致这些角色除了查验什么都不留档。
**任何希望在战报/复盘/摘要里出现的行动，都必须 push 一条 `gameRecord`。** Render.log 只是当场刷屏，不入档。

---

## 4. 夜间私密信息的"视角隔离"是硬规则

夜间行动（谁查了谁、谁有盾、谁锁了谁、查验结果）**只能给两种视角看**：
1. **上帝视角**（`isGod`，导出/复盘/MVP）；
2. **行动者本人**（自视角摘要、自己的 prompt）。

**绝不能泄漏给其它玩家**（包括狼队友——狼妃的锁、女巫的毒都是本人私密）。
判定本人用 `r.role === roleId`（唯一角色）或 `_isOwnNightAction(r, viewerP)`（按 `r.name` 匹配，用于赐予/积木类）。
给事件加了 `name` 字段就是为了这个。新增角色的私密数据，务必确认非本人视角拿不到。

---

## 5. 「你的私密信息」块（`_buildPrivateInfoLines`）：AI 只信这里的结果

导出摘要里明确写着一句指示："**只有列在'你的私密信息'里的铁视角结果才可当作身份事实**"。
含义有两层：
- 新角色若不在 `_buildPrivateInfoLines` 里重建自己的行动/结果历史，切到**网页端 AI 接力**时，那个 AI 就**不知道自己每晚做了什么、验到了谁**，会当自己没技能瞎打；
- 更糟：即便结果出现在别处（如时间线），AI 也**不敢采信**，因为它被要求只信这个块。

所以：**任何有"查验/得知阵营"类结果、或有多晚行动历史的新角色，必须在 `_buildPrivateInfoLines` 里加一块**，
从 `gameRecord`（按 `r.name` 过滤本人）重建历史。查验/媚惑类结果要标注"=铁验证阵营"。

---

## 6. 技能状态标志要能存档/读档

玩家身上的瞬时技能标志（`_foolUsed`、`_shieldUsed`、`_rpUsed`、`_grant*`、`_cPoisonUsed`…）
如果不加进 `SKILL_STATE_KEYS`（`serializeSkillFlags` 用它序列化），
存档再读档后会**丢失/技能复活**（愚者存档后又多一条命之类）。
**新增任何 `_xxx` 技能标志，同步加进 `SKILL_STATE_KEYS`。**

---

## 7. 新的"查验/守护/毒"来源，要考虑会不会被蚀时狼妃反弹

蚀时狼妃锁定 X 后，凡打到 X 的查验/守护/毒都反弹到施法者自己（整晚仅一次）。
统一走两个 helper：`reflectInspectSubject(caster, t)`（查验）、`reflectEffectTarget(caster, targetId)`（守护/毒落点）。
它们共用 `S.nightData._concubineTriggered` 保证"仅一次"。
曾漏掉赐予的查验/毒、积木的守护/毒——新增此类效果时，**记得过一遍对应 helper，否则会静默绕过反弹**，与"凡查/守/毒打到 X 都反弹"的设定不一致。

---

## 8. 技能被消耗/失效，要主动告知本人

曾出现：愚者的保命被触发了，公告发给了除它以外的所有人，**愚者自己反而不知道**，
还以为有一条命。**凡是"一次性技能被用掉/失效"，都要往本人 `p.memory` push 一条系统提示。**
（守卫盾成没成可以不公布，但"技能已经没了"必须告诉本人。）

---

## 9. 死因 ≠ 身份；隐死亡模式别泄底

`_publicEventReadingNote()` 那段话是硬约束：中枪者/被咬者/自爆被带走者/殉情者，
**不因该死因就自动被认定成技能发动者，也不自动验证阵营**。隐死亡模式下夜间死因对普通玩家统一显示"夜晚死亡"。
新增死亡/技能事件，渲染时要遵守同样的视角隔离与"不自动翻身份"原则。

---

## 10. 验证方式（无模型 key，跑不了真实对局）

- **语法**：抽取所有内联 `<script>`，逐个 `node --check`（见 scratchpad/check.mjs 模式）。
- **逻辑**：把纯函数抠出来用 node 做时序模拟（反弹仅一次、退药、护盾三态、解析枚举…）。
- ⚠️ 平衡性、多角色交叉交互**必须作者用真 key 实测**，AI 只能保证逻辑自洽。

---

## 11. Git 卫生（多个 AI 并行改同一仓库！）

- **务必基于最新 `origin/main` 开分支**，push 前 `git diff origin/main --stat` 确认改动范围，
  别把别人的文件/改动覆盖回去（曾发生分支基于旧 main，一 push 就删掉别人加的文件）。
- PR **squash 合并后，分支带着未压缩的旧提交**，直接复用会 merge 冲突；
  正确做法：`git checkout -B <branch> origin/main` 再 `git cherry-pick <本次提交>`，然后 `--force-with-lease` 推。
- 提交者身份用 `noreply@anthropic.com`。
- **不要**擅自建 PR / 合并 / 触发 APK 构建，除非作者要求（本项目作者的既定流程是"合并到 main 才能测"，所以是显式授权的）。

---

## 附：关键数据流速记

- 角色注册：`reg({id,name,team,...})` → `ALL_ROLES` / `MAX_COUNT` / `ROLE_CLS`。
- 夜间编排：`PhaseHandlers.night()` 顺序调 `NightActions.xxx(alive)` → `resolveNight()` 结算。
  - 顺序有讲究：`applyCustomNightFx()` 在 `resolveNight` 最前做子狐封技/狼妃反弹预处理。
  - 蚀时狼妃第 2 顺位行动（早于守卫/女巫/查验/赐予），所以反弹能在源头命中。
- 积木自创角色：`role.customAbilities` 数组 → `NightActions.customGods()` 逐块结算。
- 事件流：`gameRecord`（权威）→ 6+ 个 builder 渲染，各自做视角隔离。
- 存档：玩家的 `_sk`（`serializeSkillFlags`）+ memory + S 层状态（witchPotions/mechLearn/charmedPlayer/nightData）。
