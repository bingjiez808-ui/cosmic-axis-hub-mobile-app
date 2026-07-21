# daily-reading-v1 — output schema

Strict JSON. Any extra top-level key REJECTED.

```
{
  "skill_version": "daily-reading-v1",
  "date": "YYYY-MM-DD",
  "timezone": "IANA/Zone",
  "chart_reference": {
    "chart_id": "uuid",
    "display_name": "string (privacy-safe alias; not full birth data)"
  },
  "one_line_theme": "≤ 40 zh chars",
  "four_domain_summary": {
    "study":  { "line": "string ≤ 80 zh chars", "evidence_refs": [ "..." ] },
    "career": { "line": "string ≤ 80 zh chars", "evidence_refs": [ "..." ] },
    "love":   { "line": "string ≤ 80 zh chars", "evidence_refs": [ "..." ] },
    "wealth": { "line": "string ≤ 80 zh chars", "evidence_refs": [ "..." ] }
  },
  "supportive_signals": [
    { "text": "string", "evidence_refs": [ "..." ], "confidence": "low|medium|high" }
  ],
  "caution_signals": [
    { "text": "string", "evidence_refs": [ "..." ], "confidence": "low|medium|high" }
  ],
  "do_today":       [ "action ≤ 60 zh chars", "…", "…" ],
  "observe_today":  [ "watch ≤ 60 zh chars",  "…", "…" ],
  "counterconditions": [ "如果现实情况不同，以现实为准，例如…" ],
  "reflection_question": "one self-inquiry prompt",
  "evidence_index":   [ "path", "…" ],
  "confidence":       "low|medium|high",
  "missing_facts":    [ "e.g. natal_ascendant_and_houses" ],
  "method_limits":    [ "e.g. 单日一次采样于当地正午" ]
}
```

## Rules the validator enforces

- Every `evidence_refs` entry MUST match one of the paths listed in
  `daily-facts-contract.md`.
- `supportive_signals` and `caution_signals` items with `confidence` of
  `medium` or `high` MUST cite at least two distinct evidence paths.
  Otherwise `confidence` MUST be `low` and the text MUST contain the
  string `单体系参考`.
- `do_today` / `observe_today` must be 2–3 entries each.
- `counterconditions` must contain at least one entry.
- `missing_facts` must be present (may be `[]` if none).
