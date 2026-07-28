// @ts-expect-error — bun:test
import { describe, expect, test } from "bun:test";

import {
  MEMBERSHIP_PLANS_HREF,
  ROOM_CTA_ANCHOR_ID,
  bannerCopy,
  ctaLabel,
  lockedButtonLabel,
  roomAccess,
} from "@/lib/room-access";

describe("roomAccess — free tier", () => {
  test("blocks Sage room with none-sage banner", () => {
    const a = roomAccess("none", "sage");
    expect(a.entitled).toBe(false);
    expect(a.banner).toBe("none-sage");
    expect(a.ctaHref).toBe(MEMBERSHIP_PLANS_HREF);
  });
  test("blocks Oracle room with none-oracle banner", () => {
    const a = roomAccess("none", "oracle");
    expect(a.entitled).toBe(false);
    expect(a.banner).toBe("none-oracle");
    expect(a.ctaHref).toBe(MEMBERSHIP_PLANS_HREF);
  });
});

describe("roomAccess — sage tier", () => {
  test("passes Sage room", () => {
    const a = roomAccess("sage", "sage");
    expect(a.entitled).toBe(true);
    expect(a.banner).toBe("ok");
  });
  test("blocks Oracle room with sage-visiting-oracle banner", () => {
    const a = roomAccess("sage", "oracle");
    expect(a.entitled).toBe(false);
    expect(a.banner).toBe("sage-visiting-oracle");
    expect(a.ctaHref).toBe(MEMBERSHIP_PLANS_HREF);
  });
});

describe("roomAccess — oracle tier inherits sage", () => {
  test("passes Sage room (inheritance)", () => {
    const a = roomAccess("oracle", "sage");
    expect(a.entitled).toBe(true);
    expect(a.banner).toBe("ok");
  });
  test("passes Oracle room", () => {
    const a = roomAccess("oracle", "oracle");
    expect(a.entitled).toBe(true);
    expect(a.banner).toBe("ok");
  });
});

describe("CTA is the single canonical anchor", () => {
  test("every ctaHref points at /report#membership-plans", () => {
    for (const tier of ["none", "sage", "oracle"] as const) {
      for (const room of ["sage", "oracle"] as const) {
        expect(roomAccess(tier, room).ctaHref).toBe("/report#membership-plans");
      }
    }
  });
  test("ROOM_CTA_ANCHOR_ID exists and is stable", () => {
    expect(ROOM_CTA_ANCHOR_ID).toBe("membership-plans-cta");
  });
});

describe("bilingual banner copy", () => {
  test("none-sage has both languages, mentions sage room", () => {
    const zh = bannerCopy("none-sage", "zh");
    const en = bannerCopy("none-sage", "en");
    expect(zh.title).toContain("贤者阅览室");
    expect(en.title.toLowerCase()).toContain("sage");
    expect(zh.hint.length).toBeGreaterThan(0);
    expect(en.hint.length).toBeGreaterThan(0);
  });
  test("none-oracle has both languages, mentions oracle room", () => {
    const zh = bannerCopy("none-oracle", "zh");
    const en = bannerCopy("none-oracle", "en");
    expect(zh.title).toContain("神谕者阅览室");
    expect(en.title.toLowerCase()).toContain("oracle");
  });
  test("sage-visiting-oracle names both tiers explicitly", () => {
    const zh = bannerCopy("sage-visiting-oracle", "zh");
    const en = bannerCopy("sage-visiting-oracle", "en");
    expect(zh.title).toContain("贤者");
    expect(zh.title).toContain("神谕者");
    expect(en.title.toLowerCase()).toContain("sage");
    expect(en.title.toLowerCase()).toContain("oracle");
  });
  test("ok banner is empty (no banner rendered)", () => {
    expect(bannerCopy("ok", "zh").title).toBe("");
    expect(bannerCopy("ok", "en").title).toBe("");
  });
});

describe("locked-button label + CTA label are bilingual", () => {
  test("locked button label", () => {
    expect(lockedButtonLabel("zh")).toBe("购买后可使用");
    expect(lockedButtonLabel("en")).toBe("Available after purchase");
  });
  test("cta label", () => {
    expect(ctaLabel("zh")).toBe("查看会员方案");
    expect(ctaLabel("en")).toBe("See membership plans");
  });
});
