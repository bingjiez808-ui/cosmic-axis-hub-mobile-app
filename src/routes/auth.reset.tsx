import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";

type Stage = "request" | "sent" | "reset" | "done";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Route = createFileRoute("/auth/reset")({
  head: () => ({
    meta: [
      { title: "Reset password · Library of Destiny" },
      { name: "description", content: "Reset your Library of Destiny password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
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

function ResetPage() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const zh = lang === "zh";

  const [stage, setStage] = useState<Stage>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [linkError, setLinkError] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Detect recovery link: Supabase places tokens in URL hash and emits
  // PASSWORD_RECOVERY when the client processes them.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && /error/i.test(hash)) {
      setLinkError(true);
      history.replaceState(null, "", window.location.pathname);
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStage("reset");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const pwRules = useMemo(() => evaluatePassword(password), [password]);
  const pwValid = pwRules.every((r) => r.ok);
  const confirmValid = password.length > 0 && confirm === password;

  const t = {
    kicker: zh ? "重铸口令" : "Reset the key",
    titleRequest: zh ? "找回密码" : "Reset your password",
    titleSent: zh ? "邮件已寄出" : "Check your inbox",
    titleReset: zh ? "设置新密码" : "Set a new password",
    titleDone: zh ? "密码已更新" : "Password updated",
    email: zh ? "邮箱" : "Email",
    password: zh ? "新密码" : "New password",
    confirm: zh ? "确认新密码" : "Confirm new password",
    show: zh ? "显示" : "Show",
    hide: zh ? "隐藏" : "Hide",
    send: zh ? "发送重置邮件" : "Send reset email",
    resend: zh ? "重新寄出" : "Resend email",
    save: zh ? "保存新密码" : "Save new password",
    backToLogin: zh ? "返回登录" : "Back to sign in",
    sentBody: (addr: string) =>
      zh
        ? `如该邮箱已注册，我们已向 ${addr} 寄出重置链接。请打开邮箱（含垃圾箱）并点击链接完成重置。`
        : `If that email is registered, a reset link has been sent to ${addr}. Open your inbox (including spam) and click the link.`,
    resetBody: zh
      ? "请为账户设置新密码，密码将由 Supabase 安全存储。"
      : "Set a new password for your account. Your password is stored securely by Supabase.",
    doneBody: zh
      ? "密码已更新。请使用新密码重新登录。"
      : "Your password has been updated. Please sign in with your new password.",
    invalidEmail: zh ? "请输入有效邮箱。" : "Please enter a valid email.",
    weakPassword: zh ? "密码不符合要求。" : "Password does not meet the requirements.",
    mismatch: zh ? "两次输入的密码不一致。" : "Passwords do not match.",
    genericError: zh ? "无法完成请求，请稍后再试。" : "We couldn't complete that request. Please try again later.",
    linkExpired: zh ? "该链接无效或已过期，请重新申请。" : "That link is invalid or expired. Please request a new one.",
    pwHeader: zh ? "密码需满足：" : "Password must include:",
  };

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    if (busy || cooldown > 0) return;
    const addr = email.trim().toLowerCase();
    if (!EMAIL_RE.test(addr) || addr.length > 254) return toast.error(t.invalidEmail);
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
    } catch {
      // ignore — neutral messaging
    }
    toast.success(t.sentBody(addr));
    setStage("sent");
    setCooldown(60);
    setBusy(false);
  }

  async function onResend() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
    } catch {}
    toast.success(t.sentBody(email));
    setCooldown(60);
    setBusy(false);
  }

  async function onSaveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!pwValid) return toast.error(t.weakPassword);
    if (!confirmValid) return toast.error(t.mismatch);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(t.genericError);
    // Sign out so the user must re-authenticate with the new password.
    try {
      await supabase.auth.signOut();
    } catch {}
    setStage("done");
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-16">
      <div className="glass-card w-full max-w-md rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">{t.kicker}</p>
        <h1 className="mt-3 font-serif text-3xl italic text-stone-warm">
          {stage === "request" ? t.titleRequest : stage === "sent" ? t.titleSent : stage === "reset" ? t.titleReset : t.titleDone}
        </h1>

        {linkError && (
          <p className="mt-6 rounded-lg border border-red-400/30 bg-red-500/5 px-4 py-3 text-xs text-red-200/90">
            {t.linkExpired}
          </p>
        )}

        {stage === "request" && (
          <form onSubmit={onRequest} className="mt-8 space-y-3">
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
              className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50"
            >
              {cooldown > 0 ? `${cooldown}s` : t.send}
            </button>
          </form>
        )}

        {stage === "sent" && (
          <>
            <p className="mt-6 mb-4 text-sm leading-relaxed text-stone-warm/70">{t.sentBody(email)}</p>
            <div className="flex flex-col items-center gap-3 text-[11px] text-stone-warm/60">
              <button
                type="button"
                onClick={onResend}
                disabled={busy || cooldown > 0}
                className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10 disabled:opacity-40"
              >
                {cooldown > 0 ? `${cooldown}s` : t.resend}
              </button>
            </div>
          </>
        )}

        {stage === "reset" && (
          <form onSubmit={onSaveNewPassword} className="mt-6 space-y-3">
            <p className="text-sm text-stone-warm/70">{t.resetBody}</p>
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
            <button
              type="submit"
              disabled={busy || !pwValid || !confirmValid}
              className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50"
            >
              {t.save}
            </button>
          </form>
        )}

        {stage === "done" && (
          <>
            <p className="mt-6 mb-6 text-sm leading-relaxed text-stone-warm/70">{t.doneBody}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/auth", search: { mode: "login" } as never })}
              className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
            >
              {t.backToLogin}
            </button>
          </>
        )}

        <div className="mt-6 text-center">
          <Link to="/auth" search={{ mode: "login" } as never} className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/40 hover:text-gold-dust">
            ← {t.backToLogin}
          </Link>
        </div>
      </div>
    </div>
  );
}
