
本次改动仅在 preview 生效，不发布生产。/me/match 顶部加两个 tab；原“我的命盘适配”整体保留为 tab A，新增 tab B“社区匿名匹配”。所有分数走现有 deterministic 链路，默认 0 AI 调用。

## 一、数据库与安全（一份 migration）

### 表（public schema，每张表 GRANT + RLS + 策略齐备）

1. `community_match_profiles`
   - `user_id uuid PK REFERENCES auth.users`, `primary_chart_id uuid REFERENCES public.charts`, `anonymous_alias text UNIQUE NOT NULL`（服务端生成，形如 `nebula-4718`；与 user_id 之间只在 SECURITY DEFINER 内部映射，客户端不可反查）, `age_band text`（可空，enum: `18-24|25-34|35-44|45-54|55+`）, `show_age_band boolean default true`, `is_active boolean default true`, `paused_at timestamptz`, `consent_version text not null`, `consented_at timestamptz not null default now()`, `created_at/updated_at`.
   - RLS：只有 owner (`auth.uid()=user_id`) 可 SELECT / UPDATE 自己的行；普通客户端不能 SELECT 别人的档案（匿名候选通过 RPC 返回，绕开表 SELECT）。

2. `community_match_invites`
   - `id`, `sender_id`, `recipient_id`, `mode text default 'friendship'`, `status text CHECK IN (pending|accepted|declined|expired|revoked|blocked)`, `expires_at timestamptz default now()+interval '7 days'`, `created_at/updated_at`.
   - 约束：`sender_id <> recipient_id`；`UNIQUE(sender_id, recipient_id) WHERE status='pending'` 防重复。
   - RLS：只对 sender / recipient SELECT / UPDATE。所有写通过 RPC。

3. `community_match_grants`
   - `pair_key text`（`least(a,b) || ':' || greatest(a,b)`，服务端计算写入）, `a_user_id`, `b_user_id`（`a_user_id<b_user_id`）, `a_granted_at`, `b_granted_at`, `a_revoked_at`, `b_revoked_at`, `mode`.
   - RLS：只对 pair 双方 SELECT。

4. `community_match_results`
   - `pair_key text UNIQUE`, `a_user_id`, `b_user_id`, `mode`, `calculator_version text`, `facets_snapshot jsonb`, `score_snapshot jsonb`, `evidence_summary jsonb`, `status text`, `created_at`.
   - RLS：SELECT 仅当 `auth.uid() in (a,b)` 且 grants 双向有效（未 revoke），通过 helper function `public.can_read_match_result(pair_key)`（SECURITY DEFINER）判定。

5. 复用（不新增）：`public.friend_invites`、`public.friendships`、`public.friend_blocks`、`public.friend_reports`（pending migration 20260722 已定义；如尚未落库则一并纳入本次 migration）。聊天入口在 friendship 建立后再开放，本次不新建 chat 表；如项目已有 messages 表则复用，否则聊天入口先渲染 "Coming soon"。

### RPC（SECURITY DEFINER，`auth.uid()` 校验所有权）

- `community_match_opt_in(_alias_seed text, _age_band text, _show_age_band bool, _consent_version text)` — upsert profile；要求 `charts.is_primary=true, chart_role='self'` 存在，否则 raise。
- `community_match_pause() / resume() / opt_out()`。
- `community_match_recommend(_limit int default 10)` — 返回匿名候选：`{alias, age_band?, facets(4维), overall_band, evidence_bullets}`。服务端按现有 facts 缓存计算适配，屏蔽已 block/已 invite pending/自己；每用户 60s 冷却 + 每天 200 次上限。
- `community_match_invite(_recipient_alias text, _mode text)` / `respond(_invite_id, 'accept'|'decline'|'block')` / `revoke(_invite_id)`。
- `community_match_grant_confirm(_invite_id)` — accept 后写 grants 与 results（若不存在），返回 pair_key。
- `community_match_result_read(_pair_key text)` — 校验 grants 有效，返回快照或 `revoked`。
- `community_match_revoke_grant(_pair_key)`。
- `community_match_alias_reveal_owner(_alias text)` — 内部使用，不直接暴露给客户端。

## 二、后端 server functions（`src/lib/community-match.functions.ts`）

`requireSupabaseAuth` 包裹以下 fn，均调用上面 RPC，不绕过 RLS 直接查表：
`optIn/optOut/pause/resume`、`listRecommendations`、`sendInvite`、`respondInvite`、`revokeInvite`、`listMyInvitesSent/Received`、`listMyMatches`、`readMatchResult`、`revokeMatchGrant`、`blockUserByAlias`、`reportUserByAlias`。

