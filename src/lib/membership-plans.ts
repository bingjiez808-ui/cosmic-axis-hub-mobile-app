/**
 * MEMBERSHIP_PLANS — single source of truth for monthly-membership
 * tier names, prices and benefit copy across the whole app.
 *
 * The server-side `simulate_mock_membership_upgrade` RPC re-derives
 * price from the target tier — this table is used ONLY for UI display.
 */

export type MembershipTierId = "sage" | "oracle";
export type MembershipPaymentMethod = "wechat" | "alipay" | "visa" | "unionpay";

export const MEMBERSHIP_PAYMENT_METHODS: MembershipPaymentMethod[] = [
  "wechat",
  "alipay",
  "visa",
  "unionpay",
];

export type MembershipPlan = {
  id: MembershipTierId;
  priceCents: number;
  currency: "CNY";
  name: { zh: string; en: string };
  priceLabel: { zh: string; en: string };
  benefits: { zh: string; en: string };
};

export const MEMBERSHIP_PLANS: Record<MembershipTierId, MembershipPlan> = {
  sage: {
    id: "sage",
    priceCents: 1990,
    currency: "CNY",
    name: { zh: "贤者", en: "Sage" },
    priceLabel: { zh: "¥19.9 / 月", en: "¥19.9 / mo" },
    benefits: {
      zh: "完整生命时间轴 · 合盘关系分析 · 每月 10 次塔罗 AI 解读 · 开通即赠 2 次先贤回信与 1 次管理员授权（真人回信）。",
      en: "Full life timeline · synastry · 10 tarot AI readings per month · 2 gifted sage replies and 1 librarian-authorised human reply on joining.",
    },
  },
  oracle: {
    id: "oracle",
    priceCents: 3990,
    currency: "CNY",
    name: { zh: "神谕者", en: "Oracle" },
    priceLabel: { zh: "¥39.9 / 月", en: "¥39.9 / mo" },
    benefits: {
      zh: "包含贤者全部权益 · 无限 AI 追问 · 无限塔罗 · 90 天窗口分析。",
      en: "Everything in Sage · unlimited AI follow-up · unlimited tarot · 90-day windows.",
    },
  },
};

export const MEMBERSHIP_METHOD_LABELS: Record<
  MembershipPaymentMethod,
  { zh: string; en: string; glyph: string }
> = {
  wechat: { zh: "微信支付", en: "WeChat Pay", glyph: "💬" },
  alipay: { zh: "支付宝", en: "Alipay", glyph: "🅰" },
  visa: { zh: "Visa / Mastercard", en: "Visa / Mastercard", glyph: "💳" },
  unionpay: { zh: "银联卡", en: "UnionPay", glyph: "🀄" },
};

/** Oracle strictly inherits Sage. */
export function tierCovers(current: "none" | "sage" | "oracle", target: MembershipTierId): boolean {
  if (current === "oracle") return true;
  if (current === "sage") return target === "sage";
  return false;
}

/** Generate a client-side idempotency key for a single checkout attempt. */
export function newIdempotencyKey(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `mem_${rnd}`.slice(0, 60);
}
