/**
 * Canonical price contract + version migration for the Premium Deep Reading.
 *
 * Server holds the only source of truth for amount / currency / product
 * version. Clients render whatever server functions return and never
 * pass amounts into `startPremiumCheckout` / `grantPremiumReportAccess`.
 * Legacy PDF-era paid rows (v1 ¥99, v2 ¥79) still inherit permanent
 * access; new orders always create the current deep-report version.
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

  test("live product version is deep-report v1; legacy PDF versions preserved", () => {
    expect(PREMIUM_PRODUCT_VERSION).toBe("premium_deep_report_v1");
    expect(PREMIUM_LEGACY_PRODUCT_VERSIONS).toContain("premium_pdf_v1");
    expect(PREMIUM_LEGACY_PRODUCT_VERSIONS).toContain("premium_pdf_v2");
    expect(PREMIUM_ALL_PRODUCT_VERSIONS).toEqual(
      expect.arrayContaining([
        "premium_pdf_v1",
        "premium_pdf_v2",
        "premium_deep_report_v1",
      ]),
    );
  });

  test("report content schema version is stable so historic buyers keep their generated report", () => {
    expect(PREMIUM_REPORT_VERSION).toBe("premium_pdf_v1");
  });
});

const row = (
  id: string,
  status: OrderRowLite["status"],
  product_version: string,
): OrderRowLite => ({ id, status, product_version });

describe("chooseCheckoutAction — legacy PDF ↔ deep report", () => {
  test("legacy v1 paid → already_paid (permanent entitlement)", () => {
    const d = chooseCheckoutAction([row("v1a", "paid", "premium_pdf_v1")]);
    expect(d).toEqual({ action: "already_paid", orderId: "v1a" });
  });

  test("legacy v2 (PDF ¥79) paid → already_paid", () => {
    const d = chooseCheckoutAction([row("v2a", "paid", "premium_pdf_v2")]);
    expect(d).toEqual({ action: "already_paid", orderId: "v2a" });
  });

  test("legacy pending is IGNORED — a new deep-report order at ¥79 must be created", () => {
    const d = chooseCheckoutAction([row("v1p", "pending", "premium_pdf_v1")]);
    expect(d).toEqual({
      action: "create_current",
      amountCents: 7900,
      productVersion: "premium_deep_report_v1",
    });
  });

  test("legacy refunded/failed do NOT unlock and do not block a new order", () => {
    const d1 = chooseCheckoutAction([row("v1r", "refunded", "premium_pdf_v1")]);
    const d2 = chooseCheckoutAction([row("v2f", "failed", "premium_pdf_v2")]);
    for (const d of [d1, d2]) {
      expect(d.action).toBe("create_current");
      if (d.action === "create_current") expect(d.amountCents).toBe(7900);
    }
  });

  test("current-version pending is reused (no duplicate charge)", () => {
    const d = chooseCheckoutAction([row("dp", "pending", "premium_deep_report_v1")]);
    expect(d).toEqual({ action: "reuse_current_pending", orderId: "dp" });
  });

  test("current-version paid → already_paid", () => {
    const d = chooseCheckoutAction([row("da", "paid", "premium_deep_report_v1")]);
    expect(d).toEqual({ action: "already_paid", orderId: "da" });
  });

  test("legacy pending + current pending → current pending reused, legacy untouched", () => {
    const d = chooseCheckoutAction([
      row("v1p", "pending", "premium_pdf_v1"),
      row("dp", "pending", "premium_deep_report_v1"),
    ]);
    expect(d).toEqual({ action: "reuse_current_pending", orderId: "dp" });
  });

  test("no orders → create current-version ¥79", () => {
    const d = chooseCheckoutAction([]);
    expect(d).toEqual({
      action: "create_current",
      amountCents: 7900,
      productVersion: "premium_deep_report_v1",
    });
  });
});

describe("chooseGrantAction — admin grants respect legacy paid", () => {
  test("legacy v1 paid → reject_legacy (never duplicate grant)", () => {
    const d = chooseGrantAction([row("v1a", "paid", "premium_pdf_v1")]);
    expect(d).toEqual({ action: "reject_legacy", orderId: "v1a" });
  });

  test("legacy v2 paid → reject_legacy", () => {
    const d = chooseGrantAction([row("v2a", "paid", "premium_pdf_v2")]);
    expect(d).toEqual({ action: "reject_legacy", orderId: "v2a" });
  });

  test("legacy pending → ignored, create fresh current-version paid grant", () => {
    const d = chooseGrantAction([row("v1p", "pending", "premium_pdf_v1")]);
    expect(d).toEqual({ action: "create_current_paid" });
  });

  test("current-version pending → upgraded to paid", () => {
    const d = chooseGrantAction([row("dp", "pending", "premium_deep_report_v1")]);
    expect(d).toEqual({ action: "upgrade_current_pending", orderId: "dp" });
  });

  test("current-version paid → idempotent reuse", () => {
    const d = chooseGrantAction([row("da", "paid", "premium_deep_report_v1")]);
    expect(d).toEqual({ action: "reuse_current_paid", orderId: "da" });
  });
});
