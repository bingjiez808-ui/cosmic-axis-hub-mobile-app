
## 目标

只在本轮完成：馆门打开→馆内视频背景→七张 Scroll Stack 卡片首页，去重现有重复模块，保留全部业务逻辑/路由/handler。**不实现 Lanyard 借阅证**。

## 一、审计结果（不修改，仅确认复用）

现首页 `src/routes/index.tsx` 已使用的组件与去向：

| 现有模块 | 去向 |
|---|---|
| `LibraryEntrance`（开屏） | 保留原样，卡片首页作为下一层 |
| `ConcernSelector`（问题选择） | 移入 **卡片 01**，删除页面独立段 |
| `FeatureLibraryShelf`（六本书）| 拆入 **卡片 02/03/04/05**（各自路由 CTA），首页不再单独渲染 |
| `PlayfulLibrarySection`（命运通识馆入口） | 移入 **卡片 06** |
| `PostRitualRoomsSection`（四藏室） | 拆合并进 **卡片 03/04/05/07**（塔罗、时间轴、贤者/神谕者） |
| `HomePersonalDeskTeaser` / trust-bridge / 会员段 / `CuratorLetter` | 会员段并入 **卡片 07**；Curator 与 trust-bridge 作为 Scroll Stack 之后的收束页脚保留 |
| `PremiumReportCta` | 复用于 **卡片 03** CTA |
| `resolveCta`（`src/lib/home-cta.ts`） | 七张卡的登录/命盘/会员判断统一走它，不复制第二套 |
| `useSupabaseSession` + 现有主命盘 hook（沿用 `resolveCta` 的入参） | 复用 |

路由复用（全部现有）：`/ritual`, `/report`, `/me/home`, `/me/echoes`（时间轴）, `/me/oracle`（塔罗 / 神谕者）, `/me/sage`, `/me/membership`, `/life-studies`（命运通识馆）。不新建任何路由。

## 二、视频资源

- 使用用户上传的 `library-interior-desktop.mp4` / `library-interior-mobile.mp4` / `library-interior-desktop-poster.webp` / `library-interior-mobile-poster.webp`，通过 `lovable-assets` 上 CDN，生成 `.asset.json` 指针于 `src/assets/library-interior/`。
- 组件 `LibraryInteriorBackdrop`：
  - `<video muted autoPlay loop playsInline preload="metadata" object-cover>` 加 poster。
  - JS 依据 `(max-width:640px)` 选桌面/移动源。
  - `onError` → 隐藏 video 显 poster。
  - `prefers-reduced-motion` → 只渲染 poster `<img>`。
  - `position: fixed inset-0 -z-10 pointer-events-none`，滚动不重挂载。
  - 三层可读性：顶/底渐变 + 黑金半透明遮罩 + 卡片自带 `backdrop-blur`。

## 三、Scroll Stack 组件

不装 npm 包。直接把 React Bits 官方 ScrollStack（TS + Tailwind）源码抄入 `src/components/scroll-stack/ScrollStack.tsx`，仅保留 rAF + IntersectionObserver 的堆叠逻辑；不引第三方依赖。

- 桌面：`max-w-[1240px]`, `clamp(520px,68vh,760px)`, 卡片粘性堆叠，`scale/brightness` 微变（±3%），无旋转。
- 移动：单列，`min-h`-驱动，sticky 弱化（`top: 12vh`）。
- `prefers-reduced-motion` → 关掉 sticky + scale，降级为普通列表。
- 键盘 Tab 可达；卡片 focus 时更新进度指示。
- 不锁 body、不劫持触控。

## 四、七卡数据源

新建 `src/lib/home-guide-cards.ts` 定义 `HomeGuideCard[]`，字段：id、序号、双语标题/一句话、access（open/basic/sage/oracle/coming）、CTA 目标（走 `resolveCta`）、可视化组件 key。JSX 只做映射，不复制七段。

七张卡 & 复用：

1. **今天你带着什么问题** → 复用 `ConcernSelector`（作为 Dialog 打开）
2. **建立我的命盘** → `/ritual` 或 `/me/home`（`hasPrimaryChart` 判断）
3. **阅读综合解读** → `PremiumReportCta` + `/report`
4. **沿时间寻找证据** → `/me/echoes`
5. **塔罗 · 第二位证人** → `/me/oracle`（塔罗子段）
6. **命运通识馆** → `/life-studies`，六馆状态显示
7. **贤者与神谕者阅览室** → `/me/membership`（简介 + 两扇门）

每卡视觉小组件放于 `src/components/scroll-stack/visuals/`（Card01Spines、Card02Astrolabe、…），均为轻量 SVG。

## 五、进度导航

`src/components/scroll-stack/StackProgress.tsx`：桌面右侧 7 点书签（hover 展开），移动底部 Drawer "第 X / 共 7"。scroll 到对应 `id`。

## 六、首页组装

重写 `src/routes/index.tsx`：

```
<LibraryEntrance />
<LibraryInteriorBackdrop />
<GuideDeskHero />            // 55–70vh，导览台欢迎语 + 「开始翻阅」
<HomeScrollStack cards={...} />
<CuratorLetter /> + 页脚品牌/免责
<StackProgress />
```

删除首页里 `ConcernSelector`、`FeatureLibraryShelf`、`PlayfulLibrarySection`、`PostRitualRoomsSection`、`HomePersonalDeskTeaser`、独立会员段和 trust-bridge 段的重复渲染。组件文件本身**不删除**（其他路由或未来可能复用）。

## 七、i18n

`useLang` 已有 `t`。新增所需的 key 到 i18n 字典（`hero_guide_desk_*`、七卡的 `home_card_XX_title/desc/cta` 等）。

## 八、验收

- typecheck。
- Playwright 快速跑一次：桌面 1280、移动 390，验证：进入馆门→视频背景→七卡滚动→CTA 跳转正确路由。
- 检查无 console error、无重复请求。

## 本轮不做

- Lanyard 借阅证（下一轮）
- 视频文件之外的新素材生成
- 支付弹窗、会员逻辑改动
- 现有业务组件的内部改动

—— 批准后直接开工。
