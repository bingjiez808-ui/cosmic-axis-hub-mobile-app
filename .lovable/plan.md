# 趣味图书馆 V1 · 藏书人格

不改现有五个模块职责；不动数据库；不发布；不创建 variant。本地持久化 MVP + 云端 migration 草案（不执行）。

## 一、算法模块（纯本地，可测）

新建 `src/experiences/fun-library/personality/` 目录：

- `types.ts` — Axis (`M|L`, `E|T`, `A|C`, `F|O`)、Answer、Result 类型。
- `quiz.ts` — 12 题 × 4 选项题库，中英文完整；每选项 `weights: { ML,ET,AC,FO }`（-2…+2 整数）。每轴 ≥6 题命中，正负权重总量平衡。
- `scoring.ts` — 纯函数 `scoreReadingPersonality(answers, quizVersion?)`：
  - 累计四轴分；输出 raw、normalized(0-100)、code(4字母)、version；
  - 平分时以 sha256(canonical(answers)+quizVersion) 首字节奇偶为 tie-breaker（稳定）；
  - 版本常量 `QUIZ_VERSION="quiz_v1"`, `SCORING_VERSION="score_v1"`。
- `types-catalog.ts` — 16 种代码 → {name, literaryTitle, abstractTitle, howYouRead, moments[3], oftenMisread, gentleAdvice, coRead[2], misRead[2]}；文案手写、彼此可辨。
- `bookcover.tsx` — 参数化 SVG 封面（黑金底、四轴决定纹理/书脊/符号/光晕/边框）。
- `personality.test.ts` — 覆盖：16 类型全部可达（构造答案组合）、同答案幂等、修改答案按矩阵变化、tie-break 稳定、零网络（monkey-patch fetch 抛错）。

## 二、准入与路由

- 新建 `src/routes/_authenticated/me.fun-library.tsx`：
  - 未登录：`_authenticated` 已 redirect；
  - 加载 `listUserCharts()` → 判定 `primaryChart = self+is_primary`；
  - 无任何命盘：显示 "为何需要主命盘" + CTA `开启仪式(/ritual)`；
  - 只有他人命盘：明确文案（不可用他人命盘测试）+ CTA `前往命盘与报告(/me/profile)`；
  - 有主命盘：渲染 `<FunLibraryFlow chart={primaryChart}/>`。
- `PersonalWorkspaceNav.tsx` 新增第 6 项 `fun-library`，带 New/新 徽标。
- `__root.tsx` 「我的书架」下拉与移动端手风琴新增该项。
- `/me/home` 增加一张简短 CTA「领取属于你的那本书 → /me/fun-library」（不嵌测试内容）。

## 三、测试 UI

`src/experiences/fun-library/` 组件：

- `FunLibraryFlow.tsx` — 状态机：intro → quiz(0..11) → review → result。localStorage 缓存 answers（键含 userId+primaryChartId+quizVersion）。
- `QuizStep.tsx` — 单题单屏（393 优先）；轻翻页/印章动画（reduced-motion 关闭）；上一题；进度 12/12；aria-live。
- `ResultView.tsx` — SVG 书封 + 四轴「书签罗盘」+ 文艺/抽象书名切换（本地状态，不改分）+ 3 张翻页卡 + 「测试中的你 vs 主命盘底色」对照。
- 对照区严格：只读 primaryChart 已存在字段（day-master/元素分布等来自 `calc-snapshot`），FACTS 不足显示「资料不足，暂不对照」。绝不 AI/网络。
- 「保存到我的书架」→ localStorage；「分享卡预览」用户主动触发，默认不含 PII。

## 四、缓存与隐私

- 本地 key: `funlib:${userId}:${primaryChartId}:${QUIZ_VERSION}:${SCORING_VERSION}` → { answers, result, savedAt }。
- 更换主命盘时（chartId 不匹配）显示「旧结果属于旧主命盘，可重新测试」。
- 不 log 答案；不发到 AI。
- `.lovable/plan.md` 追加最小 migration 草案 `fun_library_results` 表（user_id, chart_id, quiz_version, scoring_version, code, answers jsonb, RLS owner-only），标注「未执行」。

## 五、i18n & 术语

- 中：趣味图书馆 / 英：Fun Library。
- 用户可见文案零内部轴代码（M/L 等仅 dev/test 可见）。

## 六、验收

- `tsgo --noEmit` + `bunx vitest run src/experiences/fun-library`;
- Playwright 手动截图 1440 & 393：未登录 redirect、无主命盘拦截、有主命盘完成流、结果一致性、文艺/抽象切换。

## 技术细节

- 复用 `src/experiences/library-v2/motion/reduced-motion.ts`。
- `PersonalWorkspaceNav.Item` 联合类型扩展 `/me/fun-library`。
- 分享卡：`html2canvas` 不引入；用可下载 SVG。
- 无新依赖。
