
# Life Guidance v1 — Curator Letter, Life Chapter, Historical Echoes

Ships on the live V1 surfaces (`/`, `/me/home`) — no V2 fork, no production release. Preserves today's daily reading, chart, membership, and community features. All copy is deterministic (0 AI tokens). Full zh/en parity, reduced-motion aware, iPhone 16 safe.

Schema/version constant: `LIFE_GUIDANCE_VERSION = "life-guidance-v1"`.

## 1. Landing page — Curator's Letter (`/`)

New immersive block inserted between the hero and the Four Traditions section, on the narrative path to the existing `/ritual` CTA. Not a wall of text.

- Default view: two short lines from the letter, rendered as a barely-open leather book (SVG spine + page edges, faint stardust particles, gold seal).
- CTA `翻开馆长序言 / Open the Curator's Letter` toggles the book open (150–600ms flip; environment particle drift 8–20s; `prefers-reduced-motion` → cross-fade only, no transforms).
- Expanded body: 5 short refined paragraphs distilled from the brief (no fatalism, no "chart decides your ceiling"; charts show tendencies/conditions/possibilities; agency stays with the reader).
- Trailing CTAs inside the opened letter:
  - `开始认识自己 / Begin knowing yourself` → `/ritual` with existing `returnTo`.
  - `看看与我同龄的人在为什么困惑 / See what peers are wrestling with` → `/me/home#life-chapter` (unauth → `/auth?returnTo=/me/home%23life-chapter`).
- Component: `src/components/CuratorLetter.tsx`. Copy lives in `src/lib/life-guidance-v1.ts` under `curatorLetter.{en,zh}` so it stays testable.

## 2. `/me/home` — "此刻的人生页码 / Life Chapter Right Now"

Inserted after the today summary, before the 7-day trend area (compass block stays as-is; the removed 7-day orbit is not re-added).

- Age computed from the primary chart's birth date in the viewer's local timezone (integer years). No AI, no random.
- 5 deterministic stage templates: `learning_self / early_adulthood / building_life / midlife_reassessment / maturity_legacy`.
- Default stage from age; user can tap `这不像我现在的阶段 / This isn't my current chapter` to pick another. Persisted via `user_preferences` (see §4). While unauth or before save, override lives in `localStorage` with a clear "saved locally" note — never faked as cloud-saved.
- Card body: exactly 2–4 short lines — stage resonance sentence, one concrete action anchored to today's `priorityDomain`, one "no need to rush / watch out for" gentle line. All from templates keyed by `(stage, priorityDomain, lang)`.
- Three link buttons:
  - `这个阶段，我最需要学会什么？` → inline expand (stage lesson).
  - `为什么我总觉得自己落后？` → inline expand (peer-anxiety reframe).
  - `看看历史上谁也经历过这一章` → smooth-scroll to Historical Echoes.
- Empty state (no primary chart): explicit CTA to `/ritual`; no fabricated personalization.
- Components: `LifeChapterCard`, `LifeStageSelector`, `NextPageNote`.

## 3. Historical Echoes (`/me/home`, collapsible)

Curated static dataset in `src/lib/life-guidance-v1.ts` under `historicalFigures`. No AI, no random. Each stage × domain surfaces ≥3 figures across eras/cultures using widely accepted public biography (no invented quotes, no chart-similarity claims, no diagnoses).

- Matching: (`selectedStage`, `priorityDomain`) → figure list (deterministic order). Header line: `处境主题相近，不代表命格或结局相同`.
- Each `HistoricalFigureCard`:
  - 当时的处境 · Situation
  - 面对的矛盾 · Tension
  - 做出的选择及代价 · Choice & cost
  - 可以借鉴 / 不能照搬 · Borrow / Don't copy
- Visual: biography card pulled from a shelf. Keyboard prev/next (`←`/`→`), touch swipe, focus ring, `role="group" aria-roledescription="card"`. Mobile: horizontal snap-scroll inside a `overflow-x-auto` rail; parent page never overflows horizontally.
- Fixed closing block (`NextPageNote`): the two closing sentences from the brief + two buttons: `夹入我的书签 / Bookmark this echo` and `写下我的回应 / Write my response`.
- Bookmark / response persist to `life_bookmarks` + `life_responses` (see §4). Unauth → login with `returnTo` back to `/me/home#historical-echoes`.

## 4. Database (single migration)

- `public.user_preferences` (created only if missing): `user_id uuid PK`, `life_stage text CHECK IN (...)`, `life_stage_source text CHECK IN ('auto','user')`, timestamps. Grants + RLS: owner-only CRUD.
- `public.life_bookmarks`: `id`, `user_id`, `figure_key text`, `stage text`, `domain text`, `created_at`. Unique `(user_id, figure_key)`. Grants + RLS.
- `public.life_responses`: `id`, `user_id`, `figure_key text`, `stage text`, `domain text`, `body text CHECK length ≤ 1200`, `created_at`, `updated_at`. Grants + RLS.
- All three: `GRANT SELECT/INSERT/UPDATE/DELETE ON ... TO authenticated; GRANT ALL ... TO service_role;` and policies scoped to `auth.uid() = user_id`.

## 5. Server functions

`src/lib/life-guidance.functions.ts` (auth-required):
- `getLifeStagePreference()` / `setLifeStagePreference({ stage, source })`
- `listLifeBookmarks()` / `toggleLifeBookmark({ figureKey, stage, domain })`
- `listLifeResponses({ figureKey? })` / `upsertLifeResponse({ figureKey, stage, domain, body })` — trims, HTML-escapes to plain text, rejects >1200 chars.

## 6. Component & lib architecture

```
src/components/
  CuratorLetter.tsx
src/experiences/life-guidance/
  LifeChapterCard.tsx
  LifeStageSelector.tsx
  HistoricalEcho.tsx
  HistoricalFigureCard.tsx
  NextPageNote.tsx
src/lib/
  life-guidance-v1.ts        // pure data + selectors (age→stage, stage×domain→figures, templates)
  life-guidance.functions.ts // server fns
  life-guidance.test.ts      // deterministic tests
```

UI components take structured props only — they never compute chart facts. All copy is keyed by `lang` from existing `useLang()`. Existing floating elder icon stays; new blocks respect its safe area.

## 7. Tests (`bun test`)

- Age calc: birthday day-before/day-of/day-after, Feb 29 born, timezone-local date.
- Age → default stage mapping; user override wins.
- Determinism: same `(stage, domain, day, lang)` → identical strings.
- Priority-domain → action + figure list mapping.
- Unauth bookmark/response → returns `requiresAuth` intent with correct `returnTo`.
- zh/en key parity across curator letter, stage templates, figure cards.
- Reduced-motion: `CuratorLetter` renders no transform styles when the hook reports true.
- Snapshot: `me/home` container class list — no `overflow-x` on `<body>`/root.

## 8. Verification

`bun test`, `bunx tsgo --noEmit`, `bun run build`. Manual check on preview: `/`, `/me/home` at iPhone 16 (390px) + desktop, zh/en toggle, unauth CTA redirects, reduced-motion. Report commit SHA, changed files, migration summary, RLS notes, preview URL. Do not publish.

## Safety copy

Footer strip on the new blocks: `文化与自我反思用途，不替代心理、医疗、法律或财务专业帮助。` / `Cultural & self-reflection use only; not a substitute for professional mental-health, medical, legal or financial help.` Reuse existing crisis link if present.
