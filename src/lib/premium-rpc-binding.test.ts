/**
 * Regression: SupabaseClient.rpc uses `this.rest` internally.
 * Assigning `const rpc = supabaseAdmin.rpc` and invoking it as a bare
 * function drops `this` in strict mode and produces:
 *   "Cannot read properties of undefined (reading 'rest')"
 *
 * The production `processNextPremiumChapter` must invoke rpc bound to
 * the client. This test guards the call-site shape.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("premium rpc binding", () => {
  it("processNextPremiumChapter invokes supabaseAdmin.rpc bound to the client", () => {
    const src = readFileSync(join(__dirname, "premium.functions.ts"), "utf8");
    // Extract the region around the rpc declaration.
    const idx = src.indexOf("const rpc =");
    expect(idx).toBeGreaterThan(0);
    const window = src.slice(idx, idx + 600);
    // Must NOT keep the bare-alias pattern that drops `this`.
    expect(window).not.toMatch(/const\s+rpc\s*=\s*supabaseAdmin\.rpc\s+as\s+unknown/);
    // Must invoke via .call(supabaseAdmin, …) or supabaseAdmin.rpc.bind(supabaseAdmin).
    const bound =
      /\.call\(\s*supabaseAdmin\s*,/.test(window) ||
      /supabaseAdmin\.rpc\.bind\(\s*supabaseAdmin\s*\)/.test(window);
    expect(bound).toBe(true);
  });

  it("simulates the `this.rest` failure mode when rpc is unbound", () => {
    class FakeClient {
      rest = { rpc: (fn: string) => ({ ok: true, fn }) };
      rpc(fn: string) {
        // Mirrors @supabase/supabase-js SupabaseClient.rpc
        return (this as unknown as FakeClient).rest.rpc(fn);
      }
    }
    const client = new FakeClient();
    const unbound = client.rpc;
    expect(() => (unbound as (f: string) => unknown)("x")).toThrow(
      /Cannot read propert(?:y|ies) of undefined \(reading 'rest'\)/,
    );
    // Bound call works.
    expect(client.rpc("x")).toEqual({ ok: true, fn: "x" });
    expect((client.rpc as (f: string) => unknown).call(client, "x")).toEqual({ ok: true, fn: "x" });
  });
});
