# Visual regression snapshots

Lightweight Playwright script that captures the layouts we care about at both
desktop and mobile widths, so we can diff pixels after CSS/layout changes.

## Run

The dev server must be running on `http://localhost:8080` (Lovable's default).

```bash
python3 tests/visual/run.py
```

Baselines land in `tests/visual/screenshots/`. Commit the ones you consider
"golden"; re-run and compare after any change to `src/routes/ritual.tsx`,
`src/routes/report.tsx`, or the shared design tokens in `src/styles.css`.

## What it captures

- `/ritual` — language step (mobile 390×844 + desktop 1280×900). Guards
  against a single character being stranded on its own line in the heading.
- `/report` synthesis fixture — desktop 1440×1000, checks the natal-chart
  card's right column bottom-aligns with the left `PlanetReadingPanel`.
- `/report` synthesis fixture — mobile 390×900, verifies the chart-facts card
  stacks below the wheel without horizontal overflow.
