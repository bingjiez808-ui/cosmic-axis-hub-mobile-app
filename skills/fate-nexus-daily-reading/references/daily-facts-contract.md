# daily-facts-v1 — input contract

The Skill receives, per call, a `facts` object with this shape:

```
{
  "calculator_version": "daily-facts-v1",
  "local_date": "YYYY-MM-DD",
  "timezone": "IANA/Zone",
  "sample_utc": "ISO-8601 Z",
  "transit_planets": [
    { "key": "sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune",
      "trop_lon": number, "sign": 0..11, "retro": boolean }
  ],
  "transit_to_natal_aspects": [
    { "transit": bodyKey, "natal": bodyKey,
      "kind": "conjunction|opposition|trine|square|sextile",
      "exact_deg": 0|60|90|120|180, "angle": number, "orb": number,
      "outer": boolean }
  ],
  "moon": { "trop_lon": number, "sign": 0..11,
    "phase": "new_moon|waxing_crescent|first_quarter|waxing_gibbous|full_moon|waning_gibbous|last_quarter|waning_crescent",
    "illumination_pct": number
  }
}
```

Additionally, `scores` carries the `daily-domain-score-v1` object (see
`../../src/lib/daily-domain-score.ts` for the full TypeScript type).

## Evidence refs

Every claim in the AI output must cite one or more entries drawn from:

- `daily.transit_planets[<key>]`
- `daily.transit_to_natal_aspects[<transit>→<natal>,<kind>]`
- `daily.moon.phase` / `daily.moon.sign`
- `scores.domains[<domain>]`
- `slower.vedic|bazi|ziwei` — opaque string; treat as background only.

Any other evidence path is REJECTED by the validator.

## What is NOT in the contract

- Per-day BaZi 干支, per-day Ziwei 盘, per-day Nakshatra transit.
  These are not computed by the project and MUST NOT be inferred.
- Houses on transit or synastry beyond what natal already carries.
