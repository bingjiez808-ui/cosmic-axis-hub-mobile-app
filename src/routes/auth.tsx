import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/i18n";

type Step = "email" | "otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Enter the Library — Sign in · Library of Destiny" },
      { name: "description", content: "Sign in with a one-time email code or Google to save your readings and join the 同门 circle." },
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
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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

  // If already signed in, bounce away.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      getPostAuthDestination().then((to) => {
        if (!cancelled) navigate({ to: to as never });
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, search.redirect]);

  const zh = lang === "zh";
  const t = {
    kicker: zh ? "灯下入席" : "By candlelight",
    title:
      step === "otp"
        ? zh ? "查收验证码" : "Check your inbox"
        : zh ? "重返图书馆" : "Return to the library",
    email: zh ? "邮箱" : "Email",
    otp: zh ? "六位验证码" : "6-digit code",
    sendCode: zh ? "寄出验证码" : "Send code",
    verify: zh ? "验证并入席" : "Verify · sign in",
    resend: zh ? "重新寄出验证码" : "Resend code",
    changeEmail: zh ? "修改邮箱" : "Change email",
    google: zh ? "以 Google 之名入席" : "Continue with Google",
    or: zh ? "或" : "or",
    otpHint: (addr: string) =>
      zh
        ? `我们已向 ${addr} 寄出一封含 6 位验证码的信，请查收邮箱（含垃圾箱）。`
        : `We sent a 6-digit code to ${addr}. Please check your inbox (and spam).`,
    invalidEmail: zh ? "请输入有效邮箱。" : "Please enter a valid email.",
    invalidOtp: zh ? "请输入 6 位数字验证码。" : "Please enter the 6-digit code.",
    sendError: zh ? "邮件发送失败，请稍后再试。" : "Could not send the code. Please try again later.",
    verifyError: zh ? "验证码无效或已过期，请重试或重新寄出。" : "Code is invalid or expired. Please try again or resend.",
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

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr) || addr.length > 254) {
      toast.error(t.invalidEmail);
      return;
    }
    setBusy(true);
    try {
      await supabase.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: true },
      });
      // Neutral: always show the same success state, regardless of whether
      // the address is registered or the send actually succeeded.
      toast.success(t.otpHint(addr));
      setEmail(addr);
      setStep("otp");
      setCooldown(60);
    } catch {
      toast.success(t.otpHint(addr));
      setStep("otp");
      setCooldown(60);
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error(t.invalidOtp);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (error || !data.session) {
        toast.error(t.verifyError);
        return;
      }
      toast.success(zh ? "入席成功" : "Welcome");
      const to = await getPostAuthDestination();
      navigate({ to: to as never });
    } catch {
      toast.error(t.verifyError);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    try {
      await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
    } catch {
      // Ignore — keep messaging neutral.
    }
    toast.success(t.otpHint(email));
    setCooldown(60);
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-16">
      <div className="glass-card w-full max-w-md rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">{t.kicker}</p>
        <h1 className="mt-3 font-serif text-3xl italic text-stone-warm">{t.title}</h1>

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

            <form onSubmit={onSendCode} className="space-y-3">
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
                {cooldown > 0 ? `${cooldown}s` : t.sendCode}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <p className="mt-6 mb-4 text-xs text-stone-warm/60">{t.otpHint(email)}</p>
            <form onSubmit={onVerify} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder={t.otp}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 text-center text-lg tracking-[0.5em] text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                {t.verify}
              </button>
            </form>
            <div className="mt-6 flex flex-col items-center gap-2 text-[11px] text-stone-warm/60">
              <button
                type="button"
                onClick={onResend}
                disabled={busy || cooldown > 0}
                className="hover:text-gold-dust disabled:opacity-40"
              >
                {cooldown > 0 ? `${cooldown}s` : t.resend}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtp("");
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
