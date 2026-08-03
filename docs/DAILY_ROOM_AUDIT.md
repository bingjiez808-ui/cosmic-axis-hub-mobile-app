# Daily Reading Room — Capability Audit (2026-07-21)

## Scope

Preflight audit for the "Today's Reading Room" (`/me/home`) + friend-matching
initiative. Everything documented here is verified against the current
`main` branch; anything not listed is out-of-scope for this turn.

## Existing capabilities we can reuse

| Concern | Location | Notes |
| --- | --- | --- |
| Authenticated route gate | `src/routes/_authenticated/route.tsx` | Client-only, redirects to `/auth`. Safe to add `me.home.tsx` under it. |
| Saved charts / account modal | `src/lib/account.tsx`, `src/components/AccountModal.tsx` | Local + cloud saved readings, canonical fingerprint dedup already implemented. |
| Reports repository (cloud) | `src/lib/reports-store.functions.ts` | `deleteChart`, owner-scoped fingerprint, RLS enforced. Reuse for chart management. |
| Deterministic western natal + transits | `src/lib/western-natal.ts`, `src/lib/western-transits.ts` | `astronomy-engine` powers geocentric ecliptic longitudes and orb-checked aspects. **Sufficient to build `daily-facts-v1`.** |
| Deterministic year engine | `src/lib/year-readings.ts`, `src/lib/energy-score.ts` | Reference pattern for owner + chart + date snapshotting with versioned cache keys. |
| Vedic Dasha, BaZi luck, Ziwei horoscope | `src/lib/vedic-dasha.ts`, `src/lib/bazi-luck.ts`, `src/lib/ziwei-horoscope.ts` | Provide **slower-cycle background only** (Mahadasha / Antardasha / Pratyantar; 大运+流年; 大限+流年+流月). No per-day BaZi/Ziwei/Nakshatra transit is available — must never be fabricated. |
| Community tables (posts/comments/likes) | `community_*` in Supabase | Existing report/blocking primitives; friend system will add its own tables rather than overload these. |
| Roles | `user_roles` + `has_role` | Reused for age-gate / admin overrides. |

## Contract we MUST NOT silently violate

- Premium Skill contract already declares: **"Western transits: not
  available."** The Skill remains authoritative for `fate-nexus-premium-report`.
  The new `daily-facts-v1` is a **separate deliverable** for the daily-room
  Skill; the premium report Skill contract is not changed by this work.
- Vedic per-day, BaZi per-day 干支/日运, Ziwei per-day/per-hour panels are
  **not** implemented anywhere in this codebase. AI must not invent them.
  They are the "slower cycle background" only.

## New contracts introduced this turn

| Version constant | File | Purpose |
| --- | --- | --- |
| `DAILY_FACTS_VERSION = "daily-facts-v1"` | `src/lib/daily-facts.ts` | Deterministic per-day transit facts (transit planets, transit→natal major aspects, Moon sign, phase) sampled at user-tz local-noon → UTC. |
| `DAILY_DOMAIN_SCORE_VERSION = "daily-domain-score-v1"` | `src/lib/daily-domain-score.ts` | Deterministic mapping from facts + slower-cycle background → overall + 4 domain signals (study/career/love/wealth), band, confidence, evidence refs. |
| `DAILY_READING_SKILL = "daily-reading-v1"` | `skills/fate-nexus-daily-reading/SKILL.md` | AI-explanation Skill; explains scores + FACTS only. Never computes scores. |

## Feature flag

`VITE_ENABLE_DAILY_ROOM` — off by default. When off, `/me/home` returns a
redirect to `/` inside `beforeLoad`, and no navigation link is rendered.
This keeps the production surface unchanged until the flag is flipped.

## Pending (not delivered this turn)

- Compatibility calculator `compatibility-score-v1` and the entire friends
  subsystem (invites, consents, snapshots, notifications, blocks, reports).
  Tables sketched in `supabase/pending/20260721_daily_room_and_friends.sql`
  but not executed.
- Saved-charts management (rename / soft-delete + undo / permanent delete)
  UI on the home page — the underlying `deleteChart` server function exists.
- Playwright end-to-end drills at 1440 / 430 / 390 px viewports.
- Age gate for minors (requires product policy input on minimum age +
  consent copy).

These are called out explicitly in the closing note of this turn.
