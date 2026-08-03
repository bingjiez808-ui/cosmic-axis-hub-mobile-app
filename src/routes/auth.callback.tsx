import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { getAuthRedirectUrl, sanitizeNextPath } from "@/lib/site-url";

type Status = "processing" | "verified" | "session" | "error";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Verifying — Library of Destiny" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => {
    const next = typeof s.next === "string" ? sanitizeNextPath(s.next) : undefined;
    const code = typeof s.code === "string" ? s.code : undefined;
    const error = typeof s.error === "string" ? s.error : undefined;
    const error_description =
      typeof s.error_description === "string" ? s.error_description : undefined;
    return {
      ...(next ? { next } : {}),
      ...(code ? { code } : {}),
      ...(error ? { error } : {}),
      ...(error_description ? { error_description } : {}),
    };
  },
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("processing");
  const [detail, setDetail] = useState<string>("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        const hash = window.location.hash || "";

        // 1) OAuth / magic-link error surfaced in query or hash.
        const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
        const errParam =
          search.error || url.searchParams.get("error") || hashParams.get("error");
        const errDesc =
          search.error_description ||
          url.searchParams.get("error_description") ||
          hashParams.get("error_description");
        if (errParam) {
          if (!cancelled) {
            setStatus("error");
            setDetail(errDesc || errParam);
          }
          return;
        }

        // 2) PKCE code exchange (?code=...)
        const code = search.code || url.searchParams.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (!cancelled) {
              setStatus("error");
              setDetail(error.message);
            }
            return;
          }
          if (data.session) {
            if (!cancelled) setStatus("session");
            proceed();
            return;
          }
        }

        // 3) Legacy hash tokens (#access_token=…&refresh_token=…) — the
        // Supabase client picks these up automatically with
        // detectSessionInUrl=true (default). Give it a tick, then check.
        if (hash.includes("access_token") || hash.includes("refresh_token")) {
          await new Promise((r) => setTimeout(r, 200));
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (!cancelled) setStatus("session");
            proceed();
            return;
          }
        }

        // 4) Recovery hash — hand off to /auth/reset which listens for
        // PASSWORD_RECOVERY events.
        if (hash.includes("type=recovery")) {
          window.location.replace(`/auth/reset${hash}`);
          return;
        }

        // 5) No code, no tokens, no error. If we already have a session
        // (browser was signed in in another tab, or Supabase parsed the
        // hash), proceed. Otherwise show "email verified, please sign in".
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          if (data.session) {
            setStatus("session");
            proceed();
          } else {
            setStatus("verified");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setDetail(e instanceof Error ? e.message : String(e));
        }
      }
    }

    function proceed() {
      const next = search.next || "/me/home";
      // include=hash safe: strip any lingering hash by using assign to a
      // clean path.
      setTimeout(() => {
        if (next.includes("#") || next.includes("?")) window.location.assign(next);
        else navigate({ to: next as never });
      }, 300);
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onResend() {
    const addr = resendEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return;
    if (cooldown > 0 || resendBusy) return;
    setResendBusy(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email: addr,
        options: { emailRedirectTo: getAuthRedirectUrl(search.next) },
      });
    } catch {
      /* neutral */
    }
    setCooldown(60);
    setResendBusy(false);
  }

  const t = {
    processing: zh ? "正在完成验证…" : "Completing verification…",
    verifiedTitle: zh ? "邮箱已验证" : "Email verified",
    verifiedBody: zh
      ? "请返回登录页，使用你的邮箱和密码进入命运图书馆。"
      : "Please return to the sign-in page and use your email and password to enter.",
    goSignIn: zh ? "返回登录" : "Back to sign in",
    signedInTitle: zh ? "登录成功，正在带你回到图书馆…" : "Signed in — taking you back in…",
    errorTitle: zh ? "验证失败" : "Verification failed",
    errorHint: zh
      ? "链接可能已过期或被使用过。你可以重新发送验证邮件。"
      : "The link may have expired or already been used. You can request a new verification email.",
    emailLabel: zh ? "重新发送到" : "Resend to",
    resend: zh ? "重新发送" : "Resend email",
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-16">
      <div className="glass-card w-full max-w-md rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        {status === "processing" && (
          <p className="text-center text-sm text-stone-warm/80">{t.processing}</p>
        )}
        {status === "session" && (
          <p className="text-center text-sm text-stone-warm/80">{t.signedInTitle}</p>
        )}
        {status === "verified" && (
          <>
            <h1 className="font-serif text-3xl italic text-stone-warm">{t.verifiedTitle}</h1>
            <p className="mt-3 text-sm text-stone-warm/70">{t.verifiedBody}</p>
            <a
              href={`/auth?mode=login${search.next ? `&redirect=${encodeURIComponent(search.next)}` : ""}`}
              className="mt-6 inline-block rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
            >
              {t.goSignIn}
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="font-serif text-3xl italic text-stone-warm">{t.errorTitle}</h1>
            <p className="mt-3 text-sm text-stone-warm/70">{t.errorHint}</p>
            {detail && (
              <p className="mt-2 rounded-lg border border-red-400/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-200/80">
                {detail}
              </p>
            )}
            <div className="mt-6 space-y-3">
              <label className="block text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                {t.emailLabel}
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 text-base text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
              />
              <button
                type="button"
                onClick={onResend}
                disabled={resendBusy || cooldown > 0}
                className="w-full rounded-full border border-gold-dust/40 px-5 py-3 text-xs uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10 disabled:opacity-40"
              >
                {cooldown > 0 ? `${cooldown}s` : t.resend}
              </button>
              <a
                href="/auth?mode=login"
                className="block text-center text-[11px] text-stone-warm/60 hover:text-gold-dust"
              >
                {t.goSignIn}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
