/**
 * Static-source guarantees for the simulated cashier UI.
 *
 * These tests read `src/components/MockPaymentModal.tsx` as text and
 * assert the invariants that matter for the mock payment surface:
 *
 *   • Renders test-mode badge copy in both languages.
 *   • Wires all four payment methods.
 *   • NEVER collects real financial data — no card-number / CVV /
 *     expiry / bank-account / phone-number inputs.
 *   • Only talks to the auth-gated `simulateMockPremiumPayment` server
 *     function; no direct DB writes, no fetch to any PSP host.
 *   • Renders a QR placeholder for the QR methods only.
 *
 * Failing any of these means the UI regressed toward looking like a
 * real payment surface — reviewer must fix the modal, not this test.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(
  join(process.cwd(), "src/components/MockPaymentModal.tsx"),
  "utf8",
);

describe("MockPaymentModal — visual + safety invariants", () => {
  test("renders test-mode badge copy in both languages", () => {
    expect(SRC).toContain("测试支付 · 不会产生真实扣款");
    expect(SRC).toContain("Test payment · no real charge");
  });

  test("lists all four payment methods", () => {
    for (const m of ["WeChat Pay", "Alipay", "Visa", "UnionPay"]) {
      expect(SRC).toContain(m);
    }
    for (const m of ["微信支付", "支付宝", "银联卡"]) {
      expect(SRC).toContain(m);
    }
  });

  test("wires the auth-gated mock server function, not a raw HTTP call", () => {
    expect(SRC).toContain("simulateMockPremiumPayment");
    expect(SRC).not.toMatch(/fetch\(["'`]https?:\/\//);
    expect(SRC).not.toMatch(/api\.(alipay|wechat|weixinpay|unionpay|visa)/i);
  });

  test("never renders card / CVV / expiry / bank / phone input fields", () => {
    // No <input> elements at all — the mock UI is a selector + button.
    expect(SRC).not.toMatch(/<input\b/);
    // Reject accidental copy that could imply real capture.
    for (const forbidden of [
      /card\s*number/i,
      /credit[-\s]?card/i,
      /\bCVV\b/,
      /\bCVC\b/,
      /expiry|expiration date/i,
      /bank account/i,
      /\bIBAN\b/,
      /routing number/i,
      /手机号/,
      /卡号/,
      /有效期/,
      /安全码|校验码/,
    ]) {
      expect(SRC).not.toMatch(forbidden);
    }
  });

  test("shows a QR placeholder marked as illustrative for scan methods", () => {
    expect(SRC).toContain('data-testid="mock-qr-placeholder"');
    expect(SRC).toMatch(/示意|illustrative/i);
  });

  test("has a confirm button and treats production as disabled", () => {
    expect(SRC).toContain('data-testid="mock-payment-confirm"');
    expect(SRC).toContain("import.meta.env?.PROD");
    // Disabled copy for production is present.
    expect(SRC).toContain("支付渠道尚未开放");
    expect(SRC).toContain("Payment channel not yet available");
  });

  test("does not offer any PDF / export affordances", () => {
    expect(SRC).not.toMatch(/\bPDF\b/);
    expect(SRC).not.toMatch(/导出|Export/i);
  });
});

describe("PremiumPdfCard wires the modal instead of a live checkout", () => {
  const CARD = readFileSync(
    join(process.cwd(), "src/components/PremiumPdfCard.tsx"),
    "utf8",
  );

  test("imports MockPaymentModal and renders it", () => {
    expect(CARD).toContain('from "@/components/MockPaymentModal"');
    expect(CARD).toContain("<MockPaymentModal");
  });

  test("does not call startPremiumCheckout anywhere in the click handler", () => {
    expect(CARD).not.toContain("startPremiumCheckout");
  });
});
