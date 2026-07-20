
# 学业与认知模块 · V1 综合解读 + 高级 AI 深度报告 · 落地方案

任务面较大，先在实施前明确关键决策与兼容策略，逐步分块落地，全程不发布、不真实调用 AI、不触碰已完成的 v3 旧报告。

---

## 一、关键决策（需要用户确认或默认执行）

### 决策 A · Manifest 是保 24 章还是扩为 25 章？

**推荐：保 24 章，合并 `year_ahead` + `windows` → `year_and_windows`。**
- 两章目前都在 timing 段（index 21, 22），事实白名单完全一致（`bazi_luck / ziwei_horoscope / vedic_dasha`），内容差异只在"12 个月叙事"与"关键窗口列举"，可无损合并为一章的两个 `required_sections`（`next_12_months`、`key_windows`），目标字数取并集 1400–2100。
- 相比合并 `family + health`（语义不同、非并列体系），timing 合并更"高度重合、可安全合并"。
- 若用户偏好保守，退路是提交 **25 章方案**，本方案已在代码里显式检查 `PREMIUM_V4_CHAPTERS.length` 允许 24 或 25，并在 SKILL manifest 里注明。

新 v4 章节顺序（24 章）：
```text
0  cover_letter
1  executive_summary
2  chart_map
3  academic          ← 新增 · 学业与认知
4  western_natal     ← 原 3 顺延
5  western_aspects
6  vedic_natal
7  vedic_dasha
8  bazi_pillars
9  bazi_ten_gods
10 bazi_luck
11 ziwei_palaces
12 ziwei_horoscope
13 convergence
14 tensions
15 character
16 vocation
17 wealth
18 relationships
19 family
20 health
21 mission
22 year_and_windows  ← 合并原 21 + 22
23 methodology
```

### 决策 B · 章节身份稳定化

现库层已按 `chapter_key`（string slug）存储 —— 已经是稳定 id。要做的是：
- 新增 `chapter_index` 只当作展示序号，不做主键；
- 阅读器目录按 `PREMIUM_V4_CHAPTERS.find(k => k === savedKey)?.index ?? "?"`；
- 若一份 v3 旧报告的 chapter_key 在 v4 找不到，回退到 v3 catalog（`PREMIUM_V3_CHAPTERS`）读取序号 —— 旧报告读取 100% 不变。

### 决策 C · 免责与措辞硬约束（validator 拒绝）

学业相关章节禁止出现下列 token（并对英文等价短语做正则匹配）：
- 智商 / IQ / 天才 / 蠢
- 保证考上 / 必然录取 / 一定能 / 稳过
- 具体考试分数（如 "700 分"、"985"）
- 学科断言（"你注定学不好数学"）

---

## 二、实施分块（按顺序落地，每块独立可通过测试）

### Block 1 · V4 Manifest + validator（≈150 行新代码）

- 新文件 `src/lib/premium-chapters-v4.ts`：导出 `PREMIUM_V4_CHAPTERS`、`PREMIUM_REPORT_REVISION_V4 = "premium_v4_rev_2026_07_academic"`、`PREMIUM_MANIFEST_VERSION_V4 = "2026-07"`。
- 复用 v3 的 `V3ChapterMeta` 类型（改名为 `PremiumChapterMeta`，v3 仍旧 re-export 保持向后兼容）。
- 新增章节 `academic`：`allowed_facts: ["bazi","ziwei","western","vedic"]`, `min_module_variety: 2`, `min_evidence_refs: 3`, `required_sections: 学习认知风格 / 信息处理与表达 / 学科群候选 / 感兴趣领域 / 特长与优势 / 学习阻力 / 学习环境与方法 / 当前周期与窗口`, `required_tables: [{ key: "subject_clusters", title_zh: "学科群候选对照表" }]`。
- 合并章节 `year_and_windows`：`required_sections: [{ key: "next_12_months", ... }, { key: "key_windows", ... }]`, `min_evidence_refs: 2`。
- Manifest 选择器：`src/lib/premium-manifest.ts` 根据 `revision` 返回 v3 或 v4 catalog；调用点（`chapter-worker`, `chapter-json-schema.ts` 的 `metaForChapter`, reader）走该选择器。
- Validator 增强：注入学业禁词正则；无 evidence 的断言（"你更擅长 X" 后紧跟句号无路径）扫描并降级为 issue。

