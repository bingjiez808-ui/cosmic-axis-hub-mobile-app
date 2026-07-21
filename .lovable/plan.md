# Plan: i18n for Daily Room / Friends / Match + Login Entry

## Scope (V1 only)
Refactor three preview pages to full zh/en, wire language to Intl formatting, expose a "Today" entry across nav + account center, and route post-login default to `/me/home`. No DB migrations, no publish, no changes to deterministic scoring or ephemeris. Existing i18n dict expands; nothing hardcoded on these pages.

## 1. i18n dictionary (`src/lib/i18n.tsx`)

Add a new `daily` namespace section to `Dict` and to both `zh` / `en` dicts. Groups:
- Nav / entry: `nav_today`, `today_card_title`, `today_card_open`, `today_card_score_label`.
- Daily room: header, welcome, evidence toggle, fixture labels, entitlement toggle, missing chart notice, empty states, loading/error.
- Domains: `domain_study | career | love | wealth` labels + short descriptions.
- Bands: `band_supportive | neutral | mixed | caution`.
- Confidence: `confidence_high | medium | low`.
- Enumerables shown to user (via translator maps, never raw keys):
  - `planet_*` (sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, north_node, south_node, chiron).
  - `aspect_*` (conjunction, opposition, trine, square, sextile, quincunx).
  - `sign_*` (12 zodiac).
  - `phase_*` (moon phases: new, waxing_crescent, first_quarter, waxing_gibbous, full, waning_gibbous, last_quarter, waning_crescent).
- Friends: request states (pending/accepted/blocked/declined), invite methods (link/username/one_time_code), buttons (send/accept/decline/withdraw/remove/block/unblock/report), inbox empty, 5 note templates, 4 report categories, consent revoked banner.
- Match: mode (friendship / romantic partner / co-founder), facets (communication, emotional_support, action_tempo, boundary_repair, growth), section headings (resonance / complements / friction / advice / evidence / disclaimer), revoked panel, missing-facts notice.
- Consent gate (`SocialConsentGate`): all its Chinese literals become dict entries with `SOCIAL_MIN_AGE` interpolation.

Add helper `formatDate(date, lang, tz)` and `formatNumber(n, lang)` wrappers using `Intl` — used everywhere the pages currently pass `today` / scores.

## 2. Cache & determinism
- `daily-facts-v1` and `daily-domain-score-v1` outputs stay language-agnostic (keys/enums preserved).
- Only human-readable rendering uses the translator maps.
- If any explanation cache key surfaces (currently these pages don't cache explanation text — supportive/caution strings are literal fixtures), extend its key with `:${lang}` so switching language regenerates the localized string. Deterministic scores must NOT depend on lang.

## 3. Page rewrites

### `src/routes/_authenticated/me.home.tsx`
- Replace every literal with `t.*`.
- Domain labels via `domainLabel(t, key)`; band pills via `bandLabel(t, band)`.
- Fixture labels come from `loadDailyRoomFixture(...).label` — keep raw fixture label (each fixture is age-scenario named); wrap with a translator map `t.fixture_student_youth` etc.
- Moon phase renders via `t.phase_*`.
- Supportive/caution demo fallback strings become `t.today_supportive_demo_1..3` / `t.today_caution_demo_1..3`; skill-driven strings pass through (already deterministic, but wrap with note that these come from fixtures — leave contents intact in the demo since fixtures are pre-authored Chinese; add English variants in the fixture consumer via a `localizeSignal(t, s)` no-op fallback — if a signal doesn't have a locale mapping, we still render it verbatim; document this limitation).
- Add secondary nav row (Home / My Charts / Friends / Match) using `<Link>`.
- Intl date formatting via `formatDate(new Date(), lang, tz)` for the today string.

### `src/routes/_authenticated/me.friends.tsx`
- Full literal → `t.*`.
- Note templates rebuilt from `t.note_templates` (readonly string[5]).
- Report categories from `t.report_categories` (readonly string[4]).
- Consent gate wrapped by translated messages.
- Empty states, inbox, buttons all translated.

### `src/routes/_authenticated/me.match.tsx`
- Full literal → `t.*`.
- Facet labels via `t.facet_*` map, mode labels via `t.match_mode_*`.
- "Compatibility is not a success rate" disclaimer via `t.match_disclaimer`.
- Missing facts list translated with `t.missing_fact_*` fallback → raw key when unmapped.

### `src/experiences/daily-room/social-consent.tsx`
- All Chinese literals through `t.consent_*` with `{age}` interpolation.

## 4. Entry points

### Post-login default (`src/routes/auth.index.tsx`)
- On successful sign-in, if a `redirect` search param is present, honor it. Otherwise navigate to `/me/home` (currently probably `/` or `/ritual`).

### Account center / desktop nav
- `AccountModal` header row + main site nav (whichever component renders the account menu link) get a new "今日命运 / Today" link at the top of the personal section, pointing to `/me/home`.
- On mobile drawer: "Today" is the first item under the personal section.

### `/me/home` secondary nav
- Header row with three tabs: "我的命盘 / My Charts" (opens AccountModal or `/report`), "好友 / Friends" (`/me/friends`), "适配分析 / Match" (`/me/match`).

### Account modal "Today Card"
- Add a card at the top of `AccountModal` (above "我的命盘与报告") in the black-gold library aesthetic. Shows: "今日星图 / Today's Star Chart", a small overall score preview (uses the same daily-facts pipeline against user's default chart via the existing adapter; if no chart or unentitled preview, show a subdued CTA "打开今日阅览室"). Not crowded on mobile — one line + one button, no horizontal overflow.

## 5. Auth still enforced
Existing `_authenticated/route.tsx` gate is untouched. Unauthenticated `/me/home` etc. still bounce to `/auth`. Preview-guard `ensureSocialPreviewAllowed` unchanged.

## 6. Tests
- New `src/lib/i18n-missing-keys.test.ts` — asserts every key present in `en` exists in `zh` and vice versa, and that new keys `nav_today`, `today_card_title`, `domain_study`, all `planet_*`, `aspect_*`, `sign_*`, `phase_*`, `band_*`, `confidence_*`, `facet_*`, `match_mode_*`, `consent_*` are present.
- Extend an existing route test (or add lightweight snapshot) to render `/me/home` in both langs and assert no literal Chinese in English mode / vice versa for known selectors.
- `tsgo` + `bunx vitest run` full suite.

## 7. Visual verification
- Playwright driven, `/me/home` `/me/friends` `/me/match` at 390 / 430 / 1440, in both langs. Assert `scrollWidth === innerWidth`, zero console errors, no nested buttons, entry card visible on account modal.

## 8. Non-goals / explicit constraints
- No DB migrations, no publish.
- No changes to deterministic score outputs.
- No copy from third-party creators (陶白白 etc.) — all copy is Fate Nexus original.
- Existing user-generated same-lang same-day results (none cached yet on these routes) unchanged; if a future cache is added elsewhere, key includes `:${lang}`.

## Deliverables
List of edited files, new i18n key count, test count, visual screenshots at three widths × two langs, and note on real signed-in path (which still needs manual login on the preview host, matching prior turns).
