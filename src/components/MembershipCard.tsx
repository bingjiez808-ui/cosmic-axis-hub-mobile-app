import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/lib/i18n";
import { useLang } from "@/lib/i18n";

/**
 * MembershipCard — a small server-truth summary of the caller's
 * subscription state. Reads `profiles.membership_tier` and
 * `membership_expires_at` directly (RLS-scoped to the caller); a
 * missing / past expiry with a paid tier fails closed to "none".
 *
 * No `auto_renew` is displayed — that column doesn't exist. We
 * explicitly tell the user the tier lapses at expiry.
 */

type MemState =
  | { kind: "loading" }
  | { kind: "anon" }
  | {
      kind: "ready";
      tier: "none" | "sage" | "oracle";
      expiresAt: string | null;
      active: boolean;
    };

const T = {
  kicker: { zh: "我的会员", en: "My membership" },
  loading: { zh: "读取中…", en: "Loading…" },
  none_title: { zh: "当前：普通访客", en: "Current: Free visitor" },
  sage_title: { zh: "当前：贤者", en: "Current: Sage" },
  oracle_title: { zh: "当前：神谕者", en: "Current: Oracle" },
  active_until: { zh: "有效期至", en: "Valid until" },
  expired: { zh: "已过期 · 已自动降级", en: "Expired — auto-downgraded" },
  auto_lapse: {
    zh: "月度会员到期后自动降级，不会未经确认扣款。",
    en: "Monthly memberships lapse automatically at expiry — no silent renewal.",
  },
  learn_oracle: { zh: "了解神谕者能力", en: "About Oracle" },
  open_oracle: { zh: "进入神谕者阅读室", en: "Enter Oracle Reading Room" },
  reports_note: {
    zh: "¥79 高级综合报告是一次性购买，永久保存 —— 与会员到期无关。",
    en: "The ¥79 Premium Deep Reading is one-time and permanent — independent of membership.",
  },
};

function fmt(iso: string | null, lang: Lang): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function MembershipCard() {
  const { lang } = useLang();
  const [state, setState] = useState<MemState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        if (!cancelled) setState({ kind: "anon" });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("membership_tier, membership_expires_at")
        .eq("id", sess.session.user.id)
        .maybeSingle();
      if (cancelled) return;
      const rawTier = (data?.membership_tier ?? "none") as string;
      const exp = data?.membership_expires_at ? (data.membership_expires_at as string) : null;
      const expDate = exp ? new Date(exp) : null;
      const paid = rawTier === "sage" || rawTier === "oracle";
      const active = paid && !!expDate && expDate.getTime() > Date.now();
      const tier: "none" | "sage" | "oracle" = active ? (rawTier as "sage" | "oracle") : "none";
      setState({ kind: "ready", tier, expiresAt: exp, active });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const t = (k: keyof typeof T) => T[k][lang];

  if (state.kind === "loading") {
    return (
      <div className="rounded-xl border border-amber-400/15 bg-black/20 p-4 text-sm text-amber-100/60">
        {t("loading")}
      </div>
    );
  }
  if (state.kind === "anon") return null;

  const title =
    state.tier === "oracle"
      ? t("oracle_title")
      : state.tier === "sage"
        ? t("sage_title")
        : t("none_title");

  return (
    <section
      data-testid="membership-card"
      className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-[#1a1226] to-[#0a0a12] p-5"
    >
      <div className="text-[11px] uppercase tracking-widest text-amber-300/70">{t("kicker")}</div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-serif text-2xl text-amber-100">{title}</h2>
        {state.tier !== "none" && (
          <div className="text-xs text-amber-100/70">
            {state.active ? (
              <>
                {t("active_until")} {fmt(state.expiresAt, lang)}
              </>
            ) : (
              t("expired")
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-amber-100/65">{t("auto_lapse")}</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/50">{t("reports_note")}</p>
      {state.tier === "oracle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/me/oracle"
            search={{ source: "profile_membership" } as never}
            className="min-h-11 inline-flex items-center rounded-full border border-amber-300/50 px-4 py-2 text-xs text-amber-100 hover:bg-amber-500/10"
          >
            {t("open_oracle")}
          </Link>
        </div>
      )}

    </section>
  );
}
