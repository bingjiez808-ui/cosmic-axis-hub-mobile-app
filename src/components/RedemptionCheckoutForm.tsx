/**
 * RedemptionCheckoutForm — pluggable sub-view rendered inside
 * MembershipCheckoutModal when the user picks "兑换码 / Redemption code".
 *
 * Handles: input normalization, chart selection (for report codes),
 * live error → localized message mapping, idempotent submit, and a
 * success card that mirrors the mock-payment success UX.
 */
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/lib/i18n";
import { newIdempotencyKey } from "@/lib/membership-plans";
import {
  codeMeta,
  formatCodeForDisplay,
  normalizeCode,
  stripCode,
} from "@/lib/redemption-format";
import { redeemCode, type RedeemResult } from "@/lib/redemption.functions";
import { refreshMembershipTier } from "@/lib/use-membership-tier";

type Phase = "idle" | "busy" | "success" | "error";

type ChartOption = { id: string; name: string | null; birth_date: string | null; is_primary: boolean };

const T = {
  intro: {
    zh: "输入你收到的兑换码（不区分大小写与横线）。兑换成功后权益立即生效。",
    en: "Enter the code you received (case- and dash-insensitive). Benefits unlock immediately upon success.",
  },
  input_label: { zh: "兑换码", en: "Redemption code" },
  chart_label: { zh: "绑定命盘", en: "Bind to chart" },
  chart_hint: {
    zh: "购买 ¥79 综合报告的兑换码必须选择要绑定的命盘；会员或其他兑换码为选填。",
    en: "Required for ¥79 premium-report codes; optional for membership or other codes.",
  },
  chart_none: { zh: "— 选填 / 报告码必选 —", en: "— Optional / required for report codes —" },
  submit: { zh: "验证并开通", en: "Verify & activate" },
  processing: { zh: "验证中…", en: "Verifying…" },
  retry: { zh: "重试", en: "Retry" },
  success_title: { zh: "已开通", en: "Activated" },
  keep_reading: { zh: "继续", en: "Continue" },
  err: {
    code_invalid: {
      zh: "兑换码无效。请核对拼写或联系发放方。",
      en: "Invalid redemption code. Check spelling or contact the issuer.",
    },
    code_not_yet_active: { zh: "兑换码尚未开始生效。", en: "This code is not yet active." },
    code_expired: { zh: "兑换码已过期。", en: "This code has expired." },
    code_exhausted: { zh: "兑换码使用次数已用完。", en: "This code has reached its usage limit." },
    already_redeemed_by_user: {
      zh: "你已经用过这枚兑换码。",
      en: "You've already redeemed this code.",
    },
    code_not_assigned_to_you: {
      zh: "此兑换码已指派给其他账号邮箱，无法使用当前账号兑换。",
      en: "This code is assigned to another account. Sign in with the intended email.",
    },
    chart_required: { zh: "报告码需要选择要绑定的命盘。", en: "Report codes require a chart selection." },
    chart_not_owned: { zh: "该命盘不属于你。", en: "This chart does not belong to you." },
    report_already_owned: {
      zh: "该命盘已购综合报告；本次兑换未消耗，可换一张命盘再试。",
      en: "This chart already owns a premium report — no redemption consumed; try a different chart.",
    },
    rate_limited: {
      zh: "尝试过于频繁，请稍后再试。",
      en: "Too many attempts. Please try again shortly.",
    },
    fulfillment_failed: {
      zh: "开通失败，请重试。若持续失败请联系客服。",
      en: "Activation failed. Please retry or contact support if this persists.",
    },
    invalid_request_id: {
      zh: "请求校验失败，请刷新页面重试。",
      en: "Request check failed. Refresh and try again.",
    },
    not_authenticated: { zh: "请先登录再兑换。", en: "Please sign in before redeeming." },
  },
  benefits: {
    sage_membership: { zh: "已开通贤者会员", en: "Sage membership activated" },
    oracle_membership: { zh: "已开通神谕者会员", en: "Oracle membership activated" },
    premium_report: { zh: "¥79 综合报告权益已绑定命盘", en: "Premium report bound to your chart" },
    test_access: { zh: "测试访问权限已开通", en: "Test access activated" },
    support_compensation: { zh: "补偿权益已发放", en: "Support compensation applied" },
  },
} as const;

function pick(t: { zh: string; en: string }, lang: Lang) {
  return lang === "zh" ? t.zh : t.en;
}

