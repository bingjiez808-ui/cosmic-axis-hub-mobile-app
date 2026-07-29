# 数学馆重构计划

范围仅限 `src/experiences/life-studies/math/*` 与 `src/routes/life-studies.math.tsx`。不改命盘计算、会员权益、语文馆、其他通识馆、全站导航、DB。

## 一、页面信息架构（新顺序）

`MathRoom.tsx` 重排为 8 段：
1. 开场与三步引导（`01 认识三条线 / 02 选择一个变量 / 03 观察人生分支`）
2. 图例 + 坐标说明（横轴、纵轴、50 分含义、年龄阶段分区）
3. **人生函数主图**（`LifeFunctionChart`，重构）
4. **选择实验室**（`ChoiceLab`，移动到书签之上，重写文案与变量）
5. 实验结果卡（新增：短期/中期/代价 + 六维差值条）
6. 关键波动提示（规则生成，最多桌面 5 / 移动 3）
7. **人生数学书签**（`LifeMathBookmarks`，默认选中"大数定律"，联动图表高亮）
8. 收藏与分享（复用现有）

## 二、三条曲线定义（业务）

| 名称 | 来源 | 视觉 |
|---|---|---|
| 生命基线 baseline | 命盘长期结构 + 阶段规则 | 暖白实线，最粗 |
| 现实路径 currentPath | 基线 + 当前默认选择 + 阶段权重 | 金色实线 |
| 实验分支 experimentPath | 现实路径 + 用户选中实验的 dimensionEffects，从 startAge 起渐进偏离 | 青绿虚线 |

移除现有第 4 条无业务含义辅助线（若存在）。图例支持显示/隐藏、hover 加粗其他降透明；线尾直接标注名称，重叠自动错位。

## 三、主图交互

- **Hover**：最近点发光 + 竖参考线 + Tooltip（年龄、阶段、三条数值、与基线差值、当前阶段前 3 维度影响、≤2 句提示，边缘自动翻转）
- **移动端**：拖动游标，底部固定信息卡，点击锁定/解锁
- **关键节点**：规则识别 peak/low/crossing/risk/branch，桌面≤5 移动≤3，不同符号，hover 展开提示
- **一次性轻引导**：`localStorage: fate.math.tour.v1`

## 四、选择实验室（重写）

八个现实化实验（提前积累长期能力 / 扩大投入 / 延迟高风险财务决定 / 更早建立关系边界 / 家庭责任预留资源 / 修复睡眠体力 / 离开不匹配环境 / 保持现状对照）。

首进：experimentPath 与 currentPath 重合 + 提示语。选后：500–800ms 曲线过渡，分叉节点从 startAge 起渐进；差值达肉眼可辨最小幅度，禁瞬间跳变、禁伪造极端。

按钮：撤销 / 与原路径对照（其他线 25% 透明）/ 加入我的人生分支（`localStorage: fate.math.branches.v1`）。

## 五、人生数学书签

8 张：大数定律 / 幸存者偏差 / 墨菲定律 / 辛普森悖论 / 回归均值 / 机会成本 / 边际效应 / 复利效应。

- 默认选中 **大数定律**，深蓝底 + 金色细边
- Hover 预览一句 + 图表淡高亮不覆盖当前
- 点击切换 + 图表联动持久高亮 + 展开解释卡
- URL query `?bookmark=<id>` 或 localStorage 记住

## 六、数据契约（新增 `LifeMathTypes.ts`）

```ts
type LifeMathPoint = { age; baseline; currentPath; experimentPath?; dimensions{6}; eventType?; shortHint? }
type LifeExperiment = { id; title; description; startAge; dimensionEffects; costEffects; curveTransition:"gradual" }
type MathBookmark   = { id; title; summary; explanation; actionPrompt; relatedPattern }
```

同一 `chart_id + model_version + experiment_id` 走内存缓存，不新增 AI 调用。

## 七、视觉、响应式、无障碍

黑金调、背景更压暗、青绿分支足够亮；`prefers-reduced-motion` 关动画；触控目标≥44px；键盘 focus 与 hover 同效；不仅靠颜色；宽度覆盖 320/375/390/430/768/1024/1440/1920。

## 八、测试

新增 `MathRoom.interaction.test.tsx` 覆盖：图例开关、hover 数值、节点上限、实验室位于书签上方、选后曲线变化、撤销恢复、对照高亮、加入分支持久、默认书签选中、hover 不覆盖、点击联动。

## 九、涉及文件

改：`MathRoom.tsx` `LifeFunctionChart.tsx` `LifeLinesChart.tsx`（可能合并）`ChoiceLab.tsx` `LifeMathBookmarks.tsx` `MathLifeModel.ts` `demoFacts.ts`
新增：`LifeMathTypes.ts` `LifeMathExperiments.ts` `LifeMathEvents.ts`（节点识别）`MathRoom.interaction.test.tsx`

## 十、非目标

不动：命盘计算、会员权益/支付、语文馆、其他通识馆、全站导航、DB schema、任何 AI 调用。
