/**
 * ReplyCreditCheckoutModal — the checkout surface for topping up reply
 * chances in 【同门】(sage replies / librarian-authorised human replies).
 *
 * It mirrors MembershipCheckoutModal: same payment-method grid
 * (WeChat / Alipay / Visa / UnionPay), same visual language, same
 * idempotency-key lock, same simulated-payment banner. On success it
 * calls back so the grants page can refresh balances in place.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

import type { Lang } from "@/lib/i18n";
import {
  MEMBERSHIP_METHOD_LABELS,
  MEMBERSHIP_PAYMENT_METHODS,
  newIdempotencyKey,
  type MembershipPaymentMethod,
} from "@/lib/membership-plans";
import { useModalA11y } from "@/lib/use-modal-a11y";

export type CreditBucket = "sage" | "human";
export type CreditPack = "single" | "quad";

export const REPLY_CREDIT_PACKS: Record<
  CreditPack,
  { priceCents: number; count: number; label: { zh: string; en: string } }
> = {
  single: { priceCents: 300, count: 1, label: { zh: "3 元 · 1 次", en: "¥3 · 1 reply" } },
  quad: { priceCents: 1000, count: 4, label: { zh: "10 元 · 4 次", en: "¥10 · 4 replies" } },
};

const T = {
  kicker: { zh: "加购回信次数", en: "Top up reply chances" },
  title: { zh: "选择支付方式", en: "Choose a payment method" },
  test_badge: { zh: "模拟支付，不会真实扣款", en: "Simulated payment — no real charge" },
  confirm: { zh: "确认支付", en: "Confirm payment" },
  processing: { zh: "处理中…", en: "Processing…" },
  success: { zh: "已到账", en: "Added" },
  close: { zh: "完成", en: "Done" },
  cancel: { zh: "取消", en: "Cancel" },
  retry: { zh: "重试", en: "Retry" },
  bucket_sage: { zh: "先贤回信", en: "Sage reply" },
  bucket_human: { zh: "管理员授权（真人回信）", en: "Librarian-authorised reply" },
  desc_sage: {
    zh: "由一位历代先贤，以其本领与口吻亲笔回信。",
    en: "A historical sage answers you in their own voice and craft.",
  },
  desc_human: {
    zh: "图书管理员亲自回信，或由他委托的旅者定向匿名回信。",
    en: "The librarian replies in person, or entrusts a traveler to answer anonymously.",
  },
} as const;

function pick(t: { zh: string; en: string }, lang: Lang) {
  return lang === "zh" ? t.zh : t.en;
}

export function ReplyCreditCheckoutModal({
  open,
  bucket,
  pack,
  lang,
  onClose,
  onConfirm,
}: {
  open: boolean;
  bucket: CreditBucket;
  pack: CreditPack;
  lang: Lang;
  onClose: () => void;
  onConfirm: (input: {
    bucket: CreditBucket;
    pack: CreditPack;
    paymentMethod: MembershipPaymentMethod;
    idempotencyKey: string;
  }) => Promise<void>;
}) {
  const titleId = useId();
  const [method, setMethod] = useState<MembershipPaymentMethod>("wechat");
  const [phase, setPhase] = useState<"idle" | "busy" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef("");
  const dialogRef = useModalA11y<HTMLDivElement>({
    open,
    onClose,
    closeOnEscape: phase !== "busy",
  });

  useEffect(() => {
    if (!open) return;
    setMethod("wechat");
    setPhase("idle");
    setError(null);
    keyRef.current = newIdempotencyKey();
  }, [open, bucket, pack]);

  if (!open) return null;

  const spec = REPLY_CREDIT_PACKS[pack];
  const price = (spec.priceCents / 100).toFixed(2).replace(/\.00$/, "");

  const confirm = async () => {
    if (phase === "busy") return;
    setPhase("busy");
    setError(null);
    try {
      await onConfirm({ bucket, pack, paymentMethod: method, idempotencyKey: keyRef.current });
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  };

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
          data-testid="reply-credit-checkout-modal"
          data-bucket={bucket}
          data-pack={pack}
          data-phase={phase}
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="glass-card relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl p-6 focus:outline-none sm:max-w-md sm:rounded-3xl sm:p-8"
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
            {pick(T.kicker, lang)}
          </p>
          <h3 id={titleId} className="font-serif text-xl italic text-stone-warm md:text-2xl">
            {pick(bucket === "sage" ? T.bucket_sage : T.bucket_human, lang)}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-stone-warm/70">
            {pick(bucket === "sage" ? T.desc_sage : T.desc_human, lang)}
          </p>

          <div className="mt-4 flex items-baseline justify-between rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] px-4 py-3">
            <span className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/60">
              {pick(spec.label, lang)}
            </span>
            <span className="font-serif text-2xl italic text-gold-light">¥{price}</span>
          </div>

          <div
            role="status"
            data-testid="reply-credit-test-badge"
            className="mt-4 rounded-full border border-amber-400/40 bg-amber-400/[0.08] px-3 py-1.5 text-center text-[11px] tracking-[0.08em] text-amber-200"
          >
            ⚠ {pick(T.test_badge, lang)}
          </div>

          {phase !== "success" ? (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEMBERSHIP_PAYMENT_METHODS.map((m) => {
                  const active = m === method;
                  const meta = MEMBERSHIP_METHOD_LABELS[m];
                  return (
                    <button
                      key={m}
                      type="button"
                      data-testid={`reply-credit-method-${m}`}
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

              {error ? (
                <p
                  role="alert"
                  data-testid="reply-credit-error"
                  className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void confirm()}
                disabled={phase === "busy"}
                data-testid="reply-credit-confirm"
                className="mt-5 min-h-11 w-full rounded-full bg-gold-dust px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-60"
              >
                {phase === "busy"
                  ? pick(T.processing, lang)
                  : phase === "error"
                    ? pick(T.retry, lang)
                    : `${pick(T.confirm, lang)} · ¥${price}`}
              </button>
            </>
          ) : (
            <div
              data-testid="reply-credit-success"
              className="mt-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.08] p-5 text-center"
            >
              <p className="font-serif text-lg italic text-emerald-100">
                ✓ {pick(T.success, lang)} · {spec.count}
              </p>
              <button
                type="button"
                onClick={onClose}
                data-testid="reply-credit-done"
                className="mt-4 min-h-11 rounded-full bg-gold-dust px-6 py-2 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
              >
                {pick(T.close, lang)}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
