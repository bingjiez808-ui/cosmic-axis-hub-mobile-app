/**
 * Premium ¥79 one-time Deep Reading card.
 *
 * Drives all state from the server via `getPremiumStatus`:
 *   - No order              → show pitch + "Unlock" CTA
 *   - Pending order         → show "payment provider being configured" notice
 *   - Paid + no report      → show "Generate the full report" (idempotent)
 *   - Generating            → poll
 *   - Completed             → "Open the full report" (in-app modal)
 *
 * Two visual variants:
 *   - variant="card"  legacy tall card
 *   - variant="bar"   full-width panel shown on the report page, using a
 *                     minmax(0,1fr) / minmax(360px,440px) two-column grid
 *                     from lg+ so the pitch never collapses to a narrow
 *                     column while the status/action rail keeps a stable
 *                     comfortable width.
 *
 * Nothing here writes to the database or trusts client-provided flags,
 * and it never surfaces file downloads, exports, printing or PDFs — the
 * report is read entirely inside the app via the reader modal.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useLang } from "@/lib/i18n";
import { ensureChart, updateChartGender } from "@/lib/reports-store.functions";
import {
  generatePremiumReport,
  getPremiumStatus,
  startPremiumCheckout,
  type PremiumStatus,
} from "@/lib/premium.functions";
import { supabase } from "@/integrations/supabase/client";
import { PremiumReportReader } from "@/components/PremiumReportReader";
import {
  buildCalculationSnapshot,
  missingSystemDetails,
  missingReasonMessage,
  systemDisplayName,
  type MissingReason,
  type RequiredSystem,
} from "@/lib/calc-snapshot";

type ReportSearchLike = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  gender?: "male" | "female";
};

type MissingDetail = { system: RequiredSystem; reason: MissingReason };

const TXT = {
  kicker: { zh: "¥79 · 一次解锁", en: "¥79 · one-time unlock" },
  title: { zh: "高级 AI 深度报告", en: "Premium AI Deep Reading" },
  price: { zh: "¥79 · 一次性买断当前命盘", en: "¥79 · one-time purchase for this chart" },
  pitch: {
    zh: "在你已有的网页报告基础上，由资深 AI 综合西方占星、印度占星、八字与紫微斗数，为当前命盘生成一份更深入的完整解读。生成一次，永久保存在你的账户，随时在站内重新阅读。",
    en: "Building on your existing web reading, our premium AI blends Western astrology, Vedic Jyotish, BaZi and Zi Wei Dou Shu into a much deeper synthesis for this chart. Generated once, saved to your account forever, reopen inside the app anytime.",
  },
  chips: {
    zh: ["四体系综合", "八大维度", "未来 12 个月", "永久保存"],
    en: ["Four traditions", "Eight dimensions", "Next 12 months", "Saved forever"],
  },
  time: { zh: "生成通常需要 2–4 分钟", en: "Generation typically takes 2–4 minutes" },
  cta_unlock: { zh: "解锁 ¥79 高级报告", en: "Unlock ¥79 deep reading" },
  cta_generate: { zh: "生成完整报告", en: "Generate the full report" },
  cta_open: { zh: "查看完整报告", en: "Open the full report" },
  cta_retry: { zh: "重新尝试生成", en: "Retry generation" },
  busy_generate: { zh: "正在生成中，请稍候…", en: "Generating your deep reading…" },
  provider_pending: {
    zh: "支付渠道配置中：¥79 订单已记录，正式支付通道上线前，请联系管理员完成付款并人工开通。",
    en: "Payment provider being configured: your ¥79 intent is recorded. Contact an admin to complete payment offline while the live checkout is finalised.",
  },
  once_note: {
    zh: "非订阅 · 非按次收费 · 同一命盘只需支付一次。",
    en: "Not a subscription · not per-open · pay once per chart.",
  },
  disclaimer: {
    zh: "报告仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议。",
    en: "For cultural, reflective self-exploration only — not medical, legal, financial or life-decision advice.",
  },
  need_auth: { zh: "请先登录以购买", en: "Sign in to purchase" },
  need_verify: {
    zh: "请先完成邮箱验证后再购买或生成",
    en: "Please verify your email before purchasing or generating",
  },
  resend_verify: { zh: "重发验证邮件", en: "Resend verification email" },
  resent_verify: { zh: "验证邮件已重新发送", en: "Verification email resent" },
  no_chart_saved: {
    zh: "未能保存当前命盘，请稍后重试",
    en: "Could not save this chart. Please retry.",
  },
  chart_not_owned: {
    zh: "该命盘不属于当前账户",
    en: "This chart does not belong to your account",
  },
  order_missing: {
    zh: "尚未解锁：请先购买或让管理员开通测试权益",
    en: "Not unlocked yet — purchase or ask an admin to grant test access",
  },
  error: { zh: "操作失败，请稍后重试。", en: "Something went wrong, please retry." },
  order_pending_pill: { zh: "订单已记录", en: "Order recorded" },
  paid_pill: { zh: "已解锁", en: "Unlocked" },
  ready_pill: { zh: "报告已就绪", en: "Report ready" },
  systems_incomplete_pill_generic: {
    zh: "计算模块未完成",
    en: "Calculators pending",
  },
  systems_incomplete_pill_gender_only: {
    zh: "待补充资料",
    en: "One detail needed",
  },
  systems_incomplete_title_generic: {
    zh: "以下体系暂时无法计算",
    en: "The following traditions cannot be computed yet",
  },
  systems_incomplete_body_generic: {
    zh: "我们不会用模板伪造报告，请按下方提示补充或修正命盘资料。",
    en: "We refuse to ship a template report. Please follow each item's guidance to fix or complete this chart.",
  },
  gender_backfill_title: {
    zh: "补充紫微计算所需的性别",
    en: "Add the gender used by the Zi Wei calculator",
  },
  gender_backfill_body: {
    zh: "紫微斗数需要出生性别（仅用于传统算法）。补充后即可完成计算并解锁高级 AI 深度报告，只有本人可以更新自己的命盘。",
    en: "Zi Wei Dou Shu requires birth gender (used only by the traditional algorithm). Adding it completes the calculation and unlocks the Premium AI Deep Reading. Only you can update your own chart.",
  },
  gender_male: { zh: "男", en: "Male" },
  gender_female: { zh: "女", en: "Female" },
  edit_chart: { zh: "编辑命盘资料", en: "Edit chart details" },
};

function pick<T extends { zh: string; en: string }>(t: T, lang: "zh" | "en"): string {
  return lang === "zh" ? t.zh : t.en;
}

type UiState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "no_chart" }
  | { kind: "verify_needed"; email: string | null }
  | { kind: "systems_incomplete"; chartId: string | null; missing: MissingDetail[] }
  | { kind: "locked"; chartId: string }
  | { kind: "order_pending"; chartId: string; message: string }
  | { kind: "paid_no_report"; chartId: string }
  | { kind: "generating"; chartId: string }
  | { kind: "ready"; chartId: string }
  | { kind: "failed"; chartId: string; message: string }
  | { kind: "error"; message: string };

function extractErrorCode(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (raw.startsWith("systems_incomplete") || raw.includes("systems_incomplete")) {
    return "systems_incomplete";
  }
  const known = [
    "email_not_verified",
    "chart_not_found",
    "chart_not_found_for_user",
    "chart_lookup_failed",
    "order_not_paid",
    "order_create_failed",
    "already_granted_legacy",
    "provider_pending_config",
    "ai_gateway_not_configured",
  ];
  return known.find((k) => raw.includes(k)) ?? "";
}

export function PremiumPdfCard({
  search,
  variant = "card",
}: {
  search?: ReportSearchLike;
  variant?: "card" | "bar";
}) {
  const { lang } = useLang();
  const [state, setState] = useState<UiState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [resent, setResent] = useState(false);

  const onResendVerification = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const email = sess.session?.user?.email;
      if (!email) return;
      await supabase.auth.resend({ type: "signup", email });
      setResent(true);
    } catch {
      /* best-effort */
    }
  };

  const clearPoll = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const applyStatus = useCallback((chartId: string, s: PremiumStatus): UiState => {
    if (s.report?.status === "completed") return { kind: "ready", chartId };
    if (s.report?.status === "generating" || s.report?.status === "pending")
      return { kind: "generating", chartId };
    if (s.report?.status === "failed")
      return {
        kind: "failed",
        chartId,
        message: s.report.errorMessage ?? "generation_failed",
      };
    if (s.order?.status === "paid") return { kind: "paid_no_report", chartId };
    if (s.order?.status === "pending")
      return {
        kind: "order_pending",
        chartId,
        message: pick(TXT.provider_pending, lang),
      };
    return { kind: "locked", chartId };
  }, [lang]);

  const refresh = useCallback(async () => {
    if (!search?.date) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const snap = buildCalculationSnapshot({
          date: search.date,
          time: search.time,
          place: search.place,
          lang,
          gender: search.gender ?? null,
        });
        const missing = missingSystemDetails(snap);
        if (missing.length > 0) {
          setState({ kind: "systems_incomplete", chartId: null, missing });
          return;
        }
        setState({ kind: "signed_out" });
        return;
      }
      const preSnap = buildCalculationSnapshot({
        date: search.date,
        time: search.time,
        place: search.place,
        lang,
        gender: search.gender ?? null,
      });
      const chart = await ensureChart({
        data: {
          name: search.name,
          date: search.date,
          time: search.time,
          place: search.place,
          lang,
          input_snapshot: { ...search, lang, calculation_snapshot: preSnap },
        },
      });
      const missing = missingSystemDetails(preSnap);
      if (missing.length > 0) {
        setState({ kind: "systems_incomplete", chartId: chart.chartId, missing });
        return;
      }
      const status = await getPremiumStatus({ data: { chartId: chart.chartId } });
      setState(applyStatus(chart.chartId, status));
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === "email_not_verified") {
        const { data: sess } = await supabase.auth.getSession();
        setState({ kind: "verify_needed", email: sess.session?.user?.email ?? null });
      } else if (code === "chart_not_found" || code === "chart_not_found_for_user") {
        setState({ kind: "error", message: pick(TXT.chart_not_owned, lang) });
      } else if (code === "chart_lookup_failed") {
        setState({ kind: "error", message: pick(TXT.no_chart_saved, lang) });
      } else {
        setState({ kind: "error", message: pick(TXT.error, lang) });
      }
    }
  }, [search, lang, applyStatus]);

  const onBackfillGender = async (chartId: string, gender: "male" | "female") => {
    setBusy(true);
    try {
      await updateChartGender({ data: { chartId, gender } });
      // Rebuild snapshot & re-check all four systems without navigating.
      await refresh();
    } catch {
      setState({ kind: "error", message: pick(TXT.error, lang) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refresh();
    return clearPoll;
  }, [refresh]);

  useEffect(() => {
    if (state.kind !== "generating") return;
    clearPoll();
    pollTimer.current = setTimeout(refresh, 4000);
    return clearPoll;
  }, [state.kind, refresh]);

  const onUnlock = async () => {
    if (state.kind !== "locked") return;
    setBusy(true);
    try {
      const outcome = await startPremiumCheckout({ data: { chartId: state.chartId } });
      if (outcome.kind === "already_paid") await refresh();
      else if (outcome.kind === "provider_unavailable")
        setState({
          kind: "order_pending",
          chartId: state.chartId,
          message: pick(TXT.provider_pending, lang),
        });
      else await refresh();
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === "email_not_verified") {
        const { data: sess } = await supabase.auth.getSession();
        setState({ kind: "verify_needed", email: sess.session?.user?.email ?? null });
      } else {
        setState({ kind: "error", message: pick(TXT.error, lang) });
      }
    } finally {
      setBusy(false);
    }
  };

  const onGenerate = async () => {
    if (state.kind !== "paid_no_report" && state.kind !== "failed") return;
    setBusy(true);
    setState({ kind: "generating", chartId: state.chartId });
    try {
      await generatePremiumReport({ data: { chartId: state.chartId } });
      await refresh();
    } catch (err) {
      const code = extractErrorCode(err);
      if (code === "email_not_verified") {
        const { data: sess } = await supabase.auth.getSession();
        setState({ kind: "verify_needed", email: sess.session?.user?.email ?? null });
      } else if (code === "order_not_paid") {
        setState({ kind: "error", message: pick(TXT.order_missing, lang) });
      } else {
        setState({ kind: "failed", chartId: state.chartId, message: code || "generation_failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const onOpen = (btn: HTMLButtonElement | null) => {
    if (state.kind !== "ready") return;
    openerRef.current = btn;
    setReaderOpen(true);
  };

  const chartIdForReader =
    state.kind === "ready" || state.kind === "generating" || state.kind === "paid_no_report"
      ? state.chartId
      : null;

  // ---------------------------------------------------------------------
  // Layout
  //
  // Both variants share a two-column grid on lg+:
  //   - main column:  minmax(0, 1fr) — always wraps normally, min-w-0 so
  //                   flex-in-grid children never collapse to 1 char/line
  //   - side rail:    minmax(360px, 440px) — the status / action / gender
  //                   backfill panel; keeps a comfortable readable width
  //                   without pushing the pitch into a narrow column
  // Below lg the grid becomes a single column; on mobile everything
  // stacks and buttons keep a 44px minimum height.
  // ---------------------------------------------------------------------

  const isBar = variant === "bar";

  const cardBody = (
    <div
      className={`glass-card relative overflow-hidden rounded-3xl ${
        isBar ? "p-5 md:p-6 lg:p-7" : "p-6 md:p-8"
      }`}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-start lg:gap-8">
        {/* MAIN column — kicker + pill, title + price, pitch, chips */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {pick(TXT.kicker, lang)}
            </p>
            <StatePill state={state} lang={lang} />
          </div>

          <div className="min-w-0">
            <h3 className="font-serif text-xl italic leading-tight text-stone-warm md:text-2xl">
              {pick(TXT.title, lang)}
            </h3>
            <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-gold-light">
              {pick(TXT.price, lang)}
            </p>
          </div>

          <p className="text-[13px] leading-relaxed text-stone-warm/75 [overflow-wrap:break-word]">
            {pick(TXT.pitch, lang)}
          </p>

          <ul className="flex flex-wrap gap-2">
            {(lang === "zh" ? TXT.chips.zh : TXT.chips.en).map((c) => (
              <li
                key={c}
                className="rounded-full border border-gold-dust/25 bg-gold-dust/[0.05] px-3 py-1 text-[11px] text-stone-warm/80"
              >
                ✧ {c}
              </li>
            ))}
          </ul>
        </div>

        {/* SIDE rail — action / status / gender backfill */}
        <div className="flex min-w-0 flex-col gap-3">
          <ActionRow
            state={state}
            busy={busy}
            lang={lang}
            onUnlock={onUnlock}
            onGenerate={onGenerate}
            onOpen={onOpen}
            onResendVerification={onResendVerification}
            onBackfillGender={onBackfillGender}
            resent={resent}
          />
          <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
            {pick(TXT.time, lang)}
          </p>
        </div>
      </div>

      <p className="mt-5 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-stone-warm/40 [overflow-wrap:break-word]">
        {pick(TXT.disclaimer, lang)} · {pick(TXT.once_note, lang)}
      </p>
    </div>
  );

  return (
    <>
      {cardBody}
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
    </>
  );
}

function isGenderOnly(missing: MissingDetail[]): boolean {
  return missing.length === 1 && missing[0].system === "ziwei" && missing[0].reason === "gender_missing";
}

function StatePill({ state, lang }: { state: UiState; lang: "zh" | "en" }) {
  let label = "";
  let cls = "border-white/10 text-stone-warm/50";
  if (state.kind === "order_pending") {
    label = pick(TXT.order_pending_pill, lang);
    cls = "border-nebula-purple/50 text-nebula-purple";
  } else if (state.kind === "paid_no_report" || state.kind === "generating") {
    label = pick(TXT.paid_pill, lang);
    cls = "border-gold-dust/60 text-gold-dust";
  } else if (state.kind === "ready") {
    label = pick(TXT.ready_pill, lang);
    cls = "border-gold-dust/60 text-gold-light";
  } else if (state.kind === "systems_incomplete") {
    if (isGenderOnly(state.missing)) {
      label = pick(TXT.systems_incomplete_pill_gender_only, lang);
      cls = "border-gold-dust/50 text-gold-dust";
    } else {
      label = pick(TXT.systems_incomplete_pill_generic, lang);
      cls = "border-white/20 text-stone-warm/60";
    }
  } else return null;
  return (
    <span
      className={`shrink-0 rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.32em] ${cls}`}
    >
      {label}
    </span>
  );
}

function ActionRow({
  state,
  busy,
  lang,
  onUnlock,
  onGenerate,
  onOpen,
  onResendVerification,
  onBackfillGender,
  resent,
}: {
  state: UiState;
  busy: boolean;
  lang: "zh" | "en";
  onUnlock: () => void;
  onGenerate: () => void;
  onOpen: (btn: HTMLButtonElement | null) => void;
  onResendVerification: () => void;
  onBackfillGender: (chartId: string, gender: "male" | "female") => void;
  resent: boolean;
}) {
  const btnBase =
    "w-full rounded-full bg-gold-dust text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50 min-h-[44px] px-6 py-2.5 text-center";
  if (state.kind === "loading") return <p className="text-sm text-stone-warm/50">…</p>;
  if (state.kind === "signed_out") {
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("lod:open-account"));
        }}
        className="w-full min-h-[44px] rounded-full border border-gold-dust/50 px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
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
        <button
          type="button"
          disabled={resent}
          onClick={onResendVerification}
          className="w-full min-h-[44px] rounded-full border border-gold-dust/60 px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10 disabled:opacity-50"
        >
          {resent ? pick(TXT.resent_verify, lang) : pick(TXT.resend_verify, lang)}
        </button>
      </div>
    );
  }
  if (state.kind === "no_chart") return <p className="text-sm text-stone-warm/50">…</p>;
  if (state.kind === "systems_incomplete") {
    // Only-gender case: owner can fix in-place with two big buttons.
    if (isGenderOnly(state.missing) && state.chartId) {
      const chartId = state.chartId;
      return (
        <div
          role="group"
          aria-label={pick(TXT.gender_backfill_title, lang)}
          className="w-full rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.04] p-4 text-[12px] leading-relaxed text-stone-warm/80"
        >
          <p className="mb-2 text-[11px] uppercase tracking-[0.28em] text-gold-dust/80">
            {pick(TXT.gender_backfill_title, lang)}
          </p>
          <p className="mb-3 [overflow-wrap:break-word]">
            {pick(TXT.gender_backfill_body, lang)}
          </p>
          <div role="radiogroup" aria-label={pick(TXT.gender_backfill_title, lang)} className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onBackfillGender(chartId, "male")}
              className="min-h-[44px] flex-1 rounded-full border border-gold-dust/40 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10 disabled:opacity-50"
            >
              {pick(TXT.gender_male, lang)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onBackfillGender(chartId, "female")}
              className="min-h-[44px] flex-1 rounded-full border border-gold-dust/40 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10 disabled:opacity-50"
            >
              {pick(TXT.gender_female, lang)}
            </button>
          </div>
        </div>
      );
    }
    // Generic case — list each missing system with its own reason.
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-[12px] leading-relaxed text-stone-warm/70">
        <p className="mb-2 text-[11px] uppercase tracking-[0.28em] text-stone-warm/50">
          {pick(TXT.systems_incomplete_title_generic, lang)}
        </p>
        <p className="mb-3 [overflow-wrap:break-word]">
          {pick(TXT.systems_incomplete_body_generic, lang)}
        </p>
        <ul className="space-y-2">
          {state.missing.map((m) => (
            <li key={m.system} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/60">
                {systemDisplayName(m.system, lang)}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-stone-warm/75 [overflow-wrap:break-word]">
                {missingReasonMessage(m.reason, lang)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (state.kind === "locked") {
    return (
      <button type="button" disabled={busy} onClick={onUnlock} className={btnBase}>
        {pick(TXT.cta_unlock, lang)}
      </button>
    );
  }
  if (state.kind === "order_pending") {
    return (
      <p className="w-full rounded-2xl border border-nebula-purple/40 bg-nebula-purple/[0.08] p-3 text-[12px] leading-relaxed text-stone-warm/80 [overflow-wrap:break-word]">
        {state.message}
      </p>
    );
  }
  if (state.kind === "paid_no_report") {
    return (
      <button type="button" disabled={busy} onClick={onGenerate} className={btnBase}>
        {pick(TXT.cta_generate, lang)}
      </button>
    );
  }
  if (state.kind === "failed") {
    return (
      <div className="flex w-full flex-col gap-2">
        <button type="button" disabled={busy} onClick={onGenerate} className={btnBase}>
          {pick(TXT.cta_retry, lang)}
        </button>
        <p className="text-[11px] text-stone-warm/50 [overflow-wrap:break-word]">
          {pick(TXT.error, lang)}
          {state.message ? ` · ${state.message}` : ""}
        </p>
      </div>
    );
  }
  if (state.kind === "generating") {
    return (
      <div className="flex w-full min-h-[44px] items-center justify-center gap-3 rounded-full border border-gold-dust/30 px-5 py-2.5 text-[11px] uppercase tracking-[0.32em] text-gold-dust">
        <span className="inline-block size-2 animate-pulse rounded-full bg-gold-dust" />
        {pick(TXT.busy_generate, lang)}
      </div>
    );
  }
  if (state.kind === "ready") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={(e) => onOpen(e.currentTarget)}
        className={btnBase}
      >
        {pick(TXT.cta_open, lang)}
      </button>
    );
  }
  if (state.kind === "error") {
    return (
      <p className="w-full text-sm text-stone-warm/70 [overflow-wrap:break-word]">
        {state.message}
      </p>
    );
  }
  return null;
}
