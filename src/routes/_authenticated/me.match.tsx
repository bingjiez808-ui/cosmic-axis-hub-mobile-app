import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { PersonalWorkspaceNav, RelationshipsSubtabs } from "@/components/PersonalWorkspaceNav";

import { computeCompatibility, type CompatResult } from "@/lib/compatibility-score";
import { MATCH_DEMO, type MatchDemoKey } from "@/experiences/daily-room/match-fixtures";

import { SocialConsentGate, useSocialConsent } from "@/experiences/daily-room/social-consent";
import { useLang } from "@/lib/i18n";
import { useDaily, xlate } from "@/lib/i18n-daily";
import {
  listUserCharts,
  getChartById,
  type ChartRow,
} from "@/lib/reports-store.functions";
import { buildCalculationSnapshot } from "@/lib/calc-snapshot";
import { buildPremiumFacts } from "@/lib/premium-facts";
import {
  adaptFacetsFromFacts,
  aggregateEvidence,
} from "@/lib/compatibility-facts-adapter";
import { CommunityMatchPanel } from "@/experiences/community-match/CommunityMatchPanel";
import { useCommunityMatchCopy } from "@/lib/i18n-community-match";
import { SageLockedInsights } from "@/components/SageLockedInsights";


import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { DailyRoomError } from "@/experiences/daily-room/fallback";

