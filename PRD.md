# Library of Destiny · 产品需求文档 (PRD)

**产品名称**：Library of Destiny（命运图书馆）
**线上地址**：https://fate-nexus-ai.lovable.app
**文档版本**：v1.0
**最后更新**：2026-07-15
**文档负责人**：产品团队

---

## 1. 产品概述

### 1.1 一句话定位
一款融合 **西方占星 · 印度吠陀 · 中国八字 · 紫微斗数** 四大传统的 AI 命理解读 Web 应用，用户输入出生信息即可获得跨传统综合命盘报告，与四位"传统长老"AI 对话，抽塔罗，并可通过 MCP 协议将账号接入外部 AI Agent。

### 1.2 产品愿景
让古老的东西方命理智慧，通过 AI 与现代 Web 技术，成为当代人自我探索、决策辅助与精神慰藉的日常工具。

### 1.3 目标用户

| 用户画像 | 特征 | 核心诉求 |
| --- | --- | --- |
| **好奇型探索者**（25-35 岁） | 对占星 / 八字有兴趣但缺乏系统知识 | 快速、易懂、有趣的入门解读 |
| **深度研习者**（30-45 岁） | 已了解某一传统，想跨体系比较 | 权威、可对比、可深挖的多传统合参 |
| **人生决策者**（28-50 岁） | 面临重大选择（转行 / 婚恋 / 迁徙） | 具体、可执行的建议式神谕 |
| **AI 极客** | 熟悉 Claude Desktop / Cursor 等 MCP 客户端 | 将命理数据接入自己的 AI 工作流 |

### 1.4 竞品与差异化

| 竞品 | 我们的差异 |
| --- | --- |
| 传统单一体系 App（如 Co-Star、测测星座） | 四传统合参、AI 长老对话、MCP 开放接入 |
| 命理师人工咨询 | 即时、低价、可反复问、无社交压力 |
| ChatGPT 通用命理提问 | 结构化命盘、专属长老人格、诗意可执行的答复 |

---

## 2. 核心功能需求

### 2.1 功能地图

```text
┌─ 首页 (/) ─────────── 品牌开屏 + 入口
├─ 命盘生成 (/report) ─ 输入出生信息 → 四传统合一报告
├─ 长老对话 (/traditions) ─ 与四位 AI 长老分别问答
├─ 综合神谕 (/synthesis) ─ 跨传统综合答复
├─ 塔罗仪式 (/ritual) ─ 每月配额抽牌
├─ 社群 (/community) ─ 用户每日感悟分享
├─ 关于 (/about) ─ 项目故事
├─ 账号 (/auth) ─ 邮箱 / 手机 OTP / Google
├─ 管理后台 (/admin) ─ 仅 admin
└─ MCP 端点 (/mcp) ─ 外部 AI Agent 接入
```

### 2.2 P0 功能（MVP 必须）

#### F1. 用户认证
- **邮箱 + 密码**（Supabase Auth）
- **手机 + OTP**（自建，服务端 hash 校验）
- **Google OAuth**
- 未登录访问受保护路由自动跳 `/auth`
- **验收**：三种方式均可完成登录，session 持久化 7 天

#### F2. 命盘生成
- **输入**：姓名、出生日期、出生时间、出生地（城市下拉）、语言（中/英）
- **输出**：四传统合一 AI 报告（西方占星 / Vedic / 八字 / 紫微）
- **校验**：日期合法、城市必选、时间可选（不填按正午计算并标注）
- **验收**：15 秒内返回结构化 Markdown 报告，含核心行星 / Nakshatra / 四柱 / 紫微命宫

#### F3. 四长老对话
- 四个长老（Astrologer / Jyotish Sage / BaZi Master / Zi Wei Master）独立对话弹窗
- 每次对话携带用户命盘 context
- **验收**：长老回复保持角色人格，引用命盘元素

#### F4. 综合神谕 `ask_oracle`
- 用户提问 → AI 综合四传统给出诗意 + 可执行答复
- 登录后可用，服务端二次校验会员配额

#### F5. 塔罗仪式
- 78 张牌库，支持单牌 / 三牌 / 凯尔特十字
- 每月抽牌配额：`none: 3` / `sage: 30` / `oracle: unlimited`
- **验收**：配额消耗写入 `tarot_usage`，跨月自动重置

#### F6. 会员体系

| 等级 | 价格 | 塔罗/月 | 长老对话/日 | 高级模型 |
| --- | --- | --- | --- | --- |
| Free (none) | ¥0 | 3 | 5 | ❌ |
| Sage | ¥29/月 | 30 | 30 | ✅ |
| Oracle | ¥88/月 | ∞ | ∞ | ✅ + 优先队列 |

- 付费门在**服务端**二次校验（客户端仅显示层）

#### F7. MCP 开放接入
- `/mcp` 端点通过 Supabase JWT (OAuth 2.0) 保护
- 暴露工具：`get_my_profile`、`ask_oracle`
- 用户在 Claude Desktop / Cursor 配置 URL 即可接入

### 2.3 P1 功能（迭代）

- **F8. 社群分享**：用户发布每日感悟，点赞收藏
- **F9. 管理后台**：查看用户活跃、发放 / 撤销会员
- **F10. AI 头像生成**：根据命盘元素生成专属头像
- **F11. 关键事件时间线**：把用户提交的重要人生事件叠加到大运/流年上

### 2.4 P2 功能（规划）

- 合盘（两人命盘对比）
- 择日（服务端算法 + AI 解读）
- 移动端 App（React Native）
- 支付集成（Stripe / Paddle）

---

## 3. 非功能需求

### 3.1 性能指标

