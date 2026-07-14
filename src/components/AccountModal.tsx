import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";

import { useAccount } from "@/lib/account";
import { useLang } from "@/lib/i18n";

type Mode = "signin" | "register" | "forgot";

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { account, signIn, signOut, saved, removeReading } = useAccount();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{9,9}$/;

  const resetFields = () => {
    setPassword("");
    setError(null);
    setNotice(null);
    setShowPw(false);
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    resetFields();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const em = email.trim();
    if (!emailRe.test(em)) {
      setError(lang === "zh" ? "请输入有效的邮箱地址" : "Please enter a valid email address");
      return;
    }
    if (mode === "forgot") {
      setNotice(
        lang === "zh"
          ? `重置链接已发送至 ${em}（演示 · 请查收邮箱）。`
          : `A reset link has been sent to ${em} (demo — check your inbox).`,
      );
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
    if (mode === "register" && !name.trim()) {
      setError(lang === "zh" ? "请输入你的名字" : "Please enter your name");
      return;
    }
    signIn({ name: name.trim() || em.split("@")[0], email: em });
    setName("");
    setEmail("");
    setPassword("");
  };

  const isForgot = mode === "forgot";
  const isRegister = mode === "register";

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
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="glass-card relative m-4 w-full max-w-lg rounded-3xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
            >
              {t.mem_close}
            </button>

            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.acc_title}
            </p>
            <h3 className="mb-2 font-serif text-2xl italic text-stone-warm">
              {account
                ? `${t.acc_signed_as} · ${account.name}`
                : isForgot
                  ? lang === "zh" ? "找回密码" : "Reset password"
                  : isRegister
                    ? lang === "zh" ? "创建账号" : "Create account"
                    : lang === "zh" ? "登录账号" : "Sign in"}
            </h3>
            <p className="mb-6 text-sm text-stone-warm/60">{t.acc_desc}</p>

            {!account ? (
              <>
                {/* Tabs — sign in vs register */}
                {!isForgot && (
                  <div className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
                    {(["signin", "register"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => switchMode(m)}
                        className={`rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.28em] transition-colors ${
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

                <form onSubmit={submit} className="space-y-3">
                  {isRegister && !isForgot && (
                    <div className="mb-2 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.05] p-3">
                      <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                        {lang === "zh" ? "首次到来？" : "First time here?"}
                      </p>
                      <p className="mt-1 text-xs italic text-stone-warm/70">
                        {lang === "zh"
                          ? "输入姓名、邮箱与密码即刻创建账号 —— 你的解读将被安全保存。"
                          : "Enter your name, email and password to create an account — your readings will be saved."}
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
                          ? "输入你的注册邮箱，我们将发送重置链接。"
                          : "Enter your registered email and we'll send a reset link."}
                      </p>
                    </div>
                  )}

                  {isRegister && (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.acc_name}
                      className="ritual-input !py-2 !text-base w-full"
                    />
                  )}
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.acc_email}
                    className="ritual-input !py-2 !text-base w-full"
                  />
                  {!isForgot && (
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value.slice(0, 9))}
                        placeholder={lang === "zh" ? "密码（9 位，含大小写与数字）" : "Password (9 chars, Aa & 0-9)"}
                        maxLength={9}
                        minLength={9}
                        autoComplete={isRegister ? "new-password" : "current-password"}
                        className="ritual-input !py-2 !text-base w-full !pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? (lang === "zh" ? "隐藏密码" : "Hide password") : (lang === "zh" ? "显示密码" : "Show password")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-warm/50 hover:text-gold-dust"
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  )}
                  {!isForgot && isRegister && (
                    <p className="text-[10px] tracking-[0.2em] text-stone-warm/40">
                      {lang === "zh"
                        ? "密码需正好 9 位，且同时包含大写字母、小写字母和数字。"
                        : "Password must be exactly 9 characters with uppercase, lowercase, and a number."}
                    </p>
                  )}
                  {error && (
                    <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      {error}
                    </p>
                  )}
                  {notice && (
                    <p className="rounded-xl border border-gold-dust/40 bg-gold-dust/10 px-3 py-2 text-xs text-gold-light">
                      {notice}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
                  >
                    {isForgot
                      ? lang === "zh" ? "发送重置链接" : "Send reset link"
                      : isRegister
                        ? lang === "zh" ? "创建账号" : "Create account"
                        : lang === "zh" ? "登录" : "Sign in"}
                  </button>

                  <div className="flex items-center justify-between pt-1 text-[10px] uppercase tracking-[0.24em]">
                    {isForgot ? (
                      <button
                        type="button"
                        onClick={() => switchMode("signin")}
                        className="text-stone-warm/60 hover:text-gold-dust"
                      >
                        {lang === "zh" ? "← 返回登录" : "← Back to sign in"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-stone-warm/60 hover:text-gold-dust"
                        >
                          {lang === "zh" ? "忘记密码？" : "Forgot password?"}
                        </button>
                        <button
                          type="button"
                          onClick={() => switchMode(mode === "signin" ? "register" : "signin")}
                          className="text-stone-warm/60 hover:text-gold-dust"
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
              </>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm text-stone-warm/70">{account.email}</p>
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
                                aria-label={lang === "zh" ? "删除" : "Remove"}
                                className="text-stone-warm/40 hover:text-gold-dust"
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
                  className="w-full rounded-full border border-gold-dust/40 px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust hover:bg-gold-dust/10"
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
