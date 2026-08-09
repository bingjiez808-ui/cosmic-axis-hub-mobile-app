/**
 * Home-page CTA resolver — single source of truth for every "enter feature"
 * button on the landing page. Callers pass the desired target route plus the
 * current session/chart/tier facts; the resolver returns:
 *   - `href`: the actual URL to navigate to (never a phantom route)
 *   - `state`: which of the five states the user is in
 *   - `micro`: the small-print sentence to render under the CTA
 *
 * We do NOT open any payment modal from the landing page. When the target
 * page is a paid room (Sage / Oracle), the resolver still routes to the
 * room and lets the room's existing RoomLockedShell + MembershipCheckoutModal
 * handle the upgrade prompt in place. Prevents the home page from ever
 * hosting a second payment surface.
 */

import type { MemTier } from "@/lib/use-membership-tier";

export type CtaState =
  | "signed_out" // → /auth?redirect=<target>
  | "no_primary" // → /ritual?redirect=<target>
  | "ready" // → target
  | "locked_sage" // → target (target owns the paywall)
  | "locked_oracle" // → target
  | "coming_soon"; // → no href, disabled

export type CtaInput = {
  target: string; // absolute in-app path incl. any hash
  requiresAuth?: boolean; // default true
  requiresPrimaryChart?: boolean; // default true
  requiresTier?: MemTier; // "sage" | "oracle" | undefined
  comingSoon?: boolean;
  isSignedIn: boolean;
  hasPrimaryChart: boolean;
  tier: MemTier; // "none" | "sage" | "oracle"
};

export type CtaPlan = {
  href: string | null;
  state: CtaState;
  disabled: boolean;
};

export function resolveCta(input: CtaInput): CtaPlan {
  const {
    target,
    requiresAuth = true,
    requiresPrimaryChart = true,
    requiresTier,
    comingSoon,
    isSignedIn,
    hasPrimaryChart,
    tier,
  } = input;

  if (comingSoon) return { href: null, state: "coming_soon", disabled: true };

  if (requiresAuth && !isSignedIn) {
    return {
      href: `/auth?redirect=${encodeURIComponent(target)}`,
      state: "signed_out",
      disabled: false,
    };
  }

  if (requiresPrimaryChart && !hasPrimaryChart) {
    return {
      href: `/ritual?redirect=${encodeURIComponent(target)}`,
      state: "no_primary",
      disabled: false,
    };
  }

  // Even if the caller needs a higher tier, we still route them TO the
  // target. The room page is the one place that owns the upgrade modal.
  if (requiresTier === "oracle" && tier !== "oracle") {
    return { href: target, state: "locked_oracle", disabled: false };
  }
  if (requiresTier === "sage" && tier === "none") {
    return { href: target, state: "locked_sage", disabled: false };
  }

  return { href: target, state: "ready", disabled: false };
}

/** Bilingual micro-copy shown beneath each CTA. Keep to one short line. */
export function ctaMicroCopy(
  state: CtaState,
  targetLabel: { zh: string; en: string },
  isZh: boolean,
): string {
  const zhTarget = targetLabel.zh;
  const enTarget = targetLabel.en;
  switch (state) {
    case "signed_out":
      return isZh
        ? `先登录 · 保留原意图，登录后返回${zhTarget}`
        : `Sign in first — we'll bring you back to ${enTarget}`;
    case "no_primary":
      return isZh
        ? `进入仪式 · 建立主命盘后返回${zhTarget}`
        : `Complete the ritual — return to ${enTarget} after your primary chart is set`;
    case "locked_sage":
      return isZh
        ? "预览贤者功能 · 进入后可决定是否开通"
        : "Preview the Sage feature — decide inside whether to unlock";
    case "locked_oracle":
      return isZh
        ? "预览神谕者功能 · 进入后可决定是否开通"
        : "Preview the Oracle feature — decide inside whether to unlock";
    case "coming_soon":
      return isZh ? "该馆藏仍在开发，不会向你收费" : "Still being curated — you won't be charged";
    case "ready":
    default:
      return isZh
        ? `进入 ${zhTarget} · 不会重复计算已有内容`
        : `Open ${enTarget} — existing content won't be recomputed`;
  }
}

/** Unified access badge tokens. */
export type AccessTag = "basic" | "sage" | "oracle" | "open" | "coming";

export function accessTagLabel(tag: AccessTag, isZh: boolean): string {
  switch (tag) {
    case "basic":
      return isZh ? "基础馆藏" : "Basic";
    case "sage":
      return isZh ? "贤者功能" : "Sage";
    case "oracle":
      return isZh ? "神谕者功能" : "Oracle";
    case "open":
      return isZh ? "已开放" : "Open";
    case "coming":
      return isZh ? "馆藏整理中" : "Coming later";
  }
}

export function accessTagTooltip(tag: AccessTag, isZh: boolean): string {
  switch (tag) {
    case "basic":
      return isZh ? "完成仪式后即可阅读" : "Available once the ritual is complete";
    case "sage":
      return isZh ? "贤者及神谕者会员可用" : "Available to Sage and Oracle members";
    case "oracle":
      return isZh ? "仅神谕者会员可用" : "Available to Oracle members only";
    case "open":
      return isZh ? "已开放" : "Open now";
    case "coming":
      return isZh ? "该馆藏仍在开发，不会向你收费" : "Still being curated — you won't be charged";
  }
}
