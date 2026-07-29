
## Goal

Restore the seven-dimension life-function architecture in `/life-studies/math`. The previous refactor collapsed everything into three composite lines (Baseline / Current / Experiment) and deleted the multi-domain curves + yearly radar. This plan reinstates the full chain:

**Seven-domain main chart → age cursor → yearly radar cross-section → experiment overlay → bookmarks**

The composite lines survive only as an optional overlay mode inside the main chart, never as a replacement.

## Scope guard

Do NOT touch: chart calculation kernels for the primary destiny chart, membership permissions, other Commons halls, global navigation, database schema.

Only edit files under `src/experiences/life-studies/math/v2/**` and closely related composition. Keep the v2 folder; rebuild its internals.

## Seven dimensions & fixed color map

| key | zh | en | color | marker |
|---|---|---|---|---|
| study | 学业与成长 | Study & Growth | `#a78bfa` (violet) | circle |
| career | 事业与选择 | Career & Choices | `#f59e0b` (amber) | triangle |
| love | 爱情与亲密 | Love & Intimacy | `#f472b6` (rose) | diamond |
| family | 家庭与责任 | Family & Duty | `#fb923c` (orange) | square |
| social | 人际协作 | Social & Collaboration | `#38bdf8` (sky) | pentagon |
| wealth | 财富与风险 | Wealth & Risk | `#facc15` (yellow) | hexagon |
| health | 健康与恢复 | Health & Recovery | `#34d399` (teal) | plus |

Same map is used by chart legend, tooltip, radar axes, quick-combos and domain buttons — ZH/EN both.

## Data model changes

Update `v2/types.ts`:

```ts
export type LifeDimensionKey =
  | "study" | "career" | "love" | "family" | "social" | "wealth" | "health";

export const LIFE_DIMENSIONS: LifeDimensionKey[] = [...];

export type LifeDimensionPoint = {
  score: number;   // 0-100
  low: number;
  high: number;
  baseline: number; // long-run personal baseline
};

export type LifeEvent = {
  id: string;
  age: number;
  type: "peak" | "low" | "rise" | "drop" | "crossing"
      | "resonance" | "tension" | "branch";
  dimensions: LifeDimensionKey[];
  severity: "low" | "medium" | "high";
  title: { zh: string; en: string };
  shortHint: { zh: string; en: string };
  caution?: { zh: string; en: string };
};

export type LifeMathPoint = {
  age: number;
  stage: string;
  dimensions: Record<LifeDimensionKey, LifeDimensionPoint>;
  composite: {
    baseline: number;
    currentPath: number;
    experimentPath?: number;
  };
  events?: LifeEvent[];
};
```

`relationship` is retired; `love` and `social` are now separate first-class dimensions, matching the seven original domains in `LifeDomainModel`.

## computeSeries rebuild

`v2/computeSeries.ts`:

1. Consume `buildDomainSeries` for all seven domains directly (no love+social merge).
2. For each age, emit per-dimension `{score, low, high, baseline}` (baseline = 11-year rolling mean of that dimension).
3. Compute composite lines from weighted sum of seven dimensions (equal weight or existing weights) — keep current/baseline distinct.
4. Experiment: apply per-dimension effect ramps to BOTH dimension series AND recompute composite from the resulting dimensions. Old approach that only shifted composite is removed.
5. Event detection now runs per-dimension: peak/low/rise/drop/crossing/resonance (two dims up together)/tension (one up, one down)/branch. Cap at 5 desktop / 3 mobile via severity sort. Templates deterministic, bilingual.
6. Memoize by `mode::seed::experimentId`.

## Component rebuild

### `v2/LifeFunctionChart.tsx` — full rewrite

Three view modes (segmented control at top of chart):
- **七维领域 (default)** — draw all seven dimension lines; visibility controlled by filter state.
- **综合总览** — three composite lines (baseline dashed, current solid, experiment if any). Behind them draw seven dims at 12% opacity so context isn't lost.
- **实验对照** — enabled only when an experiment is active. Shows current vs experiment composite + top-3 dimensions with largest deltas at full opacity.

Under the chart:
- **Quick combos row**: 只看总览 / 只看事业 / 事业+财富 / 爱情+家庭 / 全部七条
- **Seven domain toggle buttons** (multi-select, min-1-visible guard, state persisted to `localStorage` `fate.math.filter.v1`)
- **Age slider** 0–80, live-updates vertical cursor + summary card ("34 岁 · 综合 49.1 · 主要推动: 事业 · 主要摩擦: 健康") + "打开这一年" button that scrolls to and updates the radar.

