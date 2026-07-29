# 兑换码开通权益 · 审计报告与交付方案

按你要求的顺序，先完成 **第一步（只汇报，不修改）** 与 **第二步（migration + 权益交付复用方案）**。批准后我按 3→8 逐步执行，本轮不接入真实微信/支付宝、不发布生产。

---

## 一、现有权益真实来源审计（只读结论）

### 1. 会员等级唯一真实来源
- **DB 字段**：`profiles.membership_tier` (`none|sage|oracle`) + `profiles.membership_expires_at`
- **前端读取**：`src/lib/use-membership-tier.ts`（`useMembershipTier()` 已带过期回落 + `refreshMembershipTier()` 广播）
- **写入路径**：**唯一**通过 DB RPC `simulate_mock_membership_upgrade`（SECURITY DEFINER，事务内 insert `membership_orders` + update `profiles`），前端由 `src/lib/membership.functions.ts::simulateMockMembershipUpgrade` 调用
- **写保护**：DB 触发器 `profiles_membership_write_guard` 已经拒绝任何非 `app.membership_writer=on` 的会员列写入（含管理员豁免），任何绕过 RPC 的直改都会被拒
- **模拟支付订单表**：`membership_orders`（已存在，`provider='mock'`）

### 2. ¥79 高级报告权益唯一真实来源
- **订单表**：`premium_report_orders`（`status='paid'` 视为该 `chart_id` 的一次性权益）
- **报告表**：`premium_pdf_reports`（一 `chart_id` 一份最新报告）
- **入口**：`src/lib/premium.functions.ts`（`getPremiumStatus/createOrder/markPaid` 等）
- **绑定粒度**：`(user_id, chart_id)`

### 3. 管理员角色唯一真实来源
- **DB**：`user_roles` 表 + `app_role` 枚举（`admin|user`）+ `private.has_role()` SECURITY DEFINER
- **服务端校验**：`admin.functions.ts::ensureAdmin` 与 `premium.functions.ts::ensureAdmin` 均查 `user_roles`
- 前端**不存在**任何按 email 硬编码的管理员判断；`icejie0311@163.com` 已经通过 `handle_new_user`/`handle_user_updated` 触发器自动写入 `user_roles`

### 4. 共享购买 UI
- **唯一弹窗**：`src/components/MembershipCheckoutModal.tsx`（被 /report、/me/sage、/me/oracle、/me/membership、关系深度分析、匿名匹配复用）
- 支付方式 4 个（wechat/alipay/visa/unionpay）全部走同一 `simulateMockMembershipUpgrade`

### 结论
现有会员与报告权益是**单一真实来源**，不存在需要合并的第二套 state。**兑换码要复用同一路径**：会员类兑换码复用 `simulate_mock_membership_upgrade` 的时长顺延与不降级逻辑；报告类兑换码复用 `premium_report_orders` 已购判定。绝不建立第二套 `membership state`。

---

## 二、数据库 migration 方案（第二步 · 待批准）

### 新增表
1. **`redemption_codes`**（管理员创建；仅服务端可读）
   - `code_hash text unique`（HMAC-SHA256(normalized_code, REDEMPTION_CODE_PEPPER)）
   - `code_prefix text`, `code_last4 text`（脱敏辨识）
   - `benefit_type text check in ('sage_membership','oracle_membership','premium_report','test_access','support_compensation')`
   - `duration_days int null`, `report_scope text null check in ('current_chart','next_selected_chart')`
   - `max_redemptions int default 1`, `redemption_count int default 0`
   - `starts_at/expires_at timestamptz null`
   - `status text default 'active' check in ('active','disabled','exhausted','expired')`
   - `campaign_name/internal_note text null`
   - `created_by/disabled_by uuid`, `created_at/disabled_at`

2. **`redemption_uses`**（每次兑换一行）
   - `redemption_code_id`, `user_id`, `benefit_type`, `chart_id nullable`, `order_id nullable`
   - `status text check in ('processing','fulfilled','failed','reversed')`
   - `entitlement_id text null`（指向 `membership_orders.id` 或 `premium_report_orders.id`）
   - `failure_code text null`
   - `request_id text unique`（幂等键，`(user_id, request_id)` 幂等）
   - `ip_hash/user_agent_summary text null`
   - `redeemed_at/fulfilled_at`

3. **`redemption_attempts`**（限流与安全审计）
   - `user_id nullable`, `code_prefix`, `outcome text`, `ip_hash`, `rate_limited bool`, `error_code`, `created_at`

4. **`admin_audit_logs`**（管理员操作全审计：创建/批量/禁用/恢复/查看/撤销）

### RLS / GRANT
- `redemption_codes`：**只 `service_role`**（管理员通过 RPC 读取；无 `authenticated` SELECT）
- `redemption_uses`：`authenticated` 仅 SELECT 自己（`user_id = auth.uid()`），无 UPDATE/DELETE/INSERT；`service_role` 全权
- `redemption_attempts`：无 `authenticated` 权限；`service_role` 全权
- `admin_audit_logs`：无 `authenticated`；`service_role` 全权

