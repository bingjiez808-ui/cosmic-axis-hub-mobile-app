import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/i18n";

type Mode = "login" | "signup";
type SignupStage = "form" | "sent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// TODO(wechat-login): A real WeChat QR sign-in requires an approved
// WeChat Open Platform AppID + AppSecret and a filed/verifiable callback
// domain. Do not surface a WeChat button before those credentials exist.

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Enter the Library — Sign in · Library of Destiny" },
      { name: "description", content: "Sign in or create an account to save your readings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
    mode: s.mode === "signup" ? ("signup" as const) : s.mode === "login" ? ("login" as const) : undefined,
    verified: s.verified === "1" ? ("1" as const) : undefined,
  }),
  component: AuthPage,
});

type PasswordRule = { id: string; ok: boolean; labelEn: string; labelZh: string };

function evaluatePassword(pw: string): PasswordRule[] {
  return [
    { id: "len", ok: pw.length >= 8, labelEn: "At least 8 characters", labelZh: "至少 8 个字符" },
    { id: "upper", ok: /[A-Z]/.test(pw), labelEn: "One uppercase letter", labelZh: "至少 1 个大写字母" },
    { id: "lower", ok: /[a-z]/.test(pw), labelEn: "One lowercase letter", labelZh: "至少 1 个小写字母" },
    { id: "digit", ok: /\d/.test(pw), labelEn: "One number", labelZh: "至少 1 个数字" },
    { id: "special", ok: /[^A-Za-z0-9]/.test(pw), labelEn: "One special character", labelZh: "至少 1 个特殊字符" },
  ];
}

