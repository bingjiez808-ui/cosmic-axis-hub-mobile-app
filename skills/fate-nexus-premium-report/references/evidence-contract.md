# Evidence contract

Every `evidence_ref` inside a chapter's `content_json.evidence_refs`:

```ts
{
  path:       string,                          // dot / [i] path into PremiumFacts
  module:     FactModule,                      // must be in chapter's allowed_facts
  confidence: "grounded" | "traditional" | "reflective"
}
```

## Path shape

Regex (enforced in `EvidenceRefSchema` and `validateV3Content`):

```
^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*|\[\d+\])*$
```

Examples:

- `bazi.pillars.day.stem`
- `bazi.luck.cycles[3].start_year`
- `ziwei.palaces[0].main_stars[0]`
- `western.aspects[12].orb_deg`
- `vedic.mahadasha[2].lord`

## Module classification

The server maps a resolved path to its most specific module (see
`classifyPathModule` in `scripts/run-real-ai-generation.mjs`):

| Path prefix                                | Module            |
|--------------------------------------------|-------------------|
| `bazi.luck…`                               | `bazi_luck`       |
| `bazi.*` (anything else under bazi)        | `bazi`            |
| `ziwei.horoscope…`                         | `ziwei_horoscope` |
| `ziwei.*`                                  | `ziwei`           |
| `western.aspects…`                         | `western_aspects` |
| `western.*`                                | `western`         |
| `vedic.mahadasha…` / `vedic.dasha…`        | `vedic_dasha`     |
| `vedic.*`                                  | `vedic`           |

A ref whose `module` field does not match the classified module for its
path is a validation error — the server MAY correct it deterministically,
but MUST NOT persist a mismatched pair.

## Resolution

`resolveFactsPath(facts, path)` walks the dotted/bracketed segments.
Returns `undefined` or `null` when the path does not resolve; both are
treated as unresolved. Unresolved paths fail
`validateChapterAgainstFacts` with `unresolved_evidence_path:<path>`.

## Confidence tiers

| Tier          | Meaning                                                                                              |
|---------------|------------------------------------------------------------------------------------------------------|
| `grounded`    | The path resolves to a concrete factual value (stem, star name, aspect orb, dasha lord).             |
| `traditional` | The chapter interprets a schoolbook meaning of a real fact (e.g., "traditional BaZi reading of …"). |
| `reflective`  | Self-reflection prompt anchored on a real fact ("consider how the Moon in H10 shapes ambition").     |

System chapters (BaZi, ZiWei, Vedic, Western sub-chapters) MUST include
≥1 `grounded` ref. Cross-tradition chapters may mix tiers but need ≥2
distinct modules regardless of tier.

## Server-side deterministic correction

Model output for `evidence_refs` is treated as advisory. Before persisting,
the server runs `chooseDeterministicRefs(meta, facts, allFactsPaths)`:

1. Collect every scalar-leaf path in `facts` that matches the chapter's
   `allowed_facts`.
2. Sort deterministically.
3. For cross chapters: pick one path from each of the first
   `max(2, min_refs)` modules present.
4. Fill up to `max(min_refs, cross ? 3 : 2)` via round-robin over
   modules present, skipping already-cited paths.

The chosen refs REPLACE the model refs only when the model refs fail
validation. Body text is never rewritten.

## Failure categories

| Category                          | Trigger                                                                                                        | Server action                                              |
|-----------------------------------|----------------------------------------------------------------------------------------------------------------|------------------------------------------------------------|
| `no_json_object`                  | Response has no `{…}` payload                                                                                  | Record `error_message`, retry (attempts < 3)                |
| `bad_json:<msg>`                  | JSON.parse threw                                                                                               | Retry                                                       |
| `schema:<path>:<msg>`             | Zod validation failed (extra keys, wrong types)                                                                | Retry                                                       |
| `empty_body`                      | Body trimmed to empty                                                                                          | Retry                                                       |
| `no_evidence_refs`                | AF non-empty, refs empty AND deterministic correction found no candidates                                       | Retry with different model on next attempt if configured    |
| `unresolved_evidence_path:<path>` | Path failed `resolveFactsPath`                                                                                 | Deterministic correction attempted; if still failing, retry |
| `disallowed_fact_module:<m>`      | Ref module not in `allowed_facts`                                                                              | Deterministic correction attempted; else retry              |
| `cross_chapter_needs_two_modules` | Cross chapter cites <2 modules                                                                                 | Deterministic correction attempted; else retry              |
| `insufficient_evidence_refs:X/Y`  | Fewer refs than `min_evidence_refs`                                                                             | Retry                                                       |
| `insufficient_module_variety:X/Y` | Fewer distinct modules than `min_module_variety`                                                                | Retry                                                       |
| `missing_section:<key>`           | Required section marker missing from body                                                                       | Retry                                                       |
| `missing_table:<key>`             | Required table title missing OR no pipe in body                                                                 | Retry                                                       |

Three failed attempts → chapter stays `failed`; report goes `partial`.
The admin runner `run-real-ai-generation.mjs --reset --only=<keys>` is
the only sanctioned way to reset attempts on a partial report.

## What the model must never do

- Compute or invent pillars, stem/branch pairs, star placements, house
  cusps, aspect orbs, dasha spans, transits.
- Cite paths that don't exist in the provided FACTS block.
- Return extra keys, prose outside JSON, or wrap output in code fences
  without a valid JSON payload.
- Cite modules outside the chapter's `allowed_facts`.
- Claim guaranteed marriage, income, health, or disaster outcomes.

## Four-system coverage contract (v2026-07-30)

Every generator that reads a natal chart — the free `/report` reader, the
premium chapters, the outlook / key-events tools and the oracle — MUST be
handed all four systems, in this order:

| System | Prompt field | Minimum fact |
|---|---|---|
| 西方占星 / Western | `planets` | sign + house of at least the luminaries |
| 八字 / BaZi | `bazi` | four pillars incl. day-master stem |
| 印度占星 / Jyotish | `vedic` | sidereal Asc, Moon nakshatra + pada, current Vimshottari dasha |
| 紫微斗数 / Zi Wei | `ziwei` | five-elements class, body star, 12 palaces with main stars |

Runtime enforcement lives in `src/lib/four-system-brief.ts`:

- `buildFourSystemFacts(snapshot)` — client side; produces the `vedic` /
  `ziwei` prose lines plus a `coverage` map. Gender is required for Zi Wei
  and birth time + resolvable birthplace for Jyotish; when one is missing
  the system is reported missing, never approximated.
- `systemCoverageFromFacts(...)` + `coverageDirective(...)` — server side;
  injects an explicit line naming which systems are present and which are
  absent. A missing system must be declared in the prose
  ("本次缺少 X 排盘"), never fabricated.
- `crossSystemDirective(lang)` — the synthesis rule: `synthesis` must name
  the 2–3 systems that **converge**, the system that reads it
  **differently**, and end with one combined conclusion. Four parallel
  monologues are not a synthesis. Single-system claims must be labelled
  「单体系参考」 / "single-system reference".

## Concern promise contract

When the visitor entered through 「今天你带着什么问题来到这里」 the homepage
already showed them three 「这次阅读会帮你分清」 cards
(`src/lib/concern-reading-guide.ts`). `concernFocusDirective(concern, lang)`
injects those three cards into the prompt, and the generated chapter MUST
answer all three — spread across `synthesis` / `plain` / `details` — each
anchored to a real chart fact from one of the four systems.
