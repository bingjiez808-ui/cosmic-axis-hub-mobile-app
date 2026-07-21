import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { loadDailyRoomFixture, type DailyRoomFixtureKey } from "@/experiences/daily-room/fixtures";
import { ensureSocialPreviewAllowed } from "@/experiences/daily-room/route-guard";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useDaily, useFormatDate, xlate } from "@/lib/i18n-daily";
import { formatDailySignal, formatThemeKeyword, formatContradiction, tPhase } from "@/lib/daily-format";

/**
 * /me/home — Today's Reading Room (preview). Fully localized.
 */
export const Route = createFileRoute("/_authenticated/me/home")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => {
    ensureSocialPreviewAllowed();
  },
  component: DailyRoomPage,
});

const FIXTURE_KEYS: DailyRoomFixtureKey[] = [
  "student_youth",
  "working_adult",
  "adult_transition",
  "no_birth_time",
];

const FIXTURE_LABELS: Record<DailyRoomFixtureKey, { zh: string; en: string }> = {
  student_youth: { zh: "学生 · 18 岁", en: "Student · 18" },
  working_adult: { zh: "职场 · 32 岁", en: "Working adult · 32" },
  adult_transition: { zh: "成年转型 · 45 岁", en: "Transition · 45" },
  no_birth_time: { zh: "缺出生时间", en: "No birth time" },
};

const FIXTURE_CHART_LABELS: Record<DailyRoomFixtureKey, { zh: string; en: string }> = {
  student_youth: { zh: "DEMO 学生", en: "DEMO Student" },
  working_adult: { zh: "DEMO 职场", en: "DEMO Working" },
  adult_transition: { zh: "DEMO 转型", en: "DEMO Transition" },
  no_birth_time: { zh: "DEMO 无时", en: "DEMO No-time" },
};