export function RedemptionCheckoutForm({
  lang,
  presetChartId,
  onSuccess,
  onClose,
}: {
  lang: Lang;
  /** When a caller has an obvious chart context (e.g. /report), pass it here. */
  presetChartId?: string | null;
  onSuccess?: (result: RedeemResult) => void;
  onClose?: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [chartId, setChartId] = useState<string | null>(presetChartId ?? null);
  const [charts, setCharts] = useState<ChartOption[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [requestId, setRequestId] = useState<string>(() => newIdempotencyKey().replace("mem_", "rd_"));

  // Load caller's charts once so report codes can pick a target.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        if (!cancelled) setCharts([]);
        return;
      }
      const { data } = await supabase
        .from("charts")
        .select("id, name, birth_date, is_primary")
        .eq("user_id", sess.session.user.id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as ChartOption[];
      setCharts(list);
      if (!chartId && presetChartId) setChartId(presetChartId);
      else if (!chartId) {
        const primary = list.find((c) => c.is_primary);
        if (primary) setChartId(primary.id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetChartId]);

  const normalized = useMemo(() => normalizeCode(raw), [raw]);
  const displayValue = useMemo(() => {
    const stripped = stripCode(raw);
    if (!stripped) return "";
    if (normalized) return formatCodeForDisplay(normalized);
    return stripped;
  }, [raw, normalized]);
  const meta = useMemo(() => codeMeta(raw), [raw]);

  const submit = async () => {
    if (phase === "busy") return;
    if (!normalized) {
      setError(pick(T.err.code_invalid, lang));
      setPhase("error");
      return;
    }
    setPhase("busy");
    setError(null);
    try {
      const res = await redeemCode({
        data: {
          code: normalized,
          chartId: chartId ?? undefined,
          requestId,
        },
      });
      if (res.membership) {
        await refreshMembershipTier();
      }
      setResult(res);
      setPhase("success");
      onSuccess?.(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const key = (Object.keys(T.err) as Array<keyof typeof T.err>).find((k) =>
        msg.toLowerCase().includes(k),
      );
      setError(key ? pick(T.err[key], lang) : pick(T.err.fulfillment_failed, lang));
      setPhase("error");
      // Rotate request id on failure so retry is a genuinely new attempt.
      setRequestId(newIdempotencyKey().replace("mem_", "rd_"));
    }
  };

  if (phase === "success" && result) {
    return (
      <div
        data-testid="redemption-success"
        className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.08] p-5 text-center"
      >
        <p className="font-serif text-lg italic text-emerald-100">
          ✓ {pick(T.success_title, lang)}
        </p>
        <p className="mt-2 text-xs text-stone-warm/80">
          {pick(T.benefits[result.benefitType], lang)}
        </p>
        {result.membership?.expiresAt && (
          <p className="mt-2 text-[11px] text-stone-warm/60">
            {lang === "zh" ? "有效期至 " : "Expires "}
            {new Date(result.membership.expiresAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          data-testid="redemption-continue"
          className="mt-4 min-h-11 rounded-full bg-gold-dust px-6 py-2 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
        >
          {pick(T.keep_reading, lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <p className="text-[11px] leading-relaxed text-stone-warm/70">{pick(T.intro, lang)}</p>

      <label className="mt-4 block">
        <span className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
          {pick(T.input_label, lang)}
        </span>
        <input
          data-testid="redemption-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          value={displayValue}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="FN-SAGE-XXXX-XXXX-XXXX"
          className="mt-2 w-full rounded-xl border border-white/10 bg-obsidian/40 px-4 py-3 font-mono text-sm uppercase tracking-widest text-stone-warm placeholder:text-stone-warm/25 focus:border-gold-dust focus:outline-none"
        />
        {meta && (
          <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
            {meta.prefix} • •••• {meta.last4}
          </p>
        )}
      </label>

      <label className="mt-4 block">
        <span className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
          {pick(T.chart_label, lang)}
        </span>
        <select
          data-testid="redemption-chart"
          value={chartId ?? ""}
          onChange={(e) => setChartId(e.target.value || null)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-obsidian/40 px-4 py-3 text-sm text-stone-warm focus:border-gold-dust focus:outline-none"
        >
          <option value="">{pick(T.chart_none, lang)}</option>
          {(charts ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {(c.is_primary ? "★ " : "") + (c.name || c.id.slice(0, 8)) + (c.birth_date ? ` · ${c.birth_date}` : "")}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[10px] leading-relaxed text-stone-warm/50">
          {pick(T.chart_hint, lang)}
        </p>
      </label>

      {error && (
        <p
          data-testid="redemption-error"
          role="alert"
          className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={phase === "busy" || !normalized}
        data-testid="redemption-submit"
        className="mt-5 min-h-11 w-full rounded-full bg-gold-dust px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50"
      >
        {phase === "busy"
          ? pick(T.processing, lang)
          : phase === "error"
            ? pick(T.retry, lang)
            : pick(T.submit, lang)}
      </button>
    </div>
  );
}
