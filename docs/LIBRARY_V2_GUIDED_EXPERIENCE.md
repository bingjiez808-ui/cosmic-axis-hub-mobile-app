# Guided Library V2 · Story Chain Demo

- **Version constant:** `LIBRARY_EXPERIENCE_VERSION = "library-v2-guided-2026-07"`
  (see `src/experiences/library-v2/version.ts`)
- **Preview URL (Lovable Preview / Local only):** `/dev/guided-library-v2`
- **Status:** demo / fixture-only. Not wired to accounts, AI, or payments.
  V1 (`/`, `/ritual`, `/report`, …) is byte-identical.

## 1. What this is

Guided Library V2 is a **second, parallel** landing-to-notes experience
that lives entirely under `src/experiences/library-v2/`. It is only
reachable from the DEV / Preview route `/dev/guided-library-v2` after
the pure guard `isGuidedLibraryV2PreviewAllowed({hostname,isDev})`
returns `true` (see `preview-guard.ts`). The production Lovable
subdomain — `fate-nexus-ai.lovable.app` — and every other host renders
"Not available".

V2 does not import V1 business logic, does not read/write customer
data, and never calls the AI gateway or payment endpoints. The route is
excluded from `src/routes/sitemap[.]xml.ts` and always ships
`<meta name="robots" content="noindex,nofollow" />`.

## 2. Story chain (single route, internal state machine)

```
gate  →  focus  →  intake_name  →  intake_birth  →  intake_place
                              →  first_insight  →  shelf
                                                       ↕
                    history  ⇄  figure   recommendations   notes
                                                            ↕
                                                    note_compose
                                                    note_detail
```

Each screen has one primary CTA; `Esc`/focus/ARIA/44px touch/safe-area
paddings and `prefers-reduced-motion` are all honoured. State persists
in `localStorage` under `lod:library-v2:story-state:v1` so refresh
resumes where the reader left off.

## 3. Files

```
src/experiences/library-v2/
  version.ts             Frozen version constant.
  preview-guard.ts       Pure guard (unchanged).
  GuidedLibraryV2.tsx    Story-chain container + all screens.
  fixtures.ts            Legacy V1-side helpers kept for the old contract test.
  state.ts               Legacy card helpers kept for the old contract test.
  library-v2.test.ts     Original contract tests (still pass).
  story/
    types.ts             Story types (Reader / Note / Figure / Insight).
    state.ts             Pure intake state machine, age-band derivation, copy.
    fixtures.ts          Books (7), historical figures (8), insights, seed notes.
    matching.ts          Deterministic matching for figures / notes / recs.
    privacy.ts           Public payload whitelist + assertNoBirthLeak.
    storage.ts           Versioned localStorage helpers.
    repository.ts        Fixture-backed repository (single seam for cloud mode).
    story.test.ts        Story-chain unit tests.

supabase/pending/20260720_library_v2.sql
  Pending migration for the future cloud backend (v2_* tables + RLS
  + GRANTs + hard-purge scaffold). NOT executed automatically — the
  Demo runs on the fixture repository. Apply through the migration
  tool and flip BACKEND_MODE when ready.
```

## 4. Story chain — screen checklist

1. **Gate.** Full-height obsidian panel. Copy: “每一种文明，都在追问同一个问题 / 你，是谁？”, single CTA `步入图书馆`.
   0.55 s golden halo transition; reduced-motion collapses to instant.
2. **Destiny Map.** Star-atlas layout with five explorable nodes: `overview / career / love / wealth / recent`. Desktop shows a radial map (glowing centre "此刻的我 · 起点" + dashed golden paths); mobile falls back to an S-curve vertical journey. Node captions are neutral (no leading questions, no "注定/必然" language). Clicking a node opens a `ChapterPreviewPanel` describing 分析什么 (3) / 你会获得 (2) / 使用的解读模块, plus the fixed disclaimer "结果用于自我理解，不替代医疗、法律或投资建议". Only the panel's `从这一章开始` commits a topic and advances to intake; `返回地图` closes without losing exploration bookmarks. `overview` is UX-only and safe-maps to `career` for matching, with a `reading_history` marker so downstream shelf/recs are unaffected. Keyboard: Tab through nodes, Enter/Space opens preview, Esc closes; `aria-pressed` on hover-open, `aria-current` on committed topic.
3. **Intake (three steps).** 昵称+性别 / 出生日期+时间(可勾"不知道准确时间") / 出生城市. Each input is `text-[16px]` so mobile Safari never zooms; every step ≥44px controls; every step lets you go back one step.
4. **First insight.** One strong Demo insight per topic + three drawers (为什么/怎么做/何时变化). Drawer traps focus, locks body scroll, closes on `Esc`, portals to `document.body`.
5. **Shelf.** 7 books: `self / career / love / wealth / timeline / premium / sage`. Highlighted `你正在阅读` + up to two `推荐下一页`. Reading a book is Demo (quick + optional deep).
6. **History echoes.** 8 curated fixture figures (mixed east/west, ages 25-49). Filters: 全部 / 东方 / 西方 / 做出不同选择的人. Detail view: 面对什么 / 如何选择 / 带来什么 / 代价 / 可迁移的经验 + 与你的关系(保留/停止/开始) + 来源占位 + 过度类比警示. Closing quote is fixed and required.
7. **Recommendations.** ≤3 items derived from `age × topic × unread`. Each item shows `为什么推荐给我`. Topic is switchable inline.
8. **Notes.** Public list scoped to the reader's topic. Compose covers audience mode (`similar / opposite / experienced / librarian`) + topic + body (≤800 chars) + optional single image (local `FileReader` preview, MIME + 5 MB guardrails, **never uploaded** in the Demo). Detail view lists structured replies; readers may reply, self-delete their own notes/replies.

## 5. Privacy invariants

- No V2 fixture, matcher, or public payload ever contains raw birth
  date, birth time, city, gender or chart JSON. `privacy.ts`'s
  `assertNoBirthLeak` runs on every `create*` call and is exercised in
  `story.test.ts`.
- `noteTraitsFor` returns only abstract phrases (`人生阶段相近 / 责任模式相似 / 互补视角 / 走过这段的人 / …`). No probabilities, no "same fate" claim.
- Historical-figure matching is topic + age-band + tradition only; a `warning` field is required on every figure so the UI can print the过度类比 note.

## 6. Cloud migration path

When V2 is ready for production data:

1. Run `supabase/pending/20260720_library_v2.sql` through the migration
   tool and generate types.
2. Flip `BACKEND_MODE` in `story/repository.ts` from `'fixture'` and
   wire the equivalent server functions (`v2.list_notes`,
   `v2.create_note`, etc.). All UI already routes through the
   repository seam.
3. Add a `functionMiddleware`-authenticated wrapper for note-writes;
   surface public reads through a `TO anon` SELECT path already
   defined in the migration.
4. Only after cloud parity: consider promoting `/dev/guided-library-v2`
   to a real URL (still off the sitemap by default).

## 7. Rollback

Because V1 has no dependency on V2, rollback is:

1. Delete `src/routes/dev.guided-library-v2.tsx`.
2. Delete `src/experiences/library-v2/`.
3. Delete `supabase/pending/20260720_library_v2.sql`.
4. Delete this document.

Nothing else needs to change.
