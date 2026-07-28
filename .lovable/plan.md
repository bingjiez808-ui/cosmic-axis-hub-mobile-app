
## 目标
让首次访问者 6 秒看懂产品，在滚动中发现「趣味图书馆」与「四间特别藏室」两个差异化亮点，同时始终知道「从哪里进、需要什么、点击后会发生什么」。仅改首页展示层与路由指引，不动算法/支付/数据库/权限底座。

## 一、新的首页信息架构（`src/routes/index.tsx`）

```text
1. Hero: 品牌主张 + 语言切换 + 开启仪式主 CTA
2. ConcernSelector: 今天你带着什么问题（保留）
3. FeatureLibraryShelf: 六本主题书（保留，去掉与藏室重复的会员话术）
4. PlayfulLibrarySection (新增) — 跨学科馆藏桌
5. PostRitualRoomsSection (新增) — 仪式之后四间特别藏室
6. TraditionsBridge: 四大体系专业计算说明（复用现 trust-bridge → /traditions）
7. HomePersonalDeskTeaser: 登录后的个人书架（保留）
8. MembershipHint + PremiumReportCta: 唯一的会员/¥79 入口（保留，删掉现在 CuratorLetter 前后的重复文案）
9. CuratorLetter + 页脚
```

删除现有位于 8 与 9 之间的重复 Final CTA（`#concern` 已在第 2 步出现）。

## 二、趣味图书馆板块（新组件 `src/components/PlayfulLibrarySection.tsx`）

**视觉：** 深色图书馆桌面、金色馆藏编号、SVG 手稿/公式/诗句/地图线条，复用现有 `bg-obsidian` `gold-dust` `nebula-purple` 语义 token；不生成新的 AI 图片。

**桌面端交互：** 横向「跨学科馆藏桌」
- 中央「我的命盘馆藏卡」（登录+主命盘状态自适应）
- 周围 5 本书脊，一次只展开一本，展开在原位下方（不横向溢出）
- 展开内容：这本书如何解释人生 / 用户会看到什么 / 微型可视化 / 状态 / 入口 / CTA 说明

**移动端交互：** 纵向书脊列表，点击就地展开，一次一本，CTA ≥44px。

**已开放（真实路由映射，代码搜索确认后使用）：**
| 书 | 状态 | 未登录 CTA | 无主命盘 CTA | 有主命盘 CTA | 真实路由 |
|---|---|---|---|---|---|
| 数学馆 | 已开放 | 去登录→仪式 | 完成仪式 | 进入数学馆 | `/life-studies/math` |
| 语文馆·人生哲学 | 已开放 | 去登录→仪式 | 完成仪式 | 进入语文馆 | 复用现有 life-guidance 真实路由（探测后填） |

**筹备中（不放可点入口，只显示「馆藏整理中」）：**
- 地理馆·人生迁移地图
- 历史馆·与你同龄的回声（如现有历史回声真实可用则标「已有基础馆藏」并指向真实路由）
- 物理馆·惯性与转向成本
- 经济馆·选择、机会成本与风险
- 生物馆·节律、适应与恢复

**微型可视化：**
- 数学馆：SVG 主曲线 + 6 维（学业/事业/爱情关系/财富/家庭/健康）悬停高亮 + 「人生分支」示例按钮（就地展示曲线变化示意；标明「情景模拟，不是预测」）
- 语文馆：桌面上一封未拆信 → 点开一句诗 → 「为什么是这句话」展开时代背景 → 「换一页」。首页仅示例，标注「示例馆藏」

**「如何进入」三步图：** 完成仪式 → 设为主命盘 → 从顶部导航或个人书架进入。

**主导航不新增顶级项**（避免与品牌名/账号/语言按钮遮挡），只在 hero 与 `/me/home` 增加「趣味图书馆」入口锚点；避免与「我的书架/四大体系」职责重叠。

## 三、仪式之后·四间特别藏室（新组件 `src/components/PostRitualRoomsSection.tsx`）

标题「仪式之后，图书馆会为你打开四间特别藏室」。桌面端探索地图（2×2 或轨道），移动端纵向路线。