Hover / touch:
- Nearest-age snap on mouseover. Highlight hovered line (stroke width 3, glow), dim others to 15%.
- Vertical age guideline + marker dot per visible line at that age.
- Tooltip with: age, stage, line name (ZH/EN, not internal key), value, delta vs personal baseline, top-2 co-moving dimensions, one-sentence explanation, one-sentence caution.
- Mobile: tap-to-lock, info card below chart, no hover.

Click line → open right side sheet (desktop) or bottom sheet (mobile) with:
- Domain description ("这条线观察 / 它不代表 / 与它联动最明显的领域")
- Buttons: 只看这条线 / 加入对照 / 关闭

Event markers: small colored glyphs at up to 5 (desktop) / 3 (mobile) severity-top events; click → tooltip with title + shortHint + caution.

Bookmark overlay: `activeBookmarkRanges` still renders a soft golden band over the composite view; on 七维 view render as thin vertical guides only.

### `v2/YearlyRadar.tsx` — new file

Radar chart of seven dimensions at focus age. Same color map. Values labeled outside axes. Includes:
- Header: `这一年的生活横截面` + explanatory subtitle (from spec, exactly).
- Right/below: `<age> 岁 · 综合 <n>` + 最值得投入 / 最需防摩擦 (derived: highest positive delta vs baseline / lowest).
- "How to read" card (80–150 chars, deterministic template).
- Buttons: 回到折线图看前后变化 / 查看上一年 / 查看下一年.
- Click axis → highlights that dim on main chart via lifted state.

### `v2/ExperimentLab.tsx` — updated

Cards unchanged, but the impact panel now shows seven per-dimension before/after values with color dots, plus composite before/after. Experiment application still gradual (500-800ms via CSS transition on the SVG path).

### `v2/MathRoomV2.tsx` — new order

1. 开场说明 (existing)
2. 模式切换 demo/personal (existing)
3. **七维人生函数主图** (`LifeFunctionChart` new)
4. 领域筛选、年龄游标、年度详情摘要 (inside chart)
5. **年度生活横截面雷达图** (`YearlyRadar` new)
6. 选择实验室 (`ExperimentLab` updated)
7. 实验前后对照 (folded into ExperimentLab impact card)
8. 人生数学书签 (existing `BookmarkStrip`)
9. 收藏与分享 (existing GenerationMethod block)

Owns lifted state: `focusAge`, `viewMode`, `visibleDims`, `activeExperimentId`, `bookmarkId`, `lockedLine`.

### `v2/bookmarks.ts` — small tweak

Highlight ranges keep operating on composite; add ability to also flag relevant dimensions (used by chart to hint which lines to bold when a bookmark is active in 七维 view). No new AI, no new fetches.

## Responsive rules

- Desktop ≥ md: chart full seven lines default, radar right of description.
- Mobile: default view = 综合总览 with 2-3 lines pre-selected (career + health); button "全部七条" to expand. Radar stacks above description. Age slider full width. No hover-only affordances.

## Deterministic guarantees

- Same `chart_id + model_version + age` → same output.
- Demo mode uses fixed seed `demo:v1`; personal mode uses `seedForChart(primaryBirthISO)`.
- No new AI/network calls anywhere in the module. Cache retained via existing `memo` map.

## Files touched

- `src/experiences/life-studies/math/v2/types.ts` — expand schema
- `src/experiences/life-studies/math/v2/computeSeries.ts` — seven-dim + composite + events
- `src/experiences/life-studies/math/v2/LifeFunctionChart.tsx` — rewrite
- `src/experiences/life-studies/math/v2/YearlyRadar.tsx` — new
- `src/experiences/life-studies/math/v2/ExperimentLab.tsx` — seven-dim impact panel
- `src/experiences/life-studies/math/v2/MathRoomV2.tsx` — new section order & lifted state
- `src/experiences/life-studies/math/v2/bookmarks.ts` — optional dimension hints
- Tests: add lightweight unit test for `computeSeries` seven-dim output + event detection.

## Acceptance

- Default view is 七维领域, not composite.
- All seven domain curves render, filter buttons + quick combos work, min-1 guard enforced.
- Hover tooltip shows human-readable name + age + value + delta + co-movers + explanation, never internal keys.
- Age slider live-updates cursor and summary; "打开这一年" scrolls to and syncs the radar.
- Radar values equal main-chart values at same age (same source).
- Radar axis click highlights that dim on main chart.
- 综合总览 preserved as a mode, not the default.
- Experiments shift both composite AND per-dimension curves; before/after panel shows seven dims.
- Undo restores state; branch save persists.
- Demo data clearly labeled; personal mode uses primary chart; no AI calls added.
- ZH/EN both clean, no leaked internal keys.
- Typecheck + build + existing tests pass.
