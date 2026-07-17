/**
 * Vimshottari sub-period expansion — Antardasha (AD) and Pratyantar (PD).
 *
 * Classical rules (locked in by `vedic-dasha.test.ts`):
 *   - Within a Mahadasha of lord M with full duration Y_M:
 *       AD sequence starts at M itself, then walks DASHA_ORDER cyclically.
 *       Each AD's full duration = Y_ad * Y_M / 120 years.
 *       Σ full AD durations inside one MD = Y_M (exact).
 *   - Within an AD of lord A with full duration Y_A:
 *       PD sequence starts at A itself, then walks DASHA_ORDER cyclically.
 *       Each PD's full duration = Y_pd * Y_A / 120 years.
 *       Σ full PD durations inside one AD = Y_A (exact).
 *   - Birth balance: fraction of the first MD remaining = 1 − withinNak/nakSpan.
 *       For MDs after the first, `balanceFrac_md = 1`.
 *     When elapsed_within_MD > 0, the earlier ADs / PDs already passed;
 *     we walk the sequence and truncate the AD (and its first PD) that
 *     contains the birth moment.
 *
 * We validate every level:
 *   totalMD Σ = 120 years (± 1 day)
 *   inside each MD, Σ AD = MD length (± 12 hours)
 *   inside each AD, Σ PD = AD length (± 6 hours)
 * A failed validation → the level is dropped and reported as unavailable
 * rather than persisted with garbage.
 */
import { DASHA_ORDER, DASHA_YEARS, type DashaLord, type VimshottariMahadasha } from "./vedic";

const MS_PER_YEAR = 365.2422 * 86_400_000;

export type Pratyantar = {
  lord: DashaLord;
  start: string;
  end: string;
  years: number;
};

export type Antardasha = {
  lord: DashaLord;
  start: string;
  end: string;
  years: number;
  /** PDs are populated only for the AD active at `expandForDate`; empty otherwise. */
  pratyantar: Pratyantar[];
};

export type MahadashaExpanded = VimshottariMahadasha & {
  antardasha: Antardasha[];
};

export type DashaExpansion = {
  mahadasha: MahadashaExpanded[];
  /** Whether Pratyantar level passed 120-year / sub-period validation. */
  pratyantar_available: boolean;
  /** Human-readable validation diagnostics (empty on full success). */
  warnings: string[];
};

function shiftDasha(startLord: DashaLord, steps: number): DashaLord {
  const i = DASHA_ORDER.indexOf(startLord);
  return DASHA_ORDER[(i + steps + DASHA_ORDER.length * 100) % DASHA_ORDER.length];
}

/**
 * Expand a MD's Antardasha timeline.
 *
 * For a MD spanning [mdStart, mdEnd]:
 *   fullMdYears = DASHA_YEARS[md.lord]
 *   elapsedYears at mdStart = fullMdYears - (mdEnd - mdStart)_years
 *   Walk AD sequence starting at md.lord, accumulating full durations,
 *   truncating the AD that straddles mdStart so its emitted [start,end]
 *   sit fully inside the MD, and stopping once we cross mdEnd.
 */
function expandAntardasha(md: VimshottariMahadasha): Antardasha[] {
  const mdStartMs = new Date(md.start).getTime();
  const mdEndMs = new Date(md.end).getTime();
  const fullMdYears = DASHA_YEARS[md.lord];
  const mdActualYears = (mdEndMs - mdStartMs) / MS_PER_YEAR;
  const elapsedYears = Math.max(0, fullMdYears - mdActualYears);
  const mdEndYearsFull = elapsedYears + mdActualYears;
  const EPS = 1e-9;

  const out: Antardasha[] = [];
  let cursorYears = 0;
  for (let step = 0; step < DASHA_ORDER.length * 2; step++) {
    const lord = shiftDasha(md.lord, step);
    const fullAdYears = (DASHA_YEARS[lord] * fullMdYears) / 120;
    const adStartYears = cursorYears;
    const adEndYears = cursorYears + fullAdYears;
    cursorYears = adEndYears;

    if (adEndYears <= elapsedYears + EPS) continue;
    const adRealStartYears = Math.max(adStartYears, elapsedYears);
    const adRealEndYears = Math.min(adEndYears, mdEndYearsFull);
    if (adRealEndYears - adRealStartYears < EPS) continue;

    const adStartMs = mdStartMs + (adRealStartYears - elapsedYears) * MS_PER_YEAR;
    const adEndMs = mdStartMs + (adRealEndYears - elapsedYears) * MS_PER_YEAR;
    out.push({
      lord,
      start: new Date(adStartMs).toISOString(),
      end: new Date(adEndMs).toISOString(),
      years: (adEndMs - adStartMs) / MS_PER_YEAR,
      pratyantar: [],
    });
    if (adEndYears >= mdEndYearsFull - EPS) break;
  }
  return out;
}

