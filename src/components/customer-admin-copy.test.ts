/**
 * Static scan — customer-facing source must not tell users to
 * "contact the admin" to get premium unlocked. The unlock CTA must
 * point at the simulated cashier for every state that used to render
 * an admin-contact dead-end.
 *
 * Admin management pages (src/routes/_authenticated/**) and internal
 * comments in server-only modules (*.functions.ts, *.server.ts) are
 * intentionally excluded — they are not customer surfaces.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip admin-only surfaces and test files.
      if (full.includes(`${"/"}_authenticated${"/"}`)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const CUSTOMER_FILES = [
  ...walk("src/components"),
  ...walk("src/routes"),
].filter(
  (p) =>
    !p.includes("_authenticated") &&
    !p.endsWith(".functions.ts") &&
    !p.endsWith(".server.ts") &&
    !p.endsWith(".server.tsx"),
);

const FORBIDDEN_PATTERNS: RegExp[] = [
  /联系管理员/,
  /联系\s*管理/,
  /管理员\s*(开通|授权|完成|发放|解锁)/,
  /请管理员/,
  /contact\s+(?:an?\s+|the\s+)?admin/i,
  /admin\s+(?:to\s+)?(?:grant|unlock|complete|approve)/i,
  /reach\s+out\s+to\s+(?:an?\s+|the\s+)?admin/i,
];

describe("Customer surfaces do not funnel users to an admin", () => {
  for (const pattern of FORBIDDEN_PATTERNS) {
    test(`no customer file matches ${pattern}`, () => {
      const offenders: string[] = [];
      for (const f of CUSTOMER_FILES) {
        const src = readFileSync(f, "utf8");
        if (pattern.test(src)) offenders.push(f);
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe("PremiumPdfCard folds pending intents into the ¥79 CTA", () => {
  const SRC = readFileSync("src/components/PremiumPdfCard.tsx", "utf8");
  test("no order_pending state, no provider_pending copy left", () => {
    expect(SRC).not.toContain("order_pending");
    expect(SRC).not.toContain("provider_pending");
    expect(SRC).not.toContain("联系管理员");
    expect(SRC).not.toMatch(/contact\s+an?\s+admin/i);
  });
});
