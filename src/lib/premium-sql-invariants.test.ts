/**
 * Regression tests documenting the security-critical properties of
 * `public.claim_premium_chapter` at the SQL text level.
 *
 * These do NOT execute against a live database. They read the migration
 * that defines the function and assert:
 *   - SECURITY DEFINER is set (needed for RLS-scoped callers).
 *   - `search_path = public` is pinned (blocks search_path injection).
 *   - Owner-check against premium_pdf_reports is present.
 *   - Only `pending` and `failed` rows are eligible for CAS claim.
 *   - Lock TTL is respected (`make_interval(secs => _lock_ttl_seconds)`).
 *
 * If any of these change, the migration must be updated deliberately
 * and this test bumped alongside it. A live Supabase E2E covering
 * two-worker concurrency, RLS owner isolation, admin gating, and
 * legacy v1/v2 read compatibility is intentionally NOT included in
 * this suite — it requires a fresh project + test users and is
 * tracked as an open follow-up.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIG_DIR = "supabase/migrations";

function loadMigrationDefining(fnName: string): string {
  const files = readdirSync(MIG_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const hits: string[] = [];
  const defRe = new RegExp(
    `(?:CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION)\\s+(?:public\\.)?${fnName}\\b`,
    "i",
  );
  for (const f of files) {
    const text = readFileSync(join(MIG_DIR, f), "utf8");
    if (defRe.test(text)) hits.push(text);
  }
  if (hits.length === 0) throw new Error(`no migration defines ${fnName}`);
  // Return the last (most recent) definition — this is the effective one.
  return hits[hits.length - 1];
}

describe("claim_premium_chapter — SQL invariants", () => {
  const sql = loadMigrationDefining("claim_premium_chapter_for_user");

  test("SECURITY DEFINER", () => {
    expect(sql).toMatch(/SECURITY DEFINER/i);
  });
  test("search_path pinned to public", () => {
    expect(sql).toMatch(/SET\s+search_path\s*(=|TO)\s*(?:'?)public/i);
  });
  test("verifies caller owns the report", () => {
    // Owner-check joins premium_pdf_reports on user_id = auth.uid()
    expect(sql).toMatch(/premium_pdf_reports/i);
    // The specific ownership predicate must be present.
    expect(sql).toMatch(/user_id\s*=\s*_user_id/i);
  });
  test("pending, failed, or stale running rows are eligible for claim", () => {
    expect(sql).toMatch(/status\s+IN\s*\(\s*'pending'\s*,\s*'failed'\s*\)/i);
    expect(sql).toMatch(/status\s*=\s*'running'/i);
  });
  test("CAS honours lock TTL and prior claim_token", () => {
    expect(sql).toMatch(/claim_token/i);
    expect(sql).toMatch(/make_interval\(\s*secs\s*=>\s*_lock_ttl_seconds\s*\)/i);
  });
  test("raises not_authenticated when auth.uid() is null", () => {
    expect(sql).toMatch(/not_authenticated/);
  });
  test("raises not_report_owner when caller doesn't own the report", () => {
    expect(sql).toMatch(/not_report_owner/);
  });
});

describe("admin_ai_usage_summary — access gate", () => {
  const sql = loadMigrationDefining("admin_ai_usage_summary");
  test("SECURITY DEFINER + search_path pinned", () => {
    expect(sql).toMatch(/admin_ai_usage_summary/);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET\s+search_path\s*(=|TO)\s*(?:'?)public/i);
  });
  test("checks admin role via private.has_role", () => {
    expect(sql).toMatch(/private\.has_role\(\s*auth\.uid\(\)\s*,\s*'admin'/i);
  });
  test("throws admin_only with 42501 for non-admins", () => {
    expect(sql).toMatch(/admin_only/);
    expect(sql).toMatch(/42501/);
  });
});
