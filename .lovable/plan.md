
本工作量较大，涉及数据库迁移、后端 server functions、UI 重构和路由级加固。分五个阶段落地，每阶段结束跑 `bun test` 与 `tsgo --noEmit`，最后用 Playwright 真实预览验收。**不发布生产**。

## 阶段 1 — 数据模型与迁移（Lovable Cloud）

新增 migration `20260722_chart_roles.sql`：

- `ALTER TABLE public.charts ADD COLUMN chart_role text NOT NULL DEFAULT 'other'`
- `ALTER TABLE public.charts ADD COLUMN is_primary boolean NOT NULL DEFAULT false`
- `ADD CONSTRAINT charts_chart_role_check CHECK (chart_role IN ('self','other'))`
- `ADD CONSTRAINT charts_primary_requires_self CHECK (is_primary = false OR chart_role = 'self')`
- 部分唯一索引：`CREATE UNIQUE INDEX charts_one_primary_per_user ON public.charts(user_id) WHERE is_primary = true`
- 现有行保留 `chart_role='other'`, `is_primary=false`（默认值）；不自动猜测。
- RLS 已有 owner-only 策略，不改；新列继承。
- 新增 `set_primary_chart(_chart_id uuid)` SECURITY DEFINER RPC：在事务里 `UPDATE charts SET is_primary=false WHERE user_id=auth.uid()`，然后 `UPDATE charts SET is_primary=true, chart_role='self' WHERE id=_chart_id AND user_id=auth.uid()`。

迁移执行后由用户在 Cloud 中审批。types 自动重生成。

## 阶段 2 — Server functions (`src/lib/reports-store.functions.ts`)

新增/扩展（均 `requireSupabaseAuth`）：

- `setPrimaryChart({ chartId })` — 调用 `set_primary_chart` RPC。
- `setChartRole({ chartId, role: 'self'|'other' })` — 若 role=self 且已有主命盘，仅改角色不改 primary；禁止两张 primary。
- `renameChart` 已存在，确保 name 不参与 hash（当前实现已是）。
- `listUserCharts` 返回追加 `chart_role`, `is_primary` 字段（types 更新后自动带上）。

RLS 隔离：所有 update `.eq('user_id', context.userId)` 显式加，即使 RLS 已限制。

事实缓存 hash 不变（`canonical_input_hash` 已只含出生资料）。角色/name 改动不触发排盘或 AI。

## 阶段 3 — /me/home 命盘管理器 UI

重构 `src/routes/_authenticated/me.home.tsx` 的“我的命盘”section：

```text
┌───────────────────────────────────────┐
│ 我的主命盘                             │
│ [主命盘卡片 或 「请选择主命盘」引导]     │
├───────────────────────────────────────┤
│ 他人命盘 (n)                           │
│ · 卡片 [重命名] [设为我的主命盘] [删除] │
└───────────────────────────────────────┘
```

- 无主命盘时顶部显示黄色引导条 + 「去选择」按钮，锚定到列表；**不阻塞** 今日演示内容。
- 行内重命名 form：`useState` + `renameChart`，长度 1–40，错误提示双语。
- 「设为我的主命盘」→ 调用 `setPrimaryChart`，成功后 refetch。
- 创建/保存新命盘（该流程在 `/synthesis` 等入口）**暂不改动创建流程本身**——用户要求是不擅自设主。当前 UI 已不设主命盘（默认 `is_primary=false`），符合要求；只在保存成功后若账号 0 主命盘弹出一次性选择框（在保存回调处理，改动仅在 UI 层）。
- 移动端卡片纵向、桌面分组栅格。不显示 hash/version。
- 命盘为空 / 加载 / 错误状态双语。

`src/lib/i18n-daily.ts` 追加 keys：`my_charts_role_self / role_other / set_primary / primary_badge / needs_primary_prompt / privacy_other_consent / unnamed_other` …等。

## 阶段 4 — /me/match 真实导入

重构 `src/routes/_authenticated/me.match.tsx`：

- 顶部：两个 Select
  1. 我的主命盘（自动填充唯一 primary；没有 → CTA「去 /me/home 设置」）
  2. 他人命盘（从 `chart_role='other'` 列表选，显示 name + 脱敏出生日：`1990-**-** · Shanghai`）
- 隐私确认 checkbox「我已获得对方同意保存并用于关系适配」，未勾选禁用按钮。
- 「开始适配分析」→ 通过 `compatibility-facts-adapter.ts` 从两张 chart 的 `calculation_snapshot` 提取 facets；若缺失则调用本地确定性计算（`western-natal`, `bazi-luck`, `ziwei-horoscope`, `vedic-dasha`）填补并写回 snapshot；仍缺则返回 `partial=true` + `missing_facts`。
- 调用现有 `computeCompatibility` (v1, deterministic, 0 AI tokens)。
- 结果缓存 key = canonical pair key + mode + calculator_version；使用 `sessionStorage` 或直接每次纯函数重算（已确定性，重算成本可忽略）。
- DEMO 四按钮移入折叠 `<details>` 「查看演示 fixtures」，与真实结果分离。
- 加载/错误/空状态/同意撤回双语反馈。

## 阶段 5 — 今日路由加固（全局 pending）

`src/router.tsx`：

- `createRouter({ ..., defaultPendingMs: 0, defaultPendingComponent: GlobalPending, defaultErrorComponent: GlobalError })`.

`src/routes/_authenticated/route.tsx`：

- 追加 `pendingMs: 0`, `pendingComponent: DailyRoomPending`（复用现成组件），确保任何 `_authenticated/*` chunk 加载间隙都非空。
- 保留 `ssr: false` 与现有 auth 守卫。

`me.home.tsx` 主体已解耦 Supabase；确认 DailyRoomPage 顶部（demo banner + nav + welcome + fixture buttons + score/theme/domains/actions/reflection）在 Supabase pending/error 时完全渲染，仅「我的命盘」section 显示局部 loading/error。为主体加 `data-testid="daily-room-main"`；命盘 section 加 `data-testid="charts-manager"`。

## 测试

新增：

- `src/lib/reports-store.roles.test.ts`：mock supabase client，验证 `setPrimaryChart` 调用 RPC；重命名不改 hash；`setChartRole` 边界。
- `src/experiences/daily-room/charts-manager.test.tsx`：无主命盘引导、切换主、他人分组、行内重命名双语错误。
- `src/routes/_authenticated/me.match.test.tsx`：primary 缺失 CTA、导入 partial 显示 missing_facts、同意 checkbox 门控。
- `tests/visual/navigate-to-home.py`（Playwright）：从 /me/match、/me/friends、侧栏、移动菜单四个入口进 /me/home，断言 `<main>` 立即非空（pending 或主体）；auth 失败模拟下 error UI 非空。

全量 `bun test` + `tsgo --noEmit`。

## 验收命令

```bash
bun test
bunx tsgo --noEmit
python tests/visual/navigate-to-home.py
```

## 交付说明

- 迁移文件生成后通过 `supabase--migration` 工具提交，等待用户审批；types 待 migration 应用后自动重生成，然后运行测试。
- 若用户批准前无法跑 types 相关测试，会在提交时明确指出。
- 不发布，不删数据。

请确认执行。
