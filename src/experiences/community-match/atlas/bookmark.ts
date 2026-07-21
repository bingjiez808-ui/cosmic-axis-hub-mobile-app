/**
 * Deterministic "命运书签" (fate bookmark) glyph picker + atlas layout.
 *
 * Given an anonymous alias string, we derive a stable glyph id and a
 * stable orbital position. The mapping is a one-way FNV-1a hash of the
 * alias — it cannot be inverted to a user_id and does not depend on any
 * PII field.
 */

export const BOOKMARK_GLYPHS = [
  "star",
  "moon",
  "feather",
  "door",
  "lamp",
  "tree",
  "tide",
  "key",
] as const;

export type BookmarkGlyph = (typeof BOOKMARK_GLYPHS)[number];

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function glyphFor(alias: string): BookmarkGlyph {
  const h = fnv1a(`glyph::${alias}`);
  return BOOKMARK_GLYPHS[h % BOOKMARK_GLYPHS.length];
}

export type AtlasPoint = {
  alias: string;
  x: number; // -1..1
  y: number; // -1..1
  ring: 0 | 1; // 0 = inner, 1 = outer
  size: number; // 0.6..1.2 relative
  glow: number; // 0..1
  glyph: BookmarkGlyph;
};

/**
 * Deterministically position `count` candidates on two orbital rings.
 * Angle is derived from the alias hash; ring is chosen by the overall
 * band (high → inner, mid/low → outer).
 */
export function layoutAtlas(
  candidates: Array<{ alias: string; overall: number; overallBand: string }>,
): AtlasPoint[] {
  return candidates.map((c) => {
    const h = fnv1a(`pos::${c.alias}`);
    const angle = ((h % 3600) / 3600) * Math.PI * 2;
    const ring: 0 | 1 = c.overallBand === "high" ? 0 : 1;
    const radius = ring === 0 ? 0.55 : 0.88;
    const jitter = (((h >>> 12) % 100) / 100 - 0.5) * 0.06;
    const r = Math.max(0.35, Math.min(0.95, radius + jitter));
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    const size = 0.6 + Math.min(1, Math.max(0, c.overall) / 100) * 0.6;
    const glow = c.overallBand === "high" ? 0.9 : c.overallBand === "mid" ? 0.55 : 0.3;
    return { alias: c.alias, x, y, ring, size, glow, glyph: glyphFor(c.alias) };
  });
}
