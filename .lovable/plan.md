## 阶段 2：统一智者入口与神谕者会员能力

不发布生产、不接真实支付渠道、不写虚假订单。以最新 commit 为基线。

### 交付范围

1. **服务端意图路由（新，可测试、可审计）**
   - 新文件 `src/lib/intent-router.ts` + `intent-router.test.ts`。
   - 6 类：`emotional_support / destiny_reading / product_help / order_help / crisis / out_of_scope`。
   - 纯规则 + 关键词，双语，返回 `{ intent, confidence, reasons[] }`；不消耗 AI 额度。
   - 危机词表复用 `ai-guardrails` 已有的安全清单。

2. **统一 `sageChat` 服务端函数**
   - 新文件 `src/lib/sage.functions.ts`（同一 auth-middleware，限流 20/min）。
   - 输入：`{ message, lang, history[], mode?: "companion" }`；`requestId` 幂等去重。
   - 分流：
     - `emotional_support` → 复用 `elder.functions.ts` 的核心 prompt（内联抽取，不再暴露 elderChat）；`usedAi=true`, `usedChart=false`, `chargedQuota=false`。
     - `destiny_reading` → **不**调 AI，返回 `{ requires_oracle: true, hasActiveOracle, nextAction }`。
     - `product_help` → 内置 FAQ 表（登录/报告生成/会员/退款流程），命中即返回确定性文案 + 路由，不调 AI。
     - `order_help` → 只读取当前用户 `premium_report_orders` 真数据；无匹配则返回"请提供订单号 + 引导 /me/profile"；写 `user_feedback` 时只存分类与前 200 字摘要。**不再宣称已通知团队**除非成功创建了 feedback 行，返回真实 id。
     - `crisis` → 固定安全响应（zh/en），链接到 CN/US 紧急支持；不调 AI，不记录原文。
     - `out_of_scope` → 固定回应，不调 AI。
   - 统一返回 `{ intent, text, usedAi, usedChart, chargedQuota, nextAction, feedbackTicket? }`。
   - 保留旧 `elderChat` 兼容一轮（内部委托给 sageChat），避免破坏 community.tsx 等旧调用。

3. **`ElderCompanion` → `SageCompanion`（同文件重构）**
   - 顶部横幅："智者陪伴 · 情绪、产品与订单"；副行"这里不读取命盘"。
   - 品牌统一：aria-label / title 改为 **智者 / Sage Companion**；删除"树洞"字样。
   - 所有请求走 `sageChat`；渲染 `nextAction`（比如"进入神谕者" / "解锁神谕者" / "填写订单号"）。
   - 未登录：允许输入，发送时引导 /auth。
   - 若 `sageChat` 返回 `requires_oracle`：显示专用 CTA — 有 oracle 会员则 Link 到 `/me/oracle?source=companion`，否则打开会员升级说明卡（沿用 MockPaymentModal 的"模拟支付"标记，文案标明当前仍为模拟）。
   - 危机响应用不同视觉（暖橙 + 支持链接），无"下一步 CTA"。

4. **`/me/oracle` 神谕者页（新路由，_authenticated 下）**
   - `src/routes/_authenticated/me.oracle.tsx`。
   - 页面加载调用新 `getOracleEntitlement` server fn（返回 `{ tier, expiresAt, isActive }`，服务端权威）；不是 oracle → 渲染能力介绍 + 到期规则 + Mock 升级 CTA；**不**显示假对话框。
   - 是 oracle：
     - 顶部显示"当前：神谕者 · 到期 YYYY-MM-DD"。
     - 命盘选择器（`listUserCharts`）；默认建议主盘但**不静默读取**；显式"本次读取：命盘名"，可切换/清空。
     - "陪伴模式"开关：切换后 `usedChart=false`，走 `sageChat` companion 路径。
     - 消息列表 + 输入。调用现有 `askOracle`，但增加 `chartId?: string`。
   - 服务端 `askOracle` 更新：
     - 输入新增 `chartId?: string`。
     - 若提供，服务端 `charts.select().eq('id', chartId).eq('user_id', userId).maybeSingle()` 校验所有权，未命中直接抛 `FORBIDDEN`。
     - 不再接受客户端自由传入的 `chart` 对象里的任意名字/数据 — 若 `chartId` 提供，从 DB 读取权威事实覆盖。
     - 保留现有 tier / 月度过期 fail-closed 检查。

5. **旧入口统一**
   - `report.tsx` 的 `MembershipSection` 上方插入一张顶部 Banner"进入神谕者阅读室 →"链接 `/me/oracle?source=report_membership`。**不**动内部 3000 行 ReportExtras 结构。
   - `ElderCompanion` 从 __root.tsx 挂载点保持不变（同一唯一浮层）。

6. **会员显示卡**
   - 新组件 `src/components/MembershipCard.tsx`：显示 tier / 到期 / active 状态。
   - 插入 `/me/profile` 顶部（"我的会员"区块）。
   - 不假装有 `auto_renew`。文案说明"月度会员到期后自动降级"。
   - 报告 one-time 权益保持独立，会员过期不影响，已由 `access-level.ts` 与 `hasPaidPremiumForChart` 保证；新增测试覆盖此不变量。

7. **测试**
   - `intent-router.test.ts`：每类 zh/en fixture、关键词组合、危机不进入命理。
   - `sage.functions.test.ts`：意图分流的 usedAi/chargedQuota 断言（mock 掉 provider 与 supabase）。
   - `oracle.functions.test.ts`：伪造 chartId 被拒绝、tier 过期 fail-closed。
   - `access-level.test.ts`：追加"会员过期但拥有 premium report 仍可读"用例。
   - `premium-mock-payment.test.ts`：确认 mock 会员购买不会授予 report 权益，反之亦然（若已存在则复用）。

8. **验收报告（响应末尾列出）**
   - 新路由、新组件、服务端函数表、每类问题 usedAi/usedChart/chargedQuota、是否发生数据库迁移（本阶段：**否**）、权限测试结果、typecheck/build/lint 结果。

### 明确不做

- 不接真实支付（微信/支付宝/Visa/银联）。
- 不添加 `payment_events` 表；预留稳定 `simulate*` 服务端函数签名与幂等 `simulation_id` 参数，仅此。
- 不改动 six-book 首页、ConcernSelector、`/me/profile` 书架视觉。
- 不重写 ReportExtras 内嵌 oracle chat（仅上方加入统一入口 Banner）；后续阶段再退役。

### 主要新增/修改文件

```text
新增
  src/lib/intent-router.ts            + test
  src/lib/sage.functions.ts           + test
  src/routes/_authenticated/me.oracle.tsx
  src/components/MembershipCard.tsx
修改
  src/components/ElderCompanion.tsx   → 智者陪伴浮层重构
  src/lib/oracle.functions.ts         → chartId 所有权校验
  src/lib/elder.functions.ts          → 委托 sageChat（保留兼容层）
  src/routes/report.tsx               → 顶部 Banner Link 到 /me/oracle
  src/routes/_authenticated/me.profile.tsx → 顶部 MembershipCard
```

请确认。批准后我会分批写入并跑 typecheck / test / build / lint，把结果贴回。
