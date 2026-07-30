## 目标

复用第一轮已建好的表与 RPC，把「同门」从闯关答题升级为匿名跨年龄书信社区。不新建第二套表/接口，不使用 localStorage 或假数据。

## 复用的第一轮资产

- 表：community_profiles / community_letters / community_letter_deliveries / community_letter_replies / community_reports / community_blocks / community_notifications / community_moderation_events
- 服务函数：`src/lib/community-hall.functions.ts`（寄信、投递、回信、收信匣、举报）+ `community-hall.server.ts` + `community-hall-safety.ts`
- 「小小闯关」保留但降级并改名为「入馆问笺 / Entry Notes」

## 路由

```text
/community            大厅（今日来信 / 寄信 / 我的书札 / 我的回音 四入口）
/community/write      寄信台（三步：写问题 → 选人生阶段 → 封缄寄出）
/community/inbox      收信匣（未拆封/已阅读/已回复/已封存）
/community/outbox     已寄书札
/community/echoes     我的回音（收到的 / 我写出的）
/community/letters/$id 信件详情与回信
/me/community         身份、隐私、屏蔽名单、举报与封存记录
```

已存在的同门页面就地重构，不新增语义重复页面。

## 分批实施

1. **第一批**：i18n 映射层（年龄段/主题/状态/审核结果）、community 查询 hooks、大厅首页（Hero 文案、三步说明、四入口、空状态）。
2. **第二批**：寄信三步流 + 信件详情与回信抽屉 + 举报/屏蔽。
3. **第三批**：收信匣 / 已寄书札 / 回音三页与筛选、分页。
4. **第四批**：`/me/community` 身份与隐私、首次进入引导（登录回跳、18+ 拦截、未开启参与）。
5. **第五批**：管理员后台「同门书信」板块（脱敏内容、通过/隐藏/拒绝/暂停/重新投递、审计事件）。
6. **第六批**：三账户端到端测试（A 23–29 寄信、B 30–39 收信、C 18–22 不可见）、中英文与 375/412px 移动端核查、typecheck 与生产构建。

## 技术要点

- 只经 RPC 写库，前端不直插表；age_band 一律服务端由已验证生日计算。
- 每次寄信/回信/举报成功后精准 invalidate 相关 query，不整页刷新。
- 移动端弹窗一律全屏抽屉，底部四项导航，触区 ≥44px，支持安全区。
- `prefers-reduced-motion` 关闭信封位移动画；动画层 `pointer-events: none`。
- 全程不发布生产版本，直到第六批全部通过。

## 说明

体量较大，我会按上面六批依次提交，每批结束报告进度；你可以随时调整批次顺序或优先级。