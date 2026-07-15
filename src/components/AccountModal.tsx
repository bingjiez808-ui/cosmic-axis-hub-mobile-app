import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useRef } from "react";

import { useAccount, type Plan } from "@/lib/account";
import { useLang, type Lang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";
import { TAROT_LIMITS, tarotRemaining } from "@/lib/tarot-quota";

export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { account, signOut, saved, removeReading } = useAccount();
  const { session, loading, isAdmin } = useSupabaseSession();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const displayAccount = account ?? (session?.user.email
    ? {
        name:
          (typeof session.user.user_metadata?.name === "string" && session.user.user_metadata.name) ||
          (typeof session.user.user_metadata?.full_name === "string" && session.user.user_metadata.full_name) ||
          session.user.email.split("@")[0],
        email: session.user.email,
        plan: "free" as Plan,
        avatar: typeof session.user.user_metadata?.avatar_url === "string" ? session.user.user_metadata.avatar_url : undefined,
      }
    : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
    };
  }, [open, onClose]);

  const title = displayAccount
    ? `${t.acc_signed_as} · ${displayAccount.name}`
    : lang === "zh"
      ? "登录账号"
      : "Sign in";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 p-4 backdrop-blur-md"
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
            className="glass-card relative m-4 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl p-8 focus:outline-none"
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
              {title}
            </h3>
            <p id={descId} className="mb-6 text-sm text-stone-warm/60">
              {displayAccount
                ? t.acc_desc
                : lang === "zh"
                  ? "账号登录已统一到同一个入口；登录后管理员会自动进入议政厅。"
                  : "Account access now uses the same sign-in page everywhere."}
            </p>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-stone-warm/50">
                {lang === "zh" ? "正在读取登录状态…" : "Checking sign-in status…"}
              </div>
            ) : !displayAccount ? (
              <div className="space-y-4">
                <Link
                  to="/auth"
                  search={{ reset: undefined, redirect: undefined }}
                  onClick={onClose}
                  className="flex w-full items-center justify-center rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                >
                  {t.acc_sign_in}
                </Link>
                <p className="text-center text-[10px] uppercase tracking-[0.24em] text-stone-warm/35">
                  {lang === "zh" ? "使用邮箱密码或 Google 登录" : "Use email/password or Google"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-stone-warm/70">{displayAccount.email}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                        {lang === "zh" ? "已通过统一账号系统登录" : "Signed in with the unified account system"}
                      </p>
                    </div>
                    {displayAccount.avatar && (
                      <img
                        src={displayAccount.avatar}
                        alt=""
                        className="h-10 w-10 flex-none rounded-full border border-gold-dust/40 object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MembershipBadge plan={displayAccount.plan ?? "free"} lang={lang} />
                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={onClose}
                        className="rounded-full border border-gold-dust/50 bg-gold-dust/[0.08] px-3 py-1 text-[9px] uppercase tracking-[0.28em] text-gold-light"
                      >
                        {lang === "zh" ? "议政厅" : "Admin"}
                      </Link>
                    )}
                  </div>

                  <TarotQuota accountKey={displayAccount.email} plan={displayAccount.plan ?? "free"} lang={lang} />
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
                            <div className="min-w-0">
                              <p className="truncate font-serif text-base italic text-stone-warm">{s.name}</p>
                              <p className="truncate text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
                                {[s.date, s.place].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <div className="flex flex-none items-center gap-2">
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
                  onClick={() => {
                    signOut();
                    onClose();
                  }}
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

function MembershipBadge({ plan, lang }: { plan: Plan; lang: Lang }) {
  const label = plan === "oracle"
    ? (lang === "zh" ? "神谕者" : "Oracle")
    : plan === "sage"
      ? (lang === "zh" ? "贤者" : "Sage")
      : (lang === "zh" ? "寻道者 · 免费" : "Seeker · Free");
  const cls = plan === "free"
    ? "border-white/15 text-stone-warm/60"
    : "border-gold-dust/50 bg-gold-dust/[0.08] text-gold-light";
  return (
    <span className={`rounded-full border px-3 py-1 text-[9px] uppercase tracking-[0.28em] ${cls}`}>
      {plan !== "free" && "✦ "}{label}
    </span>
  );
}

function TarotQuota({ accountKey, plan, lang }: { accountKey: string; plan: Plan; lang: Lang }) {
  const limit = TAROT_LIMITS[plan];
  const rem = tarotRemaining(plan, { accountKey });
  const usedCount = isFinite(limit) ? Math.max(0, limit - rem) : 0;
  const label = plan === "oracle"
    ? lang === "zh" ? "塔罗 AI 解读 · 本月无限次" : "Tarot AI readings · unlimited this month"
    : plan === "sage"
      ? lang === "zh" ? `塔罗 AI 解读 · 本月已用 ${usedCount} · 剩余 ${rem} / ${limit} 次` : `Tarot AI readings · used ${usedCount} · ${rem} / ${limit} left`
      : lang === "zh" ? "塔罗 AI 解读 · 升级贤者解锁（每月 10 次）" : "Tarot AI readings · unlock with Sage (10 / month)";
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-obsidian/40 px-3 py-2">
      <p className="text-[11px] tracking-normal text-stone-warm/70">{label}</p>
      {plan !== "oracle" && isFinite(limit) && limit > 0 && (
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-gold-dust"
            style={{ width: `${Math.min(100, ((limit - rem) / limit) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}