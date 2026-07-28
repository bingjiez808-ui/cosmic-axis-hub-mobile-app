/**
 * Client-side social-consent gate. See src/lib/i18n-daily.ts for copy.
 */
import { useEffect, useState } from "react";

import { useDaily } from "@/lib/i18n-daily";
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
  gated: boolean;
  confirmAge: () => void;
  ackPrivacy: () => void;
  revokeAll: () => void;
} {
  // Lazy initializer reads localStorage on the first render. Every caller
  // lives under `/_authenticated` which is `ssr: false`, so this is
  // client-only and there is no hydration mismatch to worry about. This
  // avoids a visible flip between the "not consented" gate and the
  // "confirmed" banner on every route mount.
  const [state, setState] = useState<SocialConsent>(() => readSocialConsent());

  useEffect(() => {
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

// SOCIAL_MIN_AGE is referenced through the localized dict — keep the import
// in the copy layer, not this file. Re-export for external callers who
// still expect it from here.
export { SOCIAL_MIN_AGE };

export function SocialConsentGate({ onConfirm }: { onConfirm?: () => void }) {
  const d = useDaily();
  const { state, gated, confirmAge, ackPrivacy, revokeAll } = useSocialConsent();

  if (gated) {
    return (
      <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/5 p-4 text-xs text-emerald-100/80">
        <div className="flex items-center justify-between gap-3">
          <span>{d.consent_confirmed}</span>
          <button
            type="button"
            onClick={() => {
              revokeAll();
              onConfirm?.();
            }}
            className="whitespace-nowrap rounded-full border border-rose-400/40 px-3 py-1 text-rose-200 hover:bg-rose-500/10"
          >
            {d.consent_revoke}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-500/5 p-5 text-sm">
      <div className="text-xs uppercase tracking-widest text-amber-200/80">{d.consent_prompt}</div>
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
            {d.consent_age_label}
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
            {d.consent_privacy_label}
          </label>
        </li>
      </ul>
      <div className="mt-3 text-xs text-amber-200/60">{d.consent_footer}</div>
    </div>
  );
}
