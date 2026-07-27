/**
 * Input-contract tests for the chart-ownership server functions.
 *
 * These lock the shape of what the client can send in — the actual
 * DB effect (RLS scoping, `set_primary_chart` RPC transaction) is
 * exercised via preview E2E because bun:test cannot boot Supabase.
 */
// @ts-expect-error — bun:test
import { describe, expect, test } from "bun:test";
import {
  AssignChartOwnershipInputSchema,
} from "./reports-store.functions";

describe("AssignChartOwnershipInputSchema", () => {
  const base = { chartId: "11111111-1111-1111-1111-111111111111" as const };

  test("accepts self + replace intent (existing primary → replace)", () => {
    const parsed = AssignChartOwnershipInputSchema.parse({
      ...base,
      role: "self",
      autoPromoteIfNoPrimary: true,
      primaryIntent: "replace",
    });
    expect(parsed.primaryIntent).toBe("replace");
  });

  test("accepts self + keep intent (existing primary → save as other-self)", () => {
    const parsed = AssignChartOwnershipInputSchema.parse({
      ...base,
      role: "self",
      autoPromoteIfNoPrimary: true,
      primaryIntent: "keep",
    });
    expect(parsed.primaryIntent).toBe("keep");
  });

  test("primaryIntent is optional (first-time self auto-promote path)", () => {
    const parsed = AssignChartOwnershipInputSchema.parse({
      ...base,
      role: "self",
      autoPromoteIfNoPrimary: true,
    });
    expect(parsed.primaryIntent).toBeUndefined();
  });

  test("rejects invalid primaryIntent value", () => {
    expect(() =>
      AssignChartOwnershipInputSchema.parse({
        ...base,
        role: "self",
        primaryIntent: "delete",
      }),
    ).toThrow();
  });

  test("relationshipLabel trims whitespace and enforces 80-char cap", () => {
    const parsed = AssignChartOwnershipInputSchema.parse({
      ...base,
      role: "other",
      relationshipLabel: "  伴侣  ",
    });
    expect(parsed.relationshipLabel).toBe("伴侣");

    expect(() =>
      AssignChartOwnershipInputSchema.parse({
        ...base,
        role: "other",
        relationshipLabel: "x".repeat(81),
      }),
    ).toThrow();
  });

  test("role must be 'self' or 'other'", () => {
    expect(() =>
      AssignChartOwnershipInputSchema.parse({ ...base, role: "unknown" }),
    ).toThrow();
  });
});
