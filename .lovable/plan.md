
# 命运全景导览（Guided Panorama Tour）· V2 Demo

保留现有 V1 正式站与已完成的 V2 人生地图。新增“仪式完成后”的全景导览流，作为未来 V1 排盘完成的插入点。全部工作只落在 `src/experiences/library-v2/` 与配套文档，不发布、不调用真实 AI。

## 1. 五领域重排 & 中性文案

- 顺序统一为：`study → career → love → wealth → overview`。
- `StoryTopic` 扩展新增 `study`；移除 `recent` 作为领域；`recent` 语义并入每个领域的“当前周期”与 overview 的“生命时间轴”。
- 更新 `types.ts / state.ts / fixtures.ts / matching.ts` 中所有 topic 相关枚举、标签、问题、洞察、书架顺序、推荐逻辑，保持 overview 无 career 偏见。
- `DestinyMap`：五节点新序，第一个节点 = 学业与认知。文案照单填入。
- 旧 state 兼容：`recent` → 映射到 `overview`，写迁移函数于 `story/storage.ts`。

## 2. 确定性 domain-score-v1 契约

新增 `src/experiences/library-v2/panorama/domain-score.ts`（纯函数）+ 类型 `DomainScoreResult`：

```
{ domain, score:0-100, band:'high_signal'|'mid_signal'|'insufficient_facts',
  confidence:'high'|'mid'|'low'|'reference_only',
  evidence_refs:string[], system_contributions:{ system, contribution, available, reason_codes[] }[],
  timing_activation:string[], contradiction_flags:string[], missing_facts:string[],
  calculation_version:'domain-score-v1', calculated_at }
```

- 输入：`PremiumFacts`（或 v2 fixture facts）。
- 引擎：从已有确定性字段（`bazi.day_master/ten_gods`, `ziwei` 宫位星曜, `vedic.mahadasha/nakshatra`, `western` 已接入的行星与相位）派生。加权、归一化，永远 idempotent。
- 未接入的 facts（西方宫位/推运/Sookshma）→ `available:false + reason_codes`。
- Demo 提供固定 `DEMO_DOMAIN_SCORES` fixture，UI 标注“演示评分”。
- 单测：same-facts-same-score、缺失事实降 confidence、overview 不因高分自动倾向 career、五领域独立、score 边界。

推荐算法 `recommendFirstDomain(scores, mapPreviews, feedback)`：综合信号强度 + 极端值 + timing_activation + evidence_completeness + user preview。返回 `{ domain, reason_codes[], natural_language_reason }`。用户手选永远覆盖。

## 3. Skill: guided-domain-reading-v1

创建 `skills/guided-domain-reading/`：
```
SKILL.md
references/{chapter-manifest.md,evidence-contract.md,cache-policy.md}
```
- 10 段固定章节 schema（开篇 / 四体系独立观察 / 共识与分歧 / 现实表现 / 优势与资源 / 重复模式与反例 / 当前周期与时间窗口 / 保留-停止-开始 / 自我探索问题 / 方法与限制）。
- 输入/输出 JSON Schema、evidence validator（拒绝空 refs、拒绝未支持路径）、content hash = `hash(chart_id + facts_hash + domain + score + skill_version)`。
- checkpoint / 断点续跑思想复用 premium report；本轮 Demo 不接真实 provider，仅提供 typed fixture（4 份短版但结构完整）+ `deterministicDomainReadingFromFixture()`。
- 契约测试：无证据 fail、未支持字段 fail、缓存命中 provider calls = 0、同输入 idempotent。

## 4. Panorama UI

新增组件族（挂到 `PanoramaTour.tsx`）：
- `PanoramaEntry` — 标题「你的命运全景已经展开」，四节点星图（复用 DestinyMap 视觉语言，但作为只读信号图，粗细+文字标注）。
- `SignalSourceDrawer` — 点节点展开「信号从哪里来」，展示 system_contributions 与 evidence_refs（人类可读，无 hash/token）。
- `RecommendedFirstRead` — 单卡：推荐领域 + 中性理由 + 两个 CTA（`从这里开始` / `我想选择其他路径`）+ 「阅读顺序推荐，不是命运结论」标注。
- `DomainGuidedReading` — 短版首屏 + 展开完整（10 节）+ 结尾「展开我的完整全景」。
- `PanoramaFullReader` — 顶部或左侧 sticky 导航：`overview / study / career / love / wealth / timeline / history / recommendations`。桌面左 sticky，移动横向 scrollable tabs（overflow-x-auto + 自动滚到当前项，无横向 body 溢出）。滚动 spy 高亮，`prefers-reduced-motion` 遵守。
- 各章节短摘要 + 「翻开完整章节」按钮 → 跳 V1 路由（`/report`、`/ritual` 等）或 V2 shelf book，会员位复用现有 `MembershipBookPreview`（entitled 隐藏 CTA）。

