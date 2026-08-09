/**
 * Guided Library V2 · shared motion tokens.
 *
 * Every V2 component MUST source duration, easing, distance, and opacity
 * ramps from this file. Ad-hoc numeric values in individual components
 * are forbidden by the `library-v2 motion tokens` test, which greps for
 * literal transitions inside the experience directory.
 *
 * All values are tuned so the longest first-mount animation stays under
 * 1.2s and single interactions land inside 160–700ms.
 */

export const DURATION = {
  /** micro — hover response, button press */
  micro: 0.16,
  /** short — small state changes: reveal/collapse */
  short: 0.28,
  /** medium — page transitions, drawer opens */
  medium: 0.42,
  /** long — entrance ceremonies (never exceed 1.2s in real UI) */
  long: 0.7,
  /** ceremony — full gate cinematic; single-use per session */
  ceremony: 1.05,
} as const;

/**
 * Cubic-bezier easings named for their feel. All 4-tuples are safe
 * to spread into a framer-motion `transition.ease`.
 */
export const EASE = {
  /** default — natural page reveal */
  standard: [0.22, 0.61, 0.36, 1] as [number, number, number, number],
  /** decisive — button press → confirmation */
  decisive: [0.32, 0.72, 0, 1] as [number, number, number, number],
  /** paper — page turn, note into drawer */
  paper: [0.55, 0.08, 0.15, 1] as [number, number, number, number],
} as const;

export const DISTANCE = {
  /** tiny nudge for staggered lines */
  s: 6,
  /** small entrance rise */
  m: 14,
  /** book/page reveal */
  l: 28,
} as const;

export const OPACITY = {
  /** dim state for non-selected sibling cards */
  dim: 0.42,
  /** hover halo */
  halo: 0.22,
} as const;

export const STAGGER = {
  /** default line-by-line stagger */
  line: 0.09,
  /** shelf cards */
  card: 0.06,
} as const;

/**
 * Preset transitions. Import these in a `transition` prop rather than
 * hand-rolling `{ duration, ease }` objects at the call site.
 */
export const TRANSITION = {
  fadeShort: { duration: DURATION.short, ease: EASE.standard },
  fadeMedium: { duration: DURATION.medium, ease: EASE.standard },
  paperMedium: { duration: DURATION.medium, ease: EASE.paper },
  decisiveShort: { duration: DURATION.short, ease: EASE.decisive },
  ceremony: { duration: DURATION.ceremony, ease: EASE.standard },
} as const;
