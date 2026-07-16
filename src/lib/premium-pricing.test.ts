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
  PREMIUM_ALL_PRODUCT_VERSIONS,
  PREMIUM_CURRENCY,
  PREMIUM_LEGACY_PRODUCT_VERSIONS,
  PREMIUM_PRICE_CENTS,
  PREMIUM_PRODUCT_VERSION,
  PREMIUM_REPORT_VERSION,
} from "./premium.functions";

describe("premium price contract", () => {
  test("live product is ¥79 (7900 CNY cents)", () => {
    expect(PREMIUM_PRICE_CENTS).toBe(7900);
    expect(PREMIUM_CURRENCY).toBe("CNY");
  });

  test("live product version is v2 and legacy v1 is preserved for historic orders", () => {
    expect(PREMIUM_PRODUCT_VERSION).toBe("premium_pdf_v2");
    expect(PREMIUM_LEGACY_PRODUCT_VERSIONS).toContain("premium_pdf_v1");
    // The union used for read-side compatibility must contain both.
    expect(PREMIUM_ALL_PRODUCT_VERSIONS).toEqual(
      expect.arrayContaining(["premium_pdf_v1", "premium_pdf_v2"]),
    );
  });

  test("report content structure version stays v1 so historic buyers keep their PDF", () => {
    expect(PREMIUM_REPORT_VERSION).toBe("premium_pdf_v1");
  });
});
