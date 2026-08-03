/**
 * Premium ¥79 one-time Deep Reading card.
 *
 * Single-column centered layout (desktop max ~1100px, mobile stacks).
 * Server-driven state via `getPremiumStatus` + `getPremiumReportProgress`.
 * The card never surfaces exports, printing, PDF, gender-backfill or
 * per-system diagnostic panels — gender is captured earlier in the
 * ritual flow, and incomplete legacy charts show a tiny hint that
 * directs the user back to the ritual.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";
import { buildCanonicalChartInput, ensureChart, getChartById } from "@/lib/reports-store.functions";
import {
  generatePremiumReport,
  processNextPremiumChapter,
  getPremiumStatus,
  getPremiumReportProgress,
  type PremiumStatus,
  type PremiumReportProgress,
} from "@/lib/premium.functions";
import { supabase } from "@/integrations/supabase/client";
import { PremiumReportReader } from "@/components/PremiumReportReader";
import { MockPaymentModal } from "@/components/MockPaymentModal";

import {
  buildCalculationSnapshot,
  missingSystemDetails,
} from "@/lib/calc-snapshot";

type ReportSearchLike = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  gender?: "male" | "female";
  lang?: "en" | "zh";
  readingId?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TXT = {
  kicker: { zh: "¥79 · 一次解锁", en: "¥79 · one-time unlock" },
  title: { zh: "高级深度报告", en: "Premium Deep Reading" },
  pitch: {
    zh: "综合西方占星、印度占星、八字与紫微斗数，为当前命盘生成 24 章深度解读。一次解锁，永久保存在你的账户，随时在站内重新阅读。",
    en: "A 24-chapter synthesis of Western astrology, Vedic Jyotish, BaZi and Zi Wei Dou Shu for this chart. Generated once, saved to your account, reopen inside the app anytime.",
  },
  chips: {
    zh: ["四体系综合", "24 章深度解读", "证据溯源可查", "永久保存"],
    en: ["Four traditions", "24 chapters", "Evidence-traced", "Saved forever"],
  },
  time: { zh: "整份报告生成约 2–4 分钟", en: "Full report generation takes 2–4 minutes" },
  cta_unlock: { zh: "解锁完整报告 ¥79", en: "Unlock full report · ¥79" },
  cta_generate: { zh: "开始生成完整报告", en: "Start full report generation" },
  cta_continue: { zh: "继续生成", en: "Continue generation" },
  cta_open: { zh: "查看完整报告", en: "Open the full report" },
  generating_safe: {
    zh: "进度已保存；如果离开本页，回来后可从中断处继续。",
    en: "Progress is saved. If you leave, return here to continue where it stopped.",
  },
  interrupted: {
    zh: "生成暂时中断，已完成章节不会重做。请点击“继续生成”。",
    en: "Generation was temporarily interrupted. Completed chapters will not run again — press Continue.",
  },
  generating_current: { zh: "当前章节", en: "Current chapter" },
  chapters_done: { zh: "章已完成", en: "chapters completed" },
  need_auth: { zh: "请先登录以解锁", en: "Sign in to unlock" },
  need_verify: {
    zh: "请先完成邮箱验证后再继续",
    en: "Please verify your email before continuing",
  },
  resend_verify: { zh: "重发验证邮件", en: "Resend verification" },
  resent_verify: { zh: "验证邮件已重发", en: "Verification email resent" },

  legacy_incomplete: {
    zh: "这份测试命盘资料不完整，请返回命盘重新创建",
    en: "This legacy test chart is incomplete — please recreate it from the ritual",
  },
  back_to_ritual: { zh: "返回仪式", en: "Return to ritual" },
  once_note: {
    zh: "非订阅 · 非按次收费 · 同一命盘只需支付一次。",
    en: "Not a subscription · not per-open · pay once per chart.",
  },
  disclaimer: {
    zh: "报告仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议。",
    en: "For cultural, reflective self-exploration only — not medical, legal, financial or life-decision advice.",
  },
  failed_hint: {
    zh: "上次生成未能完成，你已支付的解锁不受影响，可点击“继续生成”从中断处继续。",
    en: "The previous run did not complete. Your unlock is safe — press “Continue generation” to resume where it stopped.",
  },
  error: { zh: "操作失败，请稍后重试。", en: "Something went wrong, please retry." },
};

function pick<T extends { zh: string; en: string }>(t: T, lang: "zh" | "en"): string {
  return lang === "zh" ? t.zh : t.en;
}

type UiState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "no_chart" }
  | { kind: "verify_needed"; email: string | null }
  | { kind: "legacy_incomplete" }
  | { kind: "locked"; chartId: string }
  | { kind: "paid_no_report"; chartId: string }


  | { kind: "generating"; chartId: string }
  | { kind: "partial"; chartId: string }
  | { kind: "ready"; chartId: string }
  | { kind: "failed"; chartId: string; detail?: string }
  | { kind: "error"; message: string };

function extractErrorCode(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw.includes("systems_incomplete")) return "systems_incomplete";
  const known = [
    "email_not_verified",
    "chart_not_found",
    "chart_not_found_for_user",
    "chart_lookup_failed",
    "order_not_paid",
    "provider_pending_config",
  ];
  return known.find((k) => raw.includes(k)) ?? "";
}

export function PremiumPdfCard({
  search,
}: {
  search?: ReportSearchLike;
  /** Legacy prop, ignored — layout is now unified. */
  variant?: "card" | "bar";
}) {
  const { lang } = useLang();
  const [state, setState] = useState<UiState>({ kind: "loading" });
  const [progress, setProgress] = useState<PremiumReportProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const [resent, setResent] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepLoopActive = useRef(false);

  const clearPoll = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const applyStatus = useCallback((chartId: string, s: PremiumStatus): UiState => {
    const rs = s.report?.status;
    if (rs === "completed") return { kind: "ready", chartId };
    if (rs === "generating" || rs === "pending") return { kind: "generating", chartId };
    if (rs === "partial") return { kind: "partial", chartId };
    if (rs === "failed") return { kind: "failed", chartId };
    if (s.order?.status === "paid") return { kind: "paid_no_report", chartId };
    // Pending orders (e.g. a legacy intent row) fall back to the ¥79
    // unlock CTA so the customer never sees an "admin required" dead-end.
    return { kind: "locked", chartId };
  }, []);


  const refresh = useCallback(async () => {
    if (!search?.date) return;
    try {
      const { data: sess } = await supabase.auth.getSession();

      // Authoritative hydration: if the URL carries a persisted chartId
      // (readingId), fetch the DB row and merge its fields — the URL
      // never carries gender/timezone, so relying on `search` alone
      // would misdiagnose a fully-paid chart as "incomplete".
      let hydrated: ReportSearchLike = { ...search };
      let persistedChartId: string | null = null;
      const rid = (search.readingId ?? "").trim();
      if (sess.session && rid && UUID_RE.test(rid)) {
        try {
          const row = await getChartById({ data: { chartId: rid } });
          if (row) {
            persistedChartId = row.id;
            hydrated = {
              ...hydrated,
              name: hydrated.name ?? row.name ?? undefined,
              date: hydrated.date ?? row.birth_date ?? undefined,
              time: hydrated.time ?? row.birth_time ?? undefined,
              place: hydrated.place ?? row.birth_place ?? undefined,
              gender: hydrated.gender ?? row.gender ?? undefined,
              lang: hydrated.lang ?? row.lang,
            };
          }
        } catch { /* fall through to URL-only path */ }
      }

      const snap = buildCalculationSnapshot({
        date: hydrated.date,
        time: hydrated.time,
        place: hydrated.place,
        lang,
        gender: hydrated.gender ?? null,
      });
      const missing = missingSystemDetails(snap);
      if (!sess.session) {
        if (missing.length > 0) {
          setState({ kind: "legacy_incomplete" });
          return;
        }
        setState({ kind: "signed_out" });
        return;
      }

      // When a persisted chart already exists for the caller, trust it
      // as the completeness authority — the server-side facts builder
      // will surface `systems_incomplete` if data is truly missing.
      let chartId = persistedChartId;
      if (!chartId) {
        if (missing.length > 0) {
          setState({ kind: "legacy_incomplete" });
          return;
        }
        const canonical = buildCanonicalChartInput(
          { name: hydrated.name, date: hydrated.date, time: hydrated.time, place: hydrated.place, gender: hydrated.gender ?? undefined, lang: hydrated.lang },
          lang,
        );
        const chart = await ensureChart({
          data: {
            ...canonical,
            input_snapshot: { ...canonical.input_snapshot, calculation_snapshot: snap },
          },
        });
        chartId = chart.chartId;
      }
      const status = await getPremiumStatus({ data: { chartId } });
      setActiveReportId(status.report?.id ?? null);
      setState(applyStatus(chartId, status));
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === "systems_incomplete") {
        setState({ kind: "legacy_incomplete" });
      } else if (code === "email_not_verified") {
        const { data: sess } = await supabase.auth.getSession();
        setState({ kind: "verify_needed", email: sess.session?.user?.email ?? null });
      } else {
        setState({ kind: "error", message: pick(TXT.error, lang) });
      }
    }
  }, [search, lang, applyStatus]);


  const refreshProgress = useCallback(async (chartId: string) => {
    try {
      const p = await getPremiumReportProgress({ data: { chartId } });
      setProgress(p);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    refresh();
    return clearPoll;
  }, [refresh]);

  const driveGeneration = useCallback(async (
    chartId: string,
    knownReportId: string | null,
    opts: { openWhenDone: boolean } = { openWhenDone: false },
  ) => {
    if (stepLoopActive.current) return;
    stepLoopActive.current = true;
    setBusy(true);
    try {
      let reportId = knownReportId;
      if (!reportId) {
        const start = await generatePremiumReport({ data: { chartId } });
        reportId = start.reportId;
        setActiveReportId(reportId);
        if (start.status === "completed") {
          await refreshProgress(chartId);
          await refresh();
          if (opts.openWhenDone) setReaderOpen(true);
          return;
        }
      }

      let idleLoops = 0;
      for (let i = 0; i < 12; i += 1) {
        const step = await Promise.race([
          processNextPremiumChapter({ data: { reportId } }),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("chapter_step_timeout")), 75_000);
          }),
        ]);
        setActiveReportId(step.reportId);
        await refreshProgress(chartId);

        if (step.status === "completed") {
          await refresh();
          if (opts.openWhenDone) setReaderOpen(true);
          return;
        }
        if (step.message === "prep_error") {
          setState({ kind: "failed", chartId, detail: step.error });
          return;
        }
        if (step.message === "interrupted") {
          await refresh();
          setState((prev) => prev.kind === "failed" ? { ...prev, detail: step.error ?? prev.detail } : prev);
          if (!step.shouldContinue) return;
          await new Promise((resolve) => window.setTimeout(resolve, 1800));
          continue;
        }
        if (step.shouldContinue && step.processed) {
          idleLoops = 0;
          await new Promise((resolve) => window.setTimeout(resolve, 400));
          continue;
        }
        if (step.shouldContinue && step.message === "active_lease") {
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
          continue;
        }
        if (!step.shouldContinue && step.processed) {
          await refresh();
          return;
        }
        if (!step.processed) {
          idleLoops += 1;
          if (idleLoops >= 3) {
            await refresh();
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
        } else {
          idleLoops = 0;
        }
      }
      await refresh();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err ?? "");
      setState({ kind: "failed", chartId, detail });
    } finally {
      setBusy(false);
      stepLoopActive.current = false;
    }
  }, [refresh, refreshProgress]);

  // Step while generating / partial to show live chapter progress. Each
  // server request processes at most one chapter; refresh resumes safely.
  useEffect(() => {
    const chartId =
      state.kind === "generating" || state.kind === "partial" || state.kind === "ready" || state.kind === "paid_no_report"
        ? state.chartId
        : null;
    if (!chartId) {
      setProgress(null);
      return;
    }
    void refreshProgress(chartId);
    // Server-side drain guardian: whenever the user is paid but the
    // report is not yet completed, auto-drive drain without requiring
    // a click. Covers cold reloads on paid_no_report, generating and
    // partial. Auto-opens the Reader on 24/24 so the user never has
    // to click twice.
    if (state.kind === "generating" || state.kind === "partial" || state.kind === "paid_no_report") {
      void driveGeneration(chartId, activeReportId, { openWhenDone: true });
    }
    clearPoll();
    pollTimer.current = setTimeout(async () => {
      await refreshProgress(chartId);
      await refresh();
    }, 4000);
    return clearPoll;
  }, [state, refresh, refreshProgress, driveGeneration, activeReportId]);

  const onResendVerification = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const email = sess.session?.user?.email;
      if (!email) return;
      await supabase.auth.resend({ type: "signup", email });
      setResent(true);
    } catch { /* best-effort */ }
  };

  const onUnlock = () => {
    if (state.kind !== "locked") return;
    setPayOpen(true);
  };

  const onMockPaymentSuccess = async () => {
    setPayOpen(false);
    setBusy(true);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  };


  const onGenerate = async () => {
    if (state.kind !== "paid_no_report" && state.kind !== "partial" && state.kind !== "failed") return;
    const chartId = state.chartId;
    setState({ kind: "generating", chartId });
    await driveGeneration(chartId, activeReportId, { openWhenDone: true });
  };

  const onOpen = (btn: HTMLButtonElement | null) => {
    if (state.kind !== "ready") return;
    openerRef.current = btn;
    setReaderOpen(true);
  };

  const chartIdForReader =
    state.kind === "ready" || state.kind === "generating" || state.kind === "partial"
      ? state.chartId
      : null;

  const chips = lang === "zh" ? TXT.chips.zh : TXT.chips.en;

  // Progress derived
  const total = progress?.totalChapters ?? 24;
  const done = progress?.completedChapters ?? 0;
  const running = progress?.chapters.find((c) => c.status === "running");
  const nextPending = progress?.chapters.find((c) => c.status === "pending");
  const currentChapter = running ?? nextPending ?? null;
  const pctRaw = total > 0 ? Math.round((done / total) * 100) : 0;
  const pct = pctRaw;

  return (
    <>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="glass-card relative overflow-hidden rounded-3xl p-6 md:p-10">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            <span className="rounded-full border border-gold-dust/40 bg-gold-dust/[0.06] px-4 py-1 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
              {pick(TXT.kicker, lang)}
            </span>

            <h3 className="font-serif text-2xl italic leading-tight text-stone-warm md:text-3xl [overflow-wrap:break-word]">
              {pick(TXT.title, lang)}
            </h3>

            <p className="text-[13.5px] leading-relaxed text-stone-warm/75 [overflow-wrap:break-word] md:text-[14.5px]">
              {pick(TXT.pitch, lang)}
            </p>

            <ul className="flex flex-wrap justify-center gap-2">
              {chips.map((c) => (
                <li
                  key={c}
                  className="rounded-full border border-gold-dust/25 bg-gold-dust/[0.05] px-3 py-1 text-[11px] text-stone-warm/80"
                >
                  ✧ {c}
                </li>
              ))}
            </ul>

            <div className="w-full pt-2">
              <PrimaryAction
                state={state}
                busy={busy}
                lang={lang}
                onUnlock={onUnlock}
                onGenerate={onGenerate}
                onOpen={onOpen}
                onResendVerification={onResendVerification}
                resent={resent}
              />
            </div>

            {(state.kind === "generating" || state.kind === "partial") && (
              <div className="w-full rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.04] p-4 text-left">
                <div className="flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-gold-dust/80">
                  <span>
                    {done} / {total} {pick(TXT.chapters_done, lang)}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-gold-dust to-gold-light transition-[width] duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {currentChapter && state.kind === "generating" && (
                  <p className="mt-3 text-[12px] leading-relaxed text-stone-warm/75 [overflow-wrap:break-word]">
                    <span className="text-stone-warm/50">{pick(TXT.generating_current, lang)}：</span>
                    {currentChapter.title}
                  </p>
                )}
                {state.kind === "generating" && (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-stone-warm/55 [overflow-wrap:break-word]">
                    {pick(TXT.generating_safe, lang)}
                  </p>
                )}
              </div>
            )}

            {state.kind !== "generating" && state.kind !== "partial" && (
              <p className="text-[10.5px] uppercase tracking-[0.24em] text-stone-warm/40">
                {pick(TXT.time, lang)}
              </p>
            )}
          </div>

          <p className="mt-8 border-t border-white/5 pt-4 text-center text-[11px] leading-relaxed text-stone-warm/40 [overflow-wrap:break-word]">
            {pick(TXT.disclaimer, lang)} · {pick(TXT.once_note, lang)}
          </p>
        </div>
      </div>

      {chartIdForReader && (
        <PremiumReportReader
          open={readerOpen}
          chartId={chartIdForReader}
          chartName={search?.name ?? null}
          onClose={() => {
            setReaderOpen(false);
            requestAnimationFrame(() => openerRef.current?.focus());
          }}
        />
      )}

      <MockPaymentModal
        open={payOpen}
        chartId={state.kind === "locked" ? state.chartId : null}
        lang={lang}
        onClose={() => setPayOpen(false)}
        onSuccess={onMockPaymentSuccess}
      />
    </>

  );
}