export const Route = createFileRoute("/_authenticated/me/match")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
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
  const cmc = useCommunityMatchCopy();
  const [tab, setTab] = useState<"personal" | "community">("personal");

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
    <div className="min-h-screen bg-[#0a0a12]/25 text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          {d.demo_banner_match}
        </div>

        <PersonalWorkspaceNav active="/me/match" />
        <RelationshipsSubtabs current="match" />

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

        <div role="tablist" aria-label="match-tabs" className="mb-6 flex flex-wrap gap-2 border-b border-amber-400/15 pb-3 text-xs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "personal"}
            onClick={() => setTab("personal")}
            className={`rounded-full px-3 py-1.5 transition ${
              tab === "personal"
                ? "border border-amber-300 bg-amber-300/10 text-amber-100"
                : "border border-transparent text-amber-200/70 hover:border-amber-300/40"
            }`}
          >
            {cmc.t("tab_personal")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "community"}
            onClick={() => setTab("community")}
            className={`rounded-full px-3 py-1.5 transition ${
              tab === "community"
                ? "border border-amber-300 bg-amber-300/10 text-amber-100"
                : "border border-transparent text-amber-200/70 hover:border-amber-300/40"
            }`}
          >
            {cmc.t("tab_community")}
          </button>
        </div>

        {tab === "community" ? (
          <CommunityMatchPanel />
        ) : (
          <>
        <RealImportPanel mode={mode} setMode={setMode} facetLabel={facetLabel} />


        <details className="mt-8 rounded-xl border border-amber-400/15 bg-black/20">
          <summary className="cursor-pointer select-none px-4 py-3 text-xs uppercase tracking-widest text-amber-200/70">
            {d.match_demo_details_label}
          </summary>
          <div className="border-t border-amber-400/10 p-4">
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
            </section>

            {effectivelyRevoked ? (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-8 text-center text-sm text-rose-100/80">
                {!consent.gated ? d.match_result_locked_consent : d.match_result_locked_revoked}
              </div>
            ) : (
              <ResultPanel result={result} d={d} facetLabel={facetLabel} />
            )}
          </div>
        </details>
          </>
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

      <SageLockedInsights source="relationship" testId="compat-deep-lock">
        <div className="space-y-6">
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
        </div>
      </SageLockedInsights>


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

/* ------------------------------------------------------------------ */
/* RealImportPanel — pick primary + one "other" chart, compute        */
/* compatibility with the deterministic engine (no AI).               */
/* ------------------------------------------------------------------ */

type ChartFacetsBundle = {
  chart: { id: string; name: string | null };
  facets: { yang?: number; pace?: number; openness?: number; rootedness?: number };
  evidence_refs: string[];
  systems: string[];
  missing_facts: string[];
};

async function loadChartFacets(chartId: string): Promise<ChartFacetsBundle | null> {
  const row = await getChartById({ data: { chartId } });
  if (!row) return null;
  const snap = buildCalculationSnapshot({
    date: row.birth_date,
    time: row.birth_time,
    place: row.birth_place,
    lang: row.lang,
    gender: row.gender,
  });
  const facts = buildPremiumFacts(snap);
  const adapted = adaptFacetsFromFacts(facts);
  const facets: ChartFacetsBundle["facets"] = {};
  if (adapted.yang) facets.yang = adapted.yang.value;
  if (adapted.pace) facets.pace = adapted.pace.value;
  if (adapted.openness) facets.openness = adapted.openness.value;
  if (adapted.rootedness) facets.rootedness = adapted.rootedness.value;
  const refs = new Set<string>();
  for (const fv of [adapted.yang, adapted.pace, adapted.openness, adapted.rootedness]) {
    if (!fv) continue;
    for (const r of fv.evidence_refs) refs.add(r);
  }
  return {
    chart: { id: row.id, name: row.name },
    facets,
    evidence_refs: [...refs],
    systems: adapted.consensus_bodies,
    missing_facts: adapted.missing_facts,
  };
}

function RealImportPanel({
  mode,
  setMode,
  facetLabel,
}: {
  mode: CompatResult["mode"];
  setMode: (m: CompatResult["mode"]) => void;
  facetLabel: (k: CompatResult["dimensions"][number]["key"]) => string;
}) {
  const { lang } = useLang();
  const d = useDaily();
  const [charts, setCharts] = useState<ChartRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [otherId, setOtherId] = useState<string>("");
  const [consented, setConsented] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompatResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listUserCharts();
        if (!cancelled) setCharts(rows);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const primary = charts?.find((c) => c.is_primary && c.chart_role === "self") ?? null;
  const others = charts?.filter((c) => c.chart_role === "other") ?? [];

  const runCompat = async () => {
    if (!primary || !otherId) return;
    setRunning(true);
    setResult(null);
    try {
      const [a, b] = await Promise.all([
        loadChartFacets(primary.id),
        loadChartFacets(otherId),
      ]);
      if (!a || !b) throw new Error("chart_not_found");
      const compat = computeCompatibility({
        a: { userId: `chart:${a.chart.id}`, chartId: a.chart.id, facets: a.facets },
        b: { userId: `chart:${b.chart.id}`, chartId: b.chart.id, facets: b.facets },
        mode,
        lang,
      });
      const refs = aggregateEvidence(
        {
          yang: a.facets.yang != null ? { value: a.facets.yang, evidence_refs: [], systems: [] } : null,
          pace: a.facets.pace != null ? { value: a.facets.pace, evidence_refs: [], systems: [] } : null,
          openness: a.facets.openness != null ? { value: a.facets.openness, evidence_refs: [], systems: [] } : null,
          rootedness: a.facets.rootedness != null ? { value: a.facets.rootedness, evidence_refs: [], systems: [] } : null,
          missing_facts: a.missing_facts,
          consensus_bodies: a.systems,
          confidence: 1,
        },
        {
          yang: b.facets.yang != null ? { value: b.facets.yang, evidence_refs: [], systems: [] } : null,
          pace: b.facets.pace != null ? { value: b.facets.pace, evidence_refs: [], systems: [] } : null,
          openness: b.facets.openness != null ? { value: b.facets.openness, evidence_refs: [], systems: [] } : null,
          rootedness: b.facets.rootedness != null ? { value: b.facets.rootedness, evidence_refs: [], systems: [] } : null,
          missing_facts: b.missing_facts,
          consensus_bodies: b.systems,
          confidence: 1,
        },
      );
      const merged: CompatResult = {
        ...compat,
        evidence_refs: [...new Set([...(compat.evidence_refs ?? []), ...a.evidence_refs, ...b.evidence_refs])],
        source_systems: [...new Set([...(compat.source_systems ?? []), ...a.systems, ...b.systems])],
        cross_system_support: refs.cross_system_support,
        missing_facts: [...new Set([...(compat.missing_facts ?? []), ...a.missing_facts, ...b.missing_facts])],
      };
      setResult(merged);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "unknown");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-amber-400/25 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-widest text-amber-200/70">
        {d.match_import_title}
      </div>
      <p className="mt-2 text-sm text-amber-100/70">{d.match_import_intro}</p>

      {loadErr && (
        <div className="mt-3 text-xs text-rose-300/80">{d.my_charts_error(loadErr)}</div>
      )}
      {charts === null && !loadErr && (
        <div className="mt-3 text-xs text-amber-200/60">{d.my_charts_loading}</div>
      )}

      {charts !== null && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-amber-400/20 bg-black/40 p-3 text-sm">
            <div className="text-[11px] uppercase tracking-widest text-amber-200/60">
              {d.match_import_my_primary_label}
            </div>
            {primary ? (
              <div className="mt-2 text-amber-100">
                <div className="font-medium">{primary.name ?? d.my_charts_unnamed}</div>
                <div className="text-[11px] text-amber-200/60">
                  {primary.birth_date ?? d.my_charts_missing_date} {primary.birth_time ?? ""}
                  {primary.birth_place ? ` · ${primary.birth_place}` : ""}
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-1 text-amber-200/70">
                <div>{d.match_import_no_primary}</div>
                <Link to="/me/home" className="text-amber-300 underline hover:text-amber-200">
                  {d.match_import_go_home}
                </Link>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-amber-400/20 bg-black/40 p-3 text-sm">
            <label className="block text-[11px] uppercase tracking-widest text-amber-200/60">
              {d.match_import_other_label}
            </label>
            {others.length === 0 ? (
              <div className="mt-2 text-amber-200/70">{d.match_import_no_others}</div>
            ) : (
              <select
                value={otherId}
                onChange={(e) => setOtherId(e.target.value)}
                className="mt-2 w-full rounded border border-amber-400/25 bg-black/60 px-2 py-1.5 text-amber-100 outline-none focus:border-amber-300"
              >
                <option value="">{d.match_import_other_placeholder}</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {(c.name ?? d.charts_untitled_other) +
                      (c.birth_date ? ` · ${c.birth_date}` : "")}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
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
      </div>

      <label className="mt-4 flex items-start gap-2 text-xs text-amber-200/80">
        <input
          type="checkbox"
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
          className="mt-0.5 h-3 w-3 accent-amber-400"
        />
        <span>
          <span className="text-amber-100">{d.match_import_privacy}：</span>
          {d.match_import_privacy_ack}
        </span>
      </label>

      <div className="mt-4">
        <button
          type="button"
          disabled={!primary || !otherId || !consented || running}
          onClick={() => void runCompat()}
          className="rounded-md border border-amber-300 bg-amber-300/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="match-run-real"
        >
          {running ? d.match_import_running : d.match_import_run}
        </button>
      </div>

      {result && (
        <div className="mt-6">
          {result.partial && result.missing_facts && result.missing_facts.length > 0 && (
            <div className="mb-3 text-xs text-amber-200/70">
              {d.match_import_partial_note(result.missing_facts.join(", "))}
            </div>
          )}
          <ResultPanel result={result} d={d} facetLabel={facetLabel} />
        </div>
      )}
    </section>
  );
}