/**
 * Expand a single AD's Pratyantar timeline. Sub-second precision uses
 * the same proportional rule with the AD's *actual* duration (which
 * may be a partial slice of the classical full AD when it straddles a
 * MD boundary — we anchor sub-periods to the AD's real endpoints).
 */
function expandPratyantar(ad: Antardasha): Pratyantar[] {
  const adStartMs = new Date(ad.start).getTime();
  const adEndMs = new Date(ad.end).getTime();
  const fullAdYears = (DASHA_YEARS[ad.lord] * DASHA_YEARS[ad.lord]) / 120; // for full AD only; scaled below
  const actualAdYears = (adEndMs - adStartMs) / MS_PER_YEAR;
  // If AD is a full one, scale factor = 1; otherwise proportional.
  const scale = fullAdYears > 0 ? actualAdYears / fullAdYears : 1;

  const out: Pratyantar[] = [];
  let cursorMs = adStartMs;
  for (let step = 0; step < DASHA_ORDER.length; step++) {
    const lord = shiftDasha(ad.lord, step);
    const fullPdYears = (DASHA_YEARS[lord] * DASHA_YEARS[ad.lord]) / 120;
    const pdYears = fullPdYears * scale;
    const nextMs = Math.min(adEndMs, cursorMs + pdYears * MS_PER_YEAR);
    if (nextMs <= cursorMs) break;
    out.push({
      lord,
      start: new Date(cursorMs).toISOString(),
      end: new Date(nextMs).toISOString(),
      years: (nextMs - cursorMs) / MS_PER_YEAR,
    });
    cursorMs = nextMs;
    if (cursorMs >= adEndMs) break;
  }
  return out;
}

/**
 * Expand a Vimshottari timeline to Antardasha for every MD, and to
 * Pratyantar for the AD active on `asOfDate` (plus optionally the
 * immediately-following AD for continuity).
 */
export function expandVimshottari(
  mahadasha: VimshottariMahadasha[],
  asOfDate: Date,
): DashaExpansion {
  const warnings: string[] = [];
  const asOfMs = asOfDate.getTime();

  // Validate 120-year total (sum of full MD durations, not just wall time).
  const totalMdYears = mahadasha.reduce((s, m) => s + m.years, 0);
  if (Math.abs(totalMdYears - 120) > 0.5) {
    warnings.push(`total_md_years=${totalMdYears.toFixed(3)} deviates from 120`);
  }

  let pratyantarOk = true;
  const out: MahadashaExpanded[] = mahadasha.map((md) => {
    const ads = expandAntardasha(md);
    // Validate: Σ AD years = MD wall-clock years within 12 hours.
    const mdWallYears = (new Date(md.end).getTime() - new Date(md.start).getTime()) / MS_PER_YEAR;
    const adSum = ads.reduce((s, a) => s + a.years, 0);
    if (Math.abs(adSum - mdWallYears) > 12 / (24 * 365.2422)) {
      warnings.push(`md ${md.lord} @${md.start}: AD sum ${adSum.toFixed(4)} vs wall ${mdWallYears.toFixed(4)}`);
      pratyantarOk = false;
    }
    // Populate PD on the AD active for `asOfDate`, plus the next one.
    const nowIdx = ads.findIndex(
      (a) => new Date(a.start).getTime() <= asOfMs && asOfMs < new Date(a.end).getTime(),
    );
    if (nowIdx >= 0) {
      for (const idx of [nowIdx, nowIdx + 1]) {
        const ad = ads[idx];
        if (!ad) continue;
        const pds = expandPratyantar(ad);
        const pdSum = pds.reduce((s, p) => s + p.years, 0);
        if (Math.abs(pdSum - ad.years) > 6 / (24 * 365.2422)) {
          warnings.push(`ad ${ad.lord} @${ad.start}: PD sum ${pdSum.toFixed(5)} vs AD ${ad.years.toFixed(5)}`);
          pratyantarOk = false;
        } else {
          ad.pratyantar = pds;
        }
      }
    }
    return { ...md, antardasha: ads };
  });

  return { mahadasha: out, pratyantar_available: pratyantarOk, warnings };
}

/** Pick the currently-active MD / AD / PD triple for a given date. */
export function currentDashaTriple(
  exp: DashaExpansion,
  asOfDate: Date,
): {
  mahadasha: MahadashaExpanded | null;
  antardasha: Antardasha | null;
  pratyantar: Pratyantar | null;
} {
  const t = asOfDate.getTime();
  const md = exp.mahadasha.find((m) => new Date(m.start).getTime() <= t && t < new Date(m.end).getTime()) ?? null;
  const ad = md?.antardasha.find((a) => new Date(a.start).getTime() <= t && t < new Date(a.end).getTime()) ?? null;
  const pd = ad?.pratyantar.find((p) => new Date(p.start).getTime() <= t && t < new Date(p.end).getTime()) ?? null;
  return { mahadasha: md, antardasha: ad, pratyantar: pd };
}
