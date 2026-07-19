# Chapter manifest

Mirror of `PREMIUM_V3_CHAPTERS` in `src/lib/premium-chapters-v3.ts`.
The contract test `skill-fate-nexus-premium-report.test.ts` fails if this
document drifts from code on the fields it lists.

Legend:
- **AF** — allowed_facts (evidence_refs may only cite these modules).
- **§** — required section markers (must appear literally in body).
- **T** — required Markdown pipe table titles.
- **Refs** — `min_evidence_refs` (default 1 when AF non-empty; 0 for cover-kind chapters).
- **Var** — `min_module_variety` (default 2 for cross).

## Cover chapters (facts optional)

| # | key                | title (zh / en)                              | Target (zh) | AF                          | Notes |
|---|--------------------|----------------------------------------------|-------------|-----------------------------|-------|
| 0 | `cover_letter`     | 写在开篇的话 / Opening Letter                | 400–700     | —                           | prose scaffold |
| 1 | `executive_summary`| 执行摘要 / Executive Summary                 | 700–1100    | bazi, ziwei, western, vedic | cross-tradition wrap |
| 2 | `chart_map`        | 命盘全景导览 / Chart Map                     | 500–800     | bazi, ziwei, western, vedic | topology tour |

## System chapters (one grounded ref required)

| # | key              | title                                         | Target    | AF                              | Refs | Extras |
|---|------------------|-----------------------------------------------|-----------|---------------------------------|------|--------|
| 3 | `western_natal`  | 西方本命盘 / Western Natal                    | 800–1200  | western                         | 1    |        |
| 4 | `western_aspects`| 西方相位网 / Western Aspects                  | 900–1200  | western, western_aspects        | 3    | T: 主要相位对照表 |
| 5 | `vedic_natal`    | 印度本命图 / Vedic Natal                      | 800–1200  | vedic                           | 1    |        |
| 6 | `vedic_dasha`    | Vimshottari 大限流曜 / Vimshottari Dasha      | 800–1100  | vedic, vedic_dasha              | 1    |        |
| 7 | `bazi_pillars`   | 八字四柱与日主 / BaZi Four Pillars            | 900–1300  | bazi                            | 1    |        |
| 8 | `bazi_ten_gods`  | 八字十神与五行 / BaZi Ten Gods & Elements     | 800–1100  | bazi                            | 1    |        |
| 9 | `bazi_luck`      | 八字大运与流年 / BaZi Luck Cycles             | 800–1100  | bazi, bazi_luck                 | 1    |        |
|10 | `ziwei_palaces`  | 紫微十二宫与主星 / Zi Wei Palaces & Stars     | 900–1300  | ziwei                           | 1    |        |
|11 | `ziwei_horoscope`| 紫微大限流年流月 / Zi Wei Horoscope           | 800–1100  | ziwei, ziwei_horoscope          | 1    |        |

## Cross chapters (≥2 distinct modules)

| # | key           | title                                    | Target   | AF                          | Var | Refs |
|---|---------------|------------------------------------------|----------|-----------------------------|-----|------|
|12 | `convergence` | 跨体系共识 / Cross-Tradition Convergence | 700–1000 | bazi, ziwei, western, vedic | 2   | 2    |
|13 | `tensions`    | 跨体系张力与矛盾 / Cross-Tradition Tensions | 600–900 | bazi, ziwei, western, vedic | 2   | 2    |

## Life chapters

| # | key            | title                                | Target    | AF                       | Var | Refs | Sections / Tables |
|---|----------------|--------------------------------------|-----------|--------------------------|-----|------|-------------------|
|14 | `character`    | 性格底色 / Character                 | 700–1000  | bazi, ziwei, western     | —   | 1    |                   |
|15 | `vocation`     | 事业方向与天赋 / Vocation & Talents  | 900–1300  | bazi, ziwei, western, vedic | 2 | 3   | § 适合行业族群 / 岗位职能 / 工作环境 / 创业与就业条件 / 关键技能 / 不适合模式 · T: 事业方向对照表 |
|16 | `wealth`       | 财富格局 / Wealth                    | 700–1000  | bazi, ziwei              | 2   | 2    | § 财富来源 / 风险模式 / 积累策略 · T: 财富来源对照表 |
|17 | `relationships`| 情感与关系 / Love & Relationships    | 900–1200  | bazi, ziwei, western     | 2   | 3    | § 关系需求 / 适合伴侣特质 / 冲突模式 / 婚恋准备 / 条件式时间窗口 · T: 关系窗口对照表 |
|18 | `family`       | 家庭与家园 / Family & Home           | 500–800   | bazi, ziwei              | —   | 1    |                   |
|19 | `health`       | 健康与活力 / Health & Vitality       | 500–800   | bazi, ziwei              | —   | 1    |                   |
|20 | `mission`      | 人生使命 / Life Mission              | 700–1000  | ziwei, vedic, western    | 2   | 3    | § 核心课题 / 触发情境 / 需避免的问题 / 替代行动 / 复盘清单 · T: 课题清单 |

## Timing chapters

| # | key         | title                                   | Target   | AF                                          | Refs |
|---|-------------|-----------------------------------------|----------|---------------------------------------------|------|
|21 | `year_ahead`| 未来十二个月 / Next Twelve Months       | 800–1200 | bazi_luck, ziwei_horoscope, vedic_dasha     | 1    |
|22 | `windows`   | 关键时间窗口 / Key Time Windows         | 600–900  | bazi_luck, ziwei_horoscope, vedic_dasha     | 1    |

## Closing

|# | key           | title                                       | Target  | AF | Notes |
|--|---------------|---------------------------------------------|---------|----|-------|
|23| `methodology` | 方法论与免责声明 / Methodology & Disclaimers | 400–700 | —  | Culture / self-reflection framing; must include disclaimer text. |

## Aggregate targets

- Total zh chars: 15_000..25_000 (both bounds enforced by
  `PREMIUM_V3_TOTAL_TARGET_CHARS_MIN/MAX` test).
- 24 chapters, indices strictly 0..23, keys unique.

## When to change this file

Any code change to `PREMIUM_V3_CHAPTERS` (add/remove chapter, change
`allowed_facts`, `required_sections`, `required_tables`,
`min_evidence_refs`, `min_module_variety`, `target_chars_zh`) MUST also
update this table AND bump `PREMIUM_SKILL_VERSION` and
`PREMIUM_REPORT_REVISION` in the same change.
