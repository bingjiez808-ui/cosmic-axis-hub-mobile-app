
# 登录后的今日阅览室 + 好友匹配系统 — 交付计划

范围极大，分为 6 个可独立验证的批次。全部 demo-safe：不发布、不真实付费、不调用真实 AI、不执行破坏性迁移；新迁移只放 `supabase/pending/`。

⚠️ 关键假设（如与实际不符请纠正）：
- V1 修改版本 = 当前主干（未启动 fork），新路由使用 feature flag `VITE_ENABLE_DAILY_ROOM`，默认关闭。
- 每日行运计算：项目当前 `western-transits.ts` 已能确定性计算 transit-to-natal aspects。将扩展为 `daily-facts-v1`（当前 UTC 日 12:00 采样 + 相位），可真实接入；Vedic/BaZi/紫微只沿用已验证的大运/大限/年柱作为"较慢周期背景"，绝不编造日层干支。
- Demo fixture 明显标注"DEMO"，不写真实用户数据。

---

## 批次 0 — 审计与契约固化（先交付）

**产物**：`docs/DAILY_ROOM_AUDIT.md` — 逐项列出当前登录路由、`AccountModal` saved charts、`profiles` / `user_roles` / `community_*` 表、以及 RLS 现状；标注可复用与需新建。

**calculator contract 明确化**：
- 新建 `src/lib/daily-facts.ts` (`DAILY_FACTS_VERSION = "daily-facts-v1"`)：基于 `western-transits.ts`，采样"用户 timezone 当日 12:00 本地时→UTC"，输出行运行星黄经、与本命九星主要相位（orb 与现有表一致）、月相、当日 Moon sign。测试：determinism、timezone 边界、DST。
- 新建 `src/lib/daily-domain-score.ts` (`daily-domain-score-v1`)：纯确定性映射至 overall + study/career/love/wealth；clamp 0–100；带 band/confidence/evidence_refs；含 supportive/caution/contradictions/missing_facts。无 daily facts 时返回 `partial`，UI 显示"今日星象计算待接入"。
- 明确禁语：分数称"今日领域信号/关注线索"，不称"成功率/好运概率"。

---

## 批次 1 — Skill: `fate-nexus-daily-reading`

`skills/fate-nexus-daily-reading/`
- `SKILL.md`：触发条件、事实/解释/建议分层、缓存流程、失败/partial 规则、明确禁语（灾祸/幸运色/模仿他人文风）。
- `agents/openai.yaml`
- `references/daily-facts-contract.md`、`output-schema.md`、`safety-and-language.md`
- `scripts/validate_daily_reading.py` — 校验 schema、evidence_refs 白名单、违禁词、单体系冒充跨体系共识。
- 4 个 fixture：青年学生 / 职场 / 成年学习转型 / 缺出生时间。
- 版本 `daily-reading-v1`；输出 schema 覆盖用户列出的 10 项。
- Contract test：`src/lib/daily-reading.test.ts`。

---

## 批次 2 — `/me/home` 今日阅览室（feature flag）

路由 `src/routes/_authenticated/me.home.tsx`（flag off 时导航不出现）。
- 欢迎区：昵称 + 本地日期 + 默认命盘切换（复用 saved charts）。
- 今日总览：overall + 4 项 domain，带 band 与"今日主题"。
- 今日行动卡：do_today / observe_today / countercondition / reflection_question。
- "为什么这样判断"折叠区：daily facts + slower cycle context + evidence_refs + confidence + missing modules + 计算时间。
- 缺出生时间：ASC/houses 相关结论隐藏并降 confidence。
- 缓存：`daily_readings` 表 unique(owner, chart, local_date, tz, calc_version)。命中零 AI。
- 免费/会员分层：免费只看 overall + 简版注意；会员看四项证据与历史趋势。
- UI 沿用图书馆调性，独立组件在 `src/experiences/daily-room/`。

---

## 批次 3 — 保存命盘管理增强

- 在个人首页嵌入 `SavedChartsPanel`：打开 / 设为默认 / 重命名 / 删除（软删+撤销 Toast+永久删除二次确认）。
- Owner-scoped fingerprint 去重复用 `buildCanonicalChartInput`。
- 复用 `reports-store.functions.ts`，不在 UI 散落 supabase 调用。

