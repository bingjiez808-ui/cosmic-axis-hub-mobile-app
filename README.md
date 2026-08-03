# 命运图书馆 · Library of Destiny

一个融合 **西方占星 · 印度吠陀 · 八字 · 紫微斗数** 四大传统的 AI 命理阅读应用。
产品形态不是"算命工具"，而是一座图书馆：进门 → 借阅证 → 建立主命盘 → 阅读报告 → 走进各个藏室（通识馆、众生之厅、我的书架）。

- 线上（当前）：https://cosmic-axis-hub.lovable.app
- 历史域名：https://fate-nexus-ai.lovable.app

---

## 目录

1. [产品结构总览](#1-产品结构总览)
2. [功能详解](#2-功能详解)
3. [技术栈与架构](#3-技术栈与架构)
4. [路由表](#4-路由表)
5. [数据库与安全](#5-数据库与安全)
6. [会员、支付与配额](#6-会员支付与配额)
7. [AI 调用策略与成本控制](#7-ai-调用策略与成本控制)
8. [响应式与动效规范](#8-响应式与动效规范)
9. [本地开发与测试](#9-本地开发与测试)
10. [MCP 接入](#10-mcp-接入)
11. [工作日志 Work Log](#11-工作日志-work-log)

---

## 1. 产品结构总览

```
开场序幕（沉浸式全屏）
      ↓
导览室首页 /            —— 七张书签卡：问题接待台 / 建立命盘 / 综合解读 / 通识馆 / 四间藏室 / 众生之厅 / 我的书架
      ↓
开启仪式 /ritual        —— 登记出生资料（含性别必填、查重询问）
      ↓
仪式过场 /synthesis     —— 四大体系合鸣动画
      ↓
命盘报告 /report        —— 10 大模块 + 24 章深度报告（¥79 一次性）
      ↓
├── 四大体系 /traditions        —— 与四位长老分别对话
├── 命运通识馆 /life-studies    —— 数学馆 / 语文馆等六馆
├── 众生之厅 /community         —— 匿名书信社区
└── 我的书架 /me/home           —— 每天回来的主界面
```

---

## 2. 功能详解

### 2.1 沉浸式开场序幕
全屏开场：推门动画 + 雾气粒子 + 3D 借阅证（Reader's Pass，可翻面查看背面设计）。
`prefers-reduced-motion` 下自动降级为静态过场。低内存设备通过 `useCanRender3d` 探测跳过 WebGL 层。

### 2.2 问题接待台（Concern Selector）
六种现实困惑（学业 / 事业 / 爱情 / 人际 / 财富 / 自我）→ 图书馆推出对应"一本书"的阅读路径。
两步在同一扇门内完成，不跳页。

### 2.3 开启仪式（建立主命盘）
- 姓名、出生日期、出生时间、出生地（城市检索 + 经纬度）、**性别必填**
- 提交前做**查重询问**：命中已有相同输入的命盘时提示复用而非重复生成
- 完整的必填项校验与内联错误提示（`src/lib/ritual-validation.test.ts` 覆盖）
- 生成结果可提升为"主命盘"，后续所有阅读均以主命盘为底稿

### 2.4 命盘报告 /report
- **10 大模块**：三栏等高卡片布局，含证据（evidence）与强度（strength）标注
- **字号自适应**：`clamp()` + `em` + `lh` 单位，用户调大系统字号后模块仍等高、内容不溢出
- **目录导航**：`ReportToc` 侧边锚点跳转
- **生成韧性**：每个维度调用独立指数退避重试（`ai-retry.ts`），失败降级为确定性模板；进度快照写入 `localStorage`（`report-progress.ts`），刷新后可续跑
- **稳定性**：命盘水合（`chart-hydration.ts`）完成前不触发 AI，保证重复打开摘要一致、不重复计费
- **24 章深度报告**：¥79 一次性买断、永久保存、非订阅；支持 PDF 导出（`pdf-lib`）

### 2.5 四大体系 /traditions
西方占星师、Jyotish 圣哲、八字师、紫微斗数师四位长老，毛玻璃面板独立对话。
底层算法：`western-natal.ts` / `vedic.ts` + `vedic-dasha.ts` / `lunar.ts` + `bazi-luck.ts` / `ziwei.ts` + `ziwei-horoscope.ts`（`astronomy-engine`、`lunar-javascript`、`iztro`）。

### 2.6 命运通识馆 /life-studies
把专业命理翻译成日常学科语言：

| 馆 | 状态 | 内容 |
| --- | --- | --- |
| 数学馆 | 开放 | 人生函数曲线、七条生命线、年度雷达、可交互"选择实验室" |
| 语文馆 | 开放 | 3D 翻书阅读界面 |
| 地理 / 物理 / 经济 / 生物馆 | 整理中 | — |

规则：各馆**不调用实时 AI**，只对确定性命盘事实做规则化翻译与本地可视化。

### 2.7 众生之厅 /community（匿名书信社区）
- 匿名写一封信 → 四种去向：**同龄陌生旅者 / 公共信墙 / 十二位先贤人格 / 图书管理员安排真人回信**
- 蜡封 UI、信封位移动画、投递进度条（Courier Progress）、回音提醒 Toast
- 收信匣 / 已寄书札 / 我的回音 / 通知中心 / 公共信墙
- 安全：敏感词审查（`community-hall-safety.ts`）、举报、屏蔽、管理员审核后台
- 隐私：全程化名（`馆友 · xxxxxx` 回退），前端不暴露真实 `user_id`

### 2.8 我的书架 /me/*（Personal Library）
统一外壳 `PersonalLibraryShell`，六个入口：

- **今日阅览室** `/me/home`：今日信号得分（100% 确定性计算，不花钱）、七日预览、四维度（关系 / 学业 / 事业 / 身心）弹窗式详解、按需分段 AI 解读、样例预览开关
- **命盘管理** `/me/profile`：多命盘管理、主命盘切换
- **好友** `/me/friends`：邀请码 / 分享链接、结构化纸条、收件箱、屏蔽与举报（真实持久化，非 demo）
- **匹配** `/me/match`：社区匿名匹配、共鸣图谱（Resonance Atlas / Radar）
- **贤者阅览室** `/me/sage` 与 **神谕者阅览室** `/me/oracle`：分级锁定预览（`room-access.ts` + `RoomLockedShell`）
- **会员与订单** `/me/membership`

### 2.9 智者树洞（ElderCompanion）
左下角浮标的心理陪伴 Agent：仅倾听 / 共情 / 温柔建议，明确声明非命理咨询。
识别设备与订单关键词后自动记入 `user_feedback`。

### 2.10 管理后台 /admin
用户活跃、会员发放、兑换码系统（`redeem_code` RPC）、用户反馈、工单、**同门书信审核**（脱敏内容、通过 / 隐藏 / 拒绝 / 暂停 / 重新投递 + 审计事件）。

### 2.11 发布视频工程 remotion/
Remotion 工程，输出 16:9 与 9:16 两版 ~30s 发布片：开场钩子 → 品牌 → 六个功能拍点 → 结尾 CTA，含 Ken Burns、尘埃粒子、墨蓝渐层。

---

## 3. 技术栈与架构

- **框架**：TanStack Start v1（React 19 + Vite 7 + SSR），文件式路由
- **样式**：Tailwind CSS v4（`src/styles.css` 中 `@theme`）+ shadcn/ui
- **动效**：Framer Motion、GSAP、Lenis、three / @react-three/fiber
- **后端**：Lovable Cloud（Supabase 托管）—— Auth / Postgres + RLS / Storage
- **服务端逻辑**：`createServerFn`（`src/lib/*.functions.ts`），Webhook / 公共 API 走 `src/routes/api/public/*`
- **AI**：Lovable AI Gateway（`src/lib/ai-gateway.server.ts`）
- **MCP**：`@lovable.dev/mcp-js`，Supabase JWT 作为 OAuth issuer
- **运行时**：Cloudflare Workers（`nodejs_compat`）
- **测试**：Bun test / Vitest（约 90 个 `*.test.ts`）+ Playwright 视觉与 E2E 脚本

分层约定：

```
*.functions.ts   客户端可导入的 createServerFn 薄封装（模块顶层只放 import / 类型 / 导出）
*.server.ts      仅服务端的实现与密钥读取
src/experiences/ 大型功能域（community-hall / daily-room / life-studies / library-v2 / profile / admin）
src/components/  可复用 UI 与 shadcn 组件
```

---

## 4. 路由表

| 路由 | 说明 |
| --- | --- |
| `/` | 导览室首页（七张书签卡 + 侧边浮动目录导航） |
| `/ritual` `/synthesis` `/report` | 仪式 → 过场 → 报告 |
| `/traditions` | 四大体系长老对话 |
| `/life-studies` `/life-studies/math` | 命运通识馆 |
| `/community/*` | index / write / inbox / outbox / echoes / wall / sages / librarian / errands / grants / notices / letters/$id |
| `/me/*` | home / profile / friends / match / sage / oracle / membership / relationships / literature / echoes / community |
| `/auth` `/auth/callback` `/auth/reset` | 邮箱密码 / 手机 OTP / Google OAuth |
| `/admin` | 管理后台（`_authenticated` 子树） |
| `/mcp` `/.well-known/oauth-protected-resource` | MCP 端点与 OAuth 元数据 |
| `/about` `/privacy` `/terms` `/delete-account` `/sitemap.xml` | 静态与合规页 |
| `/dev/*` | 开发调试页（demo-premium / panorama-tour / reader-harness / guided-library-v2） |

---

## 5. 数据库与安全

核心表（均启用 RLS + 明确 GRANT）：

- `profiles` / `user_roles`（`has_role()` SECURITY DEFINER）/ `phone_otps`
- `charts` 及报告与章节表、`premium_*` 章节与用量表
- `tarot_usage` / `user_activity` / `user_feedback` / `tickets`
- `community_profiles` / `community_letters` / `community_letter_deliveries` / `community_letter_replies` / `community_reports` / `community_blocks` / `community_notifications` / `community_moderation_events`
- `community_posts` / `community_comments`（列级 GRANT，不暴露 `user_id`）
- `friend_invites` / `friendships`（规范化 `a_user_id < b_user_id`）/ `friend_blocks` / `friend_reports` / `friend_notes`
- 兑换码与回信额度相关表（`redeem_code`、`purchase_reply_credits` RPC）

安全要点：

- 敏感操作一律 `createServerFn` + `requireSupabaseAuth`；前端不直插表，写库走 RPC
- 内部触发器辅助函数已 `REVOKE EXECUTE FROM PUBLIC / anon / authenticated`
- 社区内容以化名返回，服务端计算 `isMine` 而非下发 `user_id`
- `community` 存储桶 SELECT 策略限定为上传者本人或仍被未删除帖子引用的文件
- 付费门在服务端二次校验；AI 端点要求登录 + 配额检查

---

## 6. 会员、支付与配额

- 三档会员：**Free / 贤者 Sage / 神谕者 Oracle**（价格表保留在 `/report` 与 `/me/membership`）
- 贤者权益含 **2 次免费先贤回信 + 1 次管理员授权**
- 回信额度双桶结构（`sage` / `human`），支持 ¥3 / ¥10 加购，走与会员一致的真实支付弹窗
- 深度报告 ¥79 **一次性买断**，永久保存，不自动续费
- 兑换码系统：管理员生成 → 用户在结算处兑换

---

## 7. AI 调用策略与成本控制

1. **默认不花钱**：今日得分、四维度分数、通识馆全部为确定性计算
2. **显式触发**：今日 AI 解读需手动点击生成
3. **分段按需**：`use-daily-reading-segments.ts` 只在展开对应模块（概览 / 今日可做 / 某个维度）时才发起该段调用
4. **缓存**：按天 + 按命盘哈希写入 `localStorage`，同日重复打开不再调用
5. **韧性**：`ai-retry.ts` 指数退避 + 失败降级模板 + `report-progress.ts` 可恢复进度
6. **一致性**：命盘水合完成后才计算规范化输入哈希，避免同一命盘产生不同摘要
7. `REPORT_GENERATION_MODE=deterministic` 可将报告生成整体切到确定性模式

---

## 8. 响应式与动效规范

- 移动端优先（320 / 375 / 390 / 430）：顶部导航折叠为汉堡 + 两列底部抽屉；输入字号 ≥16px 防 iOS 缩放；弹窗在手机端为安全区内全屏 / 底部抽屉，锁背景滚动；触区 ≥44px
- 桌面端 ≥1024px：三段式 grid 导航（品牌 / 导航组居中 / 账户与语言）
- 首页侧边浮动目录：桌面为线条式 sidebar，移动端为金色圆点竖列，滚过 Hero 后常驻
- 排版：`typography.tsx` 的 `noOrphan()` 在 CJK 标题插入 `nowrap` 分组，杜绝孤字；全局 `text-wrap: pretty`
- 动效：全部遵守 `prefers-reduced-motion`；装饰层 `pointer-events: none`；LCP 图 `fetchPriority="high"`，其余懒加载；长段落 `content-visibility: auto`

---

## 9. 本地开发与测试

```bash
bun install
bun run dev                 # 端口 8080
bun run build               # 生产构建
bunx vitest run             # 单元测试
bun run test:e2e:hall       # 众生之厅端到端
python tests/visual/run.py  # Playwright 视觉回归
```

环境变量（`.env` 自动生成，勿手改）：
`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID`；
服务端读取 `process.env.SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `LOVABLE_API_KEY` / `REPORT_GENERATION_MODE`。

自动生成、请勿手改：`src/routeTree.gen.ts`、`src/integrations/supabase/*`、`supabase/config.toml`、`.env`。

---

## 10. MCP 接入

```json
{
  "mcpServers": {
    "library-of-destiny": {
      "url": "https://cosmic-axis-hub.lovable.app/mcp"
    }
  }
}
```

首次调用走 OAuth 登录，返回 Supabase JWT。可用工具：

- `get_my_profile` —— 当前用户资料与会员等级
- `ask_oracle` —— 传入 `question`（及可选四传统命盘快照）获得神谕回答

---

## 11. 工作日志 Work Log

按迭代倒序记录，每条含**背景 → 改动 → 验证**。

### 2026-08 · README 与仓库整备
- 重写 README，补齐全部功能、路由、数据表、AI 成本策略与工作日志；同步至 GitHub 仓库 `bingjiez808-ui/cosmic-axis-hub`。

### 2026-08 · 好友系统从 Demo 升级为真实系统
- **背景**：`/me/friends` 仍是内存演示版，带 demo 横幅与模拟按钮。
- **改动**：新建 `friend_notes` 表、为 `community_notifications` 增加 `payload`；实现 `friends.functions.ts`（快照 / 邀请码 / 兑换 / 应答 / 移除 / 屏蔽 / 解封 / 举报 / 纸条）；UI 重写为「好友 / 待处理 / 纸条 / 屏蔽 / 收件箱」标签页，接入隐私同意闸门与分享链接自动填码。
- **修复**：`self_invite` 等预期校验不再跨服务端边界抛错导致白屏，改为结果返回并提示。
- **验证**：双账号 Playwright 全流程（生成码 → 兑换 → 成为好友 → 撤回 → 屏蔽解除好友 → 解封），测试数据已清理。

### 2026-08 · 安全加固（5 项扫描发现）
- 撤销内部 SECURITY DEFINER 触发函数对 `PUBLIC/anon/authenticated` 的 EXECUTE
- `community_posts` / `community_comments` 改列级 GRANT，移除 `user_id` 下发，改为服务端计算 `isMine`
- `community` 存储桶 SELECT 策略收紧为「本人上传或仍被未删除帖子引用」
- 全部标记 fixed，`tsgo --noEmit` 通过

### 2026-07/08 · 今日阅览室与 AI 成本优化
- 今日运势接入真实主命盘（`real-chart-daily.ts` + `daily-reading.functions.ts`），去除演示数据
- 重排两栏卡片，左侧分数轨、右侧叙述区，解决右侧大片留白
- AI 改为**手动触发 + 分段按需 + 按天缓存**，默认零成本
- 四维度详解改为弹窗（`DomainDetailDialog`），移除重复的白话账本区块
- 新增「样例预览」折叠开关，默认关闭并标注非本人数据
- 技术性文案替换为图书馆语气的馆员手记文案

### 2026-07 · 报告稳定性与排版
- 重复打开摘要不一致：命盘水合完成前禁止生成，规范化输入以 `genderOverride` 优先
- 每维度指数退避重试 + 失败降级 + `localStorage` 进度快照，刷新可续跑
- 报告模块字号 / 行距自适应（`clamp` / `em` / `lh`），大字号下仍等高不溢出
- 恢复首页侧边金点浮动目录导航，桌面与移动端同步验证

### 2026-07 · 开启仪式性能与稳定性
- 将报告 AI 生成从 `/synthesis` 移交 `/report`，过场时间由 ~10s 降至 ~7s
- `RitualMagicRings` 增加 3D 能力探测与 idle 挂载，移动端页面错误归零
- 性别改必填、增加命盘查重询问、必填项内联校验与测试

### 2026-07 · 众生之厅（匿名书信社区）
- 四种投递去向（同龄旅者 / 公共信墙 / 十二位先贤 / 管理员安排真人）
- 蜡封视觉体系、样例信件弹窗、投递进度条、回音 Toast、通知中心
- 敏感词审查、举报屏蔽、管理员审核后台与审计事件
- 回信额度双桶 + ¥3/¥10 真实支付加购；术语统一，移除"蒸馏"等内部词汇

### 2026-07 · 命运通识馆
- 数学馆 v2（人生函数曲线、七条生命线、年度雷达、选择实验室）
- 语文馆 3D 翻书界面；`CommonsHallNav` 统一导航
- 兑换码系统（`redeem_code` RPC + 管理后台发放）

### 2026-07 · 沉浸式开场与首页重构
- 全屏开场序幕：推门转场、雾气系统、3D 借阅证（含背面设计）
- Hero 主标题移动端自适应（`ResponsiveHeroTitle`）、背景视频移动端裁切去黑边
- 首页改为七张书签卡 + 抽屉式功能预览；移动端导航改两列底部抽屉

### 2026-07 · 会员与阅览室
- 会员判定集中到 `use-membership-tier.ts`；`room-access.ts` + `RoomLockedShell` 统一锁定预览
- 恢复三档会员价格表（纠正上一轮误删），新增 `MembershipCheckoutModal`
- 新建 `/me/sage`、重构 `/me/oracle`

### 2026-07 · 导航与信息架构
- 全局菜单精简为：导览室 / 开启仪式 / 四大体系 / 同门 / 关于 + 我的主页
- `/me/*` 统一 `PersonalLibraryShell`；术语统一为「个人书架 / Personal Library」→ 后续统一为「我的书架 / My Library」
- 修复登录与邮箱验证回跳（`site-url.ts` + `auth.callback.tsx`，去除硬编码域名）

### 2026-07 · 项目迁移审计
- 项目 ID 变更为 `ca717418-…`，后端 Supabase 沿用同一实例（数据共享）
- 清点旧域名引用，确认保留；GitHub 连接新仓库 `bingjiez808-ui/cosmic-axis-hub`
- 设置 `REPORT_GENERATION_MODE=deterministic`；隐藏 "Edit with Lovable" 徽标

---

## License

Private / All rights reserved.
