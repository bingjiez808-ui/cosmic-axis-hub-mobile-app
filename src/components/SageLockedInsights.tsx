/**
 * SageLockedInsights — shared in-place lock overlay for Sage-gated
 * deep analysis sections (relationship depth, anonymous match reveal,
 * etc.). Basic content stays free; wrap the deep sub-tree with this
 * component and the free tier sees a blurred preview + a single CTA
 * that opens the shared MembershipCheckoutModal. On success the tier
 * hook refreshes and the same view unlocks in place — no re-fetch,
 * no route change, no AI recompute.
 */
import { useState } from "react";

import { MembershipCheckoutModal, type CheckoutSource } from "@/components/MembershipCheckoutModal";
import { useLang } from "@/lib/i18n";
import {
  hasSageAccess,
  useMembershipTier,
  type MemTier,
} from "@/lib/use-membership-tier";

const T = {
  badge: { zh: "贤者深度分析", en: "Sage deep analysis" },
  title: {
    zh: "解锁完整解读",
    en: "Unlock the full reading",
  },
  body: {
    zh: "基础评分与维度对你免费开放；共鸣、互补、摩擦与建议为贤者阅览室专属内容。开通后本页原地解锁，无需重新计算。",
    en: "Basic score and dimensions stay free. Resonances, complements, frictions and suggestions live inside the Sage Reading Room. Activate and this view unlocks in place — no recomputation.",
  },
  cta: { zh: "立即开通 · ¥19.9/月", en: "Activate · ¥19.9 / month" },
  loading: { zh: "读取权限中…", en: "Checking access…" },
};

function pick(t: { zh: string; en: string }, lang: "zh" | "en") {
  return lang === "zh" ? t.zh : t.en;
}

export function SageLockedInsights({
  source,
  children,
  testId,
}: {
  source: CheckoutSource;
  children: React.ReactNode;
  testId?: string;
}) {
  const { lang } = useLang();
  const state = useMembershipTier();
  const [open, setOpen] = useState(false);

  const tier: MemTier =
    state.kind === "ready" ? state.tier : state.kind === "anon" ? "none" : "none";
  const unlocked = state.kind === "ready" && hasSageAccess(tier);
  const loading = state.kind === "loading";

  if (unlocked) return <>{children}</>;

  return (
    <div className="relative" data-testid={testId ?? "sage-locked-insights"}>
      <div
        aria-hidden
        className="pointer-events-none select-none opacity-40 blur-[3px]"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-amber-400/40 bg-black/85 p-6 text-center shadow-2xl backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80">
            🔒 {pick(T.badge, lang)}
          </div>
          <h3 className="mt-3 font-serif text-lg italic text-amber-100">
            {pick(T.title, lang)}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-amber-100/75">
            {pick(T.body, lang)}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => setOpen(true)}
            data-testid="sage-locked-cta"
            className="mt-4 min-h-11 rounded-full bg-amber-300 px-6 py-2 text-[11px] uppercase tracking-[0.24em] text-black hover:bg-amber-200 disabled:opacity-50"
          >
            {loading ? pick(T.loading, lang) : pick(T.cta, lang)}
          </button>
        </div>
      </div>
      <MembershipCheckoutModal
        targetTier="sage"
        source={source}
        open={open}
        onClose={() => setOpen(false)}
        lang={lang}
      />
    </div>
  );
}
