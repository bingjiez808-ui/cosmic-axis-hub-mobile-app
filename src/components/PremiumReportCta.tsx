import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";

/**
 * PremiumReportCta — session-aware entry to the ¥79 24-chapter deep
 * report. This CTA never fakes payment, never opens an escalation-to-staff
 * fallback, and always sends the visitor into the real /report route
 * — which owns the downstream state machine:
 *   - not signed in → the button routes through /auth with a redirect
 *     back to /report so the visitor keeps their intent;
 *   - signed in, no chart yet → /report shows the chart picker /
 *     ritual entry;
 *   - signed in with a chart → /report opens the panorama and the
 *     PremiumPdfCard, which:
 *       · already-paid + completed → opens the saved report;
 *       · already-paid + generating/pending → resumes with progress;
 *       · unpaid → opens the one-time-purchase modal.
 */
export function PremiumReportCta({
  className,
  labelZh,
  labelEn,
}: {
  className?: string;
  labelZh?: string;
  labelEn?: string;
}) {
  const { lang } = useLang();
  const { session, loading } = useSupabaseSession();
  const isZh = lang === "zh";
  const zhLabel = labelZh ?? "打开 ¥79 综合深度报告";
  const enLabel = labelEn ?? "Open the ¥79 deep report";
  const label = isZh ? zhLabel : enLabel;

  const base =
    className ??
    "group inline-flex min-h-11 items-center gap-2 rounded-full border border-gold-dust/40 bg-obsidian/80 px-8 py-3 text-xs uppercase tracking-[0.32em] text-gold-dust transition hover:border-gold-dust hover:bg-gold-dust/10";

  const aria = isZh
    ? "打开 79 元综合深度报告"
    : "Open the 79 yuan premium deep report";

  if (loading) {
    return (
      <span
        data-testid="premium-report-cta"
        aria-busy="true"
        aria-live="polite"
        className={`${base} pointer-events-none opacity-60`}
      >
        {isZh ? "载入中…" : "Loading…"}
      </span>
    );
  }

  if (!session) {
    return (
      <Link
        to="/auth"
        search={{ redirect: "/report" } as never}
        data-testid="premium-report-cta"
        aria-label={aria}
        className={base}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      to="/report"
      data-testid="premium-report-cta"
      aria-label={aria}
      className={base}
    >
      {label}
    </Link>
  );
}
