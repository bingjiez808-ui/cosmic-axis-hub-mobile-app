/**
 * Redemption code format · shared client/server pure helpers.
 *
 * Format: `FN-<TAG>-XXXX-XXXX-XXXX`
 *   TAG: benefit tag (SAGE / ORAC / REPT / TEST / SUPP)
 *   XXXX: A-Z 2-9 excluding confusables (0/O/1/I/L/U)
 *
 * `normalizeCode` is the ONLY entry into HMAC. It uppercases, strips
 * non-alphanumerics, then re-inserts hyphens every 4 chars after the
 * prefix so the same user input pasted with/without dashes hashes to
 * the same value.
 */

export const REDEMPTION_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // 30 chars — no 0/O/1/I/L/U

export type RedemptionBenefitType =
  | "sage_membership"
  | "oracle_membership"
  | "premium_report"
  | "test_access"
  | "support_compensation";

const BENEFIT_TAG: Record<RedemptionBenefitType, string> = {
  sage_membership: "SAGE",
  oracle_membership: "ORAC",
  premium_report: "REPT",
  test_access: "TEST",
  support_compensation: "SUPP",
};

/** Strip whitespace/dashes and uppercase. Returns "" if input is invalid. */
export function stripCode(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Normalize a code the way the server hashes it: strip → validate charset
 * (allowed alphabet only after prefix, but we tolerate stray digits so
 * legacy inputs still match). Returns `null` if the shape is obviously
 * invalid so the caller can short-circuit before hitting the server.
 */
export function normalizeCode(raw: string): string | null {
  const s = stripCode(raw);
  if (!s.startsWith("FN")) return null;
  // Minimum: FN + 4-char tag + 12 payload chars = 18
  if (s.length < 18 || s.length > 40) return null;
  return s;
}

/**
 * Extract non-secret display metadata from a raw or normalized code.
 * Used for `code_prefix` / `code_last4` display everywhere.
 */
export function codeMeta(raw: string): { prefix: string; last4: string } | null {
  const n = normalizeCode(raw);
  if (!n) return null;
  return { prefix: n.slice(0, 6), last4: n.slice(-4) };
}

/**
 * Format a normalized string for display: FN-TAG-XXXX-XXXX-XXXX
 */
export function formatCodeForDisplay(normalized: string): string {
  if (normalized.length < 6) return normalized;
  const head = normalized.slice(0, 6); // FN + tag
  const body = normalized.slice(6);
  const chunks: string[] = [];
  for (let i = 0; i < body.length; i += 4) chunks.push(body.slice(i, i + 4));
  return [head, ...chunks].join("-");
}

/** Server-side random-code minting. Not usable in the browser. */
export function mintRandomCode(benefit: RedemptionBenefitType, rng: () => number = Math.random): string {
  const tag = BENEFIT_TAG[benefit];
  let payload = "";
  for (let i = 0; i < 12; i += 1) {
    const idx = Math.floor(rng() * REDEMPTION_ALPHABET.length);
    payload += REDEMPTION_ALPHABET[idx];
  }
  return formatCodeForDisplay(`FN${tag}${payload}`);
}
