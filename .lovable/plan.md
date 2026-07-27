
# 首页获客与阅读路径重构（V1 直改）

在同一 V1 主项目、基于 commit `63cf7574` 之上直接编码；不建 V2/variant、不发布、不删除任何现有用户数据。目标：新访客 6 秒内知道"这里能帮我看什么、值不值得继续、下一步点哪里"。

## 一、新增基础数据层：`src/lib/concern-guidance-v1.ts`

纯确定性数据模块，0 AI，同输入一致，可测试。

- `CONCERN_KEYS = ["study","career","love","relationships","finance","self_family","overview"]`（enum + guard `isConcernKey`）。
- 每个 concern 双语记录：
  - `question`（首屏问题句）
  - `situationalResponse`（2–3 句抚慰段，按用户在需求书中给出的示范同等级写作，事业/爱情/学业采用其原文）
  - `featureBullets`（4–5 条命运图书馆可以陪你看的功能点）
  - `sampleOutput`（一段真实格式示例片段，非 AI 生成）
  - `ctaLabel` + `nextStepHint`（"下一步将登记出生资料，生成后优先打开【模块】"）
  - `targetSection`（用于 `/report?focus=<section>`；section id 白名单：`overview | study | career | love | relationships | finance | timeline | self`）
- `dailyCounselTemplates`：`concern × dailyBand(low|neutral|high) × priorityDomain` → { line1 回应, line2 结合今日, line3 可执行小动作 }，双语，确定性。
- `resolveConcernRoute({ concern, isSignedIn, hasPrimaryChart, existingReportId })` 返回一个已白名单校验的目标 URL：
  - 未登录 → `/auth?mode=signup&redirect=/ritual?concern=<k>`
  - 已登录无主盘 → `/ritual?concern=<k>`
  - 已登录有主盘 + 有已完成报告 → `/report?id=<...>&focus=<section>`
  - 已登录有主盘无报告 → `/me/home?concern=<k>#curator-welcome`（保底真实存在的路由）
- 迁移 `onboarding_intent`：保留旧值，作为"你此刻需要怎样被陪伴"次级信息，不再是首页主入口。

**校验：** section id 必须先在 `PremiumReportReader` 现有章节列表中确认后再写入白名单；`concern` 从 URL 读入时必过 `isConcernKey` 才使用。

## 二、数据库迁移（单文件）

`user_preferences` 追加：
- `concern text` + CHECK 值在 7 个 concern key 中
- `concern_at timestamptz`
保留 `onboarding_intent` 字段，不动旧数据；owner-only RLS 已存在，无需改。

服务端函数 `src/lib/life-guidance.functions.ts` 新增 `setConcern({ concern })`（校验 enum，写入 `user_preferences`）；`getLifeGuidancePrefs` 已 select 全表，自动带出 `concern`。

未登录时 concern 存 `sessionStorage`（key `fnx.concern.v1`），登录/回到 `/me/home` 后一次性迁移调用 `setConcern` 并清空。

## 三、首页 `/` 重排

`src/routes/index.tsx` 现有品牌视觉保留；重排信息架构：

1. **6 秒首屏 Hero**：品牌句 + 价值句 + 主 CTA "带着我的问题，开始阅读"（滚动锚到 `#concern`）+ 次级 CTA "先看看图书馆能回答什么"（锚到 `#library-shelf`）+ 一行 4 项信任条。移除首屏"四根梁柱/八个切面"展开内容。
2. **馆长序言 `CuratorLetter`**：保留仪式，但第 3 页 `IntentPicker` 从"方向/勇气/平静/连接"改为下沉次级问答"你此刻需要怎样被陪伴"（保留旧 4 项作为 companion intent，仍写 `onboarding_intent`），主选择移出到序言之后的独立 `ConcernSelector` 区块。
3. **`ConcernSelector`（新组件，id=`concern`）**：7 个问题入口。移动端 2 列纵向书签，桌面左侧问题书签、右侧即时展开的 `ConcernResponsePage`；选择原地展开，不跳页。
4. **`ConcernResponsePage`（新组件）**：渲染 situationalResponse + featureBullets + sampleOutput + CTA + nextStepHint。CTA 调用 `resolveConcernRoute` 并 `setConcern`（登录）或 sessionStorage（未登录）。
5. **`FeatureLibraryShelf`（新组件，id=`library-shelf`）**：6 本"书"（认识自己 / 学业成长 / 事业道路 / 爱情关系 / 财富路径 / 人生时间轴），已选 concern 对应书脊发光并排首，顶部标 "根据你刚才的问题，建议先从这里读起"。每本书点开展开"3 个能回答的问题 + 格式示例 + 完成命盘后阅读我的这一章"CTA。展示会员锁点（免费 vs ¥79），不触发假支付，沿用现有 `MockPaymentModal`。
6. **信任条 + 四体系入口**：一句 "不是用一句星座标签定义你…" + CTA "了解四大体系如何共同阅读" → `/traditions`。删除首页现有"四根梁柱""八个切面"详细展开。

