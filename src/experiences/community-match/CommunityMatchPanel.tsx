/**
 * Community Anonymous Match — immersive "Resonance Atlas" client panel.
 *
 * Purely presentational; delegates all writes to server functions in
 * `src/lib/community-match.functions.ts`. Never displays user IDs,
 * emails, birth data, or chart IDs — the server contract only ships
 * whitelisted anonymous fields.
 *
 * Visual language matches the Fate Library motif: obsidian, indigo,
 * deep gold, celestial instruments. Motion respects
 * `prefers-reduced-motion` via {@link useReducedMotion}.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  getMyCommunityMatchProfile,
  optIntoCommunityMatch,
  optOutOfCommunityMatch,
  setCommunityMatchPaused,
  listCommunityMatchCandidates,
  sendCommunityMatchInvite,
  respondCommunityMatchInvite,
  revokeCommunityMatchInvite,
  listMyCommunityMatchInvites,
  listMyCommunityMatches,
  revokeCommunityMatchGrant,
  reportCommunityMatchAlias,
  type CommunityMatchProfile,
  type CandidateCard,
  type InviteView,
  type MatchView,
  type AgeBand,
  AGE_BANDS,
} from "@/lib/community-match.functions";
import { useCommunityMatchCopy } from "@/lib/i18n-community-match";
import { ResonanceAtlas } from "./atlas/ResonanceAtlas";
import { ResonanceRadar, type RadarFacet } from "./atlas/ResonanceRadar";
import { BookmarkGlyphIcon } from "./atlas/BookmarkGlyph";
import { glyphFor } from "./atlas/bookmark";

type SubTab = "atlas" | "invites" | "matches" | "privacy";

const BAND_CLASS: Record<string, string> = {
  high: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  mid: "text-amber-200 border-amber-400/40 bg-amber-500/10",
  low: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

/** Four axes shown on the resonance radar (spec: 4-dim). */
const RADAR_KEYS = [
  "communication",
  "emotional_support",
  "action_rhythm",
  "shared_growth",
] as const;

