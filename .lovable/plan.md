
# 借阅证 · Reader's Pass 接入计划

只处理借阅证。不改动 Scroll Stack、仪式、报告、通识馆、我的书架、鉴权、支付。

## 1. 依赖与资源

- 安装 `three` `meshline` `@react-three/fiber` `@react-three/drei` `@react-three/rapier`
- `vite.config.ts` 增加 `assetsInclude: ['**/*.glb']`
- `src/global.d.ts` 补 `*.glb` `*.png` `meshline` JSX 声明
- 从 React Bits 官方仓库下载 `card.glb` 和 `lanyard.png`（band 底纹），落地为 lovable-assets CDN 资产；下载失败则回退到只用 2D 版本，并向你如实报告

## 2. 新增文件

```
src/components/reader-pass/
  Lanyard.tsx              # React Bits 原版 3D，仅微调 pointer 判定与光照
  Lanyard.css              # 官方样式，定位改成父容器 absolute 填充
  ReaderPassLanyard.tsx    # 3D 装载壳，处理拖动/点击、光照、DPR、暂停
  ReaderPassFlat.tsx       # 移动/降级 2D 版本
  ReaderPassCard.tsx       # <ReaderPassLanyard/> 与 <ReaderPassFlat/> 的路由器
  ReaderPassDrawer.tsx     # 点击后弹出的“我的借阅证”侧栏
  useReaderPassData.ts     # 从 useHomeFacts + session 派生正面/背面字段
  useReaderPassSvg.ts      # 生成正面 SVG → Blob URL（useMemo，卸载 revoke）
  useReducedMotion.ts      # 复用/新建的 media-query hook（若已有则复用）
  hint-storage.ts          # sessionStorage 记录"拖动提示"是否已看过
```

## 3. 状态与数据（只读，不改后端）

- 复用 `useHomeFacts()` → `isSignedIn` `hasPrimaryChart` `tier`
- 复用 `useSupabaseSession()` 拿 `session.user`；只取 `user_metadata.display_name` / `email` 首字母，绝不显示邮箱/UUID/生日/坐标
- 读者编号 = `DL-••••-` + `user.id` 末 4 位；游客固定 `GUEST`
- 报告数量：如果 `useHomeFacts` 未暴露，仅在 Drawer 里按需 `listUserCharts()` / 已有查询懒取；不新增 RPC

## 4. 集成位置

只在 `src/components/home-v2/HomeScrollStack.tsx` 的 `GuideDeskHero` 内挂载：

```
<GuideDeskHero>
  <ReaderPassMount />   {/* 桌面 absolute 右上；移动端 2D 小卡 */}
</GuideDeskHero>
```

- 桌面：`clamp(240px, 22vw, 360px)` × `clamp(320px, 58vh, 620px)`，`absolute top/right`，`z-index: 20`（低于 Sheet/Dialog）
- 用 `IntersectionObserver` 观察 GuideDeskHero；离开 65% 后设 `opacity:0` `scale(.92)` `pointer-events:none`；1 秒内未回到视口则卸载 `<Canvas>`（`{mounted && ...}`）
- `document.visibilitychange` 隐藏时暂停 rAF（React Three Fiber `frameloop="demand"` 或 `invalidate()` 控制）
- 不出现在：入口动画、Scroll Stack、其他任何页面、全局 header、Layout

## 5. 3D 与 2D 判定

`ReaderPassCard` 在 mount 时判断（客户端）：

- `window.innerWidth < 768` → 2D
- `prefers-reduced-motion: reduce` → 2D
- `navigator.connection?.saveData === true` → 2D
- WebGL 探针（`document.createElement('canvas').getContext('webgl')`）失败 → 2D
- 内存 `navigator.deviceMemory && < 4` → 2D
- 3D `<Canvas>` `onCreated` 抛错也回退成 2D（`ErrorBoundary`）

## 6. 视觉

