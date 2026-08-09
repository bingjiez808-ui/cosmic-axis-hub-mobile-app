/**
 * Room entitlement policy — the single, testable source of truth for
 * whether a caller can use the Sage or Oracle reading rooms.
 *
 * The UI uses this to draw locked-preview state and to build the single
 * "See membership plans" CTA. Server functions remain the real gate.
 *
 * Rule: `free < sage < oracle` (Oracle strictly inherits Sage).
 */
import type { MemTier } from "@/lib/use-membership-tier";

export type RoomId = "sage" | "oracle";

export type RoomBanner =
  | "ok"
  | "none-sage" // free user visiting /me/sage
  | "none-oracle" // free user visiting /me/oracle
  | "sage-visiting-oracle"; // Sage member visiting /me/oracle

export type RoomAccess = {
  /** true when the caller is entitled to actually use the room. */
  entitled: boolean;
  /** which banner text to display */
  banner: RoomBanner;
  /** single canonical anchor href for the CTA — nothing else may target payment. */
  ctaHref: string;
};

export const MEMBERSHIP_PLANS_HREF = "/report#membership-plans";

export function roomAccess(tier: MemTier, room: RoomId): RoomAccess {
  if (room === "sage") {
    if (tier === "sage" || tier === "oracle") {
      return { entitled: true, banner: "ok", ctaHref: MEMBERSHIP_PLANS_HREF };
    }
    return { entitled: false, banner: "none-sage", ctaHref: MEMBERSHIP_PLANS_HREF };
  }
  // room === "oracle"
  if (tier === "oracle") {
    return { entitled: true, banner: "ok", ctaHref: MEMBERSHIP_PLANS_HREF };
  }
  if (tier === "sage") {
    return {
      entitled: false,
      banner: "sage-visiting-oracle",
      ctaHref: MEMBERSHIP_PLANS_HREF,
    };
  }
  return { entitled: false, banner: "none-oracle", ctaHref: MEMBERSHIP_PLANS_HREF };
}

export function bannerCopy(banner: RoomBanner, lang: "en" | "zh"): {
  title: string;
  hint: string;
} {
  const isZh = lang === "zh";
  switch (banner) {
    case "none-sage":
      return {
        title: isZh ? "您尚未购买贤者阅览室" : "You haven't purchased the Sage Reading Room",
        hint: isZh
          ? "以下功能仅供预览；购买后可使用。"
          : "The features below are a preview — available after purchase.",
      };
    case "none-oracle":
      return {
        title: isZh
          ? "您尚未购买神谕者阅览室"
          : "You haven't purchased the Oracle Reading Room",
        hint: isZh
          ? "以下功能仅供预览；购买后可使用。神谕者会同时解锁贤者的全部权益。"
          : "The features below are a preview — available after purchase. Oracle also unlocks every Sage benefit.",
      };
    case "sage-visiting-oracle":
      return {
        title: isZh
          ? "当前为贤者会员，神谕者功能尚未开通"
          : "You are a Sage member — Oracle features are not active yet",
        hint: isZh
          ? "贤者阅览室可正常使用；神谕者独有的追问、90 天窗口、命盘选择在这里仅做预览。"
          : "The Sage Reading Room works as usual; Oracle-only follow-up, 90-day windows and chart picker are preview-only here.",
      };
    case "ok":
    default:
      return { title: "", hint: "" };
  }
}

export function lockedButtonLabel(lang: "en" | "zh"): string {
  return lang === "zh" ? "购买后可使用" : "Available after purchase";
}

export function ctaLabel(lang: "en" | "zh"): string {
  return lang === "zh" ? "查看会员方案" : "See membership plans";
}

/** DOM id for the in-page CTA — locked buttons scroll to this. */
export const ROOM_CTA_ANCHOR_ID = "membership-plans-cta";