export function CommunityMatchPanel() {
  const c = useCommunityMatchCopy();
  const getProfile = useServerFn(getMyCommunityMatchProfile);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CommunityMatchProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState<SubTab>("atlas");

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const p = await getProfile();
      setProfile(p);
    } catch (e) {
      setErr(c.errFor(e instanceof Error ? e.message : "generic"));
    } finally {
      setLoading(false);
    }
  }, [getProfile, c]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  if (loading) {
    return <div className="rounded-xl border border-amber-400/20 bg-black/30 p-6 text-sm text-amber-200/70">…</div>;
  }
  if (err && !profile) {
    return (
      <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-6 text-sm text-rose-200">
        {err}
      </div>
    );
  }
  if (!profile) {
    return <OptInGate onDone={refreshProfile} />;
  }

  return (
    <div className="space-y-6">
      <HeroRitual />
      <ProfileHeader profile={profile} onChange={refreshProfile} />
      <nav
        aria-label="Community match sub-navigation"
        className="flex flex-wrap gap-2 border-b border-amber-400/15 pb-3"
      >
        {(["atlas", "invites", "matches", "privacy"] as SubTab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            aria-pressed={sub === k}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              sub === k
                ? "border border-amber-300 bg-amber-300/10 text-amber-100"
                : "border border-transparent text-amber-200/70 hover:border-amber-300/40"
            }`}
          >
            {c.t(
              k === "atlas"
                ? "tab_candidates"
                : k === "invites"
                  ? "tab_invites"
                  : k === "matches"
                    ? "tab_matches"
                    : "tab_privacy",
            )}
          </button>
        ))}
      </nav>
      {sub === "atlas" && <AtlasTab paused={profile.isPaused} selfAlias={profile.alias} />}
      {sub === "invites" && <InvitesTab />}
      {sub === "matches" && <MatchesTab />}
      {sub === "privacy" && <PrivacyTab profile={profile} onChange={refreshProfile} />}
    </div>
  );
}

/* -------------------- hero + ritual -------------------- */

function HeroRitual() {
  const c = useCommunityMatchCopy();
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[#1a1030] via-[#0c0820] to-black p-6 md:p-8"
      aria-labelledby="cmp-hero-title"
    >
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" />
      </div>
      <div className="relative">
        <div className="text-[11px] uppercase tracking-[0.32em] text-amber-300/70">
          {c.t("tab_community")}
        </div>
        <h2
          id="cmp-hero-title"
          className="mt-2 max-w-2xl font-serif text-2xl leading-snug text-amber-100 md:text-3xl"
        >
          {c.t("hero_title")}
        </h2>
        <p className="mt-3 max-w-xl text-sm text-amber-100/75">{c.t("hero_body")}</p>
        <ol className="mt-5 grid gap-2 text-xs text-amber-200/85 sm:grid-cols-3">
          {[c.t("ritual_step1"), c.t("ritual_step2"), c.t("ritual_step3")].map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-amber-400/15 bg-black/30 px-3 py-2"
            >
              <span className="font-mono text-amber-300/80">·0{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------- opt-in -------------------- */

function OptInGate({ onDone }: { onDone: () => void }) {
  const c = useCommunityMatchCopy();
  const optIn = useServerFn(optIntoCommunityMatch);
  const [ageBand, setAgeBand] = useState<AgeBand | "">("");
  const [showAgeBand, setShowAgeBand] = useState(true);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      await optIn({ data: { ageBand: ageBand || null, showAgeBand } });
      onDone();
    } catch (e) {
      setErr(c.errFor(e instanceof Error ? e.message : "generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#1a1030] via-[#0c0820] to-black p-6">
      <div className="text-[11px] uppercase tracking-[0.32em] text-amber-300/70">
        {c.t("intro_title")}
      </div>
      <h3 className="mt-2 font-serif text-xl text-amber-100">{c.t("opt_in_headline")}</h3>
      <p className="mt-3 text-sm text-amber-100/70">{c.t("intro_body")}</p>

      <ul className="mt-5 space-y-1.5 text-xs text-amber-200/80">
        <li>· {c.t("opt_in_req_age")}</li>
        <li>· {c.t("opt_in_req_primary")}</li>
      </ul>

      <div className="mt-5 space-y-3">
        <label className="block text-xs text-amber-200/80">
          {c.t("opt_in_age_band_label")}
          <select
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value as AgeBand | "")}
            className="mt-1 block w-full rounded border border-amber-400/25 bg-black/40 px-2 py-1.5 text-sm text-amber-100"
          >
            <option value="">—</option>
            {AGE_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-amber-200/80">
          <input
            type="checkbox"
            checked={!showAgeBand}
            onChange={(e) => setShowAgeBand(!e.target.checked)}
          />
          {c.t("opt_in_age_band_hide")}
        </label>
        <label className="flex items-start gap-2 text-xs text-amber-100/90">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>{c.t("opt_in_consent")}</span>
        </label>
      </div>

      {err && <div className="mt-3 text-xs text-rose-300">{err}</div>}

      <button
        type="button"
        disabled={!consent || submitting}
        onClick={submit}
        className="mt-4 rounded-full border border-amber-300 bg-amber-300/15 px-4 py-2 text-sm text-amber-100 hover:bg-amber-300/25 disabled:opacity-40"
      >
        {c.t("opt_in_cta")}
      </button>

      <p className="mt-4 text-[11px] text-amber-200/60">{c.t("opt_in_privacy_hint")}</p>
    </section>
  );
}

/* -------------------- profile header -------------------- */

function ProfileHeader({
  profile,
  onChange,
}: {
  profile: CommunityMatchProfile;
  onChange: () => void;
}) {
  const c = useCommunityMatchCopy();
  const setPaused = useServerFn(setCommunityMatchPaused);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await setPaused({ data: { paused: !profile.isPaused } });
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const glyph = glyphFor(profile.alias);
  return (
    <section className="rounded-xl border border-amber-400/25 bg-black/30 p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-300/50 bg-black/50 text-amber-200">
            <BookmarkGlyphIcon glyph={glyph} size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-amber-200/60">
              {c.t("pool_alias_you")}
            </div>
            <div className="truncate font-mono text-lg text-amber-100">{profile.alias}</div>
          </div>
        </div>
        {profile.isPaused && (
          <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
            {c.t("pool_paused")}
          </span>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className="rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200 hover:bg-amber-300/10"
          >
            {profile.isPaused ? c.t("pool_resume") : c.t("pool_pause")}
          </button>
        </div>
      </div>
    </section>
  );
}

/* -------------------- atlas tab (star map + detail drawer + list toggle) -------------------- */

function AtlasTab({ paused, selfAlias }: { paused: boolean; selfAlias: string }) {
  const c = useCommunityMatchCopy();
  const list = useServerFn(listCommunityMatchCandidates);
  const invite = useServerFn(sendCommunityMatchInvite);
  const report = useServerFn(reportCommunityMatchAlias);
  const [items, setItems] = useState<CandidateCard[] | null>(() => candidatesCache.items);
  const [err, setErr] = useState<string | null>(null);
  const [invited, setInvited] = useState<Record<string, "sent" | "err">>({});
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"atlas" | "list">("atlas");
  const [focusedAlias, setFocusedAlias] = useState<string | null>(
    () => candidatesCache.items?.[0]?.alias ?? null,
  );
  const [flightFor, setFlightFor] = useState<string | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (paused) return;
    // DB enforces a 60s server-side cooldown; skip if we just fetched.
    if (!force && candidatesCache.items && Date.now() - candidatesCache.at < 60_000) {
      setItems(candidatesCache.items);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const rows = await list({ data: { limit: 10, mode: "friendship", lang: "en" } });
      candidatesCache = { items: rows, at: Date.now() };
      setItems(rows);
      if (rows.length > 0 && !focusedAlias) setFocusedAlias(rows[0].alias);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "generic";
      // Rate-limit is expected when navigating back within 60s — keep stale list.
      if (msg === "rate_limited" && candidatesCache.items) {
        setItems(candidatesCache.items);
      } else {
        setErr(c.errFor(msg));
      }
    } finally {
      setLoading(false);
    }
  }, [list, paused, c, focusedAlias]);


  useEffect(() => {
    void refresh();
  }, [refresh]);

  const focused = useMemo(
    () => (items ?? []).find((x) => x.alias === focusedAlias) ?? null,
    [items, focusedAlias],
  );

  const doInvite = async (alias: string) => {
    setFlightFor(alias);
    setTimeout(() => setFlightFor(null), 1200);
    try {
      await invite({ data: { alias, mode: "friendship" } });
      setInvited((m) => ({ ...m, [alias]: "sent" }));
    } catch (e) {
      setInvited((m) => ({ ...m, [alias]: "err" }));
      setErr(c.errFor(e instanceof Error ? e.message : "generic"));
    }
  };

  const doReport = async (alias: string) => {
    try {
      await report({ data: { alias, category: "community_match" } });
      alert(c.t("card_report") + " ✓");
    } catch (e) {
      setErr(c.errFor(e instanceof Error ? e.message : "generic"));
    }
  };

  if (paused) {
    return <p className="text-sm text-amber-200/70">{c.t("pool_paused")}</p>;
  }
  if (loading && !items) {
    return (
      <p className="text-sm text-amber-200/70" role="status">
        {c.t("atlas_scanning")}
      </p>
    );
  }

  const candidates = items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-amber-400/25 bg-black/30 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setView("atlas")}
            aria-pressed={view === "atlas"}
            className={`rounded-full px-3 py-1 transition ${
              view === "atlas" ? "bg-amber-300/15 text-amber-100" : "text-amber-200/70"
            }`}
          >
            {c.t("view_atlas")}
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`rounded-full px-3 py-1 transition ${
              view === "list" ? "bg-amber-300/15 text-amber-100" : "text-amber-200/70"
            }`}
          >
            {c.t("view_list")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void refresh(true)}
          className="rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200 hover:bg-amber-300/10"
        >
          {c.t("candidates_refresh")}
        </button>
        {err && <span className="text-xs text-rose-300">{err}</span>}
      </div>

      {view === "atlas" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative">
            <ResonanceAtlas
              self={{ alias: selfAlias }}
              candidates={candidates.map((k) => ({
                alias: k.alias,
                overall: k.overall,
                overallBand: k.overallBand,
                pending: invited[k.alias] === "sent",
              }))}
              focusedAlias={focusedAlias}
              onSelect={setFocusedAlias}
              labelYou={c.t("atlas_center_you")}
              labelPending={c.t("atlas_pending_pulse")}
              emptyLabel={c.t("atlas_none_yet")}
            />
            {flightFor && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="cmp-bookmark-flight">
                  <BookmarkGlyphIcon glyph={glyphFor(selfAlias)} size={20} />
                </div>
                <style>{`
                  @keyframes cmp-bmk { 0% { opacity:0; transform: translate(0,0) scale(0.4);} 20% { opacity:1;} 100% { opacity:0; transform: translate(120px,-60px) scale(1.05);} }
                  .cmp-bookmark-flight { color:#fde68a; filter: drop-shadow(0 0 6px rgba(253,224,71,0.7)); animation: cmp-bmk 1.1s ease-out forwards; }
                `}</style>
              </div>
            )}
            <p className="mt-3 text-center text-[11px] text-amber-200/60">
              {c.t("atlas_focus_hint")}
            </p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-black/40 p-4">
            {focused ? (
              <CandidateDetail
                cand={focused}
                inviteState={invited[focused.alias]}
                onInvite={() => doInvite(focused.alias)}
                onReport={() => doReport(focused.alias)}
              />
            ) : (
              <p className="text-xs text-amber-200/70">
                {candidates.length === 0 ? c.t("candidates_empty") : c.t("atlas_focus_hint")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          {candidates.length === 0 && (
            <p className="text-sm text-amber-200/70">{c.t("candidates_empty")}</p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {candidates.map((cand) => (
              <ListCard
                key={cand.alias}
                cand={cand}
                inviteState={invited[cand.alias]}
                onInvite={() => doInvite(cand.alias)}
                onReport={() => doReport(cand.alias)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Compact detail panel shown next to the atlas / inside sheet. */
function CandidateDetail({
  cand,
  inviteState,
  onInvite,
  onReport,
}: {
  cand: CandidateCard;
  inviteState: "sent" | "err" | undefined;
  onInvite: () => void;
  onReport: () => void;
}) {
  const c = useCommunityMatchCopy();
  const radar: RadarFacet[] = RADAR_KEYS.map((k) => {
    const found = cand.facets.find((f) => f.key === k);
    return { key: k, label: c.facetLabel(k), score: found?.score ?? 0 };
  });
  const resonances = cand.evidence.slice(0, 3);
  const complements = cand.evidence.slice(3, 5);
  const glyph = glyphFor(cand.alias);
  return (
    <article aria-live="polite">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-amber-300/40 bg-black/60 text-amber-200">
            <BookmarkGlyphIcon glyph={glyph} size={16} />
          </span>
          <div>
            <div className="font-mono text-base text-amber-100">{cand.alias}</div>
            <div className="text-[11px] text-amber-200/60">
              {cand.ageBand ?? c.t("card_age_hidden")}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-amber-200/60">
            {c.t("card_overall")}
          </div>
          <div className="text-2xl font-serif text-amber-100">{cand.overall}</div>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_CLASS[cand.overallBand]}`}
          >
            {c.band(cand.overallBand)}
          </span>
        </div>
      </header>
      <div className="mt-3">
        <ResonanceRadar
          facets={radar}
          size={240}
          disclaimer={c.t("drawer_radar_disclaimer")}
        />
      </div>
      {resonances.length > 0 && (
        <section className="mt-3 rounded border border-amber-400/15 bg-black/30 p-2 text-[11px] text-amber-100/80">
          <div className="mb-1 text-amber-200/70">{c.t("drawer_group_resonance")}</div>
          <ul className="space-y-1">
            {resonances.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </section>
      )}
      {complements.length > 0 && (
        <section className="mt-2 rounded border border-violet-400/20 bg-violet-500/5 p-2 text-[11px] text-violet-100/80">
          <div className="mb-1 text-violet-200/70">{c.t("drawer_group_complement")}</div>
          <ul className="space-y-1">
            {complements.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </section>
      )}
      {cand.partial && (
        <div className="mt-2 text-[11px] text-amber-200/60">{c.t("candidates_partial")}</div>
      )}
      <footer className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onInvite}
          disabled={inviteState === "sent"}
          className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-xs text-amber-100 hover:bg-amber-300/25 disabled:opacity-40"
        >
          {inviteState === "sent" ? c.t("invite_delivered") : c.t("card_invite")}
        </button>
        <button
          type="button"
          onClick={onReport}
          className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
        >
          {c.t("card_report")}
        </button>
      </footer>
    </article>
  );
}

/** Fallback list card — keeps parity with the atlas view. */
function ListCard({
  cand,
  inviteState,
  onInvite,
  onReport,
}: {
  cand: CandidateCard;
  inviteState: "sent" | "err" | undefined;
  onInvite: () => void;
  onReport: () => void;
}) {
  const c = useCommunityMatchCopy();
  const glyph = glyphFor(cand.alias);
  return (
    <article className="rounded-xl border border-amber-400/20 bg-black/30 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-amber-300/40 bg-black/60 text-amber-200">
            <BookmarkGlyphIcon glyph={glyph} size={16} />
          </span>
          <div>
            <div className="font-mono text-base text-amber-100">{cand.alias}</div>
            <div className="text-[11px] text-amber-200/60">
              {cand.ageBand ?? c.t("card_age_hidden")}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-amber-200/60">
            {c.t("card_overall")}
          </div>
          <div className="text-2xl font-serif text-amber-100">{cand.overall}</div>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_CLASS[cand.overallBand]}`}
          >
            {c.band(cand.overallBand)}
          </span>
        </div>
      </header>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-amber-100/80">
        {cand.facets.map((f) => (
          <li
            key={f.key}
            className="flex items-center justify-between rounded border border-amber-400/15 bg-black/20 px-2 py-1"
          >
            <span className="text-amber-200/70">{c.facetLabel(f.key)}</span>
            <span className="font-mono text-amber-100">{f.score}</span>
          </li>
        ))}
      </ul>
      {cand.evidence.length > 0 && (
        <div className="mt-3 rounded border border-amber-400/10 bg-black/20 p-2 text-[11px] text-amber-100/70">
          <div className="mb-1 text-amber-200/60">{c.t("card_evidence_title")}</div>
          <ul className="space-y-1">
            {cand.evidence.map((s, i) => (
              <li key={i}>· {s}</li>
            ))}
          </ul>
        </div>
      )}
      <footer className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onInvite}
          disabled={inviteState === "sent"}
          className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-xs text-amber-100 hover:bg-amber-300/25 disabled:opacity-40"
        >
          {inviteState === "sent" ? c.t("invite_delivered") : c.t("card_invite")}
        </button>
        <button
          type="button"
          onClick={onReport}
          className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
        >
          {c.t("card_report")}
        </button>
      </footer>
    </article>
  );
}

/* -------------------- invites -------------------- */

function InvitesTab() {
  const c = useCommunityMatchCopy();
  const list = useServerFn(listMyCommunityMatchInvites);
  const respond = useServerFn(respondCommunityMatchInvite);
  const revoke = useServerFn(revokeCommunityMatchInvite);
  const [data, setData] = useState<{ sent: InviteView[]; received: InviteView[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await list());
    } catch (e) {
      setErr(c.errFor(e instanceof Error ? e.message : "generic"));
    }
  }, [list, c]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (id: string, action: "accept" | "decline" | "block") => {
    try {
      await respond({ data: { inviteId: id, action } });
      refresh();
    } catch (e) {
      setErr(c.errFor(e instanceof Error ? e.message : "generic"));
    }
  };
  const doRevoke = async (id: string) => {
    try {
      await revoke({ data: { inviteId: id } });
      refresh();
    } catch (e) {
      setErr(c.errFor(e instanceof Error ? e.message : "generic"));
    }
  };

  return (
    <div className="space-y-6">
      {err && <div className="text-xs text-rose-300">{err}</div>}
      <section>
        <h4 className="mb-2 text-xs uppercase tracking-widest text-amber-200/70">
          {c.t("tab_invites")} · received
        </h4>
        {(!data || data.received.length === 0) && (
          <p className="text-xs text-amber-200/60">{c.t("invite_received_empty")}</p>
        )}
        <ul className="space-y-2">
          {(data?.received ?? []).map((inv) => (
            <li
              key={inv.inviteId}
              className="flex flex-wrap items-center gap-3 rounded border border-amber-400/20 bg-black/30 px-3 py-2 text-xs text-amber-100"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full border border-amber-300/40 bg-black/50 text-amber-200">
                <BookmarkGlyphIcon glyph={glyphFor(inv.counterpartAlias)} size={12} />
              </span>
              <span className="font-mono text-amber-100">{inv.counterpartAlias}</span>
              <StatusPill status={inv.status} />
              <span className="text-amber-200/60">{c.expiresAt(inv.expiresAt)}</span>
              {inv.status === "pending" && (
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(inv.inviteId, "accept")}
                    className="rounded border border-emerald-400/40 px-2 py-0.5 text-emerald-200 hover:bg-emerald-500/10"
                  >
                    {c.t("invite_action_accept")}
                  </button>
                  <button
                    type="button"
                    onClick={() => act(inv.inviteId, "decline")}
                    className="rounded border border-amber-400/30 px-2 py-0.5 hover:bg-amber-500/10"
                  >
                    {c.t("invite_action_decline")}
                  </button>
                  <button
                    type="button"
                    onClick={() => act(inv.inviteId, "block")}
                    className="rounded border border-rose-400/40 px-2 py-0.5 text-rose-200 hover:bg-rose-500/10"
                  >
                    {c.t("invite_action_block")}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4 className="mb-2 text-xs uppercase tracking-widest text-amber-200/70">
          {c.t("tab_invites")} · sent
        </h4>
        {(!data || data.sent.length === 0) && (
          <p className="text-xs text-amber-200/60">{c.t("invite_sent_empty")}</p>
        )}
        <ul className="space-y-2">
          {(data?.sent ?? []).map((inv) => (
            <li
              key={inv.inviteId}
              className="flex flex-wrap items-center gap-3 rounded border border-amber-400/20 bg-black/30 px-3 py-2 text-xs text-amber-100"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full border border-amber-300/40 bg-black/50 text-amber-200">
                <BookmarkGlyphIcon glyph={glyphFor(inv.counterpartAlias)} size={12} />
              </span>
              <span className="font-mono">{inv.counterpartAlias}</span>
              <StatusPill status={inv.status} />
              <span className="text-amber-200/60">{c.expiresAt(inv.expiresAt)}</span>
              {inv.status === "pending" && (
                <button
                  type="button"
                  onClick={() => doRevoke(inv.inviteId)}
                  className="ml-auto rounded border border-amber-400/30 px-2 py-0.5 hover:bg-amber-500/10"
                >
                  {c.t("invite_action_revoke")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: InviteView["status"] }) {
  const c = useCommunityMatchCopy();
  const label =
    status === "pending"
      ? c.t("invite_status_pending")
      : status === "accepted"
        ? c.t("invite_status_accepted")
        : status === "declined"
          ? c.t("invite_status_declined")
          : status === "expired"
            ? c.t("invite_status_expired")
            : status === "revoked"
              ? c.t("invite_status_revoked")
              : c.t("invite_status_blocked");
  return (
    <span className="rounded-full border border-amber-400/30 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-200/80">
      {label}
    </span>
  );
}

/* -------------------- matches -------------------- */

function MatchesTab() {
  const c = useCommunityMatchCopy();
  const list = useServerFn(listMyCommunityMatches);
  const revoke = useServerFn(revokeCommunityMatchGrant);
  const [items, setItems] = useState<MatchView[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await list());
    } catch {
      setItems([]);
    }
  }, [list]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!items) return <p className="text-sm text-amber-200/70">…</p>;
  if (items.length === 0) return <p className="text-sm text-amber-200/70">{c.t("matches_empty")}</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((m) => {
        const live = m.myGrantLive && m.theirGrantLive;
        const radar: RadarFacet[] = RADAR_KEYS.map((k) => {
          const found = m.facets.find((f) => f.key === k);
          return { key: k, label: c.facetLabel(k), score: found?.score ?? 0 };
        });
        return (
          <article
            key={`${m.pairKey}:${m.mode}`}
            className="rounded-xl border border-amber-400/20 bg-black/30 p-5"
          >
            <header className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-amber-300/40 bg-black/60 text-amber-200">
                  <BookmarkGlyphIcon glyph={glyphFor(m.counterpartAlias)} size={14} />
                </span>
                <div className="font-mono text-amber-100">{m.counterpartAlias}</div>
              </div>
              {live ? (
                <div className="text-right">
                  <div className="text-3xl font-serif text-amber-100">{m.overall}</div>
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_CLASS[m.overallBand]}`}
                  >
                    {c.band(m.overallBand)}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-rose-300">{c.t("matches_grant_locked")}</span>
              )}
            </header>
            {live && (
              <>
                <div className="mt-3">
                  <ResonanceRadar
                    facets={radar}
                    size={220}
                    disclaimer={c.t("drawer_radar_disclaimer")}
                  />
                </div>
                <div className="mt-3 text-[11px] text-amber-100/70">
                  {m.resonances.slice(0, 3).map((s, i) => (
                    <div key={i}>· {s}</div>
                  ))}
                </div>
              </>
            )}
            <footer className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-xs text-amber-100 hover:bg-amber-300/25"
                disabled
              >
                {c.t("matches_invite_friend")}
              </button>
              <button
                type="button"
                onClick={() =>
                  revoke({ data: { pairKey: m.pairKey, mode: m.mode } }).then(refresh)
                }
                className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10"
              >
                {c.t("matches_revoke")}
              </button>
              <span className="ml-auto text-[10px] text-amber-200/50">
                {c.t("matches_chat_coming")}
              </span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

/* -------------------- privacy -------------------- */

function PrivacyTab({
  profile,
  onChange,
}: {
  profile: CommunityMatchProfile;
  onChange: () => void;
}) {
  const c = useCommunityMatchCopy();
  const optOut = useServerFn(optOutOfCommunityMatch);
  const [busy, setBusy] = useState(false);
  const leave = async () => {
    if (!confirm(c.t("pool_leave_confirm"))) return;
    setBusy(true);
    try {
      await optOut();
      onChange();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl border border-amber-400/20 bg-black/30 p-5">
      <h4 className="text-xs uppercase tracking-widest text-amber-200/70">
        {c.t("privacy_title")}
      </h4>
      <p className="text-sm text-amber-100/80">{c.t("privacy_body")}</p>
      <div className="text-xs text-amber-200/60">
        {c.t("pool_alias_you")}: <span className="font-mono">{profile.alias}</span>
      </div>
      <button
        type="button"
        onClick={leave}
        disabled={busy}
        className="rounded-full border border-rose-400/40 px-3 py-1 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
      >
        {c.t("pool_leave")}
      </button>
    </section>
  );
}
