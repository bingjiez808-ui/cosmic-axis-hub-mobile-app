// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import { PREMIUM_V3_DEMO_SAMPLE, DEV_SAMPLE_ONLY } from "./premium-demo-v3";
import { validateV3Content } from "./premium-chapters-v3";

describe("premium-demo-v3 — deterministic sample", () => {
  it("has 24 chapters", () => {
    expect(PREMIUM_V3_DEMO_SAMPLE.chapters).toHaveLength(24);
  });
  it("passes v3 validator with no issues", () => {
    expect(validateV3Content(PREMIUM_V3_DEMO_SAMPLE)).toEqual([]);
  });
  it("labels itself as a demo sample so UI cannot mistake it for real data", () => {
    expect(PREMIUM_V3_DEMO_SAMPLE.meta.chart_name).toContain(DEV_SAMPLE_ONLY);
    expect(PREMIUM_V3_DEMO_SAMPLE.cover.subtitle).toContain("NOT A REAL USER");
  });
});
