// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { sanitizeAuditMessage, safeMessage } from "./ai-guardrails";

describe("sanitizeAuditMessage — PII-safe audit strings", () => {
  test("strips ISO dates and times", () => {
    const out = sanitizeAuditMessage(
      "chapter_provider_error at 1990-03-15 07:42:00 provider=abc, stand-alone 08:15",
    );
    expect(out).not.toContain("1990-03-15");
    expect(out).not.toContain("07:42");
    expect(out).not.toContain("08:15");
    expect(out).toContain("<redacted:date>");
    expect(out).toContain("<redacted:time>");
  });

  test("strips decimal coordinates", () => {
    const out = sanitizeAuditMessage("failed with lat 39.90546 lng 116.4074");
    expect(out).not.toContain("39.90546");
    expect(out).not.toContain("116.4074");
    expect(out).toContain("<redacted:coord>");
  });

  test("strips birth-field JSON key/value pairs", () => {
    const out = sanitizeAuditMessage(
      'prompt payload: {"birth_date":"1990-03-15","name":"Alice","tz":"Asia/Shanghai"}',
    );
    expect(out).not.toContain("1990-03-15");
    expect(out).not.toContain("Alice");
    expect(out).not.toContain("Asia/Shanghai");
    expect(out).toContain("<redacted>");
  });

  test("leaves catalog-style validation problems intact", () => {
    const out = sanitizeAuditMessage(
      "validation:unresolved_evidence_path:bazi.pillars.day|no_evidence_refs",
    );
    expect(out).toContain("unresolved_evidence_path:bazi.pillars.day");
    expect(out).toContain("no_evidence_refs");
  });

  test("bounded to 400 chars", () => {
    const out = sanitizeAuditMessage("x".repeat(2000));
    expect(out.length).toBeLessThanOrEqual(400);
  });

  test("passes through safeMessage bearer/JWT scrubbing", () => {
    const raw = "eyJabcdefghijklmnopqrstuvwxyz012345 Bearer sk_test_1234567890abcdef";
    const out = sanitizeAuditMessage(raw);
    expect(out).not.toMatch(/eyJabcdefghijklm/);
    // safeMessage strips bearer tokens; assert nothing leaks
    expect(out).not.toMatch(/sk_test_1234567890abcdef/);
  });

  test("safeMessage is still exported and independent", () => {
    expect(safeMessage(new Error("Bearer eyJabcdefghijklmnopqrstuvwxyz1234"))).toContain(
      "Bearer ***",
    );
  });
});