### Block 2 · Study skill（版本化契约）

- 新目录 `skills/fate-nexus-study-reading/`（与 `fate-nexus-premium-report` 平级）：
  - `SKILL.md`：id=`fate-nexus-study-reading`, version=`1.0.0`, manifest=`2026-07`。
  - `references/study-schema.md`：输入 / 输出结构、`SubjectClusterCandidate = { cluster_id, suitability: "high"|"medium"|"exploratory", why, evidence_refs[], confidence, conditions, how_to_validate }`，至少 3 项，禁用词表。
  - `references/age-adaptation.md`：三个年龄档 fixture（18 岁前、大学阶段、成年转型）措辞规则。
  - `references/evidence-boundaries.md`：明确禁用 western house cusps / MC / 推运 / 行运；紫微必须跨宫上下文；八字禁"缺什么补什么"。
- Fixture 在 `src/experiences/library-v2/panorama/fixtures.ts` 内的 `study` 领域升级为 skill schema 兼容形态；新增 `src/lib/study-fixtures.ts` 提供 3 个年龄段样本。
- Contract test `src/lib/skill-fate-nexus-study-reading.test.ts`：`SKILL.md` frontmatter、fixture 至少 3 学科群、禁用词全部命中拒绝、无 evidence 的关键结论被 validator 报 issue。

### Block 3 · Premium report 章节生成通道复用

- 现有 `chapter-worker.ts` / `processNextPremiumChapter` 已按 `chapter_key` 逐章 checkpoint —— 直接支持插入新 slug，无结构改动。
- 在 revision=v4 场景，`chooseDeterministicRefs` / prompt 拼装读取新 manifest。
- Prompt 拼装（`src/lib/chapter-worker.ts` 的 `buildChapterPrompt` 或对应函数）在 `academic` 分支注入：学业结构说明 + 年龄档判定（birth_year 对齐当年）+ 禁用词提示。
- 缓存 key：`{chart_id, canonical_input_hash, PREMIUM_REPORT_REVISION_V4}` —— 与 v3 天然隔离，v3 completed 行 100% 不动。

### Block 4 · V1 综合解读页 `report.tsx` 新增第 03 板块

- 现 `report.tsx` 是模板化叙事（不是从数据库读的动态章节），面板顺序在 hardcoded array 中。
- 在 `character`（性格底色）之后、`vocation`（事业）之前插入 `academic` 面板：
  - 标题：`学业与认知 / Academic & Cognition`
  - 小节 1–8 严格对应用户列表；免费版：认知关键词 3 个 + 学科群候选 3 个 + 1 条现实验证提示；折叠区展开完整四体系证据。
  - 复用现有 `<section>` + `.max-w-5xl` 卡片模版，桌面/移动断点、字体、间距 100% 与其他板块一致；不新造样式。
  - 目录 / anchor 导航新增 `#academic`，`SectionNav` 的 hardcoded 数组顺延。
  - 年龄适配：从 `search.date` 派生年龄，>=25 岁切"继续教育/职业学习/知识迁移"文案。
- 会员守卫：现 `report.tsx` 是免费页，学业板块也免费展示摘要；深度部分入口指向 `/report` → 高级卡片购买路径（与其他板块相同 CTA）。

### Block 5 · Reader UI（`PremiumReportReader`）

- 章节目录按 manifest 选择器动态渲染 —— 已经动态化，只要新增 slug 自动出现。
- 桌面 1320px + 侧栏 280px、移动全屏抽屉均验证。
- 首屏对 `academic` 章节额外渲染"认知关键词 chips + 3 学科群 pill + 现实验证提示"summary head，然后正常渲染 `body`。

