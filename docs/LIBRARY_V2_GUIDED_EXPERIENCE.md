# Guided Library V2 · Isolated Experience

- **Version constant:** `LIBRARY_EXPERIENCE_VERSION = "library-v2-guided-2026-07"`
  (see `src/experiences/library-v2/version.ts`)
- **Preview URL (dev only):** `/dev/guided-library-v2`
- **Base commit:** `a358a5319c4206bffa62c644ca50720c674b7ed4`
- **Status:** demo / fixture-only. Not wired to accounts, AI, or payments.

## 1. What this is

Guided Library V2 is a **second, parallel** landing-to-reader experience
that lives entirely under `src/experiences/library-v2/` and is only
reachable from the DEV-only preview route `/dev/guided-library-v2`.

V1 (`/`, `/ritual`, `/report`, and everything else under `src/routes/`)
is unchanged. V2 does not import V1 business logic, does not read/write
customer data, and never calls the AI gateway or payment endpoints.

## 2. Files

| Path | Purpose |
| ---- | ------- |
| `src/experiences/library-v2/version.ts` | Frozen version constant + focus type. |
| `src/experiences/library-v2/fixtures.ts` | Six demo books + focus-ordered recommendations. All copy is fixture. |
| `src/experiences/library-v2/state.ts` | Pure state helpers for the borrow-card / step machine. |
| `src/experiences/library-v2/GuidedLibraryV2.tsx` | Root component: home → borrow card → archive → library → reader. |
| `src/experiences/library-v2/library-v2.test.ts` | Focus ordering, card machine, book content contract, V1-isolation guards. |
| `src/routes/dev.guided-library-v2.tsx` | Dev-only route, gated on `import.meta.env.DEV`. `robots: noindex,nofollow`. |
| `docs/LIBRARY_V2_GUIDED_EXPERIENCE.md` | This file. |

## 3. Production reachability

- The route file `src/routes/dev.guided-library-v2.tsx` renders a plain
  "Not available" screen whenever `import.meta.env.DEV` is falsy. On the
  published site this is always false, so the V2 component tree is
  effectively 404.
- The route is **not** listed in `src/routes/sitemap[.]xml.ts`.
- The route ships `<meta name="robots" content="noindex,nofollow" />`.
- The demo banner and footer both stamp `LIBRARY_EXPERIENCE_VERSION` so
  any accidental production leak is visually obvious.

## 4. Guided flow (10 requirement checklist)

1. **Home.** Copy: “四种古老传统，共同读懂同一个你 / 从你此刻最关心的问题开始”.
   CTA “开始认识自己” + hint “约 2 分钟 · 基础解读免费 · 结果可永久保存”.
   Four themed books (事业 / 情感 / 财富 / 自我) plus **“不确定，让图书馆推荐”**
   — the picked focus is stored in state and drives book ordering.
2. **Four-step borrow card.** 称呼 → 出生日期时间 → 地点与性别 → 确认主题.
   Each step: single-sentence purpose line, `n/4` progress dash, 返回 button,
   inputs sized `text-[16px]` so mobile Safari does not auto-zoom. The `card`
   state is shaped to be trivially mapped onto the existing ritual model
   (name / birth_date / birth_time / place / gender) — no new calculation
   logic is added here.
3. **Archive transition.** Four traditions light up in sequence (~700 ms
   each) then a “正在寻找共同的线索…” beat. Total budget ≤ ~4 s. A visible
   **跳过动画** button jumps straight through, and
   `prefers-reduced-motion: reduce` collapses the whole thing to ~400 ms
   with all four already lit.
4. **Library overview.** Focus-first recommendation. Six books:
   《我是谁》《事业与天赋》《情感与关系》《财富与资源》《人生时间轴》《四体系命盘》.
   Each tile shows icon, one-line verdict, read-minutes, and “打开 →”. The
   header shows read progress `n / 6` and the next recommended book. All
   copy is labelled as demo via the sticky top banner and footer strip.
5. **Reader.** Default = quick read: 一句结论 · 3 关键词 · 现实里的样子 ·
   一个建议 · 一个注意点. `展开深读` reveals four-system evidence,
   consensus / tension, an evidence + confidence `<details>` block, and a
   premium hook line. 事业 additionally renders 行业族群 / 岗位画像 /
   组织环境; 情感 renders 情感需求 / 伴侣特质 / 冲突模式. The reader
   does not promise 正缘 / 收益 / 疾病 — the fixture is asserted against
   a forbidden-terms list in the tests.
