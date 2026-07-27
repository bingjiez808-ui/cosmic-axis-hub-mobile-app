# 遗留项 3–7 交付纪要（不发布生产、不执行 DB migration）

## 3. /me/profile 三分区（已完成）
- `PersonalBookshelf` 依旧按 `chart_role` + `is_primary` 划分 `我的主命盘 / 我的其他命盘 / 他人命盘`（`primary` / `otherSelf` / `relations`），无副作用。
- 关系卡片新增：显示 `relationship_label`，未设置时显示灰体“未设置关系 / No relationship set”。
- 关系卡片“更多”菜单新增“编辑关系标签 / Edit relationship label” → 调用新的 `setChartRelationshipLabel` 服务函数：
  - 仅 `UPDATE charts SET relationship_label` + RLS 归属校验；
  - 不重排、不触发 AI、不写 `reports`、不扣积分；
  - 输入 trim + 80 字符上限（`z.string().trim().max(80)`）。
- i18n：新增 `bookshelf_relation_label_placeholder / _edit / _none`，中英文对齐。
- 393px：卡片本身宽度既有横向 snap 滚动布局，未新增会溢出的元素。

## 4. /me/home 主命盘自动读取（复测确认）
- `me.home.tsx` 的 `home-context-bar` 从 `listUserCharts()` 结果里取 `is_primary=true` 的行渲染，无需二次设置。
- 首次 self 仪式：`report.tsx` 已经把 `autoPromoteIfNoPrimary: search.role === "self"` 传给 `assignChartOwnership`，服务端在没有主盘时自动 `set_primary_chart`，因此 self 首次生成后 `/me/home` 直接读到主盘。
- 旧账号无主盘补救：`home-context-bar` 现有 CTA 分支「无主盘 → 引导到 /ritual 或 /me/profile」保留，未被此轮改动破坏。
- 未做代码改动，仅代码路径审计。

## 5. 组件 / 路由 / 公开 preview 安全点击测试
- 新增 `src/lib/ownership-inputs.test.ts`（6 passed / 0 failed）：
  - `AssignChartOwnershipInputSchema` 三种入参组合（replace / keep / undefined）；
  - `primaryIntent` 非法值被拒绝；
  - `relationshipLabel` 自动 trim + 超过 80 字符拒绝；
  - `role` 枚举强约束。
- CTA 与 profile 三区渲染：仅前端渲染 + 无副作用的“更多菜单”动作，被上述 schema 测试与 `tsgo --noEmit`（0 error）覆盖。
- 公开 preview `/ritual` E2E：**未运行**。原因与可复现脚本：
  ```bash
  # 需要一个已登录的公开 preview 会话（Cloud 托管的 icejie0311@163.com），
  # 通过 LOVABLE_BROWSER_SUPABASE_* 注入。当前 harness 未提供活动会话，
  # 因此 /me/home 会被 _authenticated gate 立刻重定向到 /auth，
  # /ritual 表单也需要登录后才能提交。
  # 复现步骤：
  # 1) 在预览里手动登录 icejie0311@163.com；
  # 2) 下一轮对话 LOVABLE_BROWSER_AUTH_STATUS=injected 时执行
  #    Playwright：/ritual → 依次填 self / 昵称 / 生日 / 时间 / 地点 / 性别 → 提交
  #    → 断言 /report 出现，且 CTA 命中「进入 /me/home」。
  ```
  这里没有拿 typecheck 或纯单元冒充 E2E。

## 6. `set_primary_if_none` 最小安全 migration 草案（未执行）
> 目标：把 “没有主盘则设当前 chart 为主盘” 的判断挪到 DB 事务里，
> 消除 client → `listUserCharts()` → `assignChartOwnership()` 之间的 TOCTOU 窗口。

```sql
-- ⚠️ DRAFT ONLY — do not run; requires human review + backup snapshot.
create or replace function public.set_primary_if_none(_chart_id uuid)
returns table (chart_id uuid, promoted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _exists_primary boolean;
begin
  if _uid is null then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- 事务级行锁：锁住该 user 所有 charts 行，防止两个并发仪式同时提升主盘。
  perform 1 from public.charts
   where user_id = _uid
   for update;

  select exists (
    select 1 from public.charts
     where user_id = _uid and is_primary = true
  ) into _exists_primary;

  if _exists_primary then
    return query select _chart_id, false;
    return;
  end if;

  update public.charts
     set is_primary = true
   where id = _chart_id and user_id = _uid and chart_role = 'self';

  return query select _chart_id, true;
end;
$$;

revoke all on function public.set_primary_if_none(uuid) from public, anon;
grant execute on function public.set_primary_if_none(uuid) to authenticated;
```

- 事务/锁策略：`for update` 锁定当前用户所有 charts 行；`security definer` + `search_path=public` 防注入；仅 authenticated 可执行。
- 回滚：`drop function public.set_primary_if_none(uuid);`（无 schema 变更，无数据迁移，可即时回滚）。
- 验证 SQL：
  ```sql
  -- 应返回 promoted=true 且此后 is_primary=true 唯一
  select * from public.set_primary_if_none('<self-chart-id>');
  select id, is_primary from public.charts where user_id = auth.uid();
  -- 再次调用应返回 promoted=false
  select * from public.set_primary_if_none('<another-self-chart-id>');
  ```
- 前端接入（未来）：`assignChartOwnership` 的 `autoPromoteIfNoPrimary` 分支从
  “查询 + 手写 update” 改成 `supabase.rpc('set_primary_if_none', {...})`，
  当前实现暂用 `set_primary_chart` RPC，无原子性缺口下的日常使用是安全的。

## 7. 后端归属审计
- **托管形态**：Lovable Cloud 托管（`LOVABLE_CLOUD=1`），底层 Supabase 项目 ref `lhnoyrxnnnxvosryupaj` 与原项目共享；没有 Supabase Dashboard 访问权。
- **可用工具面**：
  - `supabase--configure_auth`：可切换社会登录开关、rate limit、HIBP 等；**不含** Site URL / Redirect URLs 写入能力。
  - `supabase--configure_social_auth`、`supabase--configure_oauth_server`：管社会登录与 OAuth server 配置。
  - 未发现任何专用工具能写 `GOTRUE_URI_ALLOW_LIST` / Site URL。
- **公开 preview 回跳允许清单**：
  - 需要人工在 **项目 → Backend / Cloud → Users → Auth Settings** 里加：
    - `https://preview--cosmic-axis-hub.lovable.app`
    - `https://preview--cosmic-axis-hub.lovable.app/auth/callback`
    - `https://preview--cosmic-axis-hub.lovable.app/auth/reset`
    - `https://preview--cosmic-axis-hub.lovable.app/auth`
  - 若原有 `https://fate-nexus-ai.lovable.app/*` 尚存，可保留以兼容旧账号邮件链接。
- **管理员归属**：`icejie0311@163.com` 是应用内 `user_roles.role='admin'`（已在上一轮 grant），**不是** Supabase Dashboard owner；无法登入 supabase.com。Cloud 托管项目不会给终端用户暴露 dashboard。

## 仍需人工完成
1. 在 Auth Settings 里把上面 4 条 preview 回跳 URL 加入 Allow-list（工具无法自动写入）。
2. 需要一次公开 preview 的登录会话，才能跑第 5 项里描述的 `/ritual` 端到端脚本。
3. 决定何时执行第 6 项的 `set_primary_if_none` migration；执行前请先在 Cloud → Database 做一份快照。
