import type { ReactNode } from "react";

const CJK_RE = /[\u4e00-\u9fff]/;
const NATURAL_BREAK_RE = /[，。、；：·・—…]/;

/**
 * Prevent orphan glyphs at the end of a headline.
 *
 * For short-to-medium CJK titles (6–24 codepoints) the browser's
 * `text-wrap: balance/pretty` implementations still leave a single
 * character or lone punctuation stranded on line 2. We work around
 * that by splitting the title into two `white-space: nowrap` groups
 * at (or near) the midpoint — the browser can only break at that
 * seam, producing a naturally balanced two-line layout without any
 * stranded glyphs and without hanging punctuation.
 *
 * For Latin / mixed strings we fall back to the classic "glue the
 * last two glyphs together" trick.
 */
export function noOrphan(s: string): ReactNode {
  if (!s) return s;
  const chars = Array.from(s);
  const len = chars.length;
  const isCjk = CJK_RE.test(s);

  if (isCjk && len >= 6 && len <= 24) {
    const mid = Math.ceil(len / 2);
    let split = mid;
    // Prefer a natural CJK punctuation break within ±2 of the midpoint.
    for (let delta = 0; delta <= 2; delta++) {
      for (const i of [mid - delta, mid + delta]) {
        if (i > 1 && i < len - 1 && NATURAL_BREAK_RE.test(chars[i - 1])) {
          split = i;
          break;
        }
      }
    }
    return (
      <>
        <span style={{ whiteSpace: "nowrap" }}>{chars.slice(0, split).join("")}</span>
        <span style={{ whiteSpace: "nowrap" }}>{chars.slice(split).join("")}</span>
      </>
    );
  }

  if (len <= 2) return s;
  return (
    <>
      {chars.slice(0, -2).join("")}
      <span style={{ whiteSpace: "nowrap" }}>{chars.slice(-2).join("")}</span>
    </>
  );
}
