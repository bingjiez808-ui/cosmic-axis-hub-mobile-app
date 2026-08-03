# V1 Integration Contract · Panorama Tour

Status: **draft / not wired into V1**. This document defines exactly how the
V2 Panorama Tour (`src/experiences/library-v2/panorama/`) will plug into the
real V1 ritual → chart → report flow. The V2 Demo currently runs on
`DEMO_PANORAMA_FACTS`; production adoption is a follow-up turn.

## When to trigger

The tour is shown **once, immediately after** the ritual completes and the
deterministic four-system `PremiumFacts` row is saved. Preconditions:

1. `charts.calculation_status = 'ready'` for the current `chart_id`.
2. `premium_facts_v4` row exists for that `chart_id`.
3. `v2_panorama_tour.tour_completed_at IS NULL` for `(user_id, chart_id)`.

On revisit — condition (3) false — the ritual completion screen instead
shows two neutral entry points:

- **继续上次阅读** → last `overview_nav_position`, else `shelf`.
- **重新打开全景导览** → resets `tour_completed_at` to null after explicit
  confirmation.

Do **not** re-trigger the tour automatically on every login.

## Data seams

| Concern | Source | Adapter |
| --- | --- | --- |
| Facts input | `premium_facts_v4` row | `buildPanoramaFactsFromPremium` (already in `panorama/adapter.ts`) |
| Score computation | `computeDomainScores(input)` | deterministic, cached by `chart_id + facts_hash + domain-score-v1` |
| Recommendation | `recommendFirstRead(scores, previewCounts)` | preview counts come from the destiny-map interaction; default `{}` |
| Reading content | `guided-domain-reading-v1` skill | server function to be added; **not** shipped in this turn |
| Persistence | `v2_domain_scores_v1`, `v2_domain_readings_v1`, `v2_panorama_tour` | tables defined in the pending SQL below |

## Cache key contract

Domain score cache row identity:

`(chart_id, facts_hash, calculation_version)`  → unique constraint.

Guided reading cache row identity:

`(chart_id, facts_hash, domain, score_hash, skill_version, lang)`

where `score_hash = fnv1aHex(canonicalJson(domain_score_result))`.

A read hitting a valid cache row must never call any AI provider — this is
tested in the Demo via `validateGuidedReading` and, at V1 integration time,
must be enforced by a `callsAttempted === 0` assertion in the same style as
`premium-inmem-integration.test.ts`.

## Auth & privacy

- All tour tables are `owner`-scoped by `user_id` with RLS mirroring the
  existing `premium_reports` policies. A user can only ever read/write
  their own rows.
- No raw birth data flows into scores or readings — only the derived
  `PremiumFactsLike` values consumed by the adapter.
- Public-community endpoints must never receive any panorama field. The V2
  `assertNoBirthLeak` helper is extended to cover
  `DomainScoreResult.evidence_refs` (already whitelisted paths, no PII).

## Guardrails

- Missing systems: `available: false` with a `reason_codes` array; UI shows
  "该证据暂不可用" — never invents a contribution.
- Score wording: UI labels the metric as "领域信号" or "阅读顺序推荐"; the
  strings "成功率 / 好运 / 幸运指数" are forbidden and enforced by a
  content-lint test.
- Recommendation is a reading order, never a fate conclusion. The visible
  disclaimer `这是阅读顺序推荐，不是命运结论。` is required copy.
- `overview` remains a fully neutral branch; scores and recommendation
  never bias toward `career` when the user picks overview from the destiny
  map.

## Pending migration outline (not executed here)

```sql
-- v2_domain_scores_v1
create table public.v2_domain_scores_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chart_id uuid not null,
  facts_hash text not null,
  calculation_version text not null default 'domain-score-v1',
  scores jsonb not null,
  calculated_at timestamptz not null default now(),
  unique (chart_id, facts_hash, calculation_version)
);
grant select, insert on public.v2_domain_scores_v1 to authenticated;
grant all on public.v2_domain_scores_v1 to service_role;
alter table public.v2_domain_scores_v1 enable row level security;
create policy own_read on public.v2_domain_scores_v1 for select
  to authenticated using (user_id = auth.uid());
create policy own_write on public.v2_domain_scores_v1 for insert
  to authenticated with check (user_id = auth.uid());

-- v2_domain_readings_v1  (same shape, plus domain + score_hash + skill_version + lang)
-- v2_panorama_tour        (user_id, chart_id, tour_completed_at, overview_nav_position, selected_domain, reading_status jsonb)
```

Do not apply until the V1 ritual code actually wires the tour in.

## Rollback

Because the Panorama Tour lives entirely under
`src/experiences/library-v2/panorama/`:

1. Delete the panorama directory.
2. Remove the two doc references (this file + the section in
   `LIBRARY_V2_GUIDED_EXPERIENCE.md`).
3. If the pending SQL above has been applied, drop the three tables.

V1 code is untouched by this integration contract until a future turn
explicitly wires it in.
