## 目标

用真正的 React Bits `ScrollStack + Lenis` 重构馆内首页，把七张卡做成"功能索引卡 + Drawer 抽屉"，Drawer 内直接复用现有的 `ConcernSelector` / `FeatureLibraryShelf` / `DestinyCommonsGrid` / `PostRitualRoomsSection` / `HomePersonalDeskTeaser` 等原组件，不复制第二套数据、状态、路由或支付逻辑。

## 一、依赖与源码接入

1. `bun add lenis`。
2. 新建 `src/components/react-bits/ScrollStack/ScrollStack.tsx`（附件源码 TSX 化，保留全部计算逻辑，去掉不需要的 `useWindowScroll=false` 分支里的 wrapper Lenis，避免与全局竞争；桌面 `useWindowScroll={true}`）。
3. 新建 `src/components/react-bits/ScrollStack/ScrollStack.css`（附件原样）。
4. 全局 Lenis 审计：搜索 `new Lenis`，若已有则改为共用；否则由 ScrollStack 自己创建 window Lenis 且卸载时销毁。
5. `prefers-reduced-motion` / 移动端触摸：`syncTouch` 保留但 reduced-motion 时直接不初始化 Lenis，卡片按普通纵向渲染。

## 二、开场文案恢复

`GuideDeskHero` 组件重写：
- 中文主标题：`每一种文明，都在追问` 换行 `<em class="gold italic">同一个问题。</em>`
- 英文对应翻译（用现有 `useLang`）。
- 副标题：学业/事业/爱情/关系/财富/人生阶段 …
- 小字提示：向下翻阅七张索引卡；点击可打开完整馆藏。
- 字号 clamp 按要求；视频背景下方加 `linear-gradient(to top, rgba(0,0,0,0.85), transparent)` 遮罩。

## 三、七张索引卡

沿用 `HOME_GUIDE_CARDS`（现已存在），把每张卡改成瘦身版：编号 / 标题 / 一句价值 / 状态徽章 / 打开馆藏按钮 / 局部纹理。**卡片点击不再走 `resolveCta` 跳路由**，而是 `openFeature(id)` 打开 Drawer。真正的导航 CTA 仍走 `resolveCta`，放在 Drawer 内部。

七卡与 Drawer 内容映射：

| # | 卡 | Drawer 内复用组件 |
|---|---|---|
| 01 | 今天的问题 | `<ConcernSelector />` 完整原组件 |
| 02 | 建立命盘 | 简介 + resolveCta 按钮跳 `/ritual` 或 `/me/home` |
| 03 | 综合解读 | `<PremiumReportCta />` |
| 04 | 图书馆的六本书 | `<FeatureLibraryShelf />`（新加） |
| 05 | 命运通识馆 | `<DestinyCommonsGrid />` 或 `<PlayfulLibrarySection />` 原版 |
| 06 | 四间特别藏室 | `<PostRitualRoomsSection />` 原版 |
| 07 | 个人书架 | `<HomePersonalDeskTeaser />` 原版 |

*会员/塔罗/时间轴等原本在 07 位置的门牌，全部并入 06 的 `PostRitualRoomsSection`（它已经包含四藏室 + 会员共享结算）。*

如任一原组件目前含"卡片下方 inline 展开"，改由 Drawer 承载，卡本身只做入口。

## 四、Drawer 统一容器

新建 `src/components/home-v2/LibraryFeatureDrawer.tsx`：
- 底层用 shadcn `Sheet`（已存在），桌面 `side="right"`、`className="w-[min(1180px,92vw)] sm:max-w-none"`；移动 `side="bottom"` 全屏 `h-[100dvh]`。
- Props: `open / onOpenChange / title / eyebrow / status / children / primaryAction / secondaryAction`。
- Header sticky，内容区 `overflow-y-auto`，底部 CTA sticky-bottom（可选）。
- 内建 aria-labelledby / describedby，Escape、focus trap 由 Radix 自带。
- `LazyMount`：`children` 仅在 `open===true` 时渲染，避免重型模块预挂载。

## 五、URL 状态

- `useSearch` from `@tanstack/react-router`，声明 index 路由 `validateSearch` 支持 `?feature=<id>`。
- 打开 Drawer → `router.navigate({ search: { feature: id }, replace: true })`。
- 关闭 → 清空 `feature`。
- `popstate` 由 router 自动触发 → Drawer 跟随 URL；返回键先关 Drawer。
- 复用现有 router，不加二套。

## 六、去重

`src/routes/index.tsx` 精简为：
```
<LibraryEntrance />
<LibraryInteriorBackdrop />
<GuideDeskHero />
<HomeScrollStack />   // 只剩 ScrollStack + Drawer
<CuratorLetter />
```
删除 Scroll Stack 之外任何 inline 渲染的 `ConcernSelector` / `FeatureLibraryShelf` / `PostRitualRoomsSection` 等。这些组件文件保留（Drawer 内复用）。

## 七、样式与背景

- `LibraryInteriorBackdrop` 保持不变，只在其上增加底部深色渐变。
- ScrollStack 卡片：`rounded-3xl border-gold-dust/20 bg-obsidian/70 backdrop-blur-xl`，最小高度改为 `min-h-[clamp(320px,52vh,520px)]`（比原 20rem 更适合内容）。
- 移动参数：`itemDistance=64 / itemStackDistance=14 / baseScale=0.94 / blurAmount=0`。

## 八、i18n

现有 `useLang` 已有中英；新增缺失 key（hero、drawer 状态、卡片一句话）到字典。全部经 `t()` 输出。

## 九、清理旧实现

删除 / 替换：
- `src/components/home-v2/ScrollStack.tsx`（自制 sticky 版本）→ 换成引用新的 react-bits 版本。
- `src/components/home-v2/StackProgress.tsx` 保留但可选（暂不显示，避免干扰）。
- `HomeScrollStack.tsx` 重写。

## 十、验证

1. `bun x tsgo --noEmit`。
2. `bun test` — 已有 750+ 测试必须仍全绿。
3. Playwright 桌面 1440 / 1280 / 1024 + 移动 390，脚本步骤：
   - 首屏文案含 "每一种文明，都在追问"。
   - 依次点开 7 张卡 → Drawer 打开 → 关闭 → URL 同步。
   - 手动触发 ConcernSelector 选项切换，页面无跳动。
   - reduced-motion 模拟：确认卡片正常列表化。
4. 截图并 code--view 核对。

## 本轮不做

- 不改数据库、鉴权、支付、会员权益、命盘计算、报告生成、既有路由。
- 不引入 progress rail（`StackProgress` 保留代码但不挂载）。
- 不新生成图片素材。
- Lanyard 借阅证。
