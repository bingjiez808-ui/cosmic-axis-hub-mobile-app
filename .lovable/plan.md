这批交付覆盖 8 项要求，涉及新增约 20+ 文件（repository、UI、schema、tests）。为保证质量与真实可跑，我建议按**两轮**执行，本轮完成骨架 + 真实接入 + 全量测试，下一轮做端到端浏览器演练与视觉打磨。

## 本轮范围（Turn A）

### 1. `/me/home` 接入真实命盘
- 新建 `src/lib/saved-charts.functions.ts`：`listMyCharts / setDefaultChart / renameChart / softDeleteChart / restoreChart`，全部走 `requireSupabaseAuth`。
- 在 `charts` 表补一次迁移草稿（保留在 `supabase/pending/`）：`display_name`, `is_default`, `deleted_at`, `deleted_reason`；unique `(user_id, canonical_input_hash) WHERE deleted_at IS NULL` 保证去重。
- `/me/home` 改造：真实登录 → 拉取命盘 → 无命盘或 flag 关闭 → Demo fixture fallback 且明确标注「演示数据」。
- 新增 `<ChartSwitcher />` 组件（下拉 + 重命名/设为默认/软删+撤销 Toast）。

### 2. 好友系统（不含自由聊天）
- `friendships`、`friend_invites`、`friend_blocks`、`friend_reports` 表（pending 迁移）。
- `src/lib/friends.functions.ts`：`createInvite / acceptInvite / rejectInvite / cancelInvite / listFriends / removeFriend / blockUser / reportUser`。
- 邀请方式：一次性 code（`inv_` 前缀）、可选用户名查找、可分享链接 `/invite/<code>`。
- 新页 `/me/friends`（列表 + 待处理 tab + 屏蔽名单）。

### 3. 双方授权匹配 `chart_match_consents`
- 表：`(a_user, b_user, a_chart_id, b_chart_id, mode, a_consent_at, b_consent_at, revoked_at)`。
- `matches.functions.ts`：`requestMatch / respondMatch / revokeMatch`，撤回后立即失效（unique partial index）。

### 4. `compatibility-score-v1` 确定性引擎
- `src/lib/compatibility-score.ts`：canonical pair key = `[min(a,b), max(a,b)]` 顺序无关；默认 `friendship` 模式。
- 5 维度：沟通、情绪支持、行动节奏、边界修复、共同成长；输出共鸣点/互补点/误解点/相处建议数组；显式 `disclaimer` 字段。
- 纯函数、无 AI，全量单测覆盖对称性 + 稳定性。

### 5. 匹配结果 fixtures + repository fallback + 通知
- `notifications` 表 + `src/lib/notifications.functions.ts`：好友请求、匹配请求、匹配完成三类。
- 站内红点通过 header badge 显示。

### 6. 会员分层
- 复用 `useEntitlements()`：基础操作免费；「详细证据」「多命盘每日导读」「完整匹配报告」加 `<PremiumGate feature="daily-detail">`。
- 已购隐藏 CTA（沿用现有 `entitled` 判定）。

### 7. 文案统一
- 全库替换用户可见「研究」→「学业与认知」；保留 skill/内部标识符 `study/academic` 不动。

### 8. 验证
- 全量 `vitest`、`tsgo`、`bun run build`。
- Playwright headless 跑 `/me/home`、`/me/friends`、`/me/match` 三视口截图（390/430/1440）。
- 输出：console 无错、RLS 契约测试（撤回后 A 侧读不到 B 分数）、pair-key 对称性测试、timezone 边界测试。

## 明确 Defer 到 Turn B
- 邀请链接的公开 landing page（`/invite/[code]` 无登录预览）
- 举报后管理员审阅工作流
- 匹配结果 PDF 导出

## 交付格式
- 不执行 migration，SQL 存 `supabase/pending/20260722_friends_and_matches.sql` 供审阅
- 不发布，不调 AI，不真实收费
- 最终 commit 消息 + 测试计数 + fixture 列表 + 未验证项清单

确认后我立即开工。