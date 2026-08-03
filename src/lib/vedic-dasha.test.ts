/**
 * Vimshottari Antardasha / Pratyantar expansion tests.
 * Locks classical invariants: 120-year total, Σ AD = MD length,
 * Σ PD = AD length, cyclic ordering starting at the parent lord.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { DASHA_ORDER, DASHA_YEARS, type VimshottariMahadasha } from "./vedic";
import { expandVimshottari, currentDashaTriple } from "./vedic-dasha";

const MS_PER_YEAR = 365.2422 * 86_400_000;

/** Build a synthetic full-cycle Vimshottari timeline starting at `startISO`. */
function synthTimeline(startISO: string, startLordIdx: number): VimshottariMahadasha[] {
  const out: VimshottariMahadasha[] = [];
  let t = new Date(startISO).getTime();
  for (let i = 0; i < DASHA_ORDER.length; i++) {
    const lord = DASHA_ORDER[(startLordIdx + i) % DASHA_ORDER.length];
    const yrs = DASHA_YEARS[lord];
    const end = t + yrs * MS_PER_YEAR;
    out.push({ lord, start: new Date(t).toISOString(), end: new Date(end).toISOString(), years: yrs });
    t = end;
  }
  return out;
}

describe("expandVimshottari — invariants on a full 120-year synthetic timeline", () => {
  const mds = synthTimeline("2000-01-01T00:00:00Z", DASHA_ORDER.indexOf("Ketu"));
  const asOf = new Date("2025-06-15T12:00:00Z");
  const exp = expandVimshottari(mds, asOf);

  test("Σ MD durations = 120 years within 0.5 year", () => {
    const sum = exp.mahadasha.reduce((s, m) => s + m.years, 0);
    expect(Math.abs(sum - 120)).toBeLessThan(0.5);
  });

  test("no validation warnings for a synthetic full timeline", () => {
    expect(exp.warnings).toEqual([]);
    expect(exp.pratyantar_available).toBe(true);
  });

  test("within each MD: AD sequence starts at md.lord and cycles", () => {
    for (const md of exp.mahadasha) {
      expect(md.antardasha[0].lord).toBe(md.lord);
      for (let i = 1; i < md.antardasha.length; i++) {
        const expected = DASHA_ORDER[(DASHA_ORDER.indexOf(md.lord) + i) % DASHA_ORDER.length];
        expect(md.antardasha[i].lord).toBe(expected);
      }
      // All 9 ADs present for a full MD.
      expect(md.antardasha.length).toBe(9);
    }
  });

  test("within each MD: Σ AD years = MD wall-clock years within 12 hours", () => {
    for (const md of exp.mahadasha) {
      const wall = (new Date(md.end).getTime() - new Date(md.start).getTime()) / MS_PER_YEAR;
      const sum = md.antardasha.reduce((s, a) => s + a.years, 0);
      expect(Math.abs(sum - wall)).toBeLessThan(12 / (24 * 365.2422));
    }
  });

  test("active AD has 9 PDs summing to AD length within 6 hours", () => {
    const md = exp.mahadasha.find(
      (m) => new Date(m.start).getTime() <= asOf.getTime() && asOf.getTime() < new Date(m.end).getTime(),
    )!;
    const ad = md.antardasha.find(
      (a) => new Date(a.start).getTime() <= asOf.getTime() && asOf.getTime() < new Date(a.end).getTime(),
    )!;
    expect(ad.pratyantar.length).toBe(9);
    expect(ad.pratyantar[0].lord).toBe(ad.lord);
    const sum = ad.pratyantar.reduce((s, p) => s + p.years, 0);
    expect(Math.abs(sum - ad.years)).toBeLessThan(6 / (24 * 365.2422));
  });

  test("currentDashaTriple returns coherent MD ⊃ AD ⊃ PD covering asOf", () => {
    const triple = currentDashaTriple(exp, asOf);
    expect(triple.mahadasha).not.toBeNull();
    expect(triple.antardasha).not.toBeNull();
    expect(triple.pratyantar).not.toBeNull();
    const t = asOf.getTime();
    expect(new Date(triple.mahadasha!.start).getTime()).toBeLessThanOrEqual(t);
    expect(t).toBeLessThan(new Date(triple.mahadasha!.end).getTime());
    expect(new Date(triple.antardasha!.start).getTime()).toBeLessThanOrEqual(t);
    expect(t).toBeLessThan(new Date(triple.antardasha!.end).getTime());
    expect(new Date(triple.pratyantar!.start).getTime()).toBeLessThanOrEqual(t);
    expect(t).toBeLessThan(new Date(triple.pratyantar!.end).getTime());
  });
});

describe("expandVimshottari — partial (balance) first MD", () => {
  // Simulate a real birth: first MD is a partial slice of Moon (10y),
  // e.g. 4 years remaining. Following MDs are full.
  const timeline: VimshottariMahadasha[] = [
    { lord: "Moon", start: "1990-05-15T00:00:00Z", end: "1994-05-15T00:00:00Z", years: 4 },
    ...synthTimeline("1994-05-15T00:00:00Z", DASHA_ORDER.indexOf("Mars")),
  ];

  test("partial MD's AD sum equals its wall-clock length", () => {
    const exp = expandVimshottari(timeline, new Date("1992-01-01T00:00:00Z"));
    const first = exp.mahadasha[0];
    const wall = (new Date(first.end).getTime() - new Date(first.start).getTime()) / MS_PER_YEAR;
    const sum = first.antardasha.reduce((s, a) => s + a.years, 0);
    expect(Math.abs(sum - wall)).toBeLessThan(12 / (24 * 365.2422));
  });

  test("partial MD emits only the ADs that fall inside its wall-clock window", () => {
    const exp = expandVimshottari(timeline, new Date("1992-01-01T00:00:00Z"));
    const first = exp.mahadasha[0];
    // 4-year Moon MD: earlier Moon ADs (0..6y elapsed) are entirely past;
    // remaining ADs start somewhere mid-cycle. At least one AD returned.
    expect(first.antardasha.length).toBeGreaterThan(0);
    // The first emitted AD lies inside [MD.start, MD.end].
    const firstAd = first.antardasha[0];
    expect(new Date(firstAd.start).getTime()).toBeGreaterThanOrEqual(new Date(first.start).getTime());
    expect(new Date(firstAd.end).getTime()).toBeLessThanOrEqual(new Date(first.end).getTime() + 1000);
  });
});
