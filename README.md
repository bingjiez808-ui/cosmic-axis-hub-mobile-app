# Library of Destiny (命运图书馆)

一个融合 **西方占星 · 印度吠陀 · 八字 · 紫微斗数** 四大传统的 AI 命理解读应用。用户输入出生信息即可获得跨传统综合报告，与四位"传统长老"AI 对话，抽塔罗，并可通过 MCP 协议将账号数据接入外部 AI Agent（Claude Desktop / Cursor 等）。

线上：https://fate-nexus-ai.lovable.app

---

## ✨ 核心功能

| 模块 | 说明 |
| --- | --- |
| **命盘生成** | 输入姓名 / 出生日期时间 / 出生地，生成四传统合一的命理报告 |
| **传统长老对话** | 与占星师、Jyotish 圣哲、八字师、紫微斗数师分别问答 |
| **神谕问答** | 综合四传统给出诗意可执行的答复（`ask_oracle`） |
| **塔罗仪式** | 每月配额制的牌阵抽取与解读 |
| **社群** | 用户分享每日感悟 |
| **会员** | Free / Sage / Oracle 三档，含配额与高级模型 |
| **管理后台** | 管理员可查看用户活跃、发放会员 |
| **MCP 服务器** | `/mcp` 端点通过 Supabase OAuth 保护，外部 Agent 可调用 `get_my_profile`、`ask_oracle` |

---

## 🧱 技术栈

- **框架**：TanStack Start v1（React 19 + Vite 7 + SSR）
- **样式**：Tailwind CSS v4（`src/styles.css` 中 `@theme` 变量）+ shadcn/ui
- **后端**：Lovable Cloud（Supabase 托管）—— Auth / Postgres + RLS / Storage
- **服务端逻辑**：`createServerFn`（`src/lib/*.functions.ts`）；Webhook / 公共 API 走 `src/routes/api/`
- **AI**：Lovable AI Gateway（`src/lib/ai-gateway.server.ts`）
- **MCP**：`@lovable.dev/mcp-js`，Supabase JWT 作为 OAuth issuer
- **运行时**：Cloudflare Workers（`nodejs_compat`）
- **测试**：Vitest（`src/lib/tarot-quota.test.ts`）+ Playwright 视觉测试（`tests/visual/`）

---

## 📁 目录结构

```
src/
├── routes/                    # 文件式路由（自动生成 routeTree.gen.ts，勿手改）
│   ├── __root.tsx             # 全局 shell、<head> 元数据、Outlet
│   ├── index.tsx              # 首页
│   ├── report.tsx             # 命盘报告
│   ├── traditions.tsx         # 四传统长老对话
│   ├── synthesis.tsx          # 综合神谕
│   ├── ritual.tsx             # 塔罗仪式
│   ├── community.tsx          # 社群
│   ├── about.tsx              # 关于
│   ├── auth.tsx               # 登录 / 注册（邮箱 + 手机 OTP + Google OAuth）
│   ├── _authenticated/        # 登录守卫子树
│   │   ├── route.tsx          # 未登录跳 /auth
│   │   └── admin.tsx          # 管理后台
│   ├── api/                   # 服务端路由（webhook / 公共 API）
│   │   └── generate-avatar.ts
│   ├── mcp.ts                 # MCP HTTP 端点
│   ├── [.mcp]/                # MCP 工具调用与列表
│   ├── [.well-known]/         # OAuth 元数据发现
│   └── sitemap[.]xml.ts       # 站点地图
│
├── lib/
│   ├── account.tsx            # 账号 / 会员 / 已保存报告 Context
│   ├── i18n.tsx               # 中英双语
│   ├── session.ts             # Supabase session 辅助
│   ├── report.functions.ts    # 生成命盘报告（服务端）
│   ├── oracle.functions.ts    # 神谕问答（服务端 + 鉴权）
│   ├── phone-auth.functions.ts# 手机 OTP 发送/验证
│   ├── key-events.functions.ts# 关键事件日志
│   ├── admin.functions.ts     # 管理员操作
│   ├── ai-gateway.server.ts   # Lovable AI Gateway 封装（服务端专用）
│   ├── planet-reading.ts      # 行星速算
│   ├── lunar.ts               # 农历/八字换算
│   ├── tarot-deck.ts          # 塔罗牌库
│   ├── tarot-quota.ts         # 每月抽牌配额
│   ├── report-input.ts        # 输入校验
│   ├── cities.ts              # 出生地下拉数据
│   ├── error-capture.ts       # 前端错误上报
│   └── mcp/
│       ├── index.ts           # MCP 服务器定义（OAuth issuer = Supabase）
│       └── tools/
│           ├── get-my-profile.ts
│           └── ask-oracle.ts
│
├── components/
│   ├── AccountModal.tsx       # 账号弹窗（登录/资料/头像）
│   ├── TraditionModal.tsx     # 长老对话弹窗
│   ├── CityCombobox.tsx       # 城市检索
│   ├── LibrarySplash.tsx      # 首页开屏
│   ├── ReportExtras.tsx       # 报告附加信息（付费门）
│   ├── charts/DestinyCharts.tsx
│   └── ui/                    # shadcn/ui 组件
│
├── integrations/supabase/     # 自动生成，勿手改
│   ├── client.ts              # 浏览器 client
│   ├── client.server.ts       # 服务端 admin client
│   ├── auth-middleware.ts     # requireSupabaseAuth
│   ├── auth-attacher.ts       # 客户端携带 bearer token
│   └── types.ts               # 数据库类型
│
├── hooks/use-mobile.tsx
├── styles.css                 # Tailwind v4 主题变量与 @import
├── router.tsx                 # 路由 + QueryClient 上下文
├── start.ts                   # createStart（挂 auth-attacher middleware）
└── server.ts                  # SSR 入口（错误包装）

supabase/
├── config.toml                # 自动生成，勿手改
└── migrations/*.sql           # 数据库迁移

tests/
└── visual/                    # Playwright 视觉测试
```

