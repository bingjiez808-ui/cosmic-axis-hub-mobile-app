import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/i18n";

type Step = "email" | "sent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Enter the Library — Sign in · Library of Destiny" },
      { name: "description", content: "Sign in with a magic email link or Google to save your readings and join the 同门 circle." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { lang } = useLang();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Detect callback errors from magic-link (expired/invalid) in URL hash.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && /error/i.test(hash)) {
      setLinkError(true);
      // Strip so refresh doesn't repeat.
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const getPostAuthDestination = async () => {
    if (search.redirect) return search.redirect;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return "/";
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return data ? "/admin" : "/";
  };

  // If already signed in (existing session or magic-link session just established), bounce away.
  useEffect(() => {
    let cancelled = false;
    const bounce = () => {
      getPostAuthDestination().then((to) => {
        if (!cancelled) navigate({ to: to as never });
      });
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) bounce();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) bounce();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, search.redirect]);

  const zh = lang === "zh";
  const t = {
    kicker: zh ? "灯下入席" : "By candlelight",
    title:
      step === "sent"
        ? zh ? "登录链接已寄出" : "Check your inbox"
        : zh ? "重返图书馆" : "Return to the library",
    email: zh ? "邮箱" : "Email",
    sendLink: zh ? "寄出登录链接" : "Send magic link",
    resend: zh ? "重新寄出登录链接" : "Resend magic link",
    changeEmail: zh ? "修改邮箱" : "Change email",
    google: zh ? "以 Google 之名入席" : "Continue with Google",
    or: zh ? "或" : "or",
    sentHint: (addr: string) =>
      zh
        ? `登录链接已发送至 ${addr}。请打开邮箱（含垃圾箱）并点击链接完成登录。`
        : `A sign-in link has been sent to ${addr}. Open your inbox (including spam) and click the link to finish signing in.`,
    invalidEmail: zh ? "请输入有效邮箱。" : "Please enter a valid email.",
    sendError: zh ? "邮件发送失败，请稍后再试。" : "Could not send the link. Please try again later.",
    linkExpired: zh
      ? "该登录链接无效或已过期，请重新寄出一封。"
      : "That sign-in link is invalid or expired. Please request a new one.",
  };

  async function onGoogle() {
    setBusy(true);
    const redirectParam = search.redirect ? `?redirect=${encodeURIComponent(search.redirect)}` : "";
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth${redirectParam}`,
    });
    if (res && "error" in res && res.error) {
      toast.error(t.sendError);
    }
    setBusy(false);
  }

  async function sendMagicLink(addr: string) {
    const redirectParam = search.redirect ? `?redirect=${encodeURIComponent(search.redirect)}` : "";
    await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth${redirectParam}`,
      },
    });
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr) || addr.length > 254) {
      toast.error(t.invalidEmail);
      return;
    }
    setBusy(true);
    setLinkError(false);
    try {
      await sendMagicLink(addr);
    } catch {
      // Keep messaging neutral — never disclose whether the address is registered.
    }
    toast.success(t.sentHint(addr));
    setEmail(addr);
    setStep("sent");
    setCooldown(60);
    setBusy(false);
  }

  async function onResend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    try {
      await sendMagicLink(email.trim().toLowerCase());
    } catch {
      // Ignore — keep messaging neutral.
    }
    toast.success(t.sentHint(email));
    setCooldown(60);
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-16">
      <div className="glass-card w-full max-w-md rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">{t.kicker}</p>
        <h1 className="mt-3 font-serif text-3xl italic text-stone-warm">{t.title}</h1>

        {linkError && step === "email" && (
          <p className="mt-6 rounded-lg border border-red-400/30 bg-red-500/5 px-4 py-3 text-xs text-red-200/90">
            {t.linkExpired}
          </p>
        )}

        {step === "email" && (
          <>
            <button
              type="button"
              onClick={onGoogle}
              disabled={busy}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-gold-dust/40 px-5 py-3 text-xs uppercase tracking-[0.28em] text-gold-light transition-colors hover:bg-gold-dust/10 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {t.google}
            </button>

            <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
              <div className="h-px flex-1 bg-white/10" />
              {t.or}
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={onSend} className="space-y-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder={t.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 text-base text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || cooldown > 0}
                className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                {cooldown > 0 ? `${cooldown}s` : t.sendLink}
              </button>
            </form>
          </>
        )}

        {step === "sent" && (
          <>
            <p className="mt-6 mb-4 text-sm leading-relaxed text-stone-warm/70">{t.sentHint(email)}</p>
            <div className="mt-6 flex flex-col items-center gap-3 text-[11px] text-stone-warm/60">
              <button
                type="button"
                onClick={onResend}
                disabled={busy || cooldown > 0}
                className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10 disabled:opacity-40"
              >
                {cooldown > 0 ? `${cooldown}s` : t.resend}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                }}
                className="hover:text-gold-dust"
              >
                {t.changeEmail}
              </button>
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <Link to="/" className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/40 hover:text-gold-dust">
            ← {zh ? "回到大厅" : "back to the hall"}
          </Link>
        </div>
      </div>
    </div>
  );
}
