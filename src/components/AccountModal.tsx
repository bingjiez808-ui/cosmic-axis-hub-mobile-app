import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";

import { useAccount } from "@/lib/account";
import { useLang } from "@/lib/i18n";
import { TAROT_LIMITS, tarotRemaining } from "@/lib/tarot-quota";

type Mode = "signin" | "register" | "forgot";
type Step = "form" | "verify" | "reset";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{9,9}$/;
const gen6 = () => Math.floor(100000 + Math.random() * 900000).toString();

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { account, signIn, signOut, saved, removeReading } = useAccount();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  const isForgot = mode === "forgot";
  const isRegister = mode === "register";

  // Focus + Escape key handling
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => firstFieldRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
    };
  }, [open, onClose, step, mode]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const resetAll = () => {
    setStep("form");
    setPassword("");
    setNewPassword("");
    setCode("");
    setIssuedCode(null);
    setError(null);
    setNotice(null);
    setShowPw(false);
    setShowNewPw(false);
    setResendCooldown(0);
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    resetAll();
  };

  // Issue (or re-issue) a demo verification code
  const issueCode = (em: string) => {
    const c = gen6();
    setIssuedCode(c);
    setResendCooldown(30);
    setNotice(
      lang === "zh"
        ? `我们已向 ${em} 发送验证码。演示环境验证码为 ${c}（真实上线时通过邮件发送）。`
        : `A verification code has been sent to ${em}. Demo code: ${c} (real deployments deliver it via email).`,
    );
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const em = email.trim();
    if (!emailRe.test(em)) {
      setError(lang === "zh" ? "请输入有效的邮箱地址" : "Please enter a valid email address");
      return;
    }

    if (mode === "signin") {
      if (!passwordRe.test(password)) {
        setError(lang === "zh" ? "邮箱或密码不正确" : "Incorrect email or password");
        return;
      }
      signIn({ name: em.split("@")[0], email: em });
      resetAll();
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError(lang === "zh" ? "请输入你的名字" : "Please enter your name");
        return;
      }
      if (!passwordRe.test(password)) {
        setError(
          lang === "zh"
            ? "密码需为 9 位，且同时包含大写字母、小写字母和数字"
            : "Password must be exactly 9 characters and include uppercase, lowercase, and a number",
        );
        return;
      }
      issueCode(em);
      setStep("verify");
      return;
    }

    // forgot — send code, move to reset step
    if (mode === "forgot") {
      issueCode(em);
      setStep("reset");
      return;
    }
  };

  const submitVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.trim() !== issuedCode) {
      setError(lang === "zh" ? "验证码不正确，请再试一次" : "Incorrect code — try again");
      return;
    }
    signIn({ name: name.trim() || email.split("@")[0], email: email.trim() });
    resetAll();
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.trim() !== issuedCode) {
      setError(lang === "zh" ? "验证码不正确" : "Incorrect verification code");
      return;
    }
    if (!passwordRe.test(newPassword)) {
      setError(
        lang === "zh"
          ? "新密码需为 9 位，且同时包含大写字母、小写字母和数字"
          : "New password must be exactly 9 characters with uppercase, lowercase, and a number",
      );
      return;
    }
    setNotice(lang === "zh" ? "密码已重置。已为你自动登录。" : "Password reset. You are now signed in.");
    signIn({ name: email.split("@")[0], email: email.trim() });
    resetAll();
  };

  const headerLabel = account
    ? `${t.acc_signed_as} · ${account.name}`
    : step === "verify"
      ? lang === "zh" ? "输入验证码" : "Enter verification code"
      : step === "reset"
        ? lang === "zh" ? "重置密码" : "Reset password"
        : isForgot
          ? lang === "zh" ? "找回密码" : "Forgot password"
          : isRegister
            ? lang === "zh" ? "创建账号" : "Create account"
            : lang === "zh" ? "登录账号" : "Sign in";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="glass-card relative m-4 w-full max-w-lg rounded-3xl p-8 focus:outline-none"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={lang === "zh" ? "关闭对话框" : "Close dialog"}
              className="absolute right-4 top-4 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
            >
              {t.mem_close}
            </button>

            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.acc_title}
            </p>
            <h3 id={titleId} className="mb-2 font-serif text-2xl italic text-stone-warm">
              {headerLabel}
            </h3>
            <p id={descId} className="mb-6 text-sm text-stone-warm/60">
              {t.acc_desc}
            </p>

            {!account ? (
              <>
                {/* Tabs — hidden during verify/reset sub-steps */}
                {step === "form" && !isForgot && (
                  <div
                    role="tablist"
                    aria-label={lang === "zh" ? "登录或创建账号" : "Sign in or register"}
                    className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
                  >
                    {(["signin", "register"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={mode === m}
                        onClick={() => switchMode(m)}
                        className={`rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.28em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust ${
                          mode === m
                            ? "bg-gold-dust/20 text-gold-light"
                            : "text-stone-warm/50 hover:text-gold-dust"
                        }`}
                      >
                        {m === "signin"
                          ? lang === "zh" ? "登录" : "Sign in"
                          : lang === "zh" ? "创建账号" : "Register"}
                      </button>
                    ))}
                  </div>
                )}

                {/* STEP: form (email + name/password) */}
                {step === "form" && (
                  <form onSubmit={submitForm} className="space-y-3" noValidate>
                    {isRegister && (
                      <div className="mb-2 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.05] p-3">
                        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                          {lang === "zh" ? "首次到来？" : "First time here?"}
                        </p>
                        <p className="mt-1 text-xs italic text-stone-warm/70">
                          {lang === "zh"
                            ? "填写姓名、邮箱与密码 —— 我们会向你的邮箱发送验证码以确认账号。"
                            : "Enter your name, email and password — we'll email you a verification code to confirm the account."}
                        </p>
                      </div>
                    )}
                    {isForgot && (
                      <div className="mb-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                          {lang === "zh" ? "忘记密码？" : "Forgot password?"}
                        </p>
                        <p className="mt-1 text-xs italic text-stone-warm/70">
                          {lang === "zh"
                            ? "输入注册邮箱，我们会发送验证码，你即可设置新密码。"
                            : "Enter your email — we'll send a verification code so you can set a new password."}
                        </p>
                      </div>
                    )}

                    {isRegister && (
                      <label className="block">
                        <span className="sr-only">{t.acc_name}</span>
                        <input
                          ref={firstFieldRef}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t.acc_name}
                          aria-label={t.acc_name}
                          className="ritual-input !py-2 !text-base w-full"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="sr-only">{t.acc_email}</span>
                      <input
                        ref={!isRegister ? firstFieldRef : undefined}
                        type="email"
                        required
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t.acc_email}
                        aria-label={t.acc_email}
                        className="ritual-input !py-2 !text-base w-full"
                      />
                    </label>
                    {!isForgot && (
                      <div className="relative">
                        <label className="block">
                          <span className="sr-only">
                            {lang === "zh" ? "密码" : "Password"}
                          </span>
                          <input
                            type={showPw ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value.slice(0, 9))}
                            placeholder={lang === "zh" ? "密码（9 位，含大小写与数字）" : "Password (9 chars, Aa & 0-9)"}
                            aria-label={lang === "zh" ? "密码" : "Password"}
                            maxLength={9}
                            minLength={9}
                            autoComplete={isRegister ? "new-password" : "current-password"}
                            className="ritual-input !py-2 !text-base w-full !pr-11"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          aria-pressed={showPw}
                          aria-label={showPw ? (lang === "zh" ? "隐藏密码" : "Hide password") : (lang === "zh" ? "显示密码" : "Show password")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-stone-warm/50 hover:text-gold-dust focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
                        >
                          {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                        </button>
                      </div>
                    )}
                    {isRegister && (
                      <p className="text-[10px] tracking-[0.2em] text-stone-warm/40">
                        {lang === "zh"
                          ? "密码需正好 9 位，且同时包含大写字母、小写字母和数字。"
                          : "Password must be exactly 9 characters with uppercase, lowercase, and a number."}
                      </p>
                    )}

                    {error && (
                      <p role="alert" aria-live="assertive" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                    >
                      {isForgot
                        ? lang === "zh" ? "发送验证码" : "Send verification code"
                        : isRegister
                          ? lang === "zh" ? "发送验证码" : "Send verification code"
                          : lang === "zh" ? "登录" : "Sign in"}
                    </button>

                    <div className="flex items-center justify-between pt-1 text-[10px] uppercase tracking-[0.24em]">
                      {isForgot ? (
                        <button
                          type="button"
                          onClick={() => switchMode("signin")}
                          className="text-stone-warm/60 hover:text-gold-dust focus:outline-none focus-visible:text-gold-dust"
                        >
                          {lang === "zh" ? "← 返回登录" : "← Back to sign in"}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => switchMode("forgot")}
                            className="text-stone-warm/60 hover:text-gold-dust focus:outline-none focus-visible:text-gold-dust"
                          >
                            {lang === "zh" ? "忘记密码？" : "Forgot password?"}
                          </button>
                          <button
                            type="button"
                            onClick={() => switchMode(mode === "signin" ? "register" : "signin")}
                            className="text-stone-warm/60 hover:text-gold-dust focus:outline-none focus-visible:text-gold-dust"
                          >
                            {mode === "signin"
                              ? lang === "zh" ? "创建账号 →" : "Create account →"
                              : lang === "zh" ? "已有账号，登录 →" : "Have an account? Sign in →"}
                          </button>
                        </>
                      )}
                    </div>

                    <p className="pt-2 text-[10px] uppercase tracking-[0.24em] text-stone-warm/30">
                      {t.acc_privacy}
                    </p>
                  </form>
                )}

                {/* STEP: verify — for register */}
                {step === "verify" && (
                  <form onSubmit={submitVerify} className="space-y-3" noValidate>
                    <div className="mb-2 rounded-2xl border border-gold-dust/40 bg-gold-dust/[0.06] p-3">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                        {lang === "zh" ? "邮箱验证" : "Email verification"}
                      </p>
                      <p className="mt-1 text-xs italic text-stone-warm/70">{notice}</p>
                    </div>
                    <label className="block">
                      <span className="sr-only">{lang === "zh" ? "验证码" : "Verification code"}</span>
                      <input
                        ref={firstFieldRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder={lang === "zh" ? "6 位验证码" : "6-digit code"}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-label={lang === "zh" ? "验证码" : "Verification code"}
                        maxLength={6}
                        className="ritual-input !py-2 !text-base w-full tracking-[0.4em] text-center"
                      />
                    </label>
                    {error && (
                      <p role="alert" aria-live="assertive" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                    >
                      {lang === "zh" ? "确认并创建账号" : "Verify & create account"}
                    </button>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em]">
                      <button
                        type="button"
                        onClick={() => setStep("form")}
                        className="text-stone-warm/60 hover:text-gold-dust"
                      >
                        {lang === "zh" ? "← 修改邮箱" : "← Change email"}
                      </button>
                      <button
                        type="button"
                        disabled={resendCooldown > 0}
                        onClick={() => issueCode(email.trim())}
                        className="text-gold-dust hover:text-gold-light disabled:text-stone-warm/30"
                      >
                        {resendCooldown > 0
                          ? lang === "zh" ? `重新发送 (${resendCooldown}s)` : `Resend (${resendCooldown}s)`
                          : lang === "zh" ? "重新发送验证码" : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP: reset — for forgot */}
                {step === "reset" && (
                  <form onSubmit={submitReset} className="space-y-3" noValidate>
                    <div className="mb-2 rounded-2xl border border-gold-dust/40 bg-gold-dust/[0.06] p-3">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                        {lang === "zh" ? "邮箱验证 · 设置新密码" : "Verify email · set new password"}
                      </p>
                      <p className="mt-1 text-xs italic text-stone-warm/70">{notice}</p>
                    </div>
                    <label className="block">
                      <span className="sr-only">{lang === "zh" ? "验证码" : "Verification code"}</span>
                      <input
                        ref={firstFieldRef}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder={lang === "zh" ? "6 位验证码" : "6-digit code"}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        aria-label={lang === "zh" ? "验证码" : "Verification code"}
                        maxLength={6}
                        className="ritual-input !py-2 !text-base w-full tracking-[0.4em] text-center"
                      />
                    </label>
                    <div className="relative">
                      <label className="block">
                        <span className="sr-only">{lang === "zh" ? "新密码" : "New password"}</span>
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value.slice(0, 9))}
                          placeholder={lang === "zh" ? "新密码（9 位，含大小写与数字）" : "New password (9 chars, Aa & 0-9)"}
                          aria-label={lang === "zh" ? "新密码" : "New password"}
                          maxLength={9}
                          minLength={9}
                          autoComplete="new-password"
                          className="ritual-input !py-2 !text-base w-full !pr-11"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewPw((v) => !v)}
                        aria-pressed={showNewPw}
                        aria-label={showNewPw ? (lang === "zh" ? "隐藏密码" : "Hide password") : (lang === "zh" ? "显示密码" : "Show password")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-stone-warm/50 hover:text-gold-dust focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
                      >
                        {showNewPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                      </button>
                    </div>
                    {error && (
                      <p role="alert" aria-live="assertive" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                    >
                      {lang === "zh" ? "重置密码并登录" : "Reset password & sign in"}
                    </button>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em]">
                      <button
                        type="button"
                        onClick={() => switchMode("signin")}
                        className="text-stone-warm/60 hover:text-gold-dust"
                      >
                        {lang === "zh" ? "← 返回登录" : "← Back to sign in"}
                      </button>
                      <button
                        type="button"
                        disabled={resendCooldown > 0}
                        onClick={() => issueCode(email.trim())}
                        className="text-gold-dust hover:text-gold-light disabled:text-stone-warm/30"
                      >
                        {resendCooldown > 0
                          ? lang === "zh" ? `重新发送 (${resendCooldown}s)` : `Resend (${resendCooldown}s)`
                          : lang === "zh" ? "重新发送验证码" : "Resend code"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm text-stone-warm/70">{account.email}</p>
                    {(() => {
                      const p = account.plan ?? "free";
                      const label = p === "oracle"
                        ? (lang === "zh" ? "神谕者" : "Oracle")
                        : p === "sage"
                          ? (lang === "zh" ? "贤者" : "Sage")
                          : (lang === "zh" ? "寻道者 · 免费" : "Seeker · Free");
                      const cls = p === "free"
                        ? "border-white/15 text-stone-warm/60"
                        : "border-gold-dust/50 bg-gold-dust/[0.08] text-gold-light";
                      return (
                        <span className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.28em] ${cls}`}>
                          {p !== "free" && "✦ "}{label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                    {lang === "zh" ? "当前会员等级" : "Current membership"}
                  </p>

                  {/* Tarot quota */}
                  {(() => {
                    const p = (account.plan ?? "free") as "free" | "sage" | "oracle";
                    const limit = TAROT_LIMITS[p];
                    const rem = tarotRemaining(p);
                    const label = p === "oracle"
                      ? lang === "zh" ? "塔罗 AI 解读 · 本月无限次" : "Tarot AI readings · unlimited this month"
                      : p === "sage"
                        ? lang === "zh" ? `塔罗 AI 解读 · 本月剩余 ${rem} / ${limit} 次` : `Tarot AI readings · ${rem} / ${limit} left this month`
                        : lang === "zh" ? "塔罗 AI 解读 · 升级贤者解锁（每月 10 次）" : "Tarot AI readings · unlock with Sage (10 / month)";
                    return (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-obsidian/40 px-3 py-2">
                        <p className="text-[11px] tracking-normal text-stone-warm/70">{label}</p>
                        {p !== "oracle" && isFinite(limit) && limit > 0 && (
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full bg-gold-dust"
                              style={{ width: `${Math.min(100, ((limit - rem) / limit) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {t.acc_view_saved}
                  </p>
                  {saved.length === 0 ? (
                    <p className="text-sm text-stone-warm/50">{t.acc_no_saved}</p>
                  ) : (
                    <ul className="space-y-2">
                      {saved.map((s) => {
                        const q: Record<string, string> = { name: s.name };
                        if (s.date) q.date = s.date;
                        if (s.time) q.time = s.time;
                        if (s.place) q.place = s.place;
                        if (s.lang) q.lang = s.lang;
                        return (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                          >
                            <div>
                              <p className="font-serif text-base italic text-stone-warm">
                                {s.name}
                              </p>
                              <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
                                {[s.date, s.place].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Link
                                to="/report"
                                search={q}
                                onClick={onClose}
                                className="rounded-full border border-gold-dust/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
                              >
                                {t.acc_open_reading}
                              </Link>
                              <button
                                type="button"
                                onClick={() => removeReading(s.id)}
                                aria-label={lang === "zh" ? "删除保存的解读" : "Remove saved reading"}
                                className="rounded-full px-2 text-stone-warm/40 hover:text-gold-dust focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
                              >
                                ×
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={signOut}
                  className="w-full rounded-full border border-gold-dust/40 px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust hover:bg-gold-dust/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
                >
                  {t.acc_sign_out}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
