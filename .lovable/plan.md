
## 目标

1. **【生命时间轴 · 大运】** 与 **【会员近况 · 90 天时间节点与状态】** 目前是用 birthdate 做 hash 的伪随机模板文案，与用户真实八字/星盘无关。改成由 AI 依据「八字流年大运 + 西方星盘当前行运」生成。
2. **保存命盘时同时保存 AI 生成的解读**（主报告 8 维度 + 时间轴 + 90 天窗口），下次进入同一命盘直接读取，不再重复消耗 token。

## 变更

### 1. 新增服务端函数 `src/lib/outlook.functions.ts`

一个新的 `generateChartOutlook`（公开访问、无需登录，同 `generateReport`）：

**输入**：`{ name, date, time, place, lang, bazi, zodiac, lunar, planets[] }` —— 与 report.functions.ts 完全相同的输入契约（复用 `buildReportRequest`）。

**输出**：严格 JSON

```jsonc
{
  "timeline": {
    "summary": "…贴合此人八字大运的一句诗意概括…",
    "decades": [
      {
        "from": 0, "to": 10,
        "theme": "扎根",                   // 6-12 字
        "detail": "…3 句，必须点出该大运干支/十神/主要行运…",
        "personalTint": "…此十年对此人的独特倾向…",
        "years": [
          { "age": 0, "intensity": 0.4, "theme": "播种 —— …具体…" },
          // …每岁一项
        ]
      }
      // 8 个大运，覆盖 0-80 岁
    ]
  },
  "outlook90": {
    "stateSummary": "…一句话说明此刻状态的成因（行运/流月）…",
    "stateScore": 68,
    "bars": [
      { "label": "元气", "value": 72, "reason": "…一句缘由…" },
      { "label": "专注", "value": 58, "reason": "…" },
      { "label": "情绪", "value": 65, "reason": "…" },
      { "label": "运气窗口", "value": 60, "reason": "…" }
    ],
    "windows": [
      { "offsetFromDays": 0,  "offsetToDays": 6,  "tone": "信号周", "score": 70, "body": "…引用流年干支或过境行星…" },
      { "offsetFromDays": 7,  "offsetToDays": 20, "tone": "…",     "score": 55, "body": "…" },
      { "offsetFromDays": 21, "offsetToDays": 45, "tone": "…",     "score": 72, "body": "…" },
      { "offsetFromDays": 46, "offsetToDays": 90, "tone": "…",     "score": 60, "body": "…" }
    ],
    "dimensions": [
      { "key": "career", "points": [...], "cautions": [...], "mitigations": [...] },
      { "key": "study",  "points": [...], "cautions": [...], "mitigations": [...] },
      { "key": "love",   "points": [...], "cautions": [...], "mitigations": [...] },
      { "key": "health", "points": [...], "cautions": [...], "mitigations": [...] }
    ]
  }
}
```

模型使用 `google/gemini-3.5-flash`（与主报告一致，速度优先），system prompt 强调**每段必须引用具体八字干支/流年/大运干支/过境行星**，禁止通用模板。

### 2. 缓存策略：把「保存命盘」升级为持久化 AI 结果

在 `src/lib/account.tsx` 的 `SavedReading` 类型中新增：

```ts
type SavedReading = {
  id: string;
  createdAt: number;
  name: string; date?: string; time?: string; place?: string; lang?: "en"|"zh";
  // ↓ 新增：AI 缓存（可选，未生成前为空）
  aiReport?: ReportAI;
  aiOutlook?: OutlookAI;
  fingerprint?: string;  // buildReportFingerprint 的结果，用来判断缓存是否匹配
};
```

新增 API：`updateReadingAI(id, patch: Partial<Pick<SavedReading, "aiReport"|"aiOutlook"|"fingerprint">>)`，通过 fingerprint 匹配去更新已保存记录的 AI 字段。

### 3. `src/routes/report.tsx` 生成完 report 后自动写回已保存记录

现有 sessionStorage 缓存保留，此外：
- 生成 `ai` 完成后，如果 `saved` 中有匹配的 reading（fingerprint 一致），调用 `updateReadingAI(reading.id, { aiReport: ai, fingerprint })`。
- 页面加载时优先尝试从 `saved` 里按 fingerprint 找 `aiReport`，命中则跳过网络请求，直接 setAi。
- 相同 fingerprint 存在时禁用后续请求，彻底避免二次消耗。

### 4. `LifeTimeline` & `RecentWindows` 改为 AI 驱动

- 两个组件加一个共用 hook `useChartOutlook(search, lang)`：
  - 从 sessionStorage `destiny-ai-outlook-v1::<fingerprint>` 读缓存；
  - 若已保存命盘匹配 fingerprint 且有 `aiOutlook`，直接返回；
  - 否则调用 `generateChartOutlook`，写入 sessionStorage，并（若命中已保存记录）写回 `saved`。
- `LifeTimeline`：
  - 若 outlook 就绪 → 用 AI 提供的 `decades[i].theme/detail/personalTint/years` 渲染；
  - 否则退回现有硬编码 `DECADES` 作为骨架 + loading 提示。
- `RecentWindows`：
  - 就绪时用 AI 提供的 `bars/windows/dimensions` 渲染，`offsetFromDays/offsetToDays` 转换为 `fmt(offset)` 生成显示日期；
  - 否则退回现有种子生成的模板 + loading。

### 5. 把 birth+search 完整传递下去

`LifeTimeline` 与 `RecentWindows` 目前只接受 `birthISO`。改为接收 `search: ReportSearchLike` 以便调用 `buildReportRequest`。`report.tsx` 中改传 `search` prop。

## 技术细节

- 复用 `src/lib/report-input.ts` 的 `buildReportRequest / buildReportFingerprint`。
- 新 outlook 的缓存 key: `destiny-ai-outlook-v1::${readingId||"direct"}::${fingerprint}`。
- 后端 zod schema + JSON extraction 复用 report.functions.ts 中相同的 fence 剥离 + brace 截取逻辑。
- 保存的 `aiReport/aiOutlook` 存在 localStorage 里（`lod.saved_readings`），单条约 ~15-30 KB，20 条上限时约 400-600 KB，仍在配额内。
- 未登录用户依然可用 sessionStorage 缓存（同会话内不重复），只有登录并「保存命盘」才跨会话持久化。

## 不变的部分

- 未登录也能生成（`generateChartOutlook` 不加 auth 中间件）；
- 现有主报告的模型与 prompt 不变；
- 现有伪随机模板作为 loading fallback 保留，避免空白页面。

## 文件改动清单

- 新增 `src/lib/outlook.functions.ts`
- 修改 `src/lib/account.tsx`（SavedReading 类型 + `updateReadingAI`）
- 修改 `src/components/ReportExtras.tsx`（`LifeTimeline`、`RecentWindows` 接入 hook；新增 `useChartOutlook`）
- 修改 `src/routes/report.tsx`（生成成功后回写 saved；页面挂载先查 saved 缓存；改传 `search` 给两个组件）

确认后我按上述范围一次性实现。
