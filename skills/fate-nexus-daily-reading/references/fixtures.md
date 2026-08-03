# Fixtures

The Skill ships with four fixtures used by contract tests and the demo
route. All fixtures are DEMO data; none corresponds to a real user.

| Fixture | Profile | Notes |
| --- | --- | --- |
| `student_youth` | 18 y.o., high-school → university transition | study emphasised; wealth confidence low |
| `working_adult` | 32 y.o., mid-career | career / wealth emphasised |
| `adult_transition` | 45 y.o., changing profession or returning to study | study + career; longer counterconditions |
| `no_birth_time` | Any age, no birth time provided | Ascendant / house paths suppressed; confidence downgraded |

Fixtures live in `src/experiences/daily-room/fixtures.ts` and are
imported by the `/me/home` demo mode when the feature flag is on but no
real cached reading exists yet.
