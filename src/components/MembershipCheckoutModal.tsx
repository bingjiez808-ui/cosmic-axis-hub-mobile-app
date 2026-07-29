/**
 * MembershipCheckoutModal — the ONE shared checkout surface for
 * monthly Sage / Oracle upgrades. Used by /report, /me/sage,
 * /me/oracle, /me/membership and any future entry point.
 *
 * Reads plan copy/price from MEMBERSHIP_PLANS. Talks to the shared
 * server function `simulateMockMembershipUpgrade` (idempotent). On
 * success it refreshes the membership-tier query — pages stay put
 * and re-render unlocked in place.
 *
 * The confirm button is idempotency-key-locked: rapid double clicks
 * produce a single order. No real payment credentials are collected
 * or displayed. A prominent test banner is always visible.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { Lang } from "@/lib/i18n";
import {
  MEMBERSHIP_METHOD_LABELS,
  MEMBERSHIP_PAYMENT_METHODS,
  MEMBERSHIP_PLANS,
  newIdempotencyKey,
  type MembershipPaymentMethod,
  type MembershipTierId,
} from "@/lib/membership-plans";
import { simulateMockMembershipUpgrade } from "@/lib/membership.functions";
import { refreshMembershipTier } from "@/lib/use-membership-tier";
import { RedemptionCheckoutForm } from "@/components/RedemptionCheckoutForm";

type ExtendedMethod = MembershipPaymentMethod | "redemption";

export type CheckoutSource =
  | "report"
  | "sage_room"
  | "oracle_room"
  | "membership"
  | "relationship"
  | "anonymous_match";

const T = {
  kicker_sage: { zh: "开通贤者阅览室", en: "Activate the Sage Reading Room" },
  kicker_oracle: { zh: "开通神谕者阅览室", en: "Activate the Oracle Reading Room" },
  title: { zh: "选择支付方式", en: "Choose a payment method" },
  amount: { zh: "每月", en: "per month" },
  test_badge: {
    zh: "模拟支付，不会真实扣款",
    en: "Simulated payment — no real charge",
  },
  confirm: { zh: "确认支付", en: "Confirm payment" },
  processing: { zh: "处理中…", en: "Processing…" },
  success_title: { zh: "已开通", en: "Activated" },
  success_hint_sage: {
    zh: "贤者阅览室已可使用。",
    en: "The Sage Reading Room is now available.",
  },
  success_hint_oracle: {
    zh: "神谕者阅览室已可使用（包含贤者全部权益）。",
    en: "The Oracle Reading Room is now available (includes every Sage benefit).",
  },
  keep_reading: { zh: "继续阅读", en: "Keep reading" },
  cancel: { zh: "取消", en: "Cancel" },
  retry: { zh: "重试", en: "Retry" },
  err_generic: {
    zh: "模拟支付失败，请重试。",
    en: "Simulated payment failed. Please retry.",
  },
  err_auth: {
    zh: "请先登录后再开通会员。",
    en: "Please sign in first before activating a membership.",
  },
  benefits: { zh: "包含", en: "Includes" },
  method_redemption: { zh: "兑换码", en: "Redemption code" },
} as const;

function pick(t: { zh: string; en: string }, lang: Lang) {
  return lang === "zh" ? t.zh : t.en;
}

export function MembershipCheckoutModal({
  targetTier,
  source,
  open,
  onClose,
  onSuccess,
  lang,
}: {
  targetTier: MembershipTierId;
  source: CheckoutSource;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  lang: Lang;
}) {
  void source; // kept for analytics attribution once wired in.
  const titleId = useId();
  const plan = MEMBERSHIP_PLANS[targetTier];
  const [method, setMethod] = useState<ExtendedMethod>("wechat");
  const [phase, setPhase] = useState<"idle" | "busy" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>("");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Reset when the modal (re)opens for a new target.
  useEffect(() => {
    if (!open) return;
    setMethod("wechat");
    setPhase("idle");
    setError(null);
    idempotencyKeyRef.current = newIdempotencyKey();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "busy") onClose();
    };
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
    };
    // phase intentionally excluded — Escape check reads current phase via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetTier, onClose]);

  const priceCny = useMemo(() => (plan.priceCents / 100).toFixed(2).replace(/\.00$/, ""), [plan]);

  const confirm = async () => {
    if (phase === "busy" || method === "redemption") return;
    setPhase("busy");
    setError(null);
    try {
      await simulateMockMembershipUpgrade({
        data: {
          targetTier,
          paymentMethod: method as MembershipPaymentMethod,
          idempotencyKey: idempotencyKeyRef.current,
        },
      });
      await refreshMembershipTier();
      setPhase("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not_authenticated|Unauthorized/i.test(msg)) {
        setError(pick(T.err_auth, lang));
      } else {
        setError(msg || pick(T.err_generic, lang));
      }
      setPhase("error");
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-end justify-center bg-obsidian/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
        onClick={() => (phase === "busy" ? undefined : onClose())}
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="membership-checkout-modal"
          data-target-tier={targetTier}
          data-phase={phase}
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
            disabled={phase === "busy"}
            aria-label={pick(T.cancel, lang)}
            className="absolute right-4 top-4 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust disabled:opacity-40"
          >
            ✕
          </button>

          <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
            {pick(targetTier === "sage" ? T.kicker_sage : T.kicker_oracle, lang)}
          </p>
          <h3 id={titleId} className="font-serif text-xl italic text-stone-warm md:text-2xl">
            {pick(plan.name, lang)}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-stone-warm/70">
            <span className="text-stone-warm/50">{pick(T.benefits, lang)}: </span>
            {pick(plan.benefits, lang)}
          </p>

          <div className="mt-4 flex items-baseline justify-between rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/60">
              {pick(plan.priceLabel, lang)}
            </span>
            <span className="font-serif text-2xl italic text-gold-light">¥{priceCny}</span>
          </div>

          <div
            data-testid="membership-checkout-test-badge"
            role="status"
            className="mt-4 rounded-full border border-amber-400/40 bg-amber-400/[0.08] px-3 py-1.5 text-center text-[11px] tracking-[0.08em] text-amber-200"
          >
            ⚠ {pick(T.test_badge, lang)}
          </div>

          {phase !== "success" && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [...MEMBERSHIP_PAYMENT_METHODS, "redemption"] as ExtendedMethod[]
                ).map((m) => {
                  const active = m === method;
                  const meta =
                    m === "redemption"
                      ? { glyph: "🎟", zh: T.method_redemption.zh, en: T.method_redemption.en }
                      : MEMBERSHIP_METHOD_LABELS[m as MembershipPaymentMethod];
                  return (
                    <button
                      key={m}
                      type="button"
                      data-testid={`membership-method-${m}`}
                      aria-pressed={active}
                      disabled={phase === "busy"}
                      onClick={() => setMethod(m)}
                      className={[
                        "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[11px] transition",
                        active
                          ? "border-gold-dust bg-gold-dust/[0.10] text-stone-warm"
                          : "border-white/10 bg-white/[0.02] text-stone-warm/70 hover:border-gold-dust/40",
                        phase === "busy" ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      <span aria-hidden className="text-lg">
                        {meta.glyph}
                      </span>
                      <span className="leading-tight [overflow-wrap:break-word]">
                        {pick({ zh: meta.zh, en: meta.en }, lang)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {method === "redemption" ? (
                <RedemptionCheckoutForm
                  lang={lang}
                  onSuccess={(res) => {
                    if (res.membership) setPhase("success");
                  }}
                  onClose={() => {
                    onSuccess?.();
                    onClose();
                  }}
                />
              ) : (
                <>
                  {error && (
                    <p
                      data-testid="membership-checkout-error"
                      role="alert"
                      className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={confirm}
                    disabled={phase === "busy"}
                    data-testid="membership-checkout-confirm"
                    className="mt-5 min-h-11 w-full rounded-full bg-gold-dust px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-60"
                  >
                    {phase === "busy"
                      ? pick(T.processing, lang)
                      : phase === "error"
                        ? pick(T.retry, lang)
                        : `${pick(T.confirm, lang)} · ¥${priceCny}`}
                  </button>
                </>
              )}
            </>
          )}

          {phase === "success" && (
            <div
              data-testid="membership-checkout-success"
              className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.08] p-5 text-center"
            >
              <p className="font-serif text-lg italic text-emerald-100">
                ✓ {pick(T.success_title, lang)}
              </p>
              <p className="mt-2 text-xs text-stone-warm/75">
                {pick(targetTier === "oracle" ? T.success_hint_oracle : T.success_hint_sage, lang)}
              </p>
              <button
                type="button"
                onClick={() => {
                  onSuccess?.();
                  onClose();
                }}
                data-testid="membership-checkout-keep-reading"
                className="mt-4 min-h-11 rounded-full bg-gold-dust px-6 py-2 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
              >
                {pick(T.keep_reading, lang)}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