## 四、`/traditions` 承接专业内容

把从首页下沉的"四根梁柱 / 四大体系 / 八个切面 / 确定计算 vs AI 解释 / 冲突与置信度"整理进 `src/routes/traditions.tsx`，顺序按用户需求书。保留原有内容与 SEO meta。

## 五、`/ritual` 承接 concern

`validateSearch` 增加 `concern` + `returnTo`（同源白名单）。保存主盘完成后按 `resolveConcernRoute` 跳转；未通过白名单则回落 `/me/home`。

## 六、`/me/home` 馆长留言三层

现有 `CuratorWelcomeBookmark` 升级为 `DailyCuratorCounsel`：
- 输入：`concern`（优先） / 兼容旧 `onboarding_intent`、今日 `priorityDomain`、今日整体 band。
- 输出三层：回应用户 concern → 结合今日真实数据 → 一条可执行小动作。全部走确定性模板。
- 按钮改为："查看今天为什么这样判断"（展开分数账单） / "继续阅读我的【对应主题】"（→ `resolveConcernRoute`） / "我现在关心的已经变了"（原地打开 concern 重选并 `setConcern`）。
- 无 concern 也无 intent 时提示"让馆长知道你此刻最需要什么"，展开 7 项。
- 首次到达 `/me/home` 若 `sessionStorage` 有未迁移 concern，自动 `setConcern` 后清空。

## 七、组件文件结构

```
src/lib/
  concern-guidance-v1.ts
  concern-guidance-v1.test.ts
src/experiences/concern-guidance/
  ConcernSelector.tsx
  ConcernResponsePage.tsx
  FeatureLibraryShelf.tsx
  FeatureBook.tsx
  DailyCuratorCounsel.tsx
```

UI 组件不计算命理事实，只消费 props 或纯 lib 输出。

## 八、无障碍 / 移动端

- 每个 CTA 有可见"下一步会看到什么"副文本 或 `aria-description`。
- 触控 ≥44px；移动端固定底部主 CTA 在 safe-area 上方且不遮正文；无横向溢出。
- 禁用 `#traditions` 等无效锚；所有 hash 指向真实 id。
- `reduced-motion` 分支已复用现有 `useReducedMotion`。
- 双语通过 `useLang()`。

## 九、测试（bun test）

- `concern-guidance-v1.test.ts`：7 concern × 2 lang 字段完整、路由映射白名单、`resolveConcernRoute` 覆盖 signed-in/out × chart/no-chart × report/no-report、`dailyCounselTemplates` 同输入一致。
- `ConcernSelector` 组件：选择后 `setConcern`（登录 mock）/ sessionStorage（未登录）。
- 首页不再包含"四根梁柱""八个切面"字符串（快照断言）。
- `/traditions` 仍包含相关内容。
- `DailyCuratorCounsel` 无 raw key、无随机。
- CTA href 不含 `#traditions` 无效锚。
- 首页 hero 主品牌句/价值句/两个 CTA/信任条同屏渲染。

## 十、验证

`bun test` → `bunx tsgo --noEmit` → `bun run build`。同一 id-preview 手动走 6 条真实路径。输出 commit SHA、迁移摘要、变更文件清单、每条路径实际 URL。**不发布生产。**

## 技术细节

- 兼容旧 `onboarding_intent`：不删除字段与 UI 消费点，只降级为次级 companion 选择；旧用户 `welcomeBack(intent)` 逻辑保留，在 concern 缺失时 fallback。
- Section id 白名单来源：先 `code--view` `src/components/PremiumReportReader.tsx` 与 `src/lib/reader-nav.ts` 确认实际 section id，再固化到 `concern-guidance-v1.ts`。若某 concern 对应 section 不存在，`resolveConcernRoute` 保底跳 `/report` 首屏或 `/me/home`，绝不生成 dead link。
- `returnTo` / `redirect` 严格同源前缀 `/` 起始 + 无 `//`；`concern` 参数只接受 `isConcernKey` 通过的值。
- 迁移遵循规范：`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + CHECK；无需新 GRANT（表已存在）。

预计新增/修改约 12 个文件 + 1 迁移。工作量大但边界清晰，实施期间会分阶段跑测试。
