# Token, cache & resume policy

## Cache key — `input_hash`

The premium report row is keyed on `input_hash`, computed by
`buildCanonicalChartInput(...)` in `src/lib/report-input.ts`.

The canonical engine input includes:

- Canonical chart fields: `birth_date`, `birth_time`, `birth_tz`,
  `birth_lat_e6`, `birth_lng_e6`, `gender`, `calendar`.
- `lang` (`"zh" | "en"`).
- `prompt_version` — set from `PREMIUM_REPORT_REVISION`.
- Facts contract version — `PREMIUM_FACTS_VERSION` participates
  transitively because the facts snapshot is regenerated when facts
  version changes and the report worker refuses stale facts.

Composition rules:
- Same user + same chart + same lang + same revision → identical hash
  → cache hit → 0 AI calls.
- Bumping `PREMIUM_REPORT_REVISION` (which callers bump alongside
  `PREMIUM_SKILL_VERSION` / `PREMIUM_MANIFEST_VERSION`) creates a new
  row; the old row's `content_json` and `content_hash` stay immutable.
- The report row does NOT depend on a specific model id. Switching
  models mid-generation (used for retry escalation) does not invalidate
  finished chapters. Model id is recorded per chapter in
  `ai_usage_ledger` for accounting.

## Immutability guardrails

- Reader path (`ensurePremiumReportForChart` → `content_json`): never
  writes on read.
- Re-opening a `completed` report performs 0 model calls. The
  `run-real-ai-generation.mjs --report <id>` re-run verifies this
  (`callsAttempted === 0`).
- `content_hash` is computed by hashing the ordered chapter body +
  refs. It MUST remain identical across re-opens; a change signals a
  contract drift and fails the integrity check.

## Token strategy

Per-chapter prompt is composed of:

1. **Guardrails (system prompt).** Short, extracted from SKILL.md. Not
   the full SKILL — a summary: "you write prose only; refs are
   advisory; output JSON per schema; no medical/marriage/income claims".
2. **Chapter contract.** Title, kind, `allowed_facts`, required
   sections, required tables, `target_chars_zh`, `min_evidence_refs`,
   `min_module_variety`. This tells the model exactly what shape to
   produce.
3. **Facts slice.** ONLY the subtree(s) of `PremiumFacts` matching the
   chapter's `allowed_facts`. Timing chapters get the timing subtrees
   (`bazi.luck`, `ziwei.horoscope`, `vedic.mahadasha`). Cross chapters
   get all four traditions but ONLY the top-level summary keys, not
   every pillar/aspect detail.
4. **Candidate evidence paths.** Server pre-selects up to N candidate
   paths from the sliced facts. The model MAY choose from these; the
   server will replace refs deterministically if the model deviates.

What NEVER goes into the prompt:
- The full previously-generated web reading — a legacy anti-pattern.
- Other chapters' bodies.
- The full facts tree for non-relevant modules.
- User PII beyond `chart_name` (which is optional).

## Output budget

- `chapterOutputCap(spent_output_tokens)` returns the remaining cap for
  the current chapter. Enforced via the provider's max-tokens field
  where applicable (OpenAI reasoning models omit `max_tokens` — see
  `run-real-ai-generation.mjs`).
- When the report-wide output budget is exhausted, the report stays
  `partial` with `stopped_reason: "report_output_exhausted"`.
  Remaining chapters remain `pending`; a later resume with budget
  continues.

## Retry & resume protocol

Chapter state machine (rows in `premium_report_chapters`):

```
pending  ──claim──▶ in_progress ──ok────▶ completed
                        │ ├─validation-fail─▶ failed (attempts<3, back to pending on next claim)
                        │ └─exception──────▶ failed (attempts<3)
                        └── lock_expired (2min TTL) ──▶ pending
```

- `claim_premium_chapter_for_user(report_id, chapter_key, user_id)`
  RPC: atomic CAS with 2-minute lock.
- On success: write `body`, `evidence_refs`, `content_hash`,
  `provider`, `model`, `input_tokens`, `output_tokens`,
  `status = completed`, release lock.
- On failure: increment `attempt_count`, set `error_message`, keep
  `status = failed` if `attempt_count >= 3`, else `pending`.
- After 24 completed rows: aggregate → `content_json`; compute report
  `content_hash`; set `report.status = completed`, `chapters_completed = 24`.

## Concurrency

- Client (`PremiumPdfCard`) polls progress and re-invokes the
  server function; server drains up to N chapters per call.
- The RPC's CAS ensures only one worker holds a chapter at a time.
- Parallel workers across chapters are safe as long as each holds its
  own lock. Cross-chapter side effects are forbidden.

## Accounting

Every successful and failed model call writes to `ai_usage_ledger`:

- `operation = "chapter_generate"`
- `report_id`, `chart_id`, `user_id`
- `chapter_key`, `attempt`, `model_id`, `provider`
- `input_tokens`, `output_tokens`
- `cost_usd_micros` (derived from published gateway rates)

The admin runner emits a per-run summary; the server also aggregates
into `premium_pdf_reports.total_input_tokens` / `total_output_tokens`.

## Bumping the cache key safely

To roll out a manifest change without breaking existing paid reports:

1. Edit code + `chapter-manifest.md`.
2. Bump `PREMIUM_SKILL_VERSION` (semver).
3. Bump `PREMIUM_REPORT_REVISION` with a new tag (e.g.,
   `premium_v3_rev_2026_08_<what_changed>`).
4. Deploy. New reports flow into a new row keyed on the new
   `input_hash`. Old reports remain readable at their old hash.
5. Do NOT delete old rows.
