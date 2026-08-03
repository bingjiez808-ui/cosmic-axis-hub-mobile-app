# year_readings_v1 — DB schema

| Column                | Type      | Notes                                                                   |
| --------------------- | --------- | ----------------------------------------------------------------------- |
| id                    | uuid PK   | default `gen_random_uuid()`                                             |
| owner_id              | uuid      | FK `auth.users(id)` — RLS `auth.uid() = owner_id`                       |
| chart_id              | uuid      | FK `public.charts(id)`                                                  |
| facts_hash            | text      | `hashFactsForYearReading(PremiumFacts)`                                 |
| calculation_version   | text      | `YEAR_READING_CALC_VERSION`                                             |
| skill_version         | text      | `YEAR_READING_SKILL_VERSION`                                            |
| lang                  | text      | `'zh' | 'en'`                                                           |
| year                  | int       |                                                                         |
| age                   | int       |                                                                         |
| system_scores         | jsonb     | `{bazi, ziwei, vedic, western}` — each a `SystemReading`                |
| composite_score       | int null  | null when `< 2` available                                               |
| composite_direction   | text null | `up | stable | down`                                                    |
| composite_confidence  | text      | `reference_only | low | mid | high`                                     |
| evidence_refs         | jsonb     | flat array of facts paths, e.g. `bazi.luck.pillars[3].liu_nian[7]`      |
| interpretation        | jsonb     | `{brief, opportunity, caution}`                                         |
| advice                | jsonb     | `{suggestion, boundary}` — always includes boundary/disclaimer          |
| unavailable_systems   | jsonb     | array of system names                                                   |
| content_hash          | text      | fnv1a of full deterministic reading                                     |
| generated_at          | timestamptz | default `now()`                                                       |

Unique key: `(chart_id, facts_hash, calculation_version, skill_version, lang, year)`.

RLS:
- Owner: full CRUD scoped to `auth.uid() = owner_id`.
- Admin: SELECT via `private.has_role(auth.uid(), 'admin')`.