分数计算：候选生成时服务端读取双方 `premium_pdf_reports` / `year_readings_v1` 中缓存的 facts；缺 facts 的用户不进池（or 显示 partial 但不编造）。走 `adaptFacetsFromFacts` + `computeCompatibility`（已有）。同 pair + `CALCULATOR_VERSION` 复用 `community_match_results`。

## 三、前端

`src/routes/_authenticated/me.match.tsx` 顶部加 Tabs（shadcn Tabs）：
- Tab A `personal`（默认）：现有 `RealImportPanel` + 折叠 Demo。
- Tab B `community`：新组件 `src/experiences/community-match/CommunityMatchPanel.tsx`。

`CommunityMatchPanel` 子视图：
- `OptInGate`（未 opt-in / 未成年 / 无主命盘 → 分支引导）
- `CandidatesGrid`（匿名卡：alias、age_band、四维 bar、总览 band、2–3 evidence bullets；按钮：Invite / Block / Report）
- `InvitesInbox`（Received / Sent，状态徽标）
- `MatchesList`（accepted 双向授权卡；点开 `MatchResultDrawer` 显示完整四维解释 + 「邀请成为好友」按钮 → 触发现有 `friend_invites` 流）
- `PrivacySettings`（暂停 / 退出 / 撤回单个 grant / 隐藏 age_band）

i18n：`src/lib/i18n-community-match.ts` 中英双语字典；沿用黑金视觉与 daily-room tokens。移动端纵向卡，桌面 2 列 grid。

## 四、隐私护栏

- 服务端所有返回体白名单序列化：只允许 `{alias, ageBand?, facets, overallBand, evidenceBullets, inviteState, mode, createdAt}`。写单元测试断言 recommend 响应 JSON 不含 `user_id/chart_id/email/birth/date/lat/lon/name` 等字段名。
- alias 服务端生成 `${wordFromDeterministicList(userId)}-${4digitHash}`，不暴露 user_id 映射端点。
- 客户端不查任何跨用户表；所有跨用户查询走 RPC。

## 五、测试（`bun test`）

`src/lib/community-match.test.ts`（Node）
- opt-in 需主命盘；未成年 / 无主命盘门控
- 匿名响应字段白名单（PII 泄露断言）
- pair_key 顺序无关；同 pair 同 version 缓存命中 0 AI；calculator_version 变化触发重算
- 邀请状态机：pending → accepted/declined/expired/revoked/blocked；重复 pending 被拒；7 天过期
- 双方 grant 前 `readMatchResult` 拒绝
- accept 匹配不自动 friendship；friendship 需二次 `friend_invite` accept
- block 后不再进推荐；report 写入 friend_reports
- Top K、冷却、每日上限
- 现有 `/me/match` 个人 tab 回归

组件测试 `src/experiences/community-match/community-match.test.tsx`
- Tab 切换、opt-in 表单、候选卡渲染 zh/en、隐藏 age_band
- SSR hydration 首帧英文 → mount 切换 zh 无 mismatch

## 六、验证

- 应用 migration（审批后执行）
- `bun test`（预期 570+ pass）
- `bunx tsgo --noEmit` 清洁
- 刷新 id-preview，登录态实测：切 Tab、未 opt-in 空态、i18n zh↔en、移动/桌面。不替真实账号 opt-in。
- 输出：migration 摘要、RLS/RPC 列表、修改文件、测试数、预览 asset hash。

## 技术细节

```text
compute path (deterministic, cached):
  buildCalculationSnapshot(user)
    → buildPremiumFacts()  (cached in year_readings_v1)
      → adaptFacetsFromFacts()
        → computeCompatibility(a, b, mode)  // CALCULATOR_VERSION
          → persist to community_match_results by pair_key
```

```text
invite state machine
  pending --accept--> accepted --grant_confirm--> results readable
        \--decline--> declined
        \--revoke--> revoked
        \--block--> blocked (adds friend_block row)
        \--(t>7d)--> expired
```

假设与确认点（若不同请回复调整）：
- 复用 `supabase/pending/20260722_friends_and_matches.sql` 里的 friendships / blocks / reports；本次 migration 附带执行它（若未落库）。
- 本次不实现聊天（chat 表），friendship 建立后 UI 显示「Coming soon · 聊天即将开放」。
- 默认 0 AI；未来解释性 AI 留 hook 但本 PR 不启用。
