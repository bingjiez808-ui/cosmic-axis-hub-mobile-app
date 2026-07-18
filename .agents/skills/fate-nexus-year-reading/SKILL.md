---
name: fate-nexus-year-reading
description: Deterministic per-year timeline reading engine and storage for the fate-nexus app — 4 systems (BaZi, Ziwei, Vedic, Western), evidence-backed scores, no LLM in the reading path. Use when computing, storing, or rendering per-year insights on the life timeline / year-by-year charts / YearInsightModal.
---

# Fate-nexus year reading

## Trigger

Whenever the app needs a per-year insight for a user's chart (life timeline dots, YearInsightModal, "big luck" curve), use this skill. Do **not** hand-craft year interpretations, do **not** call the LLM for year text, do **not** derive year values from premium chapter prose.

## Layers — non-negotiable

`INPUT → FACTS → INTERPRETATION → ADVICE`

- **INPUT**: birth data, target year, target age, `lang`.
- **FACTS**: only `PremiumFacts` (`premium_facts_v3` shape). Calculator is the sole source of truth.
- **INTERPRETATION**: per-system score/direction/confidence + evidence refs. Deterministic — same facts, same year, same content hash.
- **ADVICE**: condition-based, safety-bounded. No medical, no death, no guaranteed wealth.

## Systems

| System  | Available when                                                                                  | Evidence refs                                                       |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| BaZi    | `bazi.day_master` + `bazi.luck.pillars` covers the target age                                   | `bazi.luck.pillars[i]`, `bazi.luck.pillars[i].liu_nian[j]`          |
| Ziwei   | `ziwei.horoscope_years[]` contains a snapshot matching the target year (v3.1+ multi-year facts) | `ziwei.horoscope_years[k].flow_year`                                |
| Vedic   | `vedic.mahadasha` covers the target year                                                        | `vedic.mahadasha[i]`, `vedic.mahadasha[i].antardasha[j]`            |
| Western | `western.annual_transits[]` has an entry for the target year (v3.1+ birthday-anchored samples)  | `western.annual_transits[k].planets`, `western.annual_transits[k].aspects` |

Western scoring is deterministic: aspects between transit planets and the natal Sun/Moon are weighted (outer trine/sextile +4, outer square/opposition −4, inner planets half-weight, Jupiter/Saturn conjunctions ±2). Score clamps to [0,100] centered at 50. Same natal + year → identical output (see `western-transits.test.ts`).

Any system that cannot supply its evidence refs is set `available: false` with a `reason_unavailable`. It contributes 0 to the composite and does not carry a score.

## Composite

- Weighted mean over available systems: `high=1.0, mid=0.6, low=0.3, reference_only=0.1`.
- Requires ≥ 2 available systems, else `composite_confidence = "reference_only"` and the UI must show single-system commentary.
- Never fabricate a fourth system to hit a threshold.

## Cache / idempotency

Row identity in `year_readings_v1`:
`(chart_id, facts_hash, calculation_version, skill_version, lang, year)` — enforced by UNIQUE constraint.

- `facts_hash`: `fnv1a(canonicalJson(subset(PremiumFacts)))` via `hashFactsForYearReading`.
- `skill_version`: exported as `YEAR_READING_SKILL_VERSION`.
- `calculation_version`: exported as `YEAR_READING_CALC_VERSION`.
- Reads: prefer cached row; never regenerate on read.
- Writes: `upsert onConflict do nothing` so concurrent requests are safe.
- Facts change or skill upgrade → new rows (old rows retained for audit).

## Forbidden

- No LLM/AI call in the reading path.
- No hand-tuned per-year strings that depend on the chart.
- No hard-coded chart-agnostic templates (e.g. "score > 70 → 'auspicious year'") as the primary interpretation — templates only supply the safety-bounded advice tier.
- No leaking internal identifiers (facts_hash, content_hash, provider names) to end users.

## Validation

Every generated row must pass `validateYearReading`:

- `available === true` implies `0 ≤ score ≤ 100` and non-empty `evidence_refs`.
- `available === false` implies `score === null`.
- `< 2 available systems` implies `composite_confidence === "reference_only"`.
- `composite_score`, when present, is in `[0, 100]`.

## References

- Engine module: `src/lib/year-readings.ts`
- Test suite: `src/lib/year-readings.test.ts`
- Schema: `.agents/skills/fate-nexus-year-reading/references/schema.md`
