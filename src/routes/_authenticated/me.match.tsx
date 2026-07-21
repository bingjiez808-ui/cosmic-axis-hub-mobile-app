import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { computeCompatibility, type CompatResult } from "@/lib/compatibility-score";
import { MATCH_DEMO, type MatchDemoKey } from "@/experiences/daily-room/match-fixtures";
import { ensureSocialPreviewAllowed } from "@/experiences/daily-room/route-guard";
import { SocialConsentGate, useSocialConsent } from "@/experiences/daily-room/social-consent";
import { useLang } from "@/lib/i18n";
import { useDaily, xlate } from "@/lib/i18n-daily";

export const Route = createFileRoute("/_authenticated/me/match")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => {
    ensureSocialPreviewAllowed();
  },
  component: MatchPage,
});

const KEYS: MatchDemoKey[] = ["friend_pair", "complementary_pair", "clash_pair", "partial_pair"];

const BAND_CLASS: Record<string, string> = {
  high: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  mid: "text-amber-200 border-amber-400/40 bg-amber-500/10",
  low: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

function MatchPage() {
  const { lang } = useLang();
  const d = useDaily();
  const consent = useSocialConsent();
  const [key, setKey] = useState<MatchDemoKey>("friend_pair");
  const [mode, setMode] = useState<CompatResult["mode"]>("friendship");
  const [revoked, setRevoked] = useState(false);
  const effectivelyRevoked = revoked || !consent.gated;

  const pair = MATCH_DEMO[key];
  const showTechDetails =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage.getItem("lod.showTechDetails") === "1";
  const result = useMemo(
    () =>
      computeCompatibility({
        a: { userId: pair.a.userId, chartId: pair.a.chartId, facets: pair.a.facets },
        b: { userId: pair.b.userId, chartId: pair.b.chartId, facets: pair.b.facets },
        mode,
        lang,
      }),
    [pair, mode, lang],
  );

  const facetLabel = (k: CompatResult["dimensions"][number]["key"]): string => {
    switch (k) {
      case "communication":
        return d.match_facet_labels.communication;
      case "emotional_support":
        return d.match_facet_labels.emotional_support;
      case "action_rhythm":
        return d.match_facet_labels.action_tempo;
      case "boundary_repair":
        return d.match_facet_labels.boundary_repair;
      case "shared_growth":
        return d.match_facet_labels.growth;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          {d.demo_banner_match}
        </div>

        <nav aria-label={d.nav_today} className="mb-6 flex flex-wrap items-center gap-2 text-xs">
          <Link
            to="/me/home"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
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
            aria-current="page"
            className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-amber-100"
          >
            {d.home_secondary_nav_match}
          </Link>
        </nav>

        <div className="mb-6">
          <SocialConsentGate />
        </div>

        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-300/60">
            {d.match_kicker}
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">{d.match_title}</h1>
          <p className="mt-3 max-w-2xl text-sm text-amber-100/70">{d.match_intro_plain}</p>
        </header>

        <section className="mb-6 rounded-xl border border-amber-400/20 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">
            {d.match_consent_status}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ConsentCard
              label={pair.a.displayName}
              chart={pair.a.chartLabel}
              consented={!effectivelyRevoked}
              okText={d.match_consent_ok}
              revokedText={d.match_consent_revoked}
            />
            <ConsentCard
              label={pair.b.displayName}
              chart={pair.b.chartLabel}
              consented={!effectivelyRevoked}
              okText={d.match_consent_ok}
              revokedText={d.match_consent_revoked}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRevoked((r) => !r)}
              className="rounded-full border border-rose-400/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
            >
              {revoked ? d.match_toggle_reauth : d.match_toggle_revoke}
            </button>
            <span className="text-xs text-amber-200/60">{d.match_revoke_hint}</span>
          </div>
        </section>

        <section className="mb-6 flex flex-wrap gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKey(k);
                setRevoked(false);
              }}
              aria-pressed={key === k}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                key === k
                  ? "border-amber-300 bg-amber-300/10 text-amber-100"
                  : "border-amber-400/20 text-amber-200/70 hover:border-amber-300/60"
              }`}
            >
              {d.match_demo_labels[k]}
            </button>
          ))}
          <span className="mx-2 self-center text-xs text-amber-200/40">|</span>
          {(["friendship", "romantic", "family", "work"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                mode === m
                  ? "border-amber-300 bg-amber-300/10 text-amber-100"
                  : "border-amber-400/20 text-amber-200/70 hover:border-amber-300/60"
              }`}
            >
              {d.match_modes[m]}
            </button>
          ))}
        </section>

        {effectivelyRevoked ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-8 text-center text-sm text-rose-100/80">
            {!consent.gated ? d.match_result_locked_consent : d.match_result_locked_revoked}
          </div>
        ) : (
          <ResultPanel result={result} d={d} facetLabel={facetLabel} />
        )}

        <p className="mt-8 text-xs text-amber-200/50">{d.match_footer}</p>
        {showTechDetails ? (
          <details className="mt-3 rounded-lg border border-amber-400/10 bg-black/20 px-3 py-2 text-[11px] text-amber-200/40 open:text-amber-200/60">
            <summary className="cursor-pointer select-none tracking-wide">
              {d.match_tech_details_label}
            </summary>
            <p className="mt-2 font-mono">{d.match_tech_line(result.version, result.pairKey)}</p>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function ConsentCard({
  label,
  chart,
  consented,
  okText,
  revokedText,
}: {
  label: string;
  chart: string;
  consented: boolean;
  okText: string;
  revokedText: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${
        consented
          ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-100"
          : "border-rose-400/30 bg-rose-500/5 text-rose-100"
      }`}
    >
      <div className="text-xs uppercase tracking-widest opacity-70">
        {consented ? okText : revokedText}
      </div>
      <div className="mt-2 text-base">{label}</div>
      <div className="mt-1 text-xs opacity-70">{chart}</div>
    </div>
  );
}

function ResultPanel({
  result,
  d,
  facetLabel,
}: {
  result: CompatResult;
  d: ReturnType<typeof useDaily>;
  facetLabel: (k: CompatResult["dimensions"][number]["key"]) => string;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
        <div className="text-xs uppercase tracking-widest text-amber-200/70">
          {d.match_overall_label}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <div className="text-6xl font-serif text-amber-100">{result.overall}</div>
          <div className="text-xs text-amber-200/60">
            / 100 · {d.match_modes[result.mode]}
          </div>
          {result.partial && (
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
              {d.match_partial_pill(String(result.confidence))}
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {result.dimensions.map((dim) => (
          <div key={dim.key} className="rounded-xl border border-amber-400/20 bg-black/30 p-4">
            <div className="text-xs text-amber-200/70">{facetLabel(dim.key)}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-serif text-amber-100">{dim.score}</div>
              <div className="text-[10px] text-amber-200/50">/ 100</div>
            </div>
            <div
              className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_CLASS[dim.band]}`}
            >
              {xlate(d.band, dim.band)}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BulletCard title={d.match_resonances} items={result.resonances} tone="emerald" />
        <BulletCard title={d.match_complements} items={result.complements} tone="amber" />
        <BulletCard title={d.match_frictions} items={result.frictions} tone="rose" />
        <BulletCard title={d.match_suggestions} items={result.suggestions} tone="amber" />
      </section>

      {result.evidence_refs && result.evidence_refs.length > 0 && (
        <section className="rounded-xl border border-amber-400/15 bg-black/20 p-5 text-xs leading-relaxed text-amber-100/80">
          <div className="mb-2 text-amber-200/70">{d.match_evidence_title}</div>
          <div className="flex flex-wrap gap-2">
            {result.evidence_refs.map((r) => (
              <code
                key={r}
                className="rounded border border-amber-400/20 bg-black/40 px-2 py-0.5 text-amber-200/80"
              >
                {r}
              </code>
            ))}
          </div>
          <div className="mt-2 text-amber-200/60">
            {result.source_systems && result.source_systems.length > 0
              ? d.match_evidence_source(
                  result.source_systems.join(" / "),
                  !!result.cross_system_support,
                )
              : d.match_evidence_source_fallback}
          </div>
          {result.missing_facts && result.missing_facts.length > 0 && (
            <div className="mt-2 text-amber-200/50">
              {d.match_evidence_missing(result.missing_facts.join(", "))}
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-amber-400/15 bg-black/20 p-5 text-xs leading-relaxed text-amber-100/70">
        {result.disclaimer}
      </section>
    </div>
  );
}

function BulletCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "rose" | "amber";
}) {
  const border =
    tone === "emerald"
      ? "border-emerald-400/25"
      : tone === "rose"
        ? "border-rose-400/25"
        : "border-amber-400/25";
  return (
    <div className={`rounded-xl border ${border} bg-black/30 p-5`}>
      <div className="text-xs uppercase tracking-widest text-amber-200/70">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-amber-50/90">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-amber-300/70">·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
