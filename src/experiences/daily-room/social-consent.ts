/**
 * Client-side social-consent gate.
 *
 * Persists two flags in localStorage under a stable key:
 *  - age_confirmed_18: user has attested they are ≥ SOCIAL_MIN_AGE (18).
 *  - privacy_ack: user has read and accepted the privacy/consent notice
 *    for pair-matching (i.e. their chart data being combined with a
 *    peer's for a bilateral interaction reading).
 *
 * Both must be true before any friend-request send / match-request send /
 * match reveal is allowed. Revoking either flag invalidates any active
 * match result on the same device (the /me/match page reads this and
 * flips its result panel to "revoked").
 *
 * This is a preview/demo gate. It is NOT a substitute for a real KYC
 * flow. Real production consent must be recorded server-side.
 */
import { useEffect, useState } from "react";

import { SOCIAL_MIN_AGE } from "@/lib/social-gates";

const KEY = "fn.social.consent.v1";

export type SocialConsent = {
  ageConfirmed: boolean;
  privacyAck: boolean;
  updatedAt: number | null;
};

const EMPTY: SocialConsent = { ageConfirmed: false, privacyAck: false, updatedAt: null };

export function readSocialConsent(): SocialConsent {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SocialConsent>;
    return {
      ageConfirmed: !!parsed.ageConfirmed,
      privacyAck: !!parsed.privacyAck,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : null,
    };
  } catch {
    return EMPTY;
  }
}

export function writeSocialConsent(next: SocialConsent): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("fn:social-consent-changed"));
}

export function useSocialConsent(): {
  state: SocialConsent;
  gated: boolean; // true when user is ALLOWED to enter social features
  confirmAge: () => void;
  ackPrivacy: () => void;
  revokeAll: () => void;
} {
  const [state, setState] = useState<SocialConsent>(EMPTY);

  useEffect(() => {
    setState(readSocialConsent());
    const handler = () => setState(readSocialConsent());
    window.addEventListener("fn:social-consent-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("fn:social-consent-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const gated = state.ageConfirmed && state.privacyAck;

  return {
    state,
    gated,
    confirmAge: () =>
      writeSocialConsent({ ...state, ageConfirmed: true, updatedAt: Date.now() }),
    ackPrivacy: () =>
      writeSocialConsent({ ...state, privacyAck: true, updatedAt: Date.now() }),
    revokeAll: () =>
      writeSocialConsent({ ageConfirmed: false, privacyAck: false, updatedAt: Date.now() }),
  };
}

export function SocialConsentGate({
  onConfirm,
}: {
  onConfirm?: () => void;
}) {
  const { state, gated, confirmAge, ackPrivacy, revokeAll } = useSocialConsent();

  if (gated) {
    return (
      <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/80">
        <div className="flex items-center justify-between gap-3">
          <span>
            已确认年龄 ≥ {SOCIAL_MIN_AGE} · 已阅读并接受隐私与匹配授权。撤回后好友与匹配立即锁定。
          </span>
          <button
            type="button"
            onClick={() => {
              revokeAll();
              onConfirm?.();
            }}
            className="whitespace-nowrap rounded-full border border-rose-400/40 px-3 py-1 text-rose-200 hover:bg-rose-500/10"
          >
            撤回同意
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-500/5 p-5 text-sm">
      <div className="text-xs uppercase tracking-widest text-amber-200/80">
        进入好友与匹配前，请确认以下内容
      </div>
      <ul className="mt-3 space-y-3">
        <li className="flex items-start gap-3">
          <input
            id="age-confirm"
            type="checkbox"
            checked={state.ageConfirmed}
            onChange={(e) => {
              if (e.target.checked) confirmAge();
            }}
            className="mt-1 h-4 w-4 accent-amber-400"
          />
          <label htmlFor="age-confirm" className="text-amber-100/90">
            我已年满 {SOCIAL_MIN_AGE} 周岁。未成年人不参与任何双方匹配。
          </label>
        </li>
        <li className="flex items-start gap-3">
          <input
            id="privacy-ack"
            type="checkbox"
            checked={state.privacyAck}
            onChange={(e) => {
              if (e.target.checked) ackPrivacy();
            }}
            className="mt-1 h-4 w-4 accent-amber-400"
          />
          <label htmlFor="privacy-ack" className="text-amber-100/90">
            我已阅读隐私说明：匹配需双方各自选择命盘并明确同意；任一方撤回，结果立即失效并不可再次读取。
            互动适配指数不是关系成功率、婚姻或命运判定。
          </label>
        </li>
      </ul>
      {!gated && (
        <div className="mt-3 text-xs text-amber-200/60">
          两项都勾选后才能发起邀请或授权匹配。撤回同意会关闭访问。
        </div>
      )}
    </div>
  );
}