6. **Librarian tour.** Three cards, shown once on first arrival at the
   library screen. Persisted via `localStorage['lod:library-v2:tour-seen']`.
   After dismissal the tour collapses to a small ✦ bookmark button that
   can re-open it. Copy explicitly separates the librarian (“只负责带路”)
   from the tree-hollow companion (“树洞”).
7. **Purpose strip.** Six short lines describing 基础报告 / 生命时间轴 /
   长老对话 / 树洞 / 同门社区 / 高级 24 章. The premium row explicitly
   reads “24 章 · 一次生成 · 账户内长期保存” and its CTA opens a note
   card whose primary button is **disabled** with the label
   `解锁完整报告 ¥79 · 预览禁用`.
8. **Style.** Dark obsidian + gold-dust palette reused from V1 tokens
   (`--obsidian`, `--gold-dust`, `--gold-light`, `--stone-warm`). No new
   colors, no generic-SaaS layout, no big walls of text — every screen is
   short-form with an obvious next action.
9. **Viewports.** Container capped at `max-w-[1120px]`; content wraps
   from 3 columns → 2 → 1 as the viewport narrows. Interactive controls
   are `min-h-11` (44 px) and inputs are `text-[16px]` on mobile.
   `env(safe-area-inset-top)` is respected on the top padding. Reduced
   motion is honoured throughout the archive transition.
10. **Tests + isolation.** `src/experiences/library-v2/library-v2.test.ts`
    covers focus ordering, reading progress derivation, one-time tour
    persistence, quick/deep content shape, forbidden marketing terms,
    V1-file untouched-ness, and sitemap exclusion.

## 5. What is still demo

- Every string in `fixtures.ts` is placeholder copy. None of it is
  computed from `premium_facts_v4`, western/vedic/bazi/ziwei calculators,
  or the AI gateway.
- The borrow card does not persist anywhere — leaving the page resets it.
- The premium note button is disabled and never fires.
- The librarian tour and read progress are per-browser (localStorage +
  in-memory) and not tied to a user account.

## 6. Switching to V2 as the primary experience

When V2 is ready to become the real product, do it in **exactly** this
order to keep a safe rollback:

1. Wire the borrow card `card` state into the existing ritual store
   (`src/lib/reading-engine.ts` / `src/routes/ritual.tsx`) — replace the
   fixture handoff with a real `chart_id` lookup.
2. Replace `DEMO_BOOKS` with a selector that reads
   `premium_facts_v4` (see `src/lib/premium-facts.ts`) and derives the
   six quick/deep sections from real, deterministic modules only.
3. Re-enable the premium note CTA and route it into
   `MockPaymentModal` / `simulateMockPremiumPayment` (still gated by
   `PAYMENT_MODE=mock` until real payment lands).
4. Promote the route: create `src/routes/library.tsx` (or repoint `/`)
   that imports `GuidedLibraryV2`; keep `src/routes/dev.guided-library-v2.tsx`
   as the staging surface until parity is confirmed.
5. Only after the above four steps: add the new URL to
   `src/routes/sitemap[.]xml.ts` and remove the demo banner + noindex.

## 7. Rollback

If V2 needs to be pulled at any point:

1. Delete `src/routes/dev.guided-library-v2.tsx`
   — the auto-generated `src/routeTree.gen.ts` will drop the route on
   the next build.
2. Delete `src/experiences/library-v2/` — V1 does not import from it.
3. Delete `docs/LIBRARY_V2_GUIDED_EXPERIENCE.md`.
4. Run `bun test` + `tsgo --noEmit`. Because V1 has no dependency on V2,
   no other file needs to change.

## 8. Non-goals (explicit)

- Not a redesign of `/report` or the 24-chapter premium reader.
- Not a replacement for the ritual flow's calculation engine — the
  borrow-card component is shape-compatible but delegates all math to V1.
- Not a marketing surface — the demo banner and disabled CTAs are
  intentional and must stay until step 5 of §6 is executed.
