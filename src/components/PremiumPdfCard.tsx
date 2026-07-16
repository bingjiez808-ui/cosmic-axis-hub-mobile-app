/**
 * Premium ¥79 one-time PDF unlock card.
 *
 * Drives all state from the server via `getPremiumStatus`:
 *   - No order         → show pitch + "Unlock" CTA
 *   - Pending order    → show "payment provider being configured" notice
 *   - Paid + no report → show "Generate my PDF" (idempotent)
 *   - Generating       → poll
 *   - Completed + pdf  → "Download PDF" via short-lived signed URL
 *   - Completed no pdf → "Content ready, PDF renderer pending config"
 *
 * Two visual variants:
 *   - variant="card"  legacy tall card (kept for backwards-compat)
 *   - variant="bar"   full-width horizontal bar shown on the report page
 *
 * Nothing here writes to the database or trusts client-provided flags.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useLang } from "@/lib/i18n";
import { ensureChart } from "@/lib/reports-store.functions";
import {
  generatePremiumPdf,
  getPremiumPdfSignedUrl,
  getPremiumStatus,
  startPremiumCheckout,
  type PremiumStatus,
} from "@/lib/premium.functions";
import { supabase } from "@/integrations/supabase/client";

type ReportSearchLike = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
};

const TXT = {
  kicker: { zh: "¥79 · 一次解锁", en: "¥79 · one-time unlock" },
  title: { zh: "高级 AI 深度 PDF 报告", en: "Premium AI Deep-Reading PDF" },
  price: { zh: "¥79 · 一次性买断当前命盘", en: "¥79 · one-time purchase for this chart" },
  pitch: {
    zh: "在你已有的网页报告基础上，由资深 AI 综合西方占星、印度占星、八字与紫微斗数，生成一份约 20–30 页的深度个人 PDF。生成一次，永久保存并可无限次重新下载。",
    en: "Building on your existing web reading, our premium AI blends Western astrology, Vedic Jyotish, BaZi and Zi Wei Dou Shu into a ~20–30 page personal PDF. Generated once, saved forever, redownload anytime.",
  },
  bullets: {
    zh: [
      "20–30 页深度解读 · 四体系综合",
      "性格 / 事业 / 财富 / 关系 / 家庭 / 健康",
      "未来 12 个月与关键时间窗口",
      "生成一次 · 永久保存 · 可重复下载",
    ],
    en: [
      "20–30 pages · four-tradition synthesis",
      "Character / vocation / wealth / relationships / family / health",
      "Next twelve months + key time windows",
      "Generate once · save forever · redownload anytime",
    ],
  },
  chips: {
    zh: ["20–30 页深度解读", "四体系综合", "未来 12 个月", "永久保存"],
    en: ["20–30 pages", "Four traditions", "Next 12 months", "Saved forever"],
  },
  time: { zh: "生成通常需要 2–4 分钟", en: "Generation typically takes 2–4 minutes" },
  cta_unlock: { zh: "¥79 解锁高级 PDF", en: "Unlock ¥79 Premium PDF" },
  cta_generate: { zh: "开始生成我的 PDF", en: "Generate my PDF" },
  cta_download: { zh: "下载 PDF", en: "Download PDF" },
  cta_redownload: { zh: "重新下载", en: "Redownload" },
  busy_generate: { zh: "正在生成中，请稍候…", en: "Generating your report…" },
  provider_pending: {
    zh: "支付渠道配置中：¥79 订单已记录，正式支付通道上线前，请联系管理员完成付款并人工开通。",
    en: "Payment provider being configured: your ¥79 intent is recorded. Contact an admin to complete payment offline while the live checkout is finalised.",
  },
  once_note: {
    zh: "非订阅 · 非按次收费 · 同一命盘只需支付一次。",
    en: "Not a subscription · not per-download · pay once per chart.",
  },
  disclaimer: {
    zh: "报告仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议。",
    en: "For cultural, reflective self-exploration only — not medical, legal, financial or life-decision advice.",
  },
  need_auth: { zh: "请先登录以购买", en: "Sign in to purchase" },
  need_verify: {
    zh: "请先验证你的邮箱后再购买或生成",
    en: "Please verify your email before purchasing or generating",
  },
  error: { zh: "操作失败，请稍后重试。", en: "Something went wrong, please retry." },
  renderer_pending: {
    zh: "深度内容已生成完毕。PDF 排版模块正在配置中文字体嵌入；下载功能将在字体上线后自动可用。",
    en: "Deep content is fully generated. The PDF renderer is being configured (font embedding for Chinese pending). Download unlocks automatically once complete.",
  },
  order_pending_pill: { zh: "订单已记录", en: "Order recorded" },
  paid_pill: { zh: "已解锁", en: "Unlocked" },
  ready_pill: { zh: "报告已就绪", en: "Report ready" },
};

function pick<T extends { zh: string; en: string }>(t: T, lang: "zh" | "en"): string {
  return lang === "zh" ? t.zh : t.en;
}

type UiState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "no_chart" }
  | { kind: "locked"; chartId: string }
  | { kind: "order_pending"; chartId: string; message: string }
  | { kind: "paid_no_report"; chartId: string }
  | { kind: "generating"; chartId: string }
  | { kind: "renderer_pending"; chartId: string }
  | { kind: "ready"; chartId: string }
  | { kind: "failed"; chartId: string; message: string }
  | { kind: "error"; message: string };

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
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const applyStatus = useCallback((chartId: string, s: PremiumStatus): UiState => {
    if (s.report?.status === "completed" && s.report.hasPdf) return { kind: "ready", chartId };
    if (s.report?.status === "completed" && !s.report.hasPdf)
      return { kind: "renderer_pending", chartId };
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
        setState({ kind: "signed_out" });
        return;
      }
      const chart = await ensureChart({
        data: {
          name: search.name,
          date: search.date,
          time: search.time,
          place: search.place,
          lang,
          input_snapshot: { ...search, lang },
        },
      });
      const status = await getPremiumStatus({ data: { chartId: chart.chartId } });
      setState(applyStatus(chart.chartId, status));
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("email_not_verified")) {
        setState({ kind: "error", message: pick(TXT.need_verify, lang) });
      } else {
        setState({ kind: "error", message: pick(TXT.error, lang) });
      }
    }
  }, [search, lang, applyStatus]);

  useEffect(() => {
    refresh();
    return clearPoll;
  }, [refresh]);

  // Poll while generating.
  useEffect(() => {
    if (state.kind !== "generating") return;
    clearPoll();
    pollTimer.current = setTimeout(refresh, 4000);
    return clearPoll;
    // biome-ignore lint: only re-arm when state kind flips
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
    } catch {
      setState({ kind: "error", message: pick(TXT.error, lang) });
    } finally {
      setBusy(false);
    }
  };

  const onGenerate = async () => {
    if (state.kind !== "paid_no_report" && state.kind !== "failed") return;
    setBusy(true);
    setState({ kind: "generating", chartId: state.chartId });
    try {
      await generatePremiumPdf({ data: { chartId: state.chartId } });
      await refresh();
    } catch {
      setState({ kind: "error", message: pick(TXT.error, lang) });
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (state.kind !== "ready") return;
    setBusy(true);
    try {
      const { url } = await getPremiumPdfSignedUrl({ data: { chartId: state.chartId } });
      if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      else setState({ kind: "error", message: pick(TXT.error, lang) });
    } catch {
      setState({ kind: "error", message: pick(TXT.error, lang) });
    } finally {
      setBusy(false);
    }
  };

  if (variant === "bar") {
    return (
      <div className="glass-card relative overflow-hidden rounded-3xl p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
          {/* Left: title + price */}
          <div className="min-w-0 md:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {pick(TXT.kicker, lang)}
              </p>
              <StatePill state={state} lang={lang} />
            </div>
            <h3 className="mt-1 font-serif text-lg italic text-stone-warm md:text-xl">
              {pick(TXT.title, lang)}
            </h3>
            <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-gold-light">
              {pick(TXT.price, lang)}
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-stone-warm/70">
              {pick(TXT.pitch, lang)}
            </p>
          </div>

          {/* Middle: chips */}
          <ul className="flex flex-wrap gap-2 md:max-w-[38%] md:flex-1">
            {(lang === "zh" ? TXT.chips.zh : TXT.chips.en).map((c) => (
              <li
                key={c}
                className="rounded-full border border-gold-dust/25 bg-gold-dust/[0.05] px-3 py-1 text-[11px] text-stone-warm/80"
              >
                ✧ {c}
              </li>
            ))}
          </ul>

          {/* Right: action */}
          <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:min-w-[13rem] md:items-end">
            <ActionRow
              state={state}
              busy={busy}
              lang={lang}
              onUnlock={onUnlock}
              onGenerate={onGenerate}
              onDownload={onDownload}
              fullWidth
            />
            <p className="text-center text-[10px] uppercase tracking-[0.24em] text-stone-warm/40 md:text-right">
              {pick(TXT.time, lang)}
            </p>
          </div>
        </div>

        <p className="mt-4 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-stone-warm/40">
          {pick(TXT.disclaimer, lang)} · {pick(TXT.once_note, lang)}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
            {pick(TXT.kicker, lang)}
          </p>
          <h3 className="font-serif text-xl italic text-stone-warm md:text-2xl">
            {pick(TXT.title, lang)}
          </h3>
          <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-gold-light">
            {pick(TXT.price, lang)}
          </p>
        </div>
        <StatePill state={state} lang={lang} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-stone-warm/70">
        {pick(TXT.pitch, lang)}
      </p>
      <ul className="mt-4 space-y-1.5 text-[13px] text-stone-warm/70">
        {(lang === "zh" ? TXT.bullets.zh : TXT.bullets.en).map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-gold-dust/80">✧</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-stone-warm/40">
        {pick(TXT.time, lang)} · {pick(TXT.once_note, lang)}
      </p>

      <div className="mt-6">
        <ActionRow
          state={state}
          busy={busy}
          lang={lang}
          onUnlock={onUnlock}
          onGenerate={onGenerate}
          onDownload={onDownload}
        />
      </div>

      <p className="mt-5 border-t border-white/5 pt-4 text-[11px] leading-relaxed text-stone-warm/40">
        {pick(TXT.disclaimer, lang)}
      </p>
    </div>
  );
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
  } else if (state.kind === "ready" || state.kind === "renderer_pending") {
    label = pick(TXT.ready_pill, lang);
    cls = "border-gold-dust/60 text-gold-light";
  } else return null;
  return (
    <span className={`shrink-0 rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.32em] ${cls}`}>
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
  onDownload,
}: {
  state: UiState;
  busy: boolean;
  lang: "zh" | "en";
  onUnlock: () => void;
  onGenerate: () => void;
  onDownload: () => void;
}) {
  if (state.kind === "loading") {
    return <p className="text-sm text-stone-warm/50">…</p>;
  }
  if (state.kind === "signed_out") {
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.dispatchEvent(new Event("lod:open-account"));
        }}
        className="rounded-full border border-gold-dust/50 px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
      >
        {pick(TXT.need_auth, lang)}
      </button>
    );
  }
  if (state.kind === "no_chart") {
    return <p className="text-sm text-stone-warm/50">…</p>;
  }
  if (state.kind === "locked") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onUnlock}
        className="rounded-full bg-gold-dust px-6 py-2.5 text-[11px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light disabled:opacity-50"
      >
        {pick(TXT.cta_unlock, lang)}
      </button>
    );
  }
  if (state.kind === "order_pending") {
    return (
      <p className="rounded-2xl border border-nebula-purple/40 bg-nebula-purple/[0.08] p-4 text-sm text-stone-warm/80">
        {state.message}
      </p>
    );
  }
  if (state.kind === "paid_no_report" || state.kind === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          className="rounded-full bg-gold-dust px-6 py-2.5 text-[11px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light disabled:opacity-50"
        >
          {pick(TXT.cta_generate, lang)}
        </button>
        {state.kind === "failed" && (
          <span className="text-[11px] text-stone-warm/50">{pick(TXT.error, lang)}</span>
        )}
      </div>
    );
  }
  if (state.kind === "generating") {
    return (
      <div className="flex items-center gap-3 rounded-full border border-gold-dust/30 px-5 py-2.5 text-[11px] uppercase tracking-[0.32em] text-gold-dust">
        <span className="inline-block size-2 animate-pulse rounded-full bg-gold-dust" />
        {pick(TXT.busy_generate, lang)}
      </div>
    );
  }
  if (state.kind === "renderer_pending") {
    return (
      <p className="rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.05] p-4 text-sm text-stone-warm/70">
        {pick(TXT.renderer_pending, lang)}
      </p>
    );
  }
  if (state.kind === "ready") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onDownload}
        className="rounded-full bg-gold-dust px-6 py-2.5 text-[11px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light disabled:opacity-50"
      >
        {pick(TXT.cta_download, lang)}
      </button>
    );
  }
  if (state.kind === "error") {
    return <p className="text-sm text-stone-warm/70">{state.message}</p>;
  }
  return null;
}
