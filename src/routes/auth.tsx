import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useLang } from "@/lib/i18n";

type Mode = "sign_in" | "sign_up" | "forgot" | "reset";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Enter the Library — Sign in · Library of Destiny" },
      { name: "description", content: "Sign in or create an account to save your readings and join the 同门 circle." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    reset: s.reset === "1" || s.reset === 1 ? "1" : undefined,
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { lang } = useLang();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(() => (search.reset === "1" ? "reset" : "sign_in"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // Detect a recovery link (Supabase sets type=recovery in the hash on redirect).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) setMode("reset");
  }, []);

  // If already signed in and not in reset flow, bounce away.
  useEffect(() => {
    if (mode === "reset") return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: (search.redirect as never) ?? "/" });
    });
  }, [mode, navigate, search.redirect]);

  const zh = lang === "zh";
  const t = {
    kicker: zh ? "灯下入席" : "By candlelight",
    title:
      mode === "sign_up"
        ? zh ? "在图书馆留名" : "Sign your name in the library"
        : mode === "forgot"
        ? zh ? "取回你的印章" : "Recover your seal"
        : mode === "reset"
        ? zh ? "重铸你的印章" : "Recast your seal"
        : zh ? "重返图书馆" : "Return to the library",
    email: zh ? "邮箱" : "Email",
    password: zh ? "口令（至少 8 位）" : "Password (min 8 chars)",
    name: zh ? "如何称呼你" : "How to call you",
    signIn: zh ? "点亮烛火进入" : "Light the candle · sign in",
    signUp: zh ? "在此留名" : "Sign your name",
    forgot: zh ? "忘记口令？" : "Forgot your seal?",
    toSignIn: zh ? "已有印章？在此入席" : "Have a seal? Sign in",
    toSignUp: zh ? "尚未留名？在此题名" : "New here? Sign your name",
    sendReset: zh ? "寄出取回信" : "Send recovery letter",
    resetBtn: zh ? "重铸口令" : "Set new password",
    google: zh ? "以 Google 之名入席" : "Continue with Google",
    or: zh ? "或" : "or",
    resetHint: zh ? "在下方设置新的口令。" : "Set a new password below.",
    forgotHint: zh ? "输入邮箱，我们将寄出一封取回信。" : "Enter your email — we'll send a recovery letter.",
    resetSent: zh ? "取回信已寄出，请查收邮箱。" : "Recovery letter sent — check your inbox.",
    signedUp: zh ? "留名成功。请查收验证信。" : "Signed up. Please verify your email.",
  };

  async function onGoogle() {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res && "error" in res && res.error) {
      toast.error(res.error instanceof Error ? res.error.message : String(res.error));
    }
    setBusy(false);
  }

  async function onEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "sign_in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(zh ? "入席成功" : "Welcome back");
        navigate({ to: (search.redirect as never) ?? "/" });
      } else if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { name: name || undefined },
          },
        });
        if (error) throw error;
        toast.success(t.signedUp);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        toast.success(t.resetSent);
        setMode("sign_in");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success(zh ? "口令已重铸" : "Password updated");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 pt-32 pb-16">
      <div className="glass-card w-full max-w-md rounded-3xl border border-gold-dust/20 p-8 md:p-10">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">{t.kicker}</p>
        <h1 className="mt-3 font-serif text-3xl italic text-stone-warm">{t.title}</h1>

        {mode !== "reset" && (
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
          </>
        )}

        {mode === "forgot" && (
          <p className="mb-4 text-xs text-stone-warm/60">{t.forgotHint}</p>
        )}
        {mode === "reset" && (
          <p className="mb-4 text-xs text-stone-warm/60">{t.resetHint}</p>
        )}

        <form onSubmit={onEmailAuth} className="space-y-3">
          {mode !== "reset" && (
            <input
              type="email"
              autoComplete="email"
              required
              placeholder={t.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
            />
          )}
          {mode === "sign_up" && (
            <input
              type="text"
              placeholder={t.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
            />
          )}
          {(mode === "sign_in" || mode === "sign_up" || mode === "reset") && (
            <input
              type="password"
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              required
              minLength={8}
              placeholder={t.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-3 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-gold-dust px-6 py-3 text-xs uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-50"
          >
            {mode === "sign_in" ? t.signIn : mode === "sign_up" ? t.signUp : mode === "forgot" ? t.sendReset : t.resetBtn}
          </button>
        </form>

        {mode !== "reset" && (
          <div className="mt-6 flex flex-col items-center gap-2 text-[11px] text-stone-warm/60">
            {mode === "sign_in" && (
              <>
                <button type="button" onClick={() => setMode("forgot")} className="hover:text-gold-dust">
                  {t.forgot}
                </button>
                <button type="button" onClick={() => setMode("sign_up")} className="hover:text-gold-dust">
                  {t.toSignUp}
                </button>
              </>
            )}
            {mode === "sign_up" && (
              <button type="button" onClick={() => setMode("sign_in")} className="hover:text-gold-dust">
                {t.toSignIn}
              </button>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("sign_in")} className="hover:text-gold-dust">
                {t.toSignIn}
              </button>
            )}
          </div>
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