- 正面 SVG：深墨绿→黑褐渐变、细金线框、顶部 `命运图书馆 · Destiny Library`、中心 `读者借阅证 / Reader's Pass`、动态字段、底部印章 `命运不是判决书 · Destiny is not a verdict`；求索者暖旧金、贤者深金+墨绿、神谕者深紫黑+微星光金
- 背面 SVG：`馆内索引`、三行入口标题（不放长文本）、底部一段免责小字
- 挂绳纹理：临时用生成的 SVG（黑褐底 + 金色 `DESTINY LIBRARY · 命运图书馆` 循环 + 月相点）转 PNG data-URL，`lanyardWidth=1.15`
- 卡片材质：`roughness 0.8 / metalness 0.2 / clearcoat 0.35`（改 Lanyard.tsx 里的 material 参数）
- 光照：暖金 keyLight + 冷蓝 rim，删除白色摄影棚 Lightformer

## 7. 交互

- 保留 Rapier 物理、拖拽、松手回弹、鼠标悬浮 grab / grabbing
- pointerDown 记录 `{x,y,t}`；pointerUp 若 `distance<6px && dt<250ms` → 打开 `ReaderPassDrawer`；否则视为拖拽结束
- 挂绳 pointer 事件不触发 Drawer
- 首次会话在卡片旁弹一次浮层提示：`拖动借阅证看看 · 点击打开馆内索引 / Drag it · Tap to open`；4.5s 后淡出；`sessionStorage.reader_pass_hinted = "1"` 之后不再显示

## 8. Drawer（复用已有 Sheet）

- 游客：`登录并领取借阅证` → `/auth?redirect=/`；`继续以访客身份浏览` 关闭
- 已登录 + 无主命盘：`开启仪式，建立我的第一张命盘` → `/ritual`
- 已登录 + 有主命盘：三个入口
  - `进入我的书架 / My Shelf` → `/me/home`
  - `查看今日命运 / Today's Reading` → `/me/home`（如无独立路由，跳同一 hub 并锚点）
  - `查看会员与订单 / Membership & Orders` → `/me/membership`
- 会员到期时间：`useMembershipTier()` 若已暴露 expires_at 就显示，否则省略

## 9. 性能

- `ReaderPassLanyard` 用 `React.lazy` + `Suspense`（fallback = 轻量骨架）
- Hero 首屏文字先渲染，`requestIdleCallback`（不可用则 `setTimeout 400ms`）后挂载
- Canvas DPR：`Math.min(window.devicePixelRatio, 1.5)`
- 离开可视区 → `mounted=false` 卸载 Canvas，销毁 texture、几何体、rAF
- SVG Blob：`useEffect` cleanup 时 `URL.revokeObjectURL`

## 10. 验收

- 手动：桌面 1280、平板 900、手机 390 三个尺寸截图
- 单测：`useReaderPassData` 派生逻辑（游客 / 三种会员 / 无命盘）
- typecheck + build（无 WebGL / Rapier / meshline / texture 报错）
- 全站巡检：确认借阅证不出现在入口、Scroll Stack、`/ritual` `/report` `/life-studies` `/traditions` `/community` `/me/*` `/auth*`

## 技术备注

- `card.glb` 与 `lanyard.png` 走 lovable-assets，放在 `src/components/reader-pass/assets/*.asset.json`
- 若 React Bits 官方 GLB 无法下载（网络受限），退回“无 3D 版本”：不 mount `<Canvas>`，桌面也用 2D 版，并在交付说明中标红
- Lanyard 官方源码里的 `Environment` + 白色 Lightformer 会导致卡面过曝，替换成两盏 `directionalLight`（暖 keyLight + 冷 rimLight）
- `frontImage` 用 SVG-to-PNG dataURL（Blob → `<img>` 装载 → 传给 `useTexture`）以避开 CanvasTexture 每帧重绘

准备执行；如果只想先看 2D 版本或先跳过挂绳纹理定制，告诉我要裁哪一块。