const BAND_COLOR: Record<string, string> = {
  supportive: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  neutral: "text-amber-200 border-amber-400/40 bg-amber-500/10",
  mixed: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  caution: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const dP = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${dP}`;
}

type RealChartAdapterState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error"; message: string }
  | { kind: "ready"; charts: ChartRow[]; canDelete: boolean; canRename: boolean; canSetDefault: boolean };

// (contradiction/theme/signal formatting now lives in `@/lib/daily-format`.)

function DailyRoomPage() {
  const { lang } = useLang();
  const d = useDaily();
  const fmtDate = useFormatDate();
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai"
      : "Asia/Shanghai";
  const today = todayInTz(tz);
  const [fixtureKey, setFixtureKey] = useState<DailyRoomFixtureKey>("working_adult");
  const [showEvidence, setShowEvidence] = useState(false);
  const [entitled, setEntitled] = useState(false);
  const [real, setReal] = useState<RealChartAdapterState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) setReal({ kind: "anonymous" });
          return;
        }
        const charts = await listUserCharts();
        if (cancelled) return;
        setReal({
          kind: "ready",
          charts,
          canDelete: true,
          canRename: true,
          canSetDefault: false,
        });
      } catch (err) {
        if (!cancelled)
          setReal({ kind: "error", message: err instanceof Error ? err.message : "unknown" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fixture = loadDailyRoomFixture(fixtureKey, today, tz);
  const { facts, score } = fixture;

  const domainLabel = (k: string) =>
    d.domain[k as keyof typeof d.domain] ?? xlate({}, k);

  const themeKeywords = useMemo(() => {
    if (!score.overall.theme_keywords.length) return d.theme_default_keyword;
    return score.overall.theme_keywords
      .map((kw) => formatThemeKeyword(kw, d, lang))
      .join(" · ");
  }, [score.overall.theme_keywords, d, lang]);

  const phaseName = facts ? tPhase(d, facts.moon.phase) : "";
  const supportive = score.supportive_signals.length
    ? score.supportive_signals.map((s) => formatDailySignal(s, d, lang))
    : [...d.supportive_demo];
  const caution = score.caution_signals.length
    ? score.caution_signals.map((s) => formatDailySignal(s, d, lang))
    : [...d.caution_demo];

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        {/* Demo banner */}
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          {d.demo_banner_home}
        </div>

        {/* Secondary in-page nav */}
        <nav
          aria-label={d.nav_today}
          className="mb-6 flex flex-wrap items-center gap-2 text-xs"
        >
          <Link
            to="/me/home"
            className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-amber-100"
            aria-current="page"
          >
            {d.nav_today}
          </Link>
          <Link
            to="/me/friends"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
          >
            {d.home_secondary_nav_friends}
          </Link>
          <Link
            to="/me/match"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
          >
            {d.home_secondary_nav_match}
          </Link>
        </nav>

        {/* Real chart adapter */}
        <section className="mb-6 rounded-xl border border-amber-400/15 bg-black/20 p-4 text-xs">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="uppercase tracking-widest text-amber-200/70">
              {d.section_my_charts}
            </div>
            <label className="flex items-center gap-2 text-amber-200/70">
              <input
                type="checkbox"
                checked={entitled}
                onChange={(e) => setEntitled(e.target.checked)}
                className="h-3 w-3 accent-amber-400"
              />
              <span>{d.today_toggle_membership}</span>
            </label>
          </div>
          {real.kind === "loading" && <div className="text-amber-200/60">{d.my_charts_loading}</div>}
          {real.kind === "anonymous" && (
            <div className="text-amber-200/60">{d.my_charts_anonymous}</div>
          )}
          {real.kind === "error" && (
            <div className="text-rose-300/80">{d.my_charts_error(real.message)}</div>
          )}
          {real.kind === "ready" && (
            <div>
              <div className="text-amber-200/80">{d.my_charts_count(real.charts.length)}</div>
              {real.charts.length === 0 && (
                <div className="mt-1 text-amber-200/60">{d.my_charts_empty}</div>
              )}
              {real.charts.slice(0, 5).map((c) => (
                <div key={c.id} className="mt-1 text-amber-100/80">
                  · {c.name ?? d.my_charts_unnamed} · {c.birth_date ?? d.my_charts_missing_date}{" "}
                  {c.birth_time ?? ""}
                </div>
              ))}
              <div className="mt-2 text-amber-200/50">
                {d.capabilities_line({
                  rename: real.canRename,
                  del: real.canDelete,
                  setDefault: real.canSetDefault,
                })}
              </div>
            </div>
          )}
        </section>

        {/* Welcome */}
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-300/60">
            {d.today_kicker}
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">{d.today_title}</h1>
          <div className="mt-2 text-sm text-amber-100/70">
            {fmtDate(today, tz)} · {tz} ·{" "}
            {d.today_chart_label(FIXTURE_CHART_LABELS[fixtureKey][lang])}
            <span className="ml-2 rounded-full border border-amber-400/30 px-2 py-0.5 text-[10px] text-amber-200">
              {entitled ? d.today_tier_member : d.today_tier_free}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {FIXTURE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFixtureKey(k)}
                aria-pressed={fixtureKey === k}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  fixtureKey === k
                    ? "border-amber-300 bg-amber-300/10 text-amber-100"
                    : "border-amber-400/20 text-amber-200/70 hover:border-amber-300/60"
                }`}
              >
                {FIXTURE_LABELS[k][lang]}
              </button>
            ))}
          </div>
        </header>

        {/* Overall + theme */}
        <section className="mb-8 grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
            <div className="text-xs uppercase tracking-widest text-amber-200/60">
              {d.overall_signal}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="text-5xl font-serif text-amber-100">{score.overall.score}</div>
              <div className="text-xs text-amber-200/70">{d.overall_out_of}</div>
            </div>
            <div
              className={`mt-3 inline-block rounded-full border px-2 py-0.5 text-xs ${BAND_COLOR[score.overall.band]}`}
            >
              {xlate(d.band, score.overall.band)}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-amber-100/70">{d.overall_note}</p>
          </div>

          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
            <div className="text-xs uppercase tracking-widest text-amber-200/60">
              {d.today_theme}
            </div>
            <div className="mt-3 text-lg text-amber-100">
              {score.partial ? d.theme_pending : d.theme_line(phaseName, themeKeywords)}
            </div>
            {score.contradictions.length > 0 && (
              <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">
                <div className="mb-1 font-semibold text-amber-200">{d.contradictions_title}</div>
                {score.contradictions.map((c, i) => (
                  <div key={i}>{formatContradiction(c, d, lang)}</div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Four domain signals */}
        <section className="mb-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {score.domains.map((dd) => (
            <div key={dd.domain} className="rounded-xl border border-amber-400/20 bg-black/30 p-4">
              <div className="text-xs text-amber-200/70">{domainLabel(dd.domain)}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-3xl font-serif text-amber-100">{dd.score}</div>
                <div className="text-[10px] text-amber-200/50">{d.overall_out_of}</div>
              </div>
              <div
                className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_COLOR[dd.band]}`}
              >
                {xlate(d.band, dd.band)} · {xlate(d.confidence, dd.confidence)}
              </div>
            </div>
          ))}
        </section>

        {/* Actions */}
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-5">
            <div className="text-xs uppercase tracking-widest text-emerald-200/80">
              {d.supportive_title}
            </div>
            <ul className="mt-3 space-y-2 text-sm text-emerald-50/90">
              {[...supportive].slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-300">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-5">
            <div className="text-xs uppercase tracking-widest text-rose-200/80">
              {d.caution_title}
            </div>
            <ul className="mt-3 space-y-2 text-sm text-rose-50/90">
              {[...caution].slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-rose-300">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Counter + reflection */}
        <section className="mb-8 rounded-xl border border-amber-400/20 bg-black/30 p-5 text-sm">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">
            {d.countercondition_title}
          </div>
          <p className="mt-2 text-amber-100/80">{d.countercondition_body}</p>
          <div className="mt-4 text-xs uppercase tracking-widest text-amber-200/70">
            {d.reflection_title}
          </div>
          <p className="mt-2 text-amber-100/80">{d.reflection_body}</p>
        </section>

        {/* Evidence gate */}
        {!entitled ? (
          <section className="mb-16 rounded-xl border border-amber-400/15 bg-black/20 p-5 text-xs text-amber-100/70">
            {d.free_tier_notice}
          </section>
        ) : (
          <section className="mb-16 rounded-xl border border-amber-400/15 bg-black/20">
            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              aria-expanded={showEvidence}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm text-amber-100/80"
            >
              <span>{d.evidence_title}</span>
              <span className="text-amber-300/70">
                {showEvidence ? d.evidence_collapse : d.evidence_expand}
              </span>
            </button>
            {showEvidence && (
              <div className="border-t border-amber-400/10 px-5 py-5 text-xs leading-relaxed text-amber-100/80">
                <div className="mb-3">
                  <div className="text-amber-200/80">{d.evidence_sample}</div>
                  <div className="text-amber-100/70">
                    {facts ? facts.sample_utc : "(missing)"} · {d.evidence_calc}{" "}
                    <code className="text-amber-300/80">daily-facts-v1</code> ·{" "}
                    <code className="text-amber-300/80">daily-domain-score-v1</code>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-amber-200/80">{d.evidence_slower}</div>
                  <div className="text-amber-100/70">
                    {d.evidence_slower_line(
                      fixture.slower.vedic,
                      fixture.slower.bazi,
                      fixture.slower.ziwei,
                    )}
                  </div>
                  <div className="mt-1 text-amber-100/50">{d.evidence_slower_note}</div>
                </div>
                <div className="mb-3">
                  <div className="text-amber-200/80">{d.evidence_refs}</div>
                  {score.domains.map((dd) => (
                    <div key={dd.domain} className="mt-2">
                      <div className="text-amber-300/80">{domainLabel(dd.domain)}</div>
                      {dd.evidence_refs.length === 0 ? (
                        <div className="text-amber-100/50">{d.evidence_no_strong}</div>
                      ) : (
                        <ul className="ml-3 list-disc text-amber-100/70">
                          {dd.evidence_refs.map((r, i) => (
                            <li key={i}>
                              <code className="text-[11px] text-amber-200/80">{r}</code>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {score.missing_facts.length > 0 && (
                  <div className="mb-3">
                    <div className="text-amber-200/80">{d.evidence_missing}</div>
                    <ul className="ml-3 list-disc text-amber-100/70">
                      {score.missing_facts.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 border-t border-amber-400/10 pt-3 text-amber-100/50">
                  {d.evidence_footer}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
