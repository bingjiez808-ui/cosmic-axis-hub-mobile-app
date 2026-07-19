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