## 5. 状态与流程

`StoryStateV1` 扩展：
```
domain_scores: DomainScoreResult[] | null
recommended_domain: { domain, reason_codes, reason_text } | null
selected_domain: StoryTopic | null
guided_reading_status: Record<StoryTopic,'idle'|'short'|'full'|'done'>
overview_nav_position: string | null
tour_completed_at: number | null
```

流程改造：
- `intake_place` 完成 → 进入新 step `panorama_entry`，不再直接 `first_insight`。
- 旧的 `first_insight` 内容并入 `DomainGuidedReading` 的开篇/短摘要区，避免内容重复。
- `tour_completed_at` 已存在 → 复访显示「继续上次阅读 / 重新打开全景导览」，不强制导览。
- 旧 state 缺字段：安全默认 + 迁移。

## 6. V1 集成契约

新增 `docs/PANORAMA_V1_INTEGRATION.md`：
- 触发点：仪式完成 & 四体系确定性 FACTS 已保存。
- 需要的输入：`chart_id, user_id, facts_version, PremiumFacts` — 与现有 premium report 契约字段一致。
- Adapter 接口 `buildDomainScoresFromFacts(facts): DomainScoreResult[]`（V2 实现 stub + 单测；V1 未来实现真实版本）。
- 复访行为、缓存 key、会员/auth 守卫复用、跳过条件、失败降级。
- 明确“不发送原始出生资料到社区/埋点”。

## 7. 数据 & Migration

- 缓存表放 `supabase/pending/20260721_panorama_domain_scores.sql`（不执行）：`v2_domain_scores_v1(user_id, chart_id, facts_hash, calculation_version, scores jsonb, created_at)` + RLS + GRANT。
- 领域导读缓存：追加到同 pending 文件（`v2_domain_readings_v1`）。
- Demo 仍走 fixture repository。

## 8. 验证

- 单测：`domain-score.test.ts`（8+ 用例）、`guided-domain-reading.test.ts`（契约）、`panorama-flow.test.ts`（state machine：study/overview/entitled 路径）、更新现有 story.test.ts 兼容 `study`。
- `tsgo` 全通过；`bun test` 全通过。
- Playwright（headless）：`/dev/guided-library-v2` 建档 → 全景入口 → 展开分数来源 → 接受推荐（study 分支）→ 更换为 overview → 短导读 → 完整导读 → 全景导航跳到 timeline → console error = 0。视口 1440 / 430 / 390 各截一张验证无横向溢出、无孤字、导航不遮挡。
- 更新 `docs/LIBRARY_V2_GUIDED_EXPERIENCE.md` 章节与流程图。

## 明确不做

- 不改任何 V1 路由/组件。
- 不 deploy migration、不调用真实 AI provider、不接真实支付。
- 不引入西方宫位/推运/Sookshma 等尚无 facts 的字段——相关 system_contributions 标 `available:false`。
- 不宣称成功率/正缘/婚期/彩票收益。

## 技术细节要点

- `StoryTopic` 变为 `'study'|'career'|'love'|'wealth'`；`FocusChoice = StoryTopic | 'overview'` 保持。
- 所有涉及 `recent` 的枚举、Record、fixture、matching 都要同步迁移；旧 storage 数据 auto-migrate（`recent` → `overview`）。
- Signal band 的颜色映射必须同时配文字标签（可达性）。
- 缓存 key：`fnv1a(canonicalJson({chart_id, facts_hash, skill_version, domain, score_hash, lang}))`。
- Reader UI 复用 `createPortal` + body scroll lock 模式（同 PremiumReportReader）。

---

需要你的确认后再进入实施。如果对以下任一项有偏好请指出，否则我按上面默认推进：
1. 移动端全景导航采用「顶部横向 tabs」而非底部或抽屉。
2. Domain score 的推荐算法暂不考虑用户历史点击（V2 Demo 仅 preview/feedback），V1 接入时再接入长期行为。
3. `recent` 完全从 UI 退场（不再是可选主题），旧 state 静默迁移到 `overview`。
