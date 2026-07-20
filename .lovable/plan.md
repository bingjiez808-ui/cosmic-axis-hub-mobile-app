
# 命运图书馆 V2 · 完整可点击 Demo 实施计划

范围很大，先给出结构化实施蓝图。批准后一次性交付；未批准前不动代码。

## 交付边界
- 全部代码在 `src/experiences/library-v2/`（V1 一行不改）。
- 预览入口沿用现有 `/dev/guided-library-v2`（保留 preview-guard + noindex + 不入 sitemap）。
- 不发布，不接真实 AI/支付；Demo 数据用 typed fixture + local repository。
- 数据库 migration 文件写入 `supabase/pending/` 但**不自动执行**（Demo 通过 fixture repository fallback 运行；这样满足"当前环境不能安全执行 migration 时的双通道"要求）。类型/服务层完整，UI 不直连表。

## 用户故事链（单一路由，内部状态机 + `localStorage` 持久化）

```text
gate  →  focus  →  intake(3)  →  first_insight  →  shelf
                                                     ↑
      history_echoes  ⇄  recommendations  ⇄  notes(list/compose/detail/reply)
```

每屏一个主 CTA；`Esc`/焦点/ARIA/44px 触控/安全区/减动效全部满足。

### 屏级要点
1. **大门** — 复用现有首屏"每一种文明…你，是谁？步入图书馆"的文字与视觉（V2 内重制，不 import V1），点击后 0.5s 光晕过场（`prefers-reduced-motion` 下退化）。
2. **主题选择** — 事业/情感/财富/近况；卡片单问句，选择后展开个性化说明 + `开始寻找答案`。
3. **三步建档** — 昵称+性别 / 生日+时间(可勾"不知道准确时间") / 出生城市（复用 `CityCombobox`）。Demo 内建"使用演示资料"按钮一键填充；写入 V2 本地 store，不写 V1 charts。
4. **第一条洞察** — 一条演示洞察 + 三抽屉（为什么/怎么做/何时变化），顶部明标"演示数据"。
5. **书架** — 6 张卡：基础命盘/事业/情感/财富/时间轴/高级报告/智者对话。V2 内均为 Demo 页（不跳 V1 路由，避免真实数据交叉）；每张有确定性 fixture 内容。突出"你正在阅读"+最多 2 条"推荐下一页"。
6. **历史的回声** — 8 位 fixture 人物（中/西、跨年龄+主题）：处境/选择/结果/代价/迁移经验/来源占位/过度类比警示。匹配 = 年龄段+主题+核心矛盾标签；不显示相似度百分比，只显示"曾面对相似问题"。切换：东方/西方/做出不同选择的人。结尾固定金句。
7. **推荐** — 本地规则：`age_band × topic × repeated_traits × read/save history` → 至多 3 项，附"为什么推荐给我"。用户可切换首要主题。
8. **命运纸条** — 列表/详情/撰写/回复：
   - 撰写：受众模式（同页/对页/经历过/交给图书馆）、主题、正文、可选单图（本地 blob 预览 + mime/大小校验；Demo 不真上传）、隐私提醒。
   - 详情：结构化回复表单（曾面对/当时选择/代价/如果重来/一个考虑）。
   - 匹配标签：抽象词（人生阶段相近/责任模式相似/互补视角），**永不显示出生资料**。
   - 操作：收藏、举报、软删除自己发的内容。
9. **重开 Demo / 演示资料** — 顶部工具条常驻。

## 数据库设计（migration file 已写，Demo 不依赖执行）

Migration: `supabase/pending/20260720_library_v2.sql`

表（全部 `v2_` 前缀，RLS 打开，`GRANT` 完备）：
- `v2_reader_profiles(user_id PK, nickname, age_band, interest_topics text[], matching_opt_in bool, chart_ref uuid null, ...)` — 只存派生资料，不复制生辰。
- `v2_exploration_events(id, user_id, chart_id null, event_type, topic, metadata jsonb, created_at)` — 用户 own read/insert。
- `v2_historical_figures(id, name, tradition, age_band, topics text[], situation, choice, outcome, cost, transferable, source_title, source_url, warning, status, ...)` — `anon`+`authenticated` 只读 `status='published'`。
- `v2_recommendations(id, user_id, chart_id null, kind, reference_id, reason_codes text[], state, created_at)` — own only。
- `v2_notes(id, author_id, topic, body, image_path null, audience_mode, status, created_at, updated_at, deleted_at)` — author 全权；公众读 `status='active' AND deleted_at IS NULL`；`body` 与 `image_path` 不含生辰。
- `v2_note_match_traits(note_id, traits text[])` — 服务端生成的抽象标签；公众可读（跟随 note 可见性）。
- `v2_note_replies(id, note_id, author_id, faced, chose, cost, if_again, one_consideration, status, deleted_at, ...)` — 同 notes 规则。
- `v2_note_actions(id, actor_id, target_kind, target_id, kind unique(actor,target_kind,target_id,kind))` — 收藏/举报。
- `v2_saved_items(id, user_id, kind, reference_id, created_at)` — own only。