---

## 🗄 数据库表

- `profiles` —— 用户资料 + 会员等级（`none` / `sage` / `oracle`）
- `user_roles` —— 角色（`admin` / `user`），通过 `has_role()` SECURITY DEFINER 检查
- `phone_otps` —— 手机验证码（服务端 hash 校验，无客户端策略）
- `tarot_usage` —— 每月塔罗抽牌次数
- `user_activity` —— 用户访问路径埋点

所有 `public` 表已启用 RLS + 明确 GRANT。

---

## 🔐 认证方式

1. **邮箱 + 密码**（Supabase Auth）
2. **手机 + OTP**（自建，`phone-auth.functions.ts`）
3. **Google OAuth**（Supabase 社交登录）

MCP 端点 `/mcp` 使用 Supabase JWT，通过 OAuth 2.0 Protected Resource Metadata 暴露 issuer。

---

## 🚀 开发

```bash
# 安装
bun install

# 本地开发（端口 8080）
bun run dev

# 生产构建
bun run build

# 单元测试
bunx vitest run

# 视觉测试
python tests/visual/run.py
```

**环境变量**（`.env` 自动生成，勿手改）：
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID`
- 服务端使用 `process.env.SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`

---

## 🤖 MCP 接入

在 Claude Desktop / Cursor 中配置：

```json
{
  "mcpServers": {
    "library-of-destiny": {
      "url": "https://fate-nexus-ai.lovable.app/mcp"
    }
  }
}
```

首次调用会走 OAuth 弹窗登录，返回 Supabase JWT。可用工具：

- `get_my_profile` —— 返回当前用户的资料与会员等级
- `ask_oracle` —— 传入 `question`（及可选的四传统命盘快照）获得神谕回答

---

## 🔒 安全

- 所有敏感操作走 `createServerFn` + `requireSupabaseAuth` 中间件
- `phone_otps` 表 RLS 全部拒绝，仅 `service_role` 通过服务端函数访问
- AI 端点全部要求登录 + 配额检查
- 付费门在服务端二次校验（客户端仅显示层）
- Webhook / 公共 API 位于 `src/routes/api/public/*`，签名校验后处理

---

## 📤 推送到 GitHub

Lovable 使用**双向同步**，在编辑器内完成即可（无需本地 git 命令）：

1. 编辑器左下角聊天输入框 → **+** → **GitHub** → **Connect project**
2. 授权 Lovable GitHub App，选择账号 / 组织
3. 点击 **Create Repository**

之后：
- Lovable 中的每次改动 → 自动 push 到 GitHub
- GitHub / 本地 IDE 的 commit → 自动同步回 Lovable

⚠️ Lovable 目前**不支持直接导入已有的 GitHub 仓库**，只能新建。

如需再镜像到 GitLab / Gitee：
```bash
git clone <github-url>
cd <repo>
git remote add mirror <your-mirror-url>
git push mirror --all && git push mirror --tags
```

---

## 📄 License

Private / All rights reserved.