function AuthPage() {
  const { lang } = useLang();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const zh = lang === "zh";

  const [mode, setMode] = useState<Mode>(search.mode === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [signupStage, setSignupStage] = useState<SignupStage>("form");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [sentAddress, setSentAddress] = useState("");

  useEffect(() => {
    if (search.mode === "signup") setMode("signup");
    else if (search.mode === "login") setMode("login");
  }, [search.mode]);

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

  const isSignup = mode === "signup";
  const pwRules = useMemo(() => evaluatePassword(password), [password]);
  const pwValid = pwRules.every((r) => r.ok);
  const confirmValid = password.length > 0 && confirm === password;

  const t = {
    kicker: zh ? "灯下入席" : "By candlelight",
    tabLogin: zh ? "登录" : "Sign in",
    tabSignup: zh ? "注册" : "Create account",
    title: isSignup
      ? zh ? "创建你的图书馆账号" : "Create your library account"
      : zh ? "重返图书馆" : "Return to the library",
    email: zh ? "邮箱" : "Email",
    password: zh ? "密码" : "Password",
    confirm: zh ? "确认密码" : "Confirm password",
    show: zh ? "显示" : "Show",
    hide: zh ? "隐藏" : "Hide",
    submitSignup: zh ? "创建账号" : "Create account",
    submitLogin: zh ? "登录" : "Sign in",
    forgot: zh ? "忘记密码？" : "Forgot your password?",
    googleSignup: zh ? "使用 Google 注册" : "Continue with Google",
    googleLogin: zh ? "使用 Google 登录" : "Continue with Google",
    googleNote: zh
      ? "首次使用 Google 会自动创建账号；已有账号则直接登录。"
      : "First-time Google users get an account created automatically. Returning users are signed in.",
    or: zh ? "或" : "or",
    invalidEmail: zh ? "请输入有效邮箱。" : "Please enter a valid email.",
    weakPassword: zh ? "密码不符合要求。" : "Password does not meet the requirements.",
    mismatch: zh ? "两次输入的密码不一致。" : "Passwords do not match.",
    needAgree: zh ? "请先同意《服务条款》与《隐私政策》。" : "Please accept the Terms of Service and Privacy Policy first.",
    genericError: zh ? "无法完成请求，请稍后再试。" : "We couldn't complete that request. Please try again later.",
    signinError: zh
      ? "邮箱或密码不正确，或邮箱尚未验证。"
      : "Email or password is incorrect, or your email hasn't been verified.",
    resendVerification: zh ? "重新寄出验证邮件" : "Resend verification email",
    verificationSent: (addr: string) =>
      zh
        ? `验证邮件已发送至 ${addr}。请打开邮箱（含垃圾箱）并点击链接完成邮箱验证；验证成功后再返回此页登录。`
        : `A verification email has been sent to ${addr}. Open your inbox (including spam) and click the link to verify — then return here to sign in.`,
    verifiedBanner: zh
      ? "邮箱已验证。请输入密码登录。"
      : "Email verified. Please sign in with your password.",
    changeEmail: zh ? "修改邮箱" : "Change email",
    resend: zh ? "重新寄出" : "Resend email",
    tosPrefix: zh ? "我已阅读并同意 " : "I have read and agree to the ",
    tosMid: zh ? " 与 " : " and ",
    tos: zh ? "服务条款" : "Terms of Service",
    privacy: zh ? "隐私政策" : "Privacy Policy",
    switchToLoginHint: zh ? "已有账号？" : "Already have an account?",
    switchToSignupHint: zh ? "还没有账号？" : "New here?",
    pwHeader: zh ? "密码需满足：" : "Password must include:",
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setSignupStage("form");
    setNeedsVerification(false);
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
      if (res && "error" in res && res.error) toast.error(t.genericError);
    } catch {
      toast.error(t.genericError);
    }
    setBusy(false);
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr) || addr.length > 254) return toast.error(t.invalidEmail);
    if (!pwValid) return toast.error(t.weakPassword);
    if (!confirmValid) return toast.error(t.mismatch);
    if (!agreed) return toast.error(t.needAgree);
    setBusy(true);
    try {
      await supabase.auth.signUp({
        email: addr,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth?mode=login&verified=1` },
      });
    } catch {
      // Neutral messaging — never reveal whether the address is registered.
    }
    toast.success(t.verificationSent(addr));
    setSentAddress(addr);
    setSignupStage("sent");
    setCooldown(60);
    setPassword("");
    setConfirm("");
    setBusy(false);
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr) || addr.length > 254) return toast.error(t.invalidEmail);
    if (password.length === 0) return toast.error(t.signinError);
    setBusy(true);
    setNeedsVerification(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email: addr, password });
    setBusy(false);
    if (error || !data.session) {
      // Detect unverified-email hint from Supabase without echoing raw text.
      const code = (error as { code?: string } | null)?.code ?? "";
      const msg = (error?.message ?? "").toLowerCase();
      if (code === "email_not_confirmed" || msg.includes("not confirm") || msg.includes("email not confirmed")) {
        setNeedsVerification(true);
      }
      toast.error(t.signinError);
      return;
    }
    // onAuthStateChange handler will bounce.
  }

  async function onResendVerification() {
    if (busy || cooldown > 0) return;
    const addr = (sentAddress || email).trim().toLowerCase();
    if (!EMAIL_RE.test(addr)) return;
    setBusy(true);
    try {
      await supabase.auth.resend({
        type: "signup",
        email: addr,
        options: { emailRedirectTo: `${window.location.origin}/auth?mode=login&verified=1` },
      });
    } catch {
      // ignore — neutral
    }
    toast.success(t.verificationSent(addr));
    setCooldown(60);
    setBusy(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-16">
      <div className="glass-card w-full max-w-md rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">{t.kicker}</p>
        <h1 className="mt-3 font-serif text-3xl italic text-stone-warm">{t.title}</h1>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 p-1 text-[10px] uppercase tracking-[0.28em]">
          {([
            ["login", t.tabLogin],
            ["signup", t.tabSignup],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={`min-h-10 rounded-full px-3 py-2 transition-colors ${
                mode === m ? "bg-gold-dust text-obsidian" : "text-stone-warm/60 hover:text-gold-dust"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {search.verified === "1" && mode === "login" && (
          <p className="mt-6 rounded-lg border border-gold-dust/30 bg-gold-dust/5 px-4 py-3 text-xs text-gold-light">
            {t.verifiedBanner}
          </p>
        )}

        {/* Google */}
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
        <p className="mt-2 text-center text-[10px] leading-relaxed text-stone-warm/45">{t.googleNote}</p>

        <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
          <div className="h-px flex-1 bg-white/10" />
          {t.or}
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {isSignup && signupStage === "sent" ? (
          <>
            <p className="mt-2 mb-4 text-sm leading-relaxed text-stone-warm/70">{t.verificationSent(sentAddress)}</p>
            <div className="mt-6 flex flex-col items-center gap-3 text-[11px] text-stone-warm/60">
              <button
                type="button"
                onClick={onResendVerification}
                disabled={busy || cooldown > 0}
                className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10 disabled:opacity-40"
              >
                {cooldown > 0 ? `${cooldown}s` : t.resend}
              </button>
              <button type="button" onClick={() => setSignupStage("form")} className="hover:text-gold-dust">
                {t.changeEmail}
              </button>
            </div>
          </>
        ) : isSignup ? (
          <form onSubmit={onSignup} className="space-y-3">
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
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                required
                maxLength={128}
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 pr-16 text-base text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
              >
                {showPw ? t.hide : t.show}
              </button>
            </div>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              required
              maxLength={128}
              placeholder={t.confirm}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 text-base text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
            />

            <div className="rounded-lg border border-white/10 bg-obsidian/30 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">{t.pwHeader}</p>
              <ul className="mt-2 space-y-1 text-[11px]">
                {pwRules.map((r) => (
                  <li key={r.id} className={r.ok ? "text-gold-light" : "text-stone-warm/50"}>
                    <span aria-hidden>{r.ok ? "✓ " : "○ "}</span>
                    {zh ? r.labelZh : r.labelEn}
                  </li>
                ))}
                <li className={confirmValid ? "text-gold-light" : "text-stone-warm/50"}>
                  <span aria-hidden>{confirmValid ? "✓ " : "○ "}</span>
                  {zh ? "两次输入的密码一致" : "Passwords match"}
                </li>
              </ul>
            </div>

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
            <button
              type="submit"
              disabled={busy || cooldown > 0 || !pwValid || !confirmValid || !agreed}
              className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              {cooldown > 0 ? `${cooldown}s` : t.submitSignup}
            </button>
          </form>
        ) : (
          <form onSubmit={onLogin} className="space-y-3">
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
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 pr-16 text-base text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
              >
                {showPw ? t.hide : t.show}
              </button>
            </div>
            <div className="flex justify-end">
              <Link to="/auth/reset" className="text-[11px] text-gold-dust hover:text-gold-light">
                {t.forgot}
              </Link>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-50"
            >
              {t.submitLogin}
            </button>

            {needsVerification && (
              <div className="mt-1 rounded-lg border border-white/10 bg-obsidian/30 px-4 py-3 text-[11px] text-stone-warm/70">
                <button
                  type="button"
                  onClick={onResendVerification}
                  disabled={busy || cooldown > 0}
                  className="text-gold-dust underline decoration-gold-dust/60 hover:text-gold-light disabled:opacity-40"
                >
                  {cooldown > 0 ? `${cooldown}s` : t.resendVerification}
                </button>
              </div>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-stone-warm/50">
          {isSignup ? t.switchToLoginHint : t.switchToSignupHint}{" "}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            className="text-gold-dust hover:text-gold-light"
          >
            {isSignup ? t.tabLogin : t.tabSignup}
          </button>
        </p>

        <div className="mt-6 text-center">
          <Link to="/" className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/40 hover:text-gold-dust">
            ← {zh ? "回到大厅" : "back to the hall"}
          </Link>
        </div>
      </div>
    </div>
  );
}