### 新增 DB 函数（SECURITY DEFINER，均通过 `private.has_role` 校验管理员）
- `admin_create_redemption_codes(...)` → 返回**本次明文**（仅一次）+ 元数据
- `admin_list_redemption_codes(...)` / `admin_disable_redemption_code(id)` / `admin_list_redemption_uses(...)`
- `redeem_code(_code_hash, _chart_id, _request_id, _ip_hash, _ua)` → 单事务：`FOR UPDATE` 锁行 → 校验状态/时窗/次数/用户去重/chart 归属 → `redemption_uses` insert(processing) → 根据 benefit_type 分派：
  - 会员类：内部调用与 `simulate_mock_membership_upgrade` **相同的顺延/不降级逻辑**（抽成 `apply_membership_grant(_user_id, _tier, _days, _source, _source_ref)`），并在 `membership_orders` 写一条 `provider='redemption'` 订单
  - 报告类：在 `premium_report_orders` 写 `provider='redemption', status='paid'`（若该 chart 已 paid → 返回 `report_already_owned`，**不消耗次数**）
- 完成后 `redemption_uses.status='fulfilled'`，`entitlement_id=<新订单id>`，`redemption_codes.redemption_count += 1`，达上限 → `status='exhausted'`
- **任何异常整笔回滚，`redemption_count` 不增加**

### 复用抽取
将现有 RPC 中"顺延/不降级"逻辑抽成 `public.apply_membership_grant(...)` 内部函数；`simulate_mock_membership_upgrade` 与新 `redeem_code` 均调用它 —— 这是"未来微信/支付宝也复用同一 entitlement fulfillment service"的落点。

### Secret
- 新增 `REDEMPTION_CODE_PEPPER`（≥32字节高强度随机）—— 需要你在 Lovable Secret 后台手动填写；DB 通过 `current_setting('app.settings.redemption_pepper')` 由 Edge 层注入（或改为在服务端函数计算 HMAC，DB 只接收 `code_hash`）。**推荐后者**（DB 不接触 pepper），我在下一节确认。

### 服务端函数（TanStack `createServerFn` + `requireSupabaseAuth`）
- `src/lib/redemption.functions.ts`
  - `adminCreateRedemptionCodes` / `adminListRedemptionCodes` / `adminDisableRedemptionCode` / `adminListRedemptionUses`
  - `redeemCode({ code, chartId?, requestId })` —— 服务端 normalize + HMAC + rate limit（复用 `enforceRateLimit`：5/min & 15/hour/user，IP-hash 每小时上限）+ 调用 `redeem_code` RPC，只把 `code_hash` 传入 DB
  - `listMyRedemptionUses`

---

## 三、UI 交付计划（第 4–7 步）

### 管理员端 `/admin`（已有页面新增 Tab）
- "兑换码管理"：创建单/批（选权益类型/时长/次数/时窗/活动名/内部备注/report_scope）→ 弹窗显示**本次生成的明文列表**（一次可见）+ 复制/导出 CSV
- 列表：脱敏显示 `FN-SAGE-••••-Q8WT`、状态、次数、时窗、活动、创建人
- 使用记录：按码/按用户查询、脱敏用户信息

### 用户端 · 共享弹窗 `MembershipCheckoutModal`
- 支付方式区新增第五个按钮 **兑换码**（微信/支付宝显示"暂未开放"角标但不删除）
- 选中后切换到兑换码子视图：输入框（自动大写/连字符/粘贴清洗）、说明、客服邮箱、"立即验证并开通"
- 成功后：`refreshMembershipTier()` + 弹出成功卡（贤者/神谕者/报告文案分支）+ CTA 按来源跳转 or 留在当前页

### 报告类兑换成功
- 若当前上下文已有 `chartId` → 直接绑定
- 若无 → 显示"选择要绑定的主命盘"（复用现有 chart 选择）
- 该 chart 已购 → 返回 `report_already_owned`，**不消耗**，允许换 chart

### `/me/membership` 新增"权益记录"分区
- 与"订单"（真实付款/模拟支付订单）**分开**
- 兑换来源：脱敏码、时间、绑定 chart、有效期、状态；测试/补偿明确标注

---

## 四、错误码与限速

- 统一错误码：`code_invalid`（合并"不存在/哈希不匹配"防枚举）、`code_not_yet_active`、`code_expired`、`code_exhausted`、`already_redeemed_by_user`、`chart_required`、`chart_not_owned`、`report_already_owned`、`rate_limited`、`fulfillment_failed`（回滚）、`already_fulfilled`（幂等）
- 限速：`enforceRateLimit(user, 5, 60_000)`、`(user, 15, 3_600_000)`、`(ip_hash, 60, 3_600_000)`；连续失败递增等待（在 attempts 表基础上）

---

## 五、测试矩阵（第 8 步）

- 单元：normalize / HMAC / 顺延与不降级（vs 现有 `simulate_mock_membership_upgrade` 行为对齐）
- 集成（bun test + DB）：
  - 单次码复用被拒 / 同 user 重复被拒 / requestId 幂等 / 并发 `FOR UPDATE` 只允许一个
  - 贤者顺延、神谕者不被降级、贤者→神谕升级、报告绑定/换 chart / 已购不消耗
  - 过期码/未生效码/禁用码/非管理员创建/普通用户读表全部被拒
- E2E（Playwright 现有 harness）：弹窗输入→成功→原地解锁 + 刷新后仍在
- Typecheck + build

---

## 六、需要你手动配置

1. Lovable Secret 后台填写 `REDEMPTION_CODE_PEPPER`（≥32 字节高强度随机字符串；生成即用，不发聊天/截图）

---

## 七、明确不做

- 不接微信/支付宝真实 API（保留现有模拟按钮）
- 不删除任何现有支付方案展示或会员/报告业务逻辑
- 不发布生产
- 不修改命盘/AI 生成/报告结构

---

**请回复"批准"后我按第 3 步开始：先建 migration（含 GRANT/RLS/`apply_membership_grant` 抽取/`redeem_code` RPC），再逐步落 UI 与测试。**
