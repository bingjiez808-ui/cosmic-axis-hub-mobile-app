/**
 * Simulated cashier for the Premium ¥79 Deep Reading unlock.
 *
 * This modal is a UX placeholder — NO real payment provider is called,
 * NO card / bank / phone data is collected. It talks to
 * `simulateMockPremiumPayment` (auth-gated, non-production-only) which
 * inserts a `provider=mock_<method>` paid row for the caller's own
 * chart. Production builds hide the confirm action entirely.
 *
 * Layout follows the project's `glass-card` / gold-dust vocabulary so it
 * lines up with the rest of the ritual UI. Four payment brands are
 * shown side-by-side (2×2 on mobile, single row on desktop). A test
 * banner is pinned near the confirm button in both languages.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

import type { Lang } from "@/lib/i18n";
import {
  PREMIUM_MOCK_PAYMENT_METHODS,
  simulateMockPremiumPayment,
  type PremiumMockPaymentMethod,
} from "@/lib/premium.functions";

type Method = PremiumMockPaymentMethod;

const T = {
  kicker: { zh: "模拟收银台 · 一次性解锁", en: "Simulated cashier · one-time unlock" },
  title: { zh: "高级 AI 综合报告", en: "Premium AI Deep Reading" },
  amount_label: { zh: "应付金额", en: "Amount due" },
  once_note: {
    zh: "同一命盘只需支付一次，永久保存在你的账户。",
    en: "Pay once per chart — kept in your account forever.",
  },
  test_badge: {
    zh: "测试支付 · 不会产生真实扣款",
    en: "Test payment · no real charge",
  },
  disabled_prod: {
    zh: "支付渠道尚未开放",
    en: "Payment channel not yet available",
  },
  pick_method: { zh: "请选择支付方式", en: "Choose a payment method" },
  qr_hint: {
    zh: "请使用手机 App 扫描二维码（示意，非真实二维码）",
    en: "Scan the QR code with the app (illustrative — not a real code)",
  },
  card_hint: {
    zh: "本演示不会请求或存储任何银行卡信息",
    en: "This demo never asks for or stores any card data",
  },
  cta_confirm_wechat: {
    zh: "模拟扫码完成支付",
    en: "Simulate scan · complete payment",
  },
  cta_confirm_alipay: {
    zh: "模拟扫码完成支付",
    en: "Simulate scan · complete payment",
  },
  cta_confirm_visa: { zh: "模拟支付", en: "Simulate payment" },
  cta_confirm_unionpay: { zh: "模拟支付", en: "Simulate payment" },
  cancel: { zh: "取消", en: "Cancel" },
  processing: { zh: "处理中…", en: "Processing…" },
  method_wechat: { zh: "微信支付", en: "WeChat Pay" },
  method_alipay: { zh: "支付宝", en: "Alipay" },
  method_visa: { zh: "Visa", en: "Visa" },
  method_unionpay: { zh: "银联卡", en: "UnionPay" },
  error: {
    zh: "模拟支付失败，请重试。",
    en: "Simulated payment failed. Please retry.",
  },
} as const;

function pick(t: { zh: string; en: string }, lang: Lang) {
  return lang === "zh" ? t.zh : t.en;
}

const METHOD_LABEL: Record<Method, { zh: string; en: string }> = {
  wechat: T.method_wechat,
  alipay: T.method_alipay,
  visa: T.method_visa,
  unionpay: T.method_unionpay,
};

// Simple brand glyphs, no real logo imagery.
const METHOD_GLYPH: Record<Method, string> = {
  wechat: "💬",
  alipay: "🅰",
  visa: "VISA",
  unionpay: "银联",
};

const METHOD_ACCENT: Record<Method, string> = {
  wechat: "from-emerald-400/40 to-emerald-600/20 text-emerald-200",
  alipay: "from-sky-400/40 to-sky-600/20 text-sky-200",
  visa: "from-indigo-400/40 to-indigo-700/20 text-indigo-100",
  unionpay: "from-rose-400/40 to-rose-600/20 text-rose-200",
};

function isProduction(): boolean {
  // Vite replaces this at build time. Preview/dev builds evaluate to false.
  try {
    return Boolean(import.meta.env?.PROD);
  } catch {
    return false;
  }
}

export function MockPaymentModal({
  open,
  chartId,
  lang,
  onClose,
  onSuccess,
}: {
  open: boolean;
  chartId: string | null;
  lang: Lang;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const titleId = useId();
  const [method, setMethod] = useState<Method>("wechat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prod = isProduction();

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
    setMethod("wechat");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
    };
    // busy intentionally excluded — inline check above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  if (!open) return null;

  const onConfirm = async () => {
    if (!chartId || busy || prod) return;
    setBusy(true);
    setError(null);
    try {
      await simulateMockPremiumPayment({ data: { chartId, method } });
      onSuccess();
    } catch {
      setError(pick(T.error, lang));
      setBusy(false);
    }
  };

  const confirmLabelKey =
    method === "wechat"
      ? T.cta_confirm_wechat
      : method === "alipay"
        ? T.cta_confirm_alipay
        : method === "visa"
          ? T.cta_confirm_visa
          : T.cta_confirm_unionpay;

  const isQrMethod = method === "wechat" || method === "alipay";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end justify-center bg-obsidian/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
        onClick={() => (busy ? undefined : onClose())}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="mock-payment-modal"
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="glass-card relative w-full max-h-[92vh] overflow-y-auto rounded-t-3xl p-6 focus:outline-none sm:max-w-md sm:rounded-3xl sm:p-8"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={pick(T.cancel, lang)}
            className="absolute right-4 top-4 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust disabled:opacity-40"
          >
            ✕
          </button>

          <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
            {pick(T.kicker, lang)}
          </p>
          <h3 id={titleId} className="font-serif text-xl italic text-stone-warm md:text-2xl">
            {pick(T.title, lang)}
          </h3>

          <div className="mt-4 flex items-baseline justify-between rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/60">
              {pick(T.amount_label, lang)}
            </span>
            <span className="font-serif text-2xl italic text-gold-light">¥79</span>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-stone-warm/60">
            {pick(T.once_note, lang)}
          </p>

          <div
            data-testid="mock-payment-test-badge"
            role="status"
            className="mt-4 rounded-full border border-amber-400/40 bg-amber-400/[0.08] px-3 py-1.5 text-center text-[11px] tracking-[0.08em] text-amber-200"
          >
            ⚠ {pick(T.test_badge, lang)}
          </div>

          <p className="mt-5 text-[10.5px] uppercase tracking-[0.28em] text-stone-warm/50">
            {pick(T.pick_method, lang)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PREMIUM_MOCK_PAYMENT_METHODS.map((m) => {
              const active = m === method;
              return (
                <button
                  key={m}
                  type="button"
                  data-testid={`mock-method-${m}`}
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => setMethod(m)}
                  className={[
                    "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[11px] transition",
                    active
                      ? "border-gold-dust bg-gold-dust/[0.10] text-stone-warm"
                      : "border-white/10 bg-white/[0.02] text-stone-warm/70 hover:border-gold-dust/40",
                    busy ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={`inline-flex h-6 min-w-[36px] items-center justify-center rounded bg-gradient-to-br px-1.5 text-[10px] font-semibold ${METHOD_ACCENT[m]}`}
                  >
                    {METHOD_GLYPH[m]}
                  </span>
                  <span className="leading-tight [overflow-wrap:break-word]">
                    {pick(METHOD_LABEL[m], lang)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Method-specific illustrative panel — never asks for card data. */}
          <div
            data-testid={`mock-panel-${method}`}
            className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-center"
          >
            {isQrMethod ? (
              <>
                <div
                  aria-hidden
                  data-testid="mock-qr-placeholder"
                  className="mx-auto grid h-32 w-32 grid-cols-8 gap-[2px] rounded-lg bg-white/[0.04] p-2"
                >
                  {Array.from({ length: 64 }).map((_, i) => (
                    <span
                      key={i}
                      className={`block rounded-[1px] ${
                        // Deterministic pattern so it stays stable across renders.
                        ((i * 7 + method.length) % 3 === 0)
                          ? "bg-stone-warm/70"
                          : "bg-transparent"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-stone-warm/60 [overflow-wrap:break-word]">
                  {pick(T.qr_hint, lang)}
                </p>
              </>
            ) : (
              <>
                <div
                  aria-hidden
                  className={`mx-auto flex h-16 w-40 items-center justify-center rounded-lg bg-gradient-to-br ${METHOD_ACCENT[method]} text-lg font-bold tracking-wider`}
                >
                  {METHOD_GLYPH[method]}
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-stone-warm/60 [overflow-wrap:break-word]">
                  {pick(T.card_hint, lang)}
                </p>
              </>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="w-full min-h-[44px] rounded-full border border-white/15 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-light disabled:opacity-40 sm:w-1/3"
            >
              {pick(T.cancel, lang)}
            </button>
            <button
              type="button"
              data-testid="mock-payment-confirm"
              onClick={onConfirm}
              disabled={busy || prod || !chartId}
              className="w-full min-h-[48px] flex-1 rounded-full bg-gold-dust px-5 py-3 text-[12px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prod
                ? pick(T.disabled_prod, lang)
                : busy
                  ? pick(T.processing, lang)
                  : pick(confirmLabelKey, lang)}
            </button>
          </div>

          <p className="mt-3 text-center text-[10.5px] leading-relaxed text-stone-warm/45 [overflow-wrap:break-word]">
            {pick(T.test_badge, lang)}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
