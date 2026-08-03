import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/i18n";
import { getAuthRedirectUrl, getPublicSiteUrl } from "@/lib/site-url";

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
  validateSearch: (s: Record<string, unknown>): { redirect?: string; mode?: "login" | "signup"; verified?: "1" } => {
    // Same-origin, absolute-path redirect only. Allow query and hash so
    // downstream focus/scroll targets survive the round-trip. Reject any
    // scheme, protocol-relative URL, or backslash-based bypass.
    const raw = typeof s.redirect === "string" ? s.redirect : "";
    const safeRedirect =
      raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
        ? raw
        : undefined;
    const modeIn = s.mode;
    const mode: "login" | "signup" | undefined =
      modeIn === "signup"
        ? "signup"
        : modeIn === "login" || modeIn === "signin"
          ? "login"
          : undefined;
    return {
      ...(safeRedirect ? { redirect: safeRedirect } : {}),
      ...(mode ? { mode } : {}),
      ...(s.verified === "1" ? { verified: "1" as const } : {}),
    };
  },

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
  const [displayName, setDisplayName] = useState("");
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
    if (!userId) return "/me";
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return data ? "/admin" : "/me";
  };

  useEffect(() => {
    let cancelled = false;
    const bounce = () => {
      getPostAuthDestination().then((to) => {
        if (cancelled) return;
        // TanStack `navigate({ to })` drops hash fragments on string
        // routes. When the caller wants us to land on a specific in-page
        // anchor (e.g. `/me/home?focus=peers#life-chapter`) we fall back
        // to a full same-origin assign so both search and hash survive.
        if (to.includes("#") || to.includes("?")) {
          window.location.assign(to);
        } else {
          navigate({ to: to as never });
        }
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
    displayName: zh ? "用户名（对管理员与好友可见）" : "Display name (visible to admins and friends)",
    displayNamePlaceholder: zh ? "如：望舒" : "e.g. Alex",
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
    invalidName: zh ? "请填写用户名（2-40 字）。" : "Please enter a display name (2–40 characters).",
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
    try {
      // Google OAuth must return to a PUBLIC route so id-preview never
      // shows up in the OAuth redirect. We still restore the intended
      // in-app destination via ?next=... on the callback URL.
      const res = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${getPublicSiteUrl()}/auth${
          search.redirect ? `?redirect=${encodeURIComponent(search.redirect)}` : ""
        }`,
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
    const name = displayName.trim();
    if (!EMAIL_RE.test(addr) || addr.length > 254) return toast.error(t.invalidEmail);
    if (name.length < 2 || name.length > 40) return toast.error(t.invalidName);
    if (!pwValid) return toast.error(t.weakPassword);
    if (!confirmValid) return toast.error(t.mismatch);
    if (!agreed) return toast.error(t.needAgree);
    setBusy(true);
    try {
      await supabase.auth.signUp({
        email: addr,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(search.redirect),
          data: { name, full_name: name, display_name: name },
        },
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
        options: { emailRedirectTo: getAuthRedirectUrl(search.redirect) },
      });
    } catch {
      // ignore — neutral
    }
    toast.success(t.verificationSent(addr));
    setCooldown(60);
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[#090912] px-4 pb-8 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-amber-50">
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/"
          aria-label={zh ? "返回" : "Back"}
          className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/15 bg-white/[0.035] text-amber-100"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <div className="rounded-full border border-amber-300/15 px-3 py-1 text-[11px] text-amber-100/65">
          {zh ? "账户" : "Account"}
        </div>
      </div>

      <div className="rounded-[32px] border border-amber-300/16 bg-gradient-to-br from-amber-300/10 via-[#15111a] to-[#090912] p-5 shadow-[0_22px_70px_-38px_rgba(0,0,0,0.95)]">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
          <Sparkles aria-hidden className="h-6 w-6" />
        </div>
        <p className="mt-5 text-[10px] uppercase tracking-[0.3em] text-amber-300/70">
          {zh ? "命运书房 App" : "Fate Nexus App"}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-amber-50">{t.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/62">
          {zh
            ? "登录后进入你的今日解读、好友关系、适配分析与已保存报告。"
            : "Sign in to open daily readings, friends, matching and saved reports."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-amber-300/12 bg-black/20 p-1 text-sm">
          {([
            ["login", t.tabLogin],
            ["signup", t.tabSignup],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={`min-h-11 rounded-xl px-3 py-2 font-medium transition-colors ${
                mode === m ? "bg-amber-300 text-[#111016]" : "text-amber-100/58 hover:text-amber-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {search.verified === "1" && mode === "login" && (
          <p className="mt-4 rounded-2xl border border-amber-300/24 bg-amber-300/8 px-4 py-3 text-xs text-amber-100">
            {t.verifiedBanner}
          </p>
        )}

        {/* Google */}
        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-amber-300/20 bg-white/[0.035] px-5 text-sm font-medium text-amber-50 transition-colors hover:bg-amber-300/8 disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {isSignup ? t.googleSignup : t.googleLogin}
        </button>
        <p className="mt-2 text-center text-[11px] leading-relaxed text-amber-100/45">{t.googleNote}</p>

        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.26em] text-amber-100/38">
          <div className="h-px flex-1 bg-amber-300/10" />
          {t.or}
          <div className="h-px flex-1 bg-amber-300/10" />
        </div>

        {isSignup && signupStage === "sent" ? (
          <>
            <p className="mt-2 mb-4 text-sm leading-relaxed text-amber-100/70">{t.verificationSent(sentAddress)}</p>
            <div className="mt-6 flex flex-col items-center gap-3 text-[11px] text-amber-100/60">
              <button
                type="button"
                onClick={onResendVerification}
                disabled={busy || cooldown > 0}
                className="rounded-full border border-amber-300/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-amber-300 hover:bg-amber-300/10 disabled:opacity-40"
              >
                {cooldown > 0 ? `${cooldown}s` : t.resend}
              </button>
              <button type="button" onClick={() => setSignupStage("form")} className="hover:text-amber-300">
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
              className="w-full rounded-2xl border border-amber-300/14 bg-black/24 px-4 py-3 text-base text-amber-50 placeholder:text-amber-100/32 focus:border-amber-300 focus:outline-none"
            />
            <input
              type="text"
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={40}
              placeholder={t.displayName}
              aria-label={t.displayName}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-2xl border border-amber-300/14 bg-black/24 px-4 py-3 text-base text-amber-50 placeholder:text-amber-100/32 focus:border-amber-300 focus:outline-none"
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
                className="w-full rounded-2xl border border-amber-300/14 bg-black/24 px-4 py-3 pr-16 text-base text-amber-50 placeholder:text-amber-100/32 focus:border-amber-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.28em] text-amber-100/50 hover:text-amber-300"
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
              className="w-full rounded-2xl border border-amber-300/14 bg-black/24 px-4 py-3 text-base text-amber-50 placeholder:text-amber-100/32 focus:border-amber-300 focus:outline-none"
            />

            <div className="rounded-lg border border-white/10 bg-black/24 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-100/50">{t.pwHeader}</p>
              <ul className="mt-2 space-y-1 text-[11px]">
                {pwRules.map((r) => (
                  <li key={r.id} className={r.ok ? "text-amber-100" : "text-amber-100/50"}>
                    <span aria-hidden>{r.ok ? "✓ " : "○ "}</span>
                    {zh ? r.labelZh : r.labelEn}
                  </li>
                ))}
                <li className={confirmValid ? "text-amber-100" : "text-amber-100/50"}>
                  <span aria-hidden>{confirmValid ? "✓ " : "○ "}</span>
                  {zh ? "两次输入的密码一致" : "Passwords match"}
                </li>
              </ul>
            </div>

            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-100/70">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-amber-300"
              />
              <span>
                {t.tosPrefix}
                <Link to="/terms" className="underline decoration-amber-300/60 hover:text-amber-300" target="_blank">
                  《{t.tos}》
                </Link>
                {t.tosMid}
                <Link to="/privacy" className="underline decoration-amber-300/60 hover:text-amber-300" target="_blank">
                  《{t.privacy}》
                </Link>
                。
              </span>
            </label>
            <button
              type="submit"
              disabled={busy || cooldown > 0 || !pwValid || !confirmValid || !agreed || displayName.trim().length < 2}
              className="w-full rounded-2xl bg-amber-300 px-6 py-3 text-sm font-semibold text-[#111016] transition-colors hover:bg-amber-200 disabled:opacity-50"
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
              className="w-full rounded-2xl border border-amber-300/14 bg-black/24 px-4 py-3 text-base text-amber-50 placeholder:text-amber-100/32 focus:border-amber-300 focus:outline-none"
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
                className="w-full rounded-2xl border border-amber-300/14 bg-black/24 px-4 py-3 pr-16 text-base text-amber-50 placeholder:text-amber-100/32 focus:border-amber-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.28em] text-amber-100/50 hover:text-amber-300"
              >
                {showPw ? t.hide : t.show}
              </button>
            </div>
            <div className="flex justify-end">
              <Link to="/auth/reset" className="text-[11px] text-amber-300 hover:text-amber-100">
                {t.forgot}
              </Link>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-amber-300 px-6 py-3 text-sm font-semibold text-[#111016] transition-colors hover:bg-amber-200 disabled:opacity-50"
            >
              {t.submitLogin}
            </button>

            {needsVerification && (
              <div className="mt-1 rounded-lg border border-white/10 bg-black/24 px-4 py-3 text-[11px] text-amber-100/70">
                <button
                  type="button"
                  onClick={onResendVerification}
                  disabled={busy || cooldown > 0}
                  className="text-amber-300 underline decoration-amber-300/60 hover:text-amber-100 disabled:opacity-40"
                >
                  {cooldown > 0 ? `${cooldown}s` : t.resendVerification}
                </button>
              </div>
            )}
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-amber-100/50">
          {isSignup ? t.switchToLoginHint : t.switchToSignupHint}{" "}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            className="text-amber-300 hover:text-amber-100"
          >
            {isSignup ? t.tabLogin : t.tabSignup}
          </button>
        </p>

        <div className="mt-6 text-center">
          <Link to="/" className="text-[10px] uppercase tracking-[0.32em] text-amber-100/40 hover:text-amber-300">
            ← {zh ? "回到大厅" : "back to the hall"}
          </Link>
        </div>
      </div>
    </div>
  );
}
