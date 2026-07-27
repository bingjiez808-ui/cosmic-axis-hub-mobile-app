/**
 * Access-level resolver — Phase A.
 *
 * The single, fail-closed mapping from real backend state to the
 * capability tiers that the UI renders. Never trust free-text checks:
 * every gated affordance MUST route through `hasAccess(feature, ctx)`.
 *
 * Real backend state today:
 *   - `profiles.membership_tier`         → 'none' | 'sage' | 'oracle'
 *   - `profiles.membership_expires_at`   → tier expires at this instant
 *   - `premium_pdf_reports.status`       → 'completed' means one-time
 *     ¥79 premium deep report is owned for that (user_id, chart_id).
 *
 * Tier lifecycle (product decision):
 *   - `sage` and `oracle` are MONTHLY subscriptions that recur, and
 *     lapse back to `none` when `membership_expires_at < now()`.
 *   - The premium deep report is a ONE-TIME purchase — once owned for a
 *     chart, it is permanent and never expires, independent of the
 *     subscription tier the user currently holds.
 *
 * The current build ships mock payment only; the resolver never claims
 * an upgrade succeeded on its own. Real writes to membership fields go
 * through the existing admin panel + (future) payment webhook.
 */

export type MembershipTier = "none" | "sage" | "oracle";

export type AccessLevel = "free" | "sage" | "oracle" | "premium_report";

/**
 * A single stable feature key per gated affordance. Adding a new key
 * here forces the caller to think about entitlement instead of guessing
 * from copy strings.
 */
export type FeatureKey =
  // Free surfaces
  | "panorama_basic"
  | "daily_reading"
  | "concern_situational_response"
  | "personal_bookshelf"
  // Sage-tier ("read one theme deeply")
  | "concern_deep_chapter"
  | "sage_conversation_unlimited"
  | "yearly_window_detail"
  // Oracle-tier ("read all four traditions and full life chapters")
  | "cross_tradition_synthesis"
  | "full_life_timeline"
  // One-time
  | "premium_report_read";

/**
 * The minimum access level that unlocks each feature. Kept small and
 * declarative so a reviewer can see the entire capability surface in
 * one screen.
 */
const REQUIRED: Record<FeatureKey, AccessLevel> = {
  panorama_basic: "free",
  daily_reading: "free",
  concern_situational_response: "free",
  personal_bookshelf: "free",

  concern_deep_chapter: "sage",
  sage_conversation_unlimited: "sage",
  yearly_window_detail: "sage",

  cross_tradition_synthesis: "oracle",
  full_life_timeline: "oracle",

  premium_report_read: "premium_report",
};

export function requiredLevelFor(feature: FeatureKey): AccessLevel {
  return REQUIRED[feature];
}

/**
 * The caller's ground-truth capability context. `chartId` is optional
 * because most affordances aren't chart-scoped, but the premium report
 * is owned per (user, chart), so `premiumChartIds` must be a set of
 * chart IDs the user has already paid to unlock.
 */
export type AccessContext = {
  membershipTier: MembershipTier | null;
  membershipExpiresAt: Date | string | null;
  premiumChartIds: readonly string[];
  now?: Date;
};

function membershipActive(ctx: AccessContext): boolean {
  if (!ctx.membershipTier || ctx.membershipTier === "none") return false;
  if (!ctx.membershipExpiresAt) return false;
  const now = ctx.now ?? new Date();
  const exp =
    ctx.membershipExpiresAt instanceof Date
      ? ctx.membershipExpiresAt
      : new Date(ctx.membershipExpiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() > now.getTime();
}

/**
 * The strongest subscription-tier level the caller currently holds.
 * Never returns 'premium_report' — that is a one-time, per-chart flag.
 */
export function resolveTierLevel(ctx: AccessContext): "free" | "sage" | "oracle" {
  if (!membershipActive(ctx)) return "free";
  return ctx.membershipTier === "oracle" ? "oracle" : "sage";
}

/**
 * Fail-closed capability check. Unknown feature → false. Missing data
 * → false. Only genuinely-verified state returns true.
 */
export function hasAccess(
  feature: FeatureKey,
  ctx: AccessContext,
  opts: { chartId?: string } = {},
): boolean {
  const required = REQUIRED[feature];
  if (!required) return false;

  if (required === "free") return true;

  if (required === "premium_report") {
    if (!opts.chartId) return false;
    return ctx.premiumChartIds.includes(opts.chartId);
  }

  const tier = resolveTierLevel(ctx);
  if (required === "sage") return tier === "sage" || tier === "oracle";
  if (required === "oracle") return tier === "oracle";
  return false;
}

/**
 * UI-facing label vocabulary. Consumers MUST use these strings for
 * badges/CTAs — a bare `sage` in copy is a bug.
 */
export const ACCESS_LABEL: Record<AccessLevel, { zh: string; en: string }> = {
  free: { zh: "免费可读", en: "Free to read" },
  sage: { zh: "贤者功能", en: "Sage feature" },
  oracle: { zh: "神谕者功能", en: "Oracle feature" },
  premium_report: { zh: "高级报告解锁", en: "Premium report unlock" },
};

/**
 * Result-oriented upgrade-CTA copy per feature. Never write "立即升级"
 * — always name what the user gets.
 */
export const UPGRADE_CTA: Partial<Record<FeatureKey, { zh: string; en: string }>> = {
  concern_deep_chapter: {
    zh: "解锁这一主题的深度阅读",
    en: "Unlock the deep reading for this theme",
  },
  yearly_window_detail: {
    zh: "解锁事业与关键年份的时间窗口",
    en: "Unlock career & keystone-year windows",
  },
  sage_conversation_unlimited: {
    zh: "解锁与智者的无限对话",
    en: "Unlock unlimited Sage conversations",
  },
  cross_tradition_synthesis: {
    zh: "解锁四体系交叉综合",
    en: "Unlock cross-tradition synthesis",
  },
  full_life_timeline: {
    zh: "解锁完整人生时间轴",
    en: "Unlock the full life timeline",
  },
  premium_report_read: {
    zh: "生成完整高级报告 ¥79",
    en: "Generate the full premium report · ¥79",
  },
};