策略要点：
- 所有含 `author_id/user_id` 表：`auth.uid() = author_id` 才能写；SELECT 仅 own（notes/replies 例外：公共列表读 active 未删）。
- `v2_historical_figures`：`GRANT SELECT ... TO anon, authenticated`，policy 限 `status='published'`。
- 原始命盘 JSON、生辰、城市：**从不出现在任何 V2 表**。仅在 `v2_reader_profiles.chart_ref` 存现有受保护 chart 的 uuid（可选、可为空）。
- 图片：使用现有 `community` 私有 bucket（Demo 里不真传，只保留字段与签名 URL 设计说明）。
- 硬删除：预留 `v2_purge_deleted_notes(uuid)` 函数（`SECURITY DEFINER`, service_role only）设计说明写在 SKILL/README；migration 内落地空实现骨架。

因当前环境不能保证安全执行，migration 文件仅**写入 pending 目录**，不调用 `supabase--migration`。UI 通过 `src/experiences/library-v2/repository.ts` 抽象数据源：
- `mode='fixture'`（默认，Demo 用）— 内存 + `localStorage`。
- `mode='cloud'`（预留）— TanStack server fns 骨架，注释掉未启用。

## 代码结构

```
src/experiences/library-v2/
  version.ts                  (bump + add MODE='demo')
  preview-guard.ts            (已有)
  state.ts                    (扩展状态机)
  fixtures.ts                 (拆细：books/figures/notes/insights)
  repository.ts               (统一读写；fixture backend)
  matching.ts                 (纯函数：age×topic×traits)
  privacy.ts                  (序列化白名单，剥离生辰)
  storage.ts                  (localStorage 持久化 + 版本化)
  types.ts
  GuidedLibraryV2.tsx         (路由容器 + 状态机)
  screens/
    Gate.tsx  FocusPick.tsx  Intake.tsx  FirstInsight.tsx
    Shelf.tsx  BookReader.tsx
    HistoryEchoes.tsx  FigureDetail.tsx
    Recommendations.tsx
    Notes.tsx  NoteCompose.tsx  NoteDetail.tsx  NoteReply.tsx
  components/
    DemoBanner.tsx  Drawer.tsx  ImagePicker.tsx  Chip.tsx ...
  __tests__/
    matching.test.ts  privacy.test.ts  storage.test.ts
    repository.test.ts  state.test.ts (原 library-v2.test.ts 保留并扩展)
docs/LIBRARY_V2_GUIDED_EXPERIENCE.md  (更新为新链路)
supabase/pending/20260720_library_v2.sql
```

## 验证

- `bun test` 全量 + 新增 V2 单测（匹配/隐私/存储/删除/preview-guard）。
- `tsgo --noEmit`。
- Playwright 单次跑通完整链路：大门→主题→建档→洞察→书架→历史→推荐→纸条发布→回复→自删。
- 视口 1440 / 430 / 390 截图验证无横向溢出。

## 报告输出

完成后返回：复用清单（`CityCombobox`、design tokens、Drawer 样式）/ fixture 清单 / migration 路径 / 测试结果（数字）/ 预览 URL / 未验证项。

---

## 明确不做（避免误解）
- 不改 V1 首页与任何 V1 路由。
- 不执行 migration（文件只放 `supabase/pending/`）。
- 书架里 6 个模块 Demo 全部 V2 内实现（**不**跳 V1 `/report`、`/ritual`），保证 Demo 数据隔离。
- 不接真实 AI/支付/图片上传。

如认可此蓝图请回复"继续"，我将一次性交付。若要收敛（例如：书架某些模块直接跳 V1 而不做 Demo 页 / 图片选择器完全省略 / 只做 5 位历史人物），请指出。