---

## 批次 4 — 好友与匹配（邀请制）

**新表**（迁移进 `supabase/pending/20260721_daily_room_and_friends.sql`，不执行）：
`user_home_preferences, daily_fact_snapshots, daily_score_snapshots, daily_readings, friend_requests, friendships, chart_match_consents, compatibility_snapshots, user_blocks, social_reports, in_app_notifications` — 全部 RLS + service-role 写 + soft delete + 唯一约束（pair key A/B 顺序无关）。

**calculator**：`src/lib/compatibility-score.ts` (`compatibility-score-v1`)：使用两盘 western synastry major aspects（确定性）+ 双方 Vedic Dasha / BaZi 大运 / 紫微大限作为背景；canonical pair key 排序后 hash。禁止无事实宫位叠盘。

**UI** (`src/experiences/friends/`)：
- 邀请（用户名 / 邀请链接 / 一次性 code），双方接受后建 friendship。
- 命盘授权：好友≠命盘共享；双方各选一张 + 明确同意；可撤回（撤回后对方视图立即失效，服务端清 snapshot）。
- 匹配报告：互动适配指数 0–100（明确非成功率）+ 沟通/情绪/节奏/边界/成长 + 共鸣/互补/易误解 + 现实验证问题；consultation_mode: friendship（默认）/romantic/work。
- 屏蔽 / 举报 / 撤回 / 删除好友；无在线状态、无 last seen。
- 私信本期仅结构化"纸条"（预置模板），不做自由聊天。
- 未成年默认关闭匹配。

---

## 批次 5 — Demo / 验证 / 类型 / 测试

- Fixture：未登录 / 无命盘 / 1 命盘 / 多命盘 / 无准确时间 / 免费 / 会员 / 待处理邀请 / 已授权匹配。
- Playwright 端到端：登录→切换命盘→展开依据→注意事项→管理命盘→好友请求→接受→双方授权→查看匹配→撤回→屏蔽/举报。
- 视口 1440 / 430 / 390：无横向溢出、无嵌套按钮、focus/ARIA、console 无 error。
- 单元测试：RLS 契约（documented in migration test）、pair key 顺序无关、daily cache、timezone rollover、权限撤回、软删、会员 CTA。
- 全量 `bunx vitest run` + `tsgo`。
- 交付说明：明确"真实接入 = daily-facts-v1 + daily-domain-score-v1 + compatibility-score-v1；AI 解释层为 demo（deterministic provider）；迁移待执行"。

---

## 技术细节（工程侧）

- feature flag：`import.meta.env.VITE_ENABLE_DAILY_ROOM === "true"` + `_authenticated/me.home.tsx` 顶部 `redirect` 到 `/`。
- 时区：使用 `Intl.DateTimeFormat().resolvedOptions().timeZone`，服务端接受 `tz` 入参，日切按用户 tz 午夜。
- 缓存 key：`sha256(owner_id | chart_id | local_date | tz | daily-facts-v1 | daily-domain-score-v1 | daily-reading-v1)`。
- Pair key：`[sorted(userA, userB)].join('|') + '|' + [sorted(chartA, chartB)].join('|') + '|' + compat-v1`。
- Repository：`src/lib/daily-room.functions.ts`、`src/lib/friends.functions.ts`（均 `requireSupabaseAuth`）。

## 交付顺序建议

我将按 批次 0 → 1 → 2 → 3 → 4 → 5 顺序推进，每批次结束报告"已完成 / 未验证"清单。若你希望某批次先做（例如先出 Skill + Daily Room，暂缓好友匹配），请指定；否则默认 6 批全做。

请确认或调整：
1. feature flag 名称与默认关闭 OK？
2. daily-facts 使用 timezone-local noon 采样 OK（或希望用日出/其它锚点）？
3. 好友私信本期只做结构化"纸条" OK？
4. 是否先做批次 0–2（家里今日阅览室 MVP），批次 4 好友系统作为下一轮？——这能显著降低本轮风险面。
