import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/i18n";

type Step = "email" | "sent";
type Mode = "login" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// TODO(wechat-login): A real WeChat QR sign-in requires an approved
// WeChat Open Platform AppID + AppSecret and a filed/verifiable callback
// domain. Do not surface a WeChat button before those credentials exist —
// showing one earlier would mislead users into thinking sign-in works.

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Enter the Library — Sign in · Library of Destiny" },
      { name: "description", content: "Sign in or create an account with an email magic link or Google to save your readings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
    mode: s.mode === "signup" ? ("signup" as const) : s.mode === "login" ? ("login" as const) : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { lang } = useLang();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode === "signup" ? "signup" : "login");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    if (search.mode === "signup") setMode("signup");
    else if (search.mode === "login") setMode("login");
  }, [search.mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && /error/i.test(hash)) {
      setLinkError(true);
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
  const isSignup = mode === "signup";

  const tabLogin = zh ? "登录" : "Sign in";
  const tabSignup = zh ? "注册" : "Create account";

  const t = {
    kicker: zh ? "灯下入席" : "By candlelight",
    title:
      step === "sent"
        ? zh ? "邮件已寄出" : "Check your inbox"
        : isSignup
          ? zh ? "创建你的图书馆账号" : "Create your library account"
          : zh ? "重返图书馆" : "Return to the library",
    email: zh ? "邮箱" : "Email",
    sendSignup: zh ? "发送注册验证邮件" : "Send verification email",
    sendLogin: zh ? "发送登录链接" : "Send magic link",
    resend: zh ? "重新寄出" : "Resend email",
    changeEmail: zh ? "修改邮箱" : "Change email",
    googleSignup: zh ? "使用 Google 注册" : "Continue with Google",
    googleLogin: zh ? "使用 Google 登录" : "Continue with Google",
    googleNote: zh
      ? "首次使用 Google 会自动创建账号；已有账号则直接登录。"
      : "First-time Google users get an account created automatically. Returning users are signed straight in.",
    or: zh ? "或" : "or",
    sentSignup: (addr: string) =>
      zh
        ? `验证邮件已发送至 ${addr}。请打开邮箱（含垃圾箱）并点击链接完成邮箱验证——验证成功后即完成注册并自动登录。`
        : `A verification email has been sent to ${addr}. Open your inbox (including spam) and click the link to verify your email — once verified you'll be signed in automatically.`,
    sentLogin: (addr: string) =>
      zh
        ? `登录链接已发送至 ${addr}。请打开邮箱（含垃圾箱）并点击链接完成登录。`
        : `A sign-in link has been sent to ${addr}. Open your inbox (including spam) and click the link to finish signing in.`,
    invalidEmail: zh ? "请输入有效邮箱。" : "Please enter a valid email.",
    sendError: zh ? "邮件发送失败，请稍后再试。" : "Could not send the email. Please try again later.",
    linkExpired: zh ? "该链接无效或已过期，请重新寄出一封。" : "That link is invalid or expired. Please request a new one.",
    needAgree: zh ? "请先同意《服务条款》与《隐私政策》。" : "Please accept the Terms of Service and Privacy Policy first.",
    tosPrefix: zh ? "我已阅读并同意 " : "I have read and agree to the ",
    tosMid: zh ? " 与 " : " and ",
    tos: zh ? "服务条款" : "Terms of Service",
    privacy: zh ? "隐私政策" : "Privacy Policy",
    switchToLoginHint: zh ? "已有账号？" : "Already have an account?",
    switchToSignupHint: zh ? "还没有账号？" : "New here?",
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("email");
    setLinkError(false);
    navigate({
      to: "/auth",
      search: { redirect: search.redirect, mode: m } as never,
      replace: true,
    });
  };

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    const redirectParam = search.redirect ? `?redirect=${encodeURIComponent(search.redirect)}` : "";
    try {
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth${redirectParam}`,
      });
      if (res && "error" in res && res.error) {
        toast.error(t.sendError);
      }
    } catch {
      toast.error(t.sendError);
    }
    setBusy(false);
  }

  async function sendEmailLink(addr: string, forSignup: boolean) {
    const redirectParam = search.redirect ? `?redirect=${encodeURIComponent(search.redirect)}` : "";
    await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        shouldCreateUser: forSignup,
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
    if (isSignup && !agreed) {
      toast.error(t.needAgree);
      return;
    }
    setBusy(true);
    setLinkError(false);
    try {
      await sendEmailLink(addr, isSignup);
    } catch {
      // Keep messaging neutral — never disclose whether the address is registered.
    }
    toast.success(isSignup ? t.sentSignup(addr) : t.sentLogin(addr));
    setEmail(addr);
    setStep("sent");
    setCooldown(60);
    setBusy(false);
  }

  async function onResend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    try {
      await sendEmailLink(email.trim().toLowerCase(), isSignup);
    } catch {
      // ignore — neutral messaging
    }
    toast.success(isSignup ? t.sentSignup(email) : t.sentLogin(email));
    setCooldown(60);
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-16">
      <div className="glass-card w-full max-w-md rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">{t.kicker}</p>
        <h1 className="mt-3 font-serif text-3xl italic text-stone-warm">{t.title}</h1>

        {/* Tabs */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 p-1 text-[10px] uppercase tracking-[0.28em]">
          {([
            ["login", tabLogin],
            ["signup", tabSignup],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={`min-h-10 rounded-full px-3 py-2 transition-colors ${
                mode === m
                  ? "bg-gold-dust text-obsidian"
                  : "text-stone-warm/60 hover:text-gold-dust"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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
              {isSignup ? t.googleSignup : t.googleLogin}
            </button>
            <p className="mt-2 text-center text-[10px] leading-relaxed tracking-normal text-stone-warm/45">
              {t.googleNote}
            </p>

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
              {isSignup && (
                <label className="flex items-start gap-2 text-[11px] leading-relaxed text-stone-warm/70">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-none accent-gold-dust"
                  />
                  <span>
                    {t.tosPrefix}
                    <Link to="/terms" className="underline decoration-gold-dust/60 hover:text-gold-dust" target="_blank">
                      《{t.tos}》
                    </Link>
                    {t.tosMid}
                    <Link to="/privacy" className="underline decoration-gold-dust/60 hover:text-gold-dust" target="_blank">
                      《{t.privacy}》
                    </Link>
                    。
                  </span>
                </label>
              )}
              <button
                type="submit"
                disabled={busy || cooldown > 0 || (isSignup && !agreed)}
                className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-50"
              >
                {cooldown > 0 ? `${cooldown}s` : isSignup ? t.sendSignup : t.sendLogin}
              </button>
            </form>

            <p className="mt-6 text-center text-[11px] tracking-normal text-stone-warm/50">
              {isSignup ? t.switchToLoginHint : t.switchToSignupHint}{" "}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "login" : "signup")}
                className="text-gold-dust hover:text-gold-light"
              >
                {isSignup ? tabLogin : tabSignup}
              </button>
            </p>
          </>
        )}

        {step === "sent" && (
          <>
            <p className="mt-6 mb-4 text-sm leading-relaxed text-stone-warm/70">
              {isSignup ? t.sentSignup(email) : t.sentLogin(email)}
            </p>
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
                onClick={() => setStep("email")}
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