| 藏室 | 对应功能 | 权限标签 | 真实路由（探测后填） |
|---|---|---|---|
| 时间回廊 | 生命时间轴·大运（多维折线预览） | 基础馆藏 | `/me/timeline` 或等效 |
| 验证档案室 | 关键节点·反向验证 | 基础馆藏 | 现有验证功能真实路由 |
| 第二证人室 | 塔罗·第二位证人 | 基础馆藏（每月配额沿用现状） | `/me/tarot` 或等效 |
| 私人阅览室 | 贤者/神谕者阅览室 | 贤者功能 / 神谕者功能 | `/me/sage` `/me/oracle` |

每间藏室卡：是什么 / 回答什么 / 会看到什么 / 权限标签 / 从哪里进 / CTA 小字说明。**首页不重复展示价格卡与支付弹窗**，「私人阅览室」CTA 直达 `/me/sage`（未开通时由该页现有 `RoomLockedShell` + `MembershipCheckoutModal` 处理）。

## 四、权限标签统一

首页所有徽章只用：`基础馆藏` / `贤者功能` / `神谕者功能`；趣味图书馆开放态另用：`已开放` / `基础馆藏已开放` / `馆藏整理中`。Tooltip 文案按用户给定四条。全部经 `useMembershipTier` + 现有配置，不硬编码。

## 五、CTA 路由闭环

在新组件中集中一个 `resolveCta(target, { session, hasPrimaryChart, tier })` helper：
- 未登录 → `/auth?next=<target>`
- 已登录无主命盘 → `/ritual?next=<target>`
- 有主命盘 → 目标真实路由
- 权限不足 → 目标页面（由目标页现有锁屏 + `MembershipCheckoutModal` 承接）
- 筹备中 → 不可点

每个按钮附小字（例：「进入仪式·建立主命盘后返回数学馆」）。

## 六、i18n / 响应式 / 无障碍

- 所有新文案进 `src/lib/i18n.ts` 现有字典（新增 key 前缀 `home_playful_*`、`home_rooms_*`），英文单独校对不逐字翻。
- clamp 标题；书脊/藏室卡在 1440/1200/1024/768/430/390/375 全部无横向滚动。
- 展开：`aria-expanded` / `aria-controls`，键盘 Tab/Enter/Space/Esc，`prefers-reduced-motion` 关闭翻页动画。
- 桌面主导航不加新项，避免遮挡。

## 七、不做的事（防倒退）

不恢复：三档方案底部按钮、重复 OracleRoomBanner、第二套价格卡、第二个支付弹窗、首页内直接支付、空白路由。继续复用 `MembershipCheckoutModal` / `simulate_mock_membership_upgrade` / `membership-plans` / `useMembershipTier`。

## 八、修改文件

- `src/routes/index.tsx` — 板块顺序与去重
- `src/components/PlayfulLibrarySection.tsx`（新）+ 子文件 `PlayfulBookCard.tsx`、`MathBookPreview.tsx`（迷你 SVG 曲线）、`ChineseBookPreview.tsx`（示例信笺）
- `src/components/PostRitualRoomsSection.tsx`（新）+ `RoomCard.tsx`
- `src/lib/home-cta.ts`（新）— `resolveCta` + 状态→路由 helper
- `src/lib/i18n.ts` — 新 key
- 单测：`src/lib/home-cta.test.ts` 覆盖 5 种状态；`PlayfulLibrarySection.test.tsx` 覆盖徽章/展开互斥/筹备卡不可点

## 九、验收

`bun test`（预期 738+ 全绿）+ `bunx tsgo --noEmit` + 手动 6 秒可读性 + 未登录/无命盘/有命盘 × free/sage/oracle 组合走查 + 6 个断点无横向滚动 + reduced motion。**不发布生产**。

## 十、需要你先确认

1. 真实路由映射：让我在实现前先 `rg` 探测「语文馆/哲学解读/历史回声/时间轴/塔罗/验证」现有真实路由并汇报，再落 CTA。可以直接开始吗？
2. 「趣味图书馆」是否需要新增顶级导航？我的建议：**不新增**（避免遮挡），只在首页与 `/me/home` 提供入口。你偏好？
