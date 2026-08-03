// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import { resolveCta, ctaMicroCopy, accessTagLabel, accessTagTooltip } from "./home-cta";

describe("resolveCta — five landing-page states", () => {
  const base = {
    target: "/life-studies/math",
    isSignedIn: false,
    hasPrimaryChart: false,
    tier: "none" as const,
  };

  it("signed_out routes through /auth?redirect=<target>", () => {
    const r = resolveCta(base);
    expect(r.state).toBe("signed_out");
    expect(r.href).toBe("/auth?redirect=%2Flife-studies%2Fmath");
    expect(r.disabled).toBe(false);
  });

  it("no_primary routes through /ritual?redirect=<target>", () => {
    const r = resolveCta({ ...base, isSignedIn: true });
    expect(r.state).toBe("no_primary");
    expect(r.href).toBe("/ritual?redirect=%2Flife-studies%2Fmath");
  });

  it("ready routes directly to target", () => {
    const r = resolveCta({ ...base, isSignedIn: true, hasPrimaryChart: true });
    expect(r.state).toBe("ready");
    expect(r.href).toBe("/life-studies/math");
  });

  it("locked_sage still routes to target so the room paywall handles it", () => {
    const r = resolveCta({
      ...base,
      isSignedIn: true,
      hasPrimaryChart: true,
      requiresTier: "sage",
    });
    expect(r.state).toBe("locked_sage");
    expect(r.href).toBe("/life-studies/math");
    expect(r.disabled).toBe(false);
  });

  it("sage tier satisfies sage requirement (ready state)", () => {
    const r = resolveCta({
      ...base,
      isSignedIn: true,
      hasPrimaryChart: true,
      tier: "sage",
      requiresTier: "sage",
    });
    expect(r.state).toBe("ready");
  });

  it("locked_oracle triggers for sage tier + oracle requirement", () => {
    const r = resolveCta({
      ...base,
      isSignedIn: true,
      hasPrimaryChart: true,
      tier: "sage",
      requiresTier: "oracle",
    });
    expect(r.state).toBe("locked_oracle");
    expect(r.href).toBe("/life-studies/math");
  });

  it("oracle tier satisfies oracle requirement", () => {
    const r = resolveCta({
      ...base,
      isSignedIn: true,
      hasPrimaryChart: true,
      tier: "oracle",
      requiresTier: "oracle",
    });
    expect(r.state).toBe("ready");
  });

  it("coming_soon short-circuits everything — no href, disabled", () => {
    const r = resolveCta({
      ...base,
      isSignedIn: true,
      hasPrimaryChart: true,
      tier: "oracle",
      requiresTier: "oracle",
      comingSoon: true,
    });
    expect(r.state).toBe("coming_soon");
    expect(r.href).toBeNull();
    expect(r.disabled).toBe(true);
  });

  it("requiresPrimaryChart=false skips the ritual gate", () => {
    const r = resolveCta({ ...base, isSignedIn: true, requiresPrimaryChart: false });
    expect(r.state).toBe("ready");
  });

  it("requiresAuth=false skips the auth gate", () => {
    const r = resolveCta({ ...base, requiresAuth: false, requiresPrimaryChart: false });
    expect(r.state).toBe("ready");
  });

  it("encodes hash anchors in target for redirect param", () => {
    const r = resolveCta({ ...base, target: "/report#life-timeline" });
    expect(r.href).toContain(encodeURIComponent("#life-timeline"));
  });
});

describe("ctaMicroCopy — bilingual per state", () => {
  const label = { zh: "数学馆", en: "the Math Hall" };
  it("returns non-empty distinct copy for every state × lang", () => {
    const states = [
      "signed_out",
      "no_primary",
      "ready",
      "locked_sage",
      "locked_oracle",
      "coming_soon",
    ] as const;
    const seen = new Set<string>();
    for (const s of states) {
      for (const isZh of [true, false]) {
        const c = ctaMicroCopy(s, label, isZh);
        expect(c.length).toBeGreaterThan(4);
        seen.add(c);
      }
    }
    expect(seen.size).toBe(states.length * 2);
  });
});

describe("access tag vocabulary", () => {
  it("labels use only the four approved tokens per lang", () => {
    expect(accessTagLabel("basic", true)).toBe("基础馆藏");
    expect(accessTagLabel("sage", true)).toBe("贤者功能");
    expect(accessTagLabel("oracle", true)).toBe("神谕者功能");
    expect(accessTagLabel("open", true)).toBe("已开放");
    expect(accessTagLabel("coming", true)).toBe("馆藏整理中");
    expect(accessTagLabel("basic", false)).toBe("Basic");
    expect(accessTagLabel("oracle", false)).toBe("Oracle");
  });

  it("tooltip forbidden vocabulary check — no 免费/普通/求索者/未购买/无权限", () => {
    const banned = ["免费", "普通", "求索者", "未购买", "无权限"];
    for (const tag of ["basic", "sage", "oracle", "open", "coming"] as const) {
      for (const isZh of [true, false]) {
        const t = accessTagTooltip(tag, isZh);
        for (const b of banned) expect(t.includes(b)).toBe(false);
      }
    }
  });
});