### Block 6 · V2 全景全景阅读的"学业"入口

- `src/experiences/library-v2/panorama/fixtures.ts`：`study` 领域按新 skill schema 提供，`GuidedDomainReadingView` 展示时使用相同分节。
- Demo 环境下"深读全文"按钮 CTA 变为跳转 `/report#academic`（Fixture 场景不再全部内联，指向真实 V1 板块），Demo 明确标注"演示身份"。

### Block 7 · 测试与验收

- 新增测试：
  - `premium-chapters-v4.test.ts`：24 章、`academic` 在 index 3、slug 唯一、字数合、旧 v3 catalog 未变。
  - `premium-manifest-selector.test.ts`：给定 revision v3 返回 v3，v4 返回 v4；未知 revision 回退 v3（读旧报告不炸）。
  - `study-reading-validator.test.ts`：禁用词命中、单体系包装成跨体系被拒、无 evidence 关键结论被拒、3 学科群下限。
  - `report-page-anchor.test.ts`（可选）：`report.tsx` DOM 序 character → academic → vocation。
- 全量：`bun test`、`tsgo`。
- Playwright 验收：`/report?...` 与 `/dev/reader-harness`（或高级卡片走假支付） 三视口 1440/430/390 无溢出、目录含"03 学业与认知"、旧 v3 fixture 报告目录仍是 v3 结构。
- 明确未验证项：不真实调用 AI，因此新 revision v4 的 chapter-worker 实跑用 deterministic provider harness，不动线上订单。

---

## 三、技术细节 · 兼容不变式

- `PREMIUM_V3_CHAPTERS` 常量不删、不改字段、不删除 `PREMIUM_REPORT_REVISION`；仅新增 v4 常量。
- `getPremiumReport` 读逻辑：按报告行的 `revision` 字段选 manifest，未知 revision 回落 v3。
- `input_hash` 组成：`buildCanonicalChartInput` 里追加 `revision`（已经在链路上），因此同一 chart 会生成两条独立行 —— 旧行不动、新购从零起。
- 已购订单：`premium_report_orders` 表按 chart_id 绑定，购买后允许 report_id 迁移到 v4 新行（沿用现有 self-heal 逻辑），不重复扣费。
- `academic` 章节的 evidence 白名单允许四体系，但 validator 硬要求至少两个体系（`min_module_variety=2`）。

---

## 四、交付清单（完成后回复内容）

1. Manifest 版本：`premium_v4_rev_2026_07_academic` / `2026-07`。
2. 合并策略：`year_ahead` + `windows` → `year_and_windows`（timing 段无损合并，理由 + 章节字数并集）。
3. Skill：`fate-nexus-study-reading@1.0.0`。
4. V1 位置：`src/routes/report.tsx` 第 03 板块。
5. 旧报告兼容：v3 catalog + revision selector，旧行不重生成、目录序不错位。
6. 测试结果：新增用例数、全量通过数、`tsgo` 结果、Playwright 三视口截图。
7. Commit：`report+study: v4 manifest w/ academic ch03 + v1 synthesis board + skill contract`.
8. 预览：`/report?...` + `/dev/reader-harness`（fixture 报告演示学业章节）。

---

## 五、需要用户在开工前确认（可默认全 yes 继续）

- **A** 合并方案：接受 timing 合并（默认 yes），否则回复"保 25 章"。
- **B** 是否为 v3 已购老用户提供"升级到 v4"入口？默认**否** —— 老用户看老版本，避免破坏已购内容契约；新购走 v4。
- **C** V1 综合解读页学业板块是否需要"擅长学科"雷达图 / 图表？默认**否**，只出 pill + 文本，与其他板块视觉一致。

如无异议请回复"照此执行"或直接说"继续"，我按此分块按顺序落地。
