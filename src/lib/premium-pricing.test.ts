/**
 * Canonical price contract for the Premium ¥79 PDF product.
 *
 * The server holds the single source of truth for amount / currency /
 * product version. Clients render whatever server functions return and
 * never pass an amount into `startPremiumCheckout` / `grantPremiumReportAccess`.
 * These assertions guard against accidental drift back to ¥99.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";

import {
  chooseCheckoutAction,
  chooseGrantAction,
  PREMIUM_ALL_PRODUCT_VERSIONS,
  PREMIUM_CURRENCY,
  PREMIUM_LEGACY_PRODUCT_VERSIONS,
  PREMIUM_PRICE_CENTS,
  PREMIUM_PRODUCT_VERSION,
  PREMIUM_REPORT_VERSION,
  type OrderRowLite,
} from "./premium.functions";

describe("premium price contract", () => {
  test("live product is ¥79 (7900 CNY cents)", () => {
    expect(PREMIUM_PRICE_CENTS).toBe(7900);
    expect(PREMIUM_CURRENCY).toBe("CNY");
  });

  test("live product version is v2 and legacy v1 is preserved for historic orders", () => {
    expect(PREMIUM_PRODUCT_VERSION).toBe("premium_pdf_v2");
    expect(PREMIUM_LEGACY_PRODUCT_VERSIONS).toContain("premium_pdf_v1");
    expect(PREMIUM_ALL_PRODUCT_VERSIONS).toEqual(
      expect.arrayContaining(["premium_pdf_v1", "premium_pdf_v2"]),
    );
  });

  test("report content structure version stays v1 so historic buyers keep their PDF", () => {
    expect(PREMIUM_REPORT_VERSION).toBe("premium_pdf_v1");
  });
});

// Shorthand row builder.
const row = (
  id: string,
  status: OrderRowLite["status"],
  product_version: string,
): OrderRowLite => ({ id, status, product_version });

describe("chooseCheckoutAction — v1/v2 migration rules", () => {
  test("legacy v1 paid → already_paid (permanent entitlement)", () => {
    const d = chooseCheckoutAction([row("v1a", "paid", "premium_pdf_v1")]);
    expect(d).toEqual({ action: "already_paid", orderId: "v1a" });
  });

  test("legacy v1 pending is IGNORED — new v2 order at ¥79 must be created", () => {
    const d = chooseCheckoutAction([row("v1p", "pending", "premium_pdf_v1")]);
    expect(d).toEqual({
      action: "create_v2",
      amountCents: 7900,
      productVersion: "premium_pdf_v2",
    });
  });

  test("legacy v1 refunded/failed do NOT unlock and do not block v2 checkout", () => {
    const d1 = chooseCheckoutAction([row("v1r", "refunded", "premium_pdf_v1")]);
    const d2 = chooseCheckoutAction([row("v1f", "failed", "premium_pdf_v1")]);
    for (const d of [d1, d2]) {
      expect(d.action).toBe("create_v2");
      if (d.action === "create_v2") expect(d.amountCents).toBe(7900);
    }
  });

  test("existing v2 pending is reused (no duplicate charge)", () => {
    const d = chooseCheckoutAction([row("v2p", "pending", "premium_pdf_v2")]);
    expect(d).toEqual({ action: "reuse_v2_pending", orderId: "v2p" });
  });

  test("v2 paid → already_paid", () => {
    const d = chooseCheckoutAction([row("v2a", "paid", "premium_pdf_v2")]);
    expect(d).toEqual({ action: "already_paid", orderId: "v2a" });
  });

  test("v1 pending + v2 pending coexist → v2 pending is reused, v1 untouched", () => {
    const d = chooseCheckoutAction([
      row("v1p", "pending", "premium_pdf_v1"),
      row("v2p", "pending", "premium_pdf_v2"),
    ]);
    expect(d).toEqual({ action: "reuse_v2_pending", orderId: "v2p" });
  });

  test("no orders → create v2 ¥79", () => {
    const d = chooseCheckoutAction([]);
    expect(d).toEqual({
      action: "create_v2",
      amountCents: 7900,
      productVersion: "premium_pdf_v2",
    });
  });
});

describe("chooseGrantAction — admin grants respect legacy v1", () => {
  test("v1 paid → reject_legacy_v1 (never duplicate grant)", () => {
    const d = chooseGrantAction([row("v1a", "paid", "premium_pdf_v1")]);
    expect(d).toEqual({ action: "reject_legacy_v1", orderId: "v1a" });
  });

  test("v1 pending → ignored, create fresh v2 paid grant", () => {
    const d = chooseGrantAction([row("v1p", "pending", "premium_pdf_v1")]);
    expect(d).toEqual({ action: "create_v2_paid" });
  });

  test("v2 pending → upgraded to paid", () => {
    const d = chooseGrantAction([row("v2p", "pending", "premium_pdf_v2")]);
    expect(d).toEqual({ action: "upgrade_v2_pending", orderId: "v2p" });
  });

  test("v2 paid → idempotent reuse", () => {
    const d = chooseGrantAction([row("v2a", "paid", "premium_pdf_v2")]);
    expect(d).toEqual({ action: "reuse_v2_paid", orderId: "v2a" });
  });
});