| 指标 | 目标 |
| --- | --- |
| 首屏 LCP | < 2.5s (P75) |
| 命盘生成 API | < 15s (P95) |
| 长老对话首 token | < 3s (P95) |
| SSR TTFB | < 800ms (P75) |
| 可用性 SLA | 99.5% |

### 3.2 安全需求
- 所有 `public` 表启用 RLS + 明确 GRANT
- 敏感操作走 `createServerFn` + `requireSupabaseAuth`
- `phone_otps` RLS 全拒绝，仅 service_role 通过服务端函数访问
- 付费门服务端二次校验
- Webhook 走 `/api/public/*` 并签名验证
- 用户角色存 `user_roles` 表（禁止存 `profiles`），通过 `has_role()` SECURITY DEFINER 检查

### 3.3 合规
- 中英双语支持（i18n）
- 出生时间不确定时明确标注解读局限
- 底部注明"仅供参考，不构成医疗 / 法律 / 投资建议"

### 3.4 可观测性
- 前端错误：Sentry（待接入，需用户提供 DSN）
- 关键事件埋点：`user_activity` 表
- AI Gateway 请求日志：Lovable 平台自带

---

## 4. 技术架构

### 4.1 技术栈
- **框架**：TanStack Start v1（React 19 + Vite 7 + SSR）
- **样式**：Tailwind CSS v4 + shadcn/ui
- **后端**：Lovable Cloud（Supabase 托管）
- **服务端逻辑**：`createServerFn`（`src/lib/*.functions.ts`）
- **AI**：Lovable AI Gateway
- **MCP**：`@lovable.dev/mcp-js`，Supabase JWT OAuth
- **运行时**：Cloudflare Workers（`nodejs_compat`）
- **测试**：Vitest + Playwright

### 4.2 数据模型

| 表 | 用途 | 关键字段 |
| --- | --- | --- |
| `profiles` | 用户资料 | id, email, phone, display_name, membership_tier, membership_expires_at |
| `user_roles` | 角色 | user_id, role (admin/user) |
| `phone_otps` | 手机验证码 | phone, code_hash, expires_at, attempts |
| `tarot_usage` | 抽牌配额 | user_id, month, count |
| `user_activity` | 访问埋点 | user_id, path, activity_date |

### 4.3 关键流程

**命盘生成**：
```text
Client → createServerFn(generateReport)
     → requireSupabaseAuth 中间件
     → 校验会员配额
     → AI Gateway (Lovable AI)
     → 返回结构化 Markdown
     → 客户端 render + 缓存到 account context
```

**MCP 调用**：
```text
Claude Desktop → /mcp (OAuth) → Supabase JWT 验证
              → 工具路由 (get_my_profile / ask_oracle)
              → 使用用户 token 的 Supabase client
              → 返回结构化响应
```

---

## 5. 用户体验规范

### 5.1 设计原则
- **神秘而现代**：深色调 + 星空/古籍质感，避免廉价"算命摊"视觉
- **诗意胜过精准**：文案偏文学化，慎用"你命里注定"等断言
- **可执行**：每次解读末尾给出 1-3 条本周 / 本月可行动建议

### 5.2 关键页面要求
- **首页**：15 秒内说清"这是什么、我能得到什么、如何开始"
- **命盘报告**：Markdown 分区折叠，图表可视化四传统核心
- **长老对话**：气泡区分角色，长老头像 + 传统符号
- **塔罗**：翻牌动画 < 1.5s，解读文案不超过 300 字

---

## 6. 里程碑

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| **M1 · MVP** | F1-F6 上线 | ✅ 已完成 |
| **M2 · 开放** | F7 MCP 接入 | ✅ 已完成 |
| **M3 · 迭代** | F8-F10 社群与管理 | 🟡 进行中 |
| **M4 · 商业化** | 支付集成 + Sentry 监控 | 🔵 规划中 |
| **M5 · 扩展** | 合盘 / 择日 / 移动端 | ⚪ 规划中 |

---

## 7. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| AI 回答"过于神棍"引起用户反感 | 品牌形象 | 系统提示词强约束 + 底部免责声明 |
| 命理内容合规风险（部分地区敏感） | 上线受阻 | 地域检测 + 内容降级 + 明确"娱乐用途" |
| AI Gateway 成本失控 | 财务 | 服务端配额 + 会员分级 + 缓存热门问答 |
| Cloudflare Workers Node 兼容限制 | 技术 | 避免 Node-only 依赖，参考 server-runtime 白名单 |
| 用户隐私（出生信息敏感） | 法务 | RLS 严格隔离，不做跨用户查询，不训练模型 |

---

## 8. 成功指标（North Star & KPI）

**北极星指标**：**周活跃深度用户数**（一周内完成 ≥1 次命盘 + ≥1 次长老对话）

| 指标 | 目标（3 个月内） |
| --- | --- |
| DAU | 1,000 |
| 注册转化率（访客→注册） | ≥ 15% |
| 命盘完成率（注册→生成命盘） | ≥ 60% |
| 付费转化率（注册→Sage/Oracle） | ≥ 3% |
| D7 留存 | ≥ 25% |
| MCP 接入用户 | ≥ 100 |

---

## 9. 附录

### 9.1 术语表
- **命盘**：出生时刻的星体 / 干支 / 星曜结构快照
- **Nakshatra**：印度吠陀 27 星宿
- **四柱 / 八字**：年月日时天干地支
- **紫微命宫**：紫微斗数十二宫之本命宫
- **MCP**：Model Context Protocol，AI Agent 工具接入协议

### 9.2 相关文档
- 项目 README：`README.md`
- 代码规范：`AGENTS.md`
- 数据库迁移：`supabase/migrations/`
- 视觉测试：`tests/visual/README.md`

---

**文档结束**
