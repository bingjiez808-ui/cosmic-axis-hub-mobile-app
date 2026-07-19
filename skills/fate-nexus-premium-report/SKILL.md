---
name: fate-nexus-premium-report
description: Generate a 24-chapter, cross-tradition premium reading (BaZi + ZiWei + Western + Vedic) from deterministic facts. Loads when writing, running, or debugging the ¥79 premium report pipeline in Fate Nexus — chapter workers, evidence refs, cache keys, retry policy, reader UI content. Do NOT load for the free web reading (see fate-nexus-reading).
---

# Fate Nexus Premium Report

A 24-chapter deep report generated on top of the deterministic facts tree
(`premium_facts_v4`). The AI writes prose ONLY. Every chart-specific claim
must resolve against `PremiumFacts`; the AI never computes pillars, stars,
houses, dashas, or aspects.

References — read on demand:
| Need                                                          | File                                    |
| ------------------------------------------------------------- | --------------------------------------- |
| Full 24-chapter catalog (titles, sections, tables, targets)   | `references/chapter-manifest.md`        |
| Evidence-ref schema, allowed_facts, module classification     | `references/evidence-contract.md`       |
| Cache keys, input hash, token strategy, retry/resume protocol | `references/token-cache-policy.md`      |

The authoritative catalog is the exported `PREMIUM_V3_CHAPTERS` array in
`src/lib/premium-chapters-v3.ts` — the reference doc mirrors it and the
contract test `premium-chapters-v3.test.ts` enforces the sync.

## Non-negotiables

1. **Facts are source of truth.** Missing facts = hide the chapter or stop
   the report; never let the model invent chart data.
2. **AI writes prose only.** No computation of astrology, BaZi, ZiWei, or
   Vedic elements inside the model call.
3. **Structured JSON output only.** `{ body, evidence_refs }`. Free text
   is rejected by `parseChapterJson` / `validateChapterAgainstFacts`.
4. **Server-side deterministic evidence correction.** The model MAY leave
   `evidence_refs` empty or approximate; the server replaces them with
   real paths from `chooseDeterministicRefs` before persisting.
5. **Completed rows are immutable.** Re-opening a completed report calls
   0 AI. Only `pending` / `failed` (attempts < 3) / expired-lock chapters
   are re-run. The final `content_hash` MUST NOT change on re-open.
6. **No silent template fallback in production.** Deterministic body
   generators exist only for the dev harness (`premium-reader-fixture`,
   `dev.reader-harness`) and for tests. Live paths must fail loud on
   validation errors and count against the 3-attempt budget.
7. **Culture / self-reflection framing.** No promises about medical
   outcomes, income, disasters, marriage certainty, or "the one".

## Skill identity and versioning

Constants live in `src/lib/premium-chapters-v3.ts`:

```ts
PREMIUM_SKILL_ID       = "fate-nexus-premium-report"
PREMIUM_SKILL_VERSION  = "1.0.0"
PREMIUM_MANIFEST_VERSION = "2026-07"
PREMIUM_REPORT_REVISION = "premium_v3_rev_2026_07_real_ai"
```

`PREMIUM_REPORT_REVISION` is the string that flows into
`buildCanonicalChartInput.prompt_version`, which becomes part of the
report's `input_hash`. Bump the revision — together with skill/manifest
version — whenever this SKILL, the chapter manifest, or the evidence
contract changes in a way that affects output. Old completed rows keep
their old revision and their old `content_hash`; a bumped revision
writes to a NEW row.

## Input contract

Callers (mainly `ensurePremiumReport` / `processNextPremiumChapter` in
`src/lib/premium.functions.ts`) MUST provide:

- `facts` — `PremiumFacts` at `PREMIUM_FACTS_VERSION = "premium_facts_v4"`.
  If any core module (`bazi`, `ziwei`, `western`, `vedic`) is missing
  its base structure, refuse to generate — the report cannot be built
  from partial facts.
