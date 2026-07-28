# Life Function → Seven Life Lines

Refactor `/life-studies/math` from four abstract sliders into an age-driven, evidence-backed view of seven life domains: study, career, love, family, social, wealthRisk, health. Keep old chart primitives, do not touch DB, no AI, no publish.

## 1. New pure model (`src/experiences/life-studies/math/`)

New files (old `MathLifeModel.ts` kept and re-exported for the scenario lab; renamed conceptually to "scenario engine"):

- `domains.ts` — domain keys, labels (zh/en), colors, line styles, definitions ("interpretive index 0–100, 50 = neutral").
- `LifeDomainModel.ts` — deterministic scoring from supplied FACTS only. Exports:
  - `buildDomainSeries({ facts, mode, fromAge, toAge })` → `{ ages, domainSeries, compositeSeries, turningPoints, dataCoverage }`
  - `ageSnapshot(age, series, facts)` → per-domain `{ score, band, positiveSignals, frictionSignals, evidenceRefs, confidence, dataCoverage }`
  - `crossDomainEffects(snapshot)` → 2–4 triggered arrows with fixed rules
  - `scenarioBranches(age, choice, series)` → 2–3 branches over next 3–5 years
- `evidence.ts` — resolves evidence refs to supplied FACTS (bazi pillars/十神/五行/大运流年; ziwei 宫/星/四化/大限流年; vedic Mahadasha/Antardasha; western natal aspects only). Missing → returns `data_coverage: 'partial' | 'insufficient'`, never fabricates.
- `demoFacts.ts` — clearly-labelled demo FACTS used when no primary chart or in demo mode.

Rules (fixed, no AI):
- Base per domain = seed-derived neutral 50 ± bazi 五行 balance signal.
- Period modifiers per system add/subtract in fixed weights (documented in a `SCORING.md` comment block).
- Cross-domain: career pressure → health realisability −; study accumulation → career choice-space + (lag 3y); family responsibility → risk tolerance −; health low → damps top-2 domains' "realisability"; social friction → career execution cost +; high wealth risk exposure → family safety −.
- Composite = weighted (study .12, career .22, love .12, family .14, social .10, wealthRisk .12, health .18) then apply health realisability cap.
- Terminology: never "小人" — use 合作摩擦/权责不清/竞争压力/信息不对称. Wealth = 风险管理环境/风险承受空间, never predictions. Health = 作息/恢复/压力/就医提醒, never diagnosis.

Old `MathLifeModel.ts` kept: `buildComposition`, `reactionForChange`, presets remain — used only inside the Choice Lab as scenario stress tests. Remove from primary-chart claims.

## 2. UI (`MathRoom.tsx` rebuild, reusing chart primitives)

Sections top→bottom (desktop two-column past section 3):

1. **Header**: title "人生函数 / Life Function", new subtitle. Demo/personalized badge. Collapsible "模型与计算说明" (moves old equation + assumptions there).
2. **Seven Life Lines chart** (`LifeLinesChart.tsx`, new) — SVG using existing gradient/axis helpers from `LifeFunctionChart.tsx`:
   - Composite "总览带" always on, with dominant-domain color per age.
   - 7 domain toggles + quick presets ("只看事业", "事业+财富", "爱情+家庭", "全部").
   - Draggable age cursor.
   - Turning point markers only when a deterministic period change fires.
3. **Age Cross-Section** (`AgeCrossSection.tsx`, new) — radar/flower of 7 scores at cursor age; top opportunity / top friction chips; "打开这一年" opens modal.
4. **Year modal** (`YearInsightModal.tsx`, new local one — do not touch existing global one) — 机会/损耗/警惕/证据/进入选择实验室. Cross-domain arrows list rendered from `crossDomainEffects`.
5. **Choice Lab** (`ChoiceLab.tsx`, new) — pick age + one real question (career/study/love/family/wealth) with conditional-text options; renders 2–3 dashed branch overlays on main chart + a comparison table (resource cost, pressure, reversibility, cycle fit). Reset button. Old four sliders live here as an "advanced" collapsible for user-controlled scenario comparison, clearly labelled "情景假设，不是命盘结论".
6. Existing `GenerationMethod` block reused at bottom.

Mobile (393px): stack — overview chart → domain toggles → cross-section → choice lab.

## 3. Tests

Extend `MathLifeModel.test.ts` and add `LifeDomainModel.test.ts`:

- deterministic replay (same FACTS + version → identical output)
- missing yearly facts → `data_coverage: 'insufficient'`, no fabrication
- composite ≠ arithmetic mean of 7
- low health → caps top-2 realisability
- high career pressure → family/health negative delta present
- high wealth risk exposure → risk-note friction signal, no return prediction strings
- friction signals never contain deterministic malice terms (regex ban list)
- three career choices produce visibly-different branches without "will succeed" language
- every `evidence_refs` entry resolves through `evidence.ts`
- zh/en label parity + 393px snapshot

## 4. Verify

`bunx tsgo --noEmit` + `bunx vitest run src/experiences/life-studies`. Playwright: toggle 2 domains, drag cursor to 2 ages, open year modal, run one career branch comparison. Report counts + any uncovered FACTS gaps. No publish.

## Technical notes

- Reuse `LifeFunctionChart.tsx` SVG axis/gradient helpers by exporting internals; do not duplicate.
- FACTS input: read from existing calc-snapshot / report-input shape for personalized mode via a thin adapter; demo mode uses `demoFacts.ts`. No new server functions.
- No route changes; still `/life-studies/math`.
- Terminology guard: shared `BANNED_TERMS` array asserted by tests.
