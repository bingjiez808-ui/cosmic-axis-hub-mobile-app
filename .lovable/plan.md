## 审计结论

**现有真实状态**
- `src/lib/account.tsx`：`Plan = "free" | "sage" | "oracle"`，`useAccount().plan` 存 localStorage，用于 UI 判权。
- `src/components/MembershipCard.tsx` + `me.oracle.tsx`：读 `profiles.membership_tier`（真实后端），带过期判断。
- `src/lib/access-level.ts`：已有 `hasAccess(feature, ctx)` fail-closed，含 `sage`/`oracle` 层级；这是唯一权威。
- `src/components/ReportExtras.tsx#MembershipSection`（L2088-2332）：当前 /report 的三列价格卡 + `TierTeasers` + Sage/Oracle-exclusive 组件 + `UpgradeCheckoutModal`（模拟支付）。
- `firstTime` -30% 折扣：只作为本地 state，`UpgradeCheckoutModal` 内确实按此对显示价格打折 → 保留。
- `/me/oracle.tsx`：已有四体系交叉、命盘选择、合盘等 —— 保留内容，重排为神谕者仪表盘。
- `/me/membership.tsx`：仅 `MembershipCard` + `MyTicketsCard`，需要拆两类。
- 塔罗真实用量在 `tarot_usage` 表 + `src/lib/tarot-quota.ts`（本地）；不伪造剩余数。

**冲突项 —— 不自行覆盖，仅列出等确认**
- 现有 i18n `mem_sage_desc` 写 "12 个月运势推演"，`mem_oracle_desc` 写"未来观察名单 · 优先计算"—— 与本轮真实权益不同。计划替换 i18n copy 为真实权益（属文案，不改后端）。
- 现 `TierTeasers` 三卡（Synastry / 90-day / Ask Sage）在 /report 直接展示；将从 /report 移除，仅在 /me/sage、/me/oracle 中出现。若你希望保留 Ask Sage 入口在 /report，请说明。

## 目标结构

```
/report
  ├─ 顶部：基础阅览权限说明（¥0，紧凑一行）
  ├─ 两扇门：SageDoorCard(¥19.9/月) │ OracleDoorCard(¥39.9/月，含贤者)
  └─ 单次馆藏：PremiumPdfCard (¥79，独立)

/me/sage  (新)
  ├─ 权限门禁：free → 升级弹窗；sage/oracle → 进入
  └─ 4 入口卡：完整生命时间轴 / 关系合盘 / 塔罗阅览 / 会员使用状态

/me/oracle  (重排现有)
  ├─ 权限门禁：free/sage → 对应升级弹窗
  ├─ "已包含贤者阅览室"横条 + 进入 /me/sage 入口
  └─ 神谕者独享：无限追问 / 无限塔罗 / 90 天窗口 / 关键节点 / 四体系交叉

/me/membership
  ├─ 分区①：月度阅读室会员 (MembershipCard 现状 + 到期/降级)
  ├─ 分区②：¥79 单次报告 (列出用户已购报告/入口)
  └─ 订单 & 工单
```

## 实施步骤

1. **统一 capability**：扩展 `src/lib/access-level.ts` 增加 feature key `sage_room_enter`, `oracle_room_enter`；`me.sage`/`me.oracle` 页面统一走 `hasAccess`。真实 tier 从 `profiles.membership_tier` 读取（复用 `MembershipCard` 里的查询逻辑抽成 hook `useMembershipTier`）。
2. **i18n**：替换 `mem_sage_desc` / `mem_oracle_desc` 为真实权益，新增 `sage_room_*`, `oracle_room_*`, `room_included_in_oracle`, `basic_access_*` 等键；中英对齐。
3. **/report 重构**：将 `MembershipSection` 中的三列价格卡改为 `BasicAccessNote` + `<div class="grid md:grid-cols-2">SageDoorCard OracleDoorCard</div>` + `PremiumPdfCard`（独立区）。移除内嵌 `TierTeasers`。保留 `UpgradeCheckoutModal` + firstTime -30% 逻辑。
4. **新建 `src/routes/_authenticated/me.sage.tsx`**：`PersonalWorkspaceNav`（需先加"贤者阅览室"入口）+ 4 张仪表卡。塔罗剩余用真实数据（`useSupabaseSession` + `tarot_usage` 或本地 quota，如无真实字段显示"以账户记录为准"）。
5. **重排 `me.oracle.tsx`**：顶部"已包含贤者"横条 + 神谕者独享模块（现有 `SynastryPreview`/`RecentWindows`/`FutureWatchlist` 复用）；移除与贤者层重复的卡片。
6. **/me/membership**：分两块 section；¥79 报告块查询 `premium_pdf_reports` 显示已购列表 + 入口。
7. **PersonalWorkspaceNav**：加入"贤者阅览室 / 神谕者阅览室"两项还是并入现 5 项？我倾向：不加入 nav（避免 7 项过长），入口通过 /report 的两扇门 + 全局导航"了解·更多"访问；`/me/sage` `/me/oracle` 自身页面顶部渲染 `PersonalWorkspaceNav`。
8. **测试**：
   - unit：新 access-level feature key + i18n 对称性 + `useMembershipTier` fail-closed。
   - E2E (Playwright)：signed-out → /report 显示两门；点击 Sage 门 → 登录提示；作为 free 登录用户点击进入 → 弹升级；模拟支付成功 → tier=sage 后再点击 Sage 门直接进入 /me/sage；oracle 同理；¥79 报告不受影响。
   - 响应式：1440/768/393 三门/两门/¥79 卡布局无横向溢出。

## 技术风险

- 后端 `profiles.membership_tier` 是权威；`useAccount().plan`（localStorage）是遗留、只用于模拟支付驱动 UI 切换。两者需要对齐 —— 我会新增 `useMembershipTier()` 作为 UI 的单一读取源，`useAccount().setPlan()` 仅作为模拟支付成功后的乐观 UI 更新（不写后端 —— 后端由既有 admin/webhook 写入）。
- 模拟支付路径不变，不做真实结算。

## 约束确认

- 不改 DB schema、不动 AI 计算、不改支付后端、不发布、无 variant。
- 冲突项已在上方"冲突"列出，需你确认是否替换 i18n 现有 `mem_sage_desc/mem_oracle_desc` 与是否保留 Ask Sage 卡在 /report。

批准后我按 1→8 顺序实施并汇报测试结果。