- `chart_canonical_hash` — output of `buildCanonicalChartInput` on the
  user-facing chart record; identical inputs → identical hash → cache hit.
- `lang` — `"zh" | "en"`. Chapter titles, section markers, and table
  titles come from the manifest in the chosen language.
- `report_revision` — read from `PREMIUM_REPORT_REVISION`. Do not accept
  overrides from callers.

The composed `input_hash` (see `token-cache-policy.md`) MUST include all
four. Anything less allows a cache poison.

## Output shape

Every chapter row stores JSON validated by `ChapterJsonSchema`:

```json
{
  "body": "…plain-text paragraphs, section markers, and optional markdown pipe tables…",
  "evidence_refs": [
    { "path": "bazi.pillars.day", "module": "bazi", "confidence": "grounded" }
  ]
}
```

- `body`: 1..20000 chars. Section markers ("## 适合行业族群" / "## Industry Fit")
  and Markdown pipe tables required for the chapters that declare
  `required_sections` / `required_tables` — see chapter-manifest.
- `evidence_refs`: ≤24 refs; module must be in the chapter's
  `allowed_facts`; path must resolve non-null against `PremiumFacts`;
  cross-tradition chapters need ≥2 distinct modules; system chapters
  need ≥1 `grounded` ref.
- `confidence`: `grounded` (path present + value non-null),
  `traditional` (schoolbook interpretation of a real fact), or
  `reflective` (self-reflection prompt tied to a real fact).

The aggregated report `content_json` follows `V3ReportContent`:
`schema_version: "v3"`, `meta`, `cover`, `chapters[24]`, `budget`.

## Chapter overview (see chapter-manifest.md for full detail)

Six kinds:
- **cover** (`cover_letter`, `executive_summary`, `chart_map`) — welcome,
  cross-tradition summary, chart topology. `chart_map` may cite facts;
  the other two are prose scaffolds with `allowed_facts: []`.
- **system** — one per tradition + one per timing subsystem:
  Western Natal + Aspects, Vedic Natal + Dasha, BaZi Pillars + Ten Gods
  + Luck, ZiWei Palaces + Horoscope. System chapters need ≥1 grounded ref.
  Western Aspects requires a full aspect table; ≥3 refs.
- **cross** — `convergence` and `tensions`. ≥2 distinct modules cited.
- **life** — `character`, `vocation`, `wealth`, `relationships`,
  `family`, `health`, `mission`. The four heavy chapters
  (`vocation`, `wealth`, `relationships`, `mission`) require named
  sections, pipe tables, ≥2 modules, and ≥3 refs.
- **timing** — `year_ahead` (next 12 months) and `windows` (multi-year
  key windows). Cite `bazi_luck` / `ziwei_horoscope` / `vedic_dasha` only.
- **closing** — `methodology`. Culture / self-reflection framing;
  no facts.

## Retry, resume, and lock policy (see token-cache-policy.md)

- One chapter = one row in `premium_report_chapters`.
- Claim via `claim_premium_chapter_for_user` RPC. Lock TTL 2 min;
  expired claims auto-recycle.
- 3 attempts max per chapter. Each failure records
  `error_message`, increments `attempt_count`, releases the lock.
- After a validation failure, deterministic evidence correction runs
  once server-side before scoring the retry.
- On completion, chapter `content_hash` is stored; the report
  aggregator recomputes the report `content_hash` from all 24 rows
  in index order and marks the report `completed`.
- Re-opening a completed report loads `content_json` directly. 0 AI
  calls, `content_hash` unchanged.

## Token strategy (see token-cache-policy.md)

- Only relevant facts are sliced into each chapter prompt (BaZi facts
  for BaZi chapters, aspect list for Western Aspects, etc.).
- Methodology, formatting rules, and guardrails live in this SKILL and
  are re-summarised — never re-pasted verbatim — into prompts.
- No prior web-report body is stuffed into the prompt (the earlier
  script did this; that pattern is deprecated and must not return).
- Structured output cap per chapter is computed from
  `chapterOutputCap(spent)`; if the report-wide budget is exhausted,
  the report goes `partial` and remaining chapters stay `pending`.
- Parallel chapter generation is safe ONLY for chapters that share no
  facts slice. Current worker runs serially — keep it that way until a
  concurrency test proves the RPC lock is race-free at throughput.

## Safety and voice

- Second-person, adult, calm. No slang, no astrological jargon dumps
  without a plain-language gloss.
- Explicit disclaimer paragraph in `methodology`.
- Never claim: guaranteed income, disease diagnosis, single true
  soulmate, forced marriage year, disaster prediction, or investment
  return.
- Traditional interpretations must be labeled: "traditional BaZi
  reading suggests …" — never "you are …" in absolute terms.
- Reflective prompts ("consider whether …") are allowed and encouraged
  where the fact base is thin.

## Minimal report sample structure (shape, not content)

```
Cover
  title:    命运图书馆·深度报告
  subtitle: 融合西方 · 印度 · 八字 · 紫微

01 写在开篇的话                (cover)
02 执行摘要                    (cover, cites cross-tradition)
03 命盘全景导览                (cover, cites cross-tradition)
04 西方本命盘                  (system, western)
05 西方相位网                  (system, western + western_aspects, table)
06 印度本命图                  (system, vedic)
07 Vimshottari 大限流曜        (system, vedic + vedic_dasha)
08 八字四柱与日主              (system, bazi)
09 八字十神与五行              (system, bazi)
10 八字大运与流年              (system, bazi + bazi_luck)
11 紫微十二宫与主星            (system, ziwei)
12 紫微大限流年流月            (system, ziwei + ziwei_horoscope)
13 跨体系共识                  (cross, ≥2 modules)
14 跨体系张力与矛盾            (cross, ≥2 modules)
15 性格底色                    (life)
16 事业方向与天赋              (life, sections + table)
17 财富格局                    (life, sections + table)
18 情感与关系                  (life, sections + table)
19 家庭与家园                  (life)
20 健康与活力                  (life)
21 人生使命                    (life, sections + table)
22 未来十二个月                (timing)
23 关键时间窗口                (timing)
24 方法论与免责声明            (closing)
```

Total target: 18k–25k CJK chars (or equivalent). Exact per-chapter
targets in `chapter-manifest.md`.

## Wiring — where the code lives

| Concern                             | File                                      |
| ----------------------------------- | ----------------------------------------- |
| Skill / manifest / revision consts  | `src/lib/premium-chapters-v3.ts`          |
| Chapter catalog + validator         | `src/lib/premium-chapters-v3.ts`          |
| JSON schema + fact-aware validator  | `src/lib/chapter-json-schema.ts`          |
| Facts contract                      | `src/lib/premium-facts.ts`                |
| Server orchestration + RPC          | `src/lib/premium.functions.ts`            |
| One-shot real-AI runner (admin)     | `scripts/run-real-ai-generation.mjs`      |
| Dev harness (deterministic bodies)  | `src/lib/premium-reader-fixture.ts`       |
| Reader UI                           | `src/components/PremiumReportReader.tsx`  |
| Contract tests                      | `src/lib/premium-chapters-v3.test.ts`, `src/lib/skill-fate-nexus-premium-report.test.ts` |

When any manifest field, allowed_facts set, or evidence rule changes:
1. Edit the catalog in `premium-chapters-v3.ts`.
2. Update the mirror table in `references/chapter-manifest.md`.
3. Bump `PREMIUM_SKILL_VERSION` (semver: patch for wording, minor for
   new required sections/tables, major for new/removed chapters).
4. Bump `PREMIUM_REPORT_REVISION` — otherwise old completed rows will
   silently be reused despite the contract change.
5. Run `bun test` — the contract tests fail loudly on drift.
