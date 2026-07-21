// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";

import { glyphFor, layoutAtlas, BOOKMARK_GLYPHS } from "./atlas/bookmark";
import { radarSummary } from "./atlas/ResonanceRadar";

describe("community-match atlas · deterministic bookmark", () => {
  it("glyphFor returns a stable glyph across calls for the same alias", () => {
    const g1 = glyphFor("traveler-42");
    const g2 = glyphFor("traveler-42");
    expect(g1).toBe(g2);
    expect(BOOKMARK_GLYPHS).toContain(g1);
  });

  it("different aliases can select different glyphs", () => {
    const glyphs = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((s) =>
        glyphFor(`alias-${s}`),
      ),
    );
    // Not all identical.
    expect(glyphs.size).toBeGreaterThan(1);
  });
});

describe("community-match atlas · layoutAtlas", () => {
  const sample = [
    { alias: "one", overall: 84, overallBand: "high" },
    { alias: "two", overall: 65, overallBand: "mid" },
    { alias: "three", overall: 40, overallBand: "low" },
  ];

  it("positions are deterministic and normalized to the unit disc", () => {
    const a = layoutAtlas(sample);
    const b = layoutAtlas(sample);
    expect(a).toEqual(b);
    for (const p of a) {
      const d = Math.hypot(p.x, p.y);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it("high band lands on inner ring, mid/low on outer", () => {
    const [hi, mid, lo] = layoutAtlas(sample);
    expect(hi.ring).toBe(0);
    expect(mid.ring).toBe(1);
    expect(lo.ring).toBe(1);
    expect(hi.size).toBeGreaterThan(lo.size);
    expect(hi.glow).toBeGreaterThan(lo.glow);
  });
});

describe("community-match atlas · radar text equivalent", () => {
  it("produces a readable summary for screen readers", () => {
    const s = radarSummary([
      { key: "communication", label: "Communication", self: 70, other: 60 },
      { key: "emotional_support", label: "Emotional support", self: 55, other: 80 },
    ]);
    expect(s).toContain("Communication");
    expect(s).toContain("self 70");
    expect(s).toContain("other 80");
  });
});