function PrimaryAction({
  state,
  busy,
  lang,
  onUnlock,
  onGenerate,
  onOpen,
  onResendVerification,
  resent,
}: {
  state: UiState;
  busy: boolean;
  lang: "zh" | "en";
  onUnlock: () => void;
  onGenerate: () => void;
  onOpen: (btn: HTMLButtonElement | null) => void;
  onResendVerification: () => void;
  resent: boolean;
}) {
  const btnPrimary =
    "w-full min-h-[48px] rounded-full bg-gold-dust px-6 py-3 text-[12px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50";
  const btnGhost =
    "w-full min-h-[48px] rounded-full border border-gold-dust/50 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10 disabled:opacity-50";

  if (state.kind === "loading") return <p className="text-sm text-stone-warm/50">…</p>;

  if (state.kind === "signed_out") {
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("lod:open-account"));
        }}
        className={btnGhost}
      >
        {pick(TXT.need_auth, lang)}
      </button>
    );
  }

  if (state.kind === "verify_needed") {
    return (
      <div className="flex w-full flex-col gap-2">
        <p className="rounded-2xl border border-nebula-purple/40 bg-nebula-purple/[0.08] p-3 text-[12px] leading-relaxed text-stone-warm/80 [overflow-wrap:break-word]">
          {pick(TXT.need_verify, lang)}
          {state.email ? ` · ${state.email}` : ""}
        </p>
        <button type="button" disabled={resent} onClick={onResendVerification} className={btnGhost}>
          {resent ? pick(TXT.resent_verify, lang) : pick(TXT.resend_verify, lang)}
        </button>
      </div>
    );
  }

  if (state.kind === "legacy_incomplete") {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center">
        <p className="text-[12.5px] leading-relaxed text-stone-warm/70 [overflow-wrap:break-word]">
          {pick(TXT.legacy_incomplete, lang)}
        </p>
        <Link
          to="/ritual"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gold-dust/50 px-6 py-2 text-[11px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
        >
          {pick(TXT.back_to_ritual, lang)}
        </Link>
      </div>
    );
  }

  if (state.kind === "locked") {
    return (
      <button type="button" disabled={busy} onClick={onUnlock} className={btnPrimary}>
        {pick(TXT.cta_unlock, lang)}
      </button>
    );
  }




  if (state.kind === "paid_no_report") {
    return (
      <button type="button" disabled={busy} onClick={onGenerate} className={btnPrimary}>
        {pick(TXT.cta_generate, lang)}
      </button>
    );
  }

  if (state.kind === "partial" || state.kind === "failed") {
    return (
      <div className="flex w-full flex-col gap-2">
        {state.kind === "failed" && (
          <p className="rounded-2xl border border-nebula-purple/30 bg-nebula-purple/[0.06] p-3 text-[12px] leading-relaxed text-stone-warm/75 [overflow-wrap:break-word]">
            {pick(TXT.failed_hint, lang)}
            {state.detail ? (
              <span className="mt-1 block text-[11px] text-stone-warm/55">
                {lang === "zh" ? "错误：" : "Error: "}{state.detail}
              </span>
            ) : null}
          </p>
        )}
        <button type="button" disabled={busy} onClick={onGenerate} className={btnPrimary}>
          {pick(TXT.cta_continue, lang)}
        </button>
      </div>
    );
  }

  if (state.kind === "generating") {
    return (
      <div className="flex w-full min-h-[48px] items-center justify-center gap-3 rounded-full border border-gold-dust/40 bg-gold-dust/[0.05] px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-gold-dust">
        <span className="inline-block size-2 animate-pulse rounded-full bg-gold-dust" />
        {lang === "zh" ? "正在生成中" : "Generating…"}
      </div>
    );
  }

  if (state.kind === "ready") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={(e) => onOpen(e.currentTarget)}
        className={btnPrimary}
      >
        {pick(TXT.cta_open, lang)}
      </button>
    );
  }

  if (state.kind === "error") {
    return (
      <p className="w-full text-[12.5px] leading-relaxed text-stone-warm/70 [overflow-wrap:break-word]">
        {state.message}
      </p>
    );
  }

  return null;
}
