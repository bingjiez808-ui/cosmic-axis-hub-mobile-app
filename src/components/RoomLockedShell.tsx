/**
 * RoomLockedShell — the shared visual scaffold for the Sage / Oracle
 * reading rooms when the caller is NOT entitled. It renders:
 *
 *   1. A prominent banner (title + hint) at the top with the correct
 *      copy for the caller's tier vs the room they're visiting.
 *   2. The child preview content (function names, descriptions,
 *      sample structure) supplied by the room page.
 *   3. A single, canonical CTA at the bottom (`ROOM_CTA_ANCHOR_ID`)
 *      that links to `/report#membership-plans` — the ONE payment
 *      surface. Locked buttons inside the preview scroll here.
 *
 * `LockedActionButton` is the only affordance rooms should use for the
 * would-be "execute" buttons (generate, ask, tarot, 90-day, synastry).
 * It shows a lock icon + "购买后可使用 / Available after purchase",
 * carries `aria-disabled`, refuses the click, and scrolls to the CTA
 * anchor — never fires a network request, never opens a modal.
 */
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import {
  MEMBERSHIP_PLANS_HREF,
  ROOM_CTA_ANCHOR_ID,
  bannerCopy,
  ctaLabel,
  lockedButtonLabel,
  type RoomBanner,
} from "@/lib/room-access";

export function LockedBanner({ banner, lang }: { banner: RoomBanner; lang: "en" | "zh" }) {
  const { title, hint } = bannerCopy(banner, lang);
  if (!title) return null;
  return (
    <section
      data-testid="room-locked-banner"
      role="status"
      aria-live="polite"
      className="mb-5 rounded-2xl border border-amber-300/40 bg-gradient-to-br from-[#2a1a08] to-[#1a1226] p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full border border-amber-300/40 bg-black/40 text-amber-200"
        >
          <Lock size={16} />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-lg text-amber-100">{title}</p>
          <p className="mt-1 text-sm text-amber-100/75">{hint}</p>
        </div>
      </div>
    </section>
  );
}

export function LockedCtaAnchor({ lang }: { lang: "en" | "zh" }) {
  const isZh = lang === "zh";
  return (
    <section
      id={ROOM_CTA_ANCHOR_ID}
      data-testid="room-locked-cta"
      className="mt-8 scroll-mt-[calc(var(--site-nav-height,96px)+24px)] rounded-2xl border border-amber-300/50 bg-black/30 p-5 text-center"
    >
      <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/80">
        {isZh ? "唯一支付入口" : "Single payment path"}
      </p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-amber-100/80">
        {isZh
          ? "所有付费升级都在报告页的三档方案区完成，避免两个支付窗口。"
          : "All paid upgrades happen in the three-tier plan panel on the report page — never a second checkout."}
      </p>
      <Link
        to="/report"
        hash="membership-plans"
        data-testid="room-locked-cta-link"
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-amber-300 px-5 py-2 text-xs uppercase tracking-[0.28em] text-[#0a0a12] hover:bg-amber-200"
      >
        {ctaLabel(lang)}
      </Link>
    </section>
  );
}

/**
 * Scroll the locked-CTA anchor into view with correct nav offset.
 * Falls back to a hash navigation if the anchor is not on the page.
 */
export function scrollToRoomCta() {
  if (typeof window === "undefined") return;
  const el = document.getElementById(ROOM_CTA_ANCHOR_ID);
  if (!el) {
    window.location.hash = ROOM_CTA_ANCHOR_ID;
    return;
  }
  const nav = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height") || "96",
    10,
  );
  const y = el.getBoundingClientRect().top + window.scrollY - (nav + 16);
  window.scrollTo({ top: y, behavior: "smooth" });
  // Move focus for keyboard users.
  const link = el.querySelector<HTMLElement>('[data-testid="room-locked-cta-link"]');
  link?.focus({ preventScroll: true });
}

export function LockedActionButton({
  testId,
  lang,
  children,
  className,
}: {
  testId?: string;
  lang: "en" | "zh";
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-locked="true"
      aria-disabled="true"
      onClick={(e) => {
        e.preventDefault();
        scrollToRoomCta();
      }}
      title={lockedButtonLabel(lang)}
      className={
        className ??
        "inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-400/30 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-amber-100/70 hover:border-amber-300/60 hover:text-amber-100"
      }
    >
      <Lock size={12} aria-hidden />
      <span>{children}</span>
      <span className="ml-1 text-amber-200/60">· {lockedButtonLabel(lang)}</span>
    </button>
  );
}

export const ROOM_CTA_HREF = MEMBERSHIP_PLANS_HREF;
