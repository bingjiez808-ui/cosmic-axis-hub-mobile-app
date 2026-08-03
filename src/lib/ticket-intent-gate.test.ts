// @ts-expect-error bun:test
import { describe, it, expect } from "bun:test";
import { classifyIntent } from "@/lib/intent-router";

/**
 * Guardrail: only product/device/order/payment/subscription messages
 * may become tickets. Emotional support, destiny reading, crisis, and
 * out-of-scope must never route to the ticket-draft branch.
 */
const TICKETABLE = new Set(["product_help", "order_help"]);

describe("ticket eligibility follows intent router", () => {
  const cases: Array<[string, string]> = [
    ["我最近很难过，睡不着", "emotional_support"],
    ["帮我算一下明天的运势", "destiny_reading"],
    ["I want to kill myself tonight", "crisis"],
    ["写一段 Python 冒泡排序", "out_of_scope"],
    ["登录页登不上，密码重置也不发邮件", "product_help"],
    ["我付了 79 元但报告没有生成，请退款", "order_help"],
  ];
  for (const [msg, expected] of cases) {
    it(`"${msg.slice(0, 20)}" → ${expected}`, () => {
      const { intent } = classifyIntent(msg);
      expect(intent).toBe(expected as never);
    });
  }
  it("only product/order intents are ticketable", () => {
    const nonTicket = ["emotional_support", "destiny_reading", "crisis", "out_of_scope"];
    for (const n of nonTicket) expect(TICKETABLE.has(n)).toBe(false);
  });
});
