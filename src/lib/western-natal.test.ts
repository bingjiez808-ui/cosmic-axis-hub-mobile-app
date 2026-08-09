/**
 * Western tropical natal chart tests — asserts real astronomy-engine
 * output shapes and physical/geometric invariants. No mock ephemeris.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { computeWesternChart } from "./western-natal";

describe("computeWesternChart — 2000-01-01T12:00Z at London", () => {
  const chart = computeWesternChart({
    utc: new Date("2000-01-01T12:00:00Z"),
    lat: 51.5074,
    lng: -0.1278,
  })!;

  test("returns 9 planets covering the classical tropical set", () => {
    expect(chart).not.toBeNull();
    expect(chart.planets.length).toBe(9);
    const keys = chart.planets.map((p) => p.key).sort();
    expect(keys).toEqual([
      "jupiter", "mars", "mercury", "moon", "neptune",
      "saturn", "sun", "uranus", "venus",
    ]);
  });

  test("all longitudes normalised into [0, 360) with matching sign index", () => {
    for (const p of chart.planets) {
      expect(p.trop_lon).toBeGreaterThanOrEqual(0);
      expect(p.trop_lon).toBeLessThan(360);
      expect(p.sign).toBe(Math.floor(p.trop_lon / 30));
      expect(p.deg_in_sign).toBeGreaterThanOrEqual(0);
      expect(p.deg_in_sign).toBeLessThan(30);
    }
  });

  test("Sun on 2000-01-01 lies in Capricorn (sign 9)", () => {
    const sun = chart.planets.find((p) => p.key === "sun")!;
    expect(sun.sign).toBe(9);
    expect(sun.retro).toBe(false);
  });

  test("Sun and Moon never retrograde", () => {
    expect(chart.planets.find((p) => p.key === "sun")!.retro).toBe(false);
    expect(chart.planets.find((p) => p.key === "moon")!.retro).toBe(false);
  });

  test("Ascendant present when lat/lng provided; sign in 0..11", () => {
    expect(chart.ascendant).not.toBeNull();
    expect(chart.ascendant!.sign).toBeGreaterThanOrEqual(0);
    expect(chart.ascendant!.sign).toBeLessThan(12);
    expect(chart.ascendant!.trop_lon).toBeGreaterThanOrEqual(0);
    expect(chart.ascendant!.trop_lon).toBeLessThan(360);
  });

  test("all aspects respect classical orb limits and reference known keys", () => {
    const keys = new Set(chart.planets.map((p) => p.key));
    for (const a of chart.aspects) {
      expect(keys.has(a.a)).toBe(true);
      expect(keys.has(a.b)).toBe(true);
      expect(a.a).not.toBe(a.b);
      expect(a.orb).toBeGreaterThanOrEqual(0);
      if (a.kind === "sextile") expect(a.orb).toBeLessThanOrEqual(4);
      else expect(a.orb).toBeLessThanOrEqual(6);
      // Angle between two directions on a circle is in [0, 180].
      expect(a.angle).toBeGreaterThanOrEqual(0);
      expect(a.angle).toBeLessThanOrEqual(180);
    }
  });

  test("no lat/lng → ascendant is null but planets still computed", () => {
    const noGeo = computeWesternChart({ utc: new Date("2000-01-01T12:00:00Z") })!;
    expect(noGeo.ascendant).toBeNull();
    expect(noGeo.planets.length).toBe(9);
  });
});

describe("Retrograde detection — Mercury in early 2000", () => {
  test("planet retro flag is a boolean for all non-luminaries", () => {
    const chart = computeWesternChart({ utc: new Date("2000-02-15T00:00:00Z") })!;
    for (const p of chart.planets) {
      if (p.key === "sun" || p.key === "moon") continue;
      expect(typeof p.retro).toBe("boolean");
    }
  });
});
