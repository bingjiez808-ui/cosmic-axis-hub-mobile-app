---
name: fate-nexus-daily-reading
description: Deterministic-facts-first daily reading Skill for the Fate Nexus "Today's Reading Room". Explains, in plain language, a set of pre-computed scores and facts for one owner + one chart + one local date + one timezone. AI never computes scores or transits — it only explains what the calculators produced. Applies when the app calls the daily-reading-v1 explanation layer.
---

# Fate Nexus — Daily Reading (v1)

## Trigger

- `/me/home` today's-reading-room page has already computed
  `daily-facts-v1` and `daily-domain-score-v1` for one owner + one chart +
  one local date + one timezone.
- No cached `daily-reading-v1` output exists for that exact key.

## Layered contract

1. **Facts (never invented):** provided upstream by
   `src/lib/daily-facts.ts` — transit planets, transit→natal aspects,
   Moon sign & phase — plus already-verified slower-cycle backgrounds
   (Vedic Mahadasha/Antardasha/Pratyantar; BaZi 大运+流年; Ziwei
   大限+流年+流月). **No per-day BaZi 干支, no per-day Ziwei panel, no
   per-day Nakshatra summary is provided or invented.**
2. **Scores (deterministic):** provided upstream by
   `src/lib/daily-domain-score.ts` — overall + study/career/love/wealth
   with band, confidence, evidence_refs, supportive/caution/contradictions,
   missing_facts.
3. **Explanation (this Skill):** the LLM produces natural language that
   references *only* the facts and scores above. It must not restate
   scores as probabilities, invent transits, or use forbidden terms.

## Output schema

See `references/output-schema.md`. Ten sections, in this order:

1. `date` / `timezone` / `chart_reference`
2. `one_line_theme`
3. `four_domain_summary`
4. `supportive_signals`
5. `caution_signals`
6. `do_today` — 2–3 concrete actions
7. `observe_today` — 2–3 things to watch
8. `counterconditions` — at least one "if reality contradicts, reality wins"
9. `reflection_question` — one self-inquiry prompt
10. `evidence_index` / `confidence` / `missing_facts` / `method_limits`

Any conclusion strong enough to appear in `supportive_signals` or
`caution_signals` MUST cite at least two evidence_refs, OR be labelled
"single-system reference only" with `confidence: low`.

## Forbidden

- Guaranteeing a specific event will happen today.
- Predicting disaster / illness / death / affair / investment gain/loss.
- Fear marketing (e.g. "if you don't act today…").
- "Lucky colour / number / direction" without a deterministic ref.
- Mimicking a named creator's voice (e.g. Tao Baibai) or trademarked
  scoring rubric.
- Restating a domain score as "success rate", "luck probability", or
  "hit rate". Correct term: "今日领域信号 / 关注线索".
- Fabricating BaZi 日干支 / Ziwei 日盘 / Nakshatra 日 signals.
- Cross-system consensus claims backed by only one system.

## Cache & retry

Cache key: `sha256(owner_id | chart_id | local_date | timezone |
daily-facts-v1 | daily-domain-score-v1 | daily-reading-v1 | prompt_hash |
model_id)`.

- Cache hit → **zero** provider calls; return the stored payload.
- Partial output (e.g. `do_today` failed schema) → save completed sections,
  retry only the failed sections. Max 3 retries per section. Completed
  sections are immutable — do not overwrite.
- If facts are missing (natal without time, or noon-UTC unresolvable):
  return `partial: true` with `missing_facts` populated, and skip any
  section that would depend on the missing facts.

## Version

`daily-reading-v1` — pinned. Any breaking change requires a new version
and cache invalidation, not an in-place edit.
