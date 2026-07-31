import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useModalA11y } from "@/lib/use-modal-a11y";

import { useAccount, type Plan } from "@/lib/account";
import { useLang, type Lang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";
import { TAROT_LIMITS, tarotRemaining } from "@/lib/tarot-quota";
import { listUserCharts, renameChart, deleteChart, computeChartHash, type ChartRow } from "@/lib/reports-store.functions";
import { listPremiumReports, type MyPremiumReportRow } from "@/lib/premium.functions";
import { PremiumReportReader } from "@/components/PremiumReportReader";


export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useLang();
  const { account, signOut, saved, removeReading } = useAccount();
  const { session, loading, isAdmin } = useSupabaseSession();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useModalA11y<HTMLDivElement>({ open, onClose });
  const [dbCharts, setDbCharts] = useState<ChartRow[] | null>(null);

  useEffect(() => {
    if (!open || !session) return;
    listUserCharts().then((r) => setDbCharts(r)).catch(() => setDbCharts([]));
  }, [open, session]);

  // Hash set of saved DB charts — any local `saved` entry with a matching
  // normalized-input hash is a duplicate of a DB chart and hidden from the
  // secondary list. Compares on the same (date/time/place/lang) fingerprint
  // the server uses via `computeChartHash`, so renames don't split rows.
  const dbHashes = useMemo(() => {
    if (!dbCharts) return null;
    const s = new Set<string>();
    for (const r of dbCharts) {
      s.add(
        computeChartHash({
          date: r.birth_date ?? "",
          time: r.birth_time ?? "",
          place: r.birth_place ?? "",
          lang: (r.lang as "en" | "zh") ?? "en",
        }),
      );
    }
    return s;
  }, [dbCharts]);

  const savedFiltered = useMemo(() => {
    if (!dbHashes) return saved;
    return saved.filter((s) => {
      const h = computeChartHash({
        date: s.date ?? "",
        time: s.time ?? "",
        place: s.place ?? "",
        lang: (s.lang as "en" | "zh") ?? "en",
      });
      return !dbHashes.has(h);
    });
  }, [saved, dbHashes]);

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
              <div className="space-y-3">
                <Link
                  to="/auth"
                  search={{ redirect: undefined, mode: "login" }}
                  onClick={onClose}
                  className="flex w-full items-center justify-center rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                >
                  {lang === "zh" ? "登录" : "Sign in"}
                </Link>
                <Link
                  to="/auth"
                  search={{ redirect: undefined, mode: "signup" }}
                  onClick={onClose}
                  className="flex w-full items-center justify-center rounded-full border border-gold-dust/50 px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-gold-light transition-colors hover:bg-gold-dust/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                >
                  {lang === "zh" ? "注册新账号" : "Create account"}
                </Link>
                <p className="text-center text-[10px] uppercase tracking-[0.24em] text-stone-warm/35">
                  {lang === "zh" ? "邮箱与密码，或使用 Google 登录" : "Email & password, or continue with Google"}
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
                        loading="lazy"
                        decoding="async"
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

                <Link
                  to="/me/home"
                  onClick={onClose}
                  className="group block rounded-2xl border border-gold-dust/40 bg-gradient-to-br from-gold-dust/10 via-obsidian/40 to-obsidian/60 p-4 transition-colors hover:border-gold-light/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                        {lang === "zh" ? "今日星图" : "Today's Chart"}
                      </p>
                      <p className="mt-1 font-serif text-lg italic text-stone-warm">
                        {lang === "zh" ? "今日命运" : "Today"}
                      </p>
                      <p className="mt-1 text-xs text-stone-warm/60">
                        {lang === "zh"
                          ? "今日领域信号 · 好友 · 适配分析"
                          : "Today's domain signals · Friends · Compatibility"}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="text-lg text-gold-light transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                </Link>

                <MyChartsSection open={open} onClose={onClose} lang={lang} rows={dbCharts} setRows={setDbCharts} />


                <MyPremiumReports open={open} lang={lang} />

                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {t.acc_view_saved}
                  </p>
                  {savedFiltered.length === 0 ? (
                    <p className="text-sm text-stone-warm/50">{t.acc_no_saved}</p>
                  ) : (
                    <ul className="space-y-2">
                      {savedFiltered.map((s) => {
                        const q: Record<string, string> = { name: s.name, readingId: s.id };
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


                <div>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {lang === "zh" ? "隐私与数据" : "Privacy & data"}
                  </p>
                  <div className="space-y-2">
                    <Link
                      to="/privacy"
                      onClick={onClose}
                      className="block rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] tracking-normal text-stone-warm/75 hover:border-gold-dust/40 hover:text-gold-dust"
                    >
                      {lang === "zh" ? "查看隐私政策" : "View privacy policy"}
                    </Link>
                    <Link
                      to="/terms"
                      onClick={onClose}
                      className="block rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px] tracking-normal text-stone-warm/75 hover:border-gold-dust/40 hover:text-gold-dust"
                    >
                      {lang === "zh" ? "查看服务条款" : "View terms of service"}
                    </Link>
                    <Link
                      to="/delete-account"
                      onClick={onClose}
                      className="block rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 text-[12px] tracking-normal text-red-200/90 hover:border-red-400/60 hover:bg-red-500/10"
                    >
                      {lang === "zh" ? "删除我的账户与数据" : "Delete my account and data"}
                    </Link>
                  </div>
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

function MyChartsSection({ open, onClose, lang, rows, setRows }: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  rows: ChartRow[] | null;
  setRows: (r: ChartRow[] | null) => void;
}) {
  const loading = rows === null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; scope: "chart" | "reports_only" } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmTitleId = useId();
  const confirmDescId = useId();
  const confirmRef = useModalA11y<HTMLDivElement>({
    open: !!confirm,
    onClose: () => setConfirm(null),
    closeOnEscape: !deleting,
  });

  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => { if (!open) return; }, [open]);

  useEffect(() => {
    if (!menuOpenId) return;
    const onDoc = () => setMenuOpenId(null);
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [menuOpenId]);

  const heading = lang === "zh" ? "我的命盘与报告" : "My charts & reports";
  const empty = lang === "zh"
    ? "还没有保存的命盘。完成一次仪式后会自动出现在这里。"
    : "No saved charts yet. Complete a ritual and one will appear here.";

  async function submitRename(id: string) {
    const name = draftName.trim();
    if (!name) return;
    try {
      await renameChart({ data: { chartId: id, name } });
      setRows(rows ? rows.map((r) => (r.id === id ? { ...r, name } : r)) : rows);
    } catch { /* ignore */ }
    setEditingId(null);
  }

  async function performDelete() {
    if (!confirm) return;
    setDeleting(true);
    try {
      const res = await deleteChart({ data: { chartId: confirm.id, scope: confirm.scope } });
      if (res.scope === "chart") {
        setRows(rows ? rows.filter((r) => r.id !== confirm.id) : rows);
        setFeedback(lang === "zh" ? "命盘及关联数据已删除" : "Chart and related data deleted");
      } else {
        setRows(rows ? rows.map((r) => (r.id === confirm.id ? { ...r, reports: [] } : r)) : rows);
        setFeedback(lang === "zh" ? "报告与逐年解读已清除，命盘保留" : "Reports cleared; chart kept");
      }
      setConfirm(null);
    } catch {
      setFeedback(lang === "zh" ? "删除失败，请稍后再试" : "Delete failed, please retry");
    } finally {
      setDeleting(false);
      setTimeout(() => setFeedback(null), 3200);
    }
  }


  return (
    <div>
      <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">{heading}</p>
      {loading ? (
        <p className="text-sm text-stone-warm/40">…</p>
      ) : !rows || rows.length === 0 ? (
        <p className="text-sm text-stone-warm/50">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const q: Record<string, string> = { readingId: r.id };
            if (r.name) q.name = r.name;
            if (r.birth_date) q.date = r.birth_date;
            if (r.birth_time) q.time = r.birth_time;
            if (r.birth_place) q.place = r.birth_place;
            if (r.lang) q.lang = r.lang;
            const hasReport = r.reports.some((rr) => rr.kind === "report" && rr.status === "completed");
            return (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingId === r.id ? (
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={() => submitRename(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(r.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full rounded border border-gold-dust/40 bg-obsidian/40 px-2 py-1 text-sm text-stone-warm focus:outline-none"
                        maxLength={120}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(r.id);
                          setDraftName(r.name ?? "");
                        }}
                        className="truncate font-serif text-base italic text-stone-warm hover:text-gold-light"
                        title={lang === "zh" ? "重命名" : "Rename"}
                      >
                        {r.name ?? (lang === "zh" ? "未命名命盘" : "Untitled chart")}
                      </button>
                    )}
                    <p className="truncate text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
                      {[r.birth_date, r.birth_place].filter(Boolean).join(" · ")}
                      {hasReport ? "" : ` · ${lang === "zh" ? "尚未生成" : "not yet generated"}`}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <Link
                      to="/report"
                      search={q}
                      onClick={onClose}
                      className="rounded-full border border-gold-dust/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
                    >
                      {lang === "zh" ? "打开" : "Open"}
                    </Link>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={lang === "zh" ? "更多操作" : "More actions"}
                        aria-haspopup="menu"
                        aria-expanded={menuOpenId === r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === r.id ? null : r.id);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-stone-warm/70 hover:border-gold-dust/50 hover:text-gold-light focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
                      >
                        <span aria-hidden className="text-lg leading-none">⋯</span>
                      </button>
                      {menuOpenId === r.id && (
                        <div
                          role="menu"
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-xl border border-white/10 bg-obsidian/95 shadow-xl backdrop-blur"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpenId(null);
                              setConfirm({ id: r.id, scope: "reports_only" });
                            }}
                            className="block w-full px-4 py-3 text-left text-[12px] tracking-normal text-stone-warm/80 hover:bg-white/[0.04]"
                          >
                            {lang === "zh" ? "仅删除报告，保留命盘" : "Delete reports, keep chart"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpenId(null);
                              setConfirm({ id: r.id, scope: "chart" });
                            }}
                            className="block w-full px-4 py-3 text-left text-[12px] tracking-normal text-red-200/90 hover:bg-red-500/10"
                          >
                            {lang === "zh" ? "删除此命盘及关联数据" : "Delete chart and related data"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {feedback && (
        <p className="mt-3 text-[11px] tracking-normal text-gold-light/80" role="status">
          {feedback}
        </p>
      )}
      {confirm && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => !deleting && setConfirm(null)}
        >
          <div
            ref={confirmRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            aria-describedby={confirmDescId}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-obsidian/95 p-5 shadow-2xl focus:outline-none"
          >
            <h3 id={confirmTitleId} className="font-serif text-lg text-stone-warm">
              {confirm.scope === "chart"
                ? lang === "zh" ? "确认删除此命盘？" : "Delete this chart?"
                : lang === "zh" ? "确认清除报告？" : "Clear reports?"}
            </h3>

            <p className="mt-2 text-[13px] leading-relaxed text-stone-warm/75">
              {confirm.scope === "chart"
                ? lang === "zh"
                  ? "命盘将连同其报告、逐年解读、对话记录一并永久删除，无法恢复。为保留财务审计所需的最少订单信息将被去标识化保留。"
                  : "The chart, its reports, year-by-year readings, and conversations will be permanently removed. A minimal, de-identified order record is retained for financial audit."
                : lang === "zh"
                  ? "将清除该命盘的所有报告与逐年解读，命盘本身与出生资料保留。已完成的付费订单在此模式下不删除，用于审计。"
                  : "All reports and year-by-year readings for this chart will be cleared; the chart itself is kept. Paid orders remain for audit."}
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirm(null)}
                className="rounded-full border border-white/15 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-stone-warm/80 hover:border-white/30 disabled:opacity-50"
              >
                {lang === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={deleting}
                autoFocus
                onClick={performDelete}
                className="rounded-full border border-red-400/50 bg-red-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-red-200 hover:bg-red-500/20 disabled:opacity-60"
              >
                {deleting
                  ? (lang === "zh" ? "处理中…" : "Working…")
                  : confirm.scope === "chart"
                    ? (lang === "zh" ? "永久删除" : "Delete permanently")
                    : (lang === "zh" ? "清除报告" : "Clear reports")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
function MyPremiumReports({ open, lang }: { open: boolean; lang: Lang }) {
  const [rows, setRows] = useState<MyPremiumReportRow[] | null>(null);
  const [readerChartId, setReaderChartId] = useState<string | null>(null);
  const [readerChartName, setReaderChartName] = useState<string | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    listPremiumReports()
      .then((r) => setRows(r))
      .catch(() => setRows([]));
  }, [open]);

  const heading = lang === "zh" ? "我的高级深度报告" : "My premium deep readings";
  const empty = lang === "zh"
    ? "还没有购买高级深度报告。前往任一命盘的报告页解锁 ¥79 深度解读。"
    : "No premium deep readings yet. Unlock ¥79 on any chart's report page.";

  return (
    <div>
      <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">{heading}</p>
      {rows === null ? (
        <p className="text-sm text-stone-warm/40">…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-stone-warm/50">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const status = r.report?.status ?? (r.order?.status === "paid" ? "pending" : null);
            const label =
              status === "completed"
                ? lang === "zh" ? "查看完整报告" : "Open full reading"
                : status === "generating"
                  ? lang === "zh" ? "生成中…" : "Generating…"
                  : status === "failed"
                    ? lang === "zh" ? "可重试生成" : "Retry available"
                    : r.order?.status === "paid"
                      ? lang === "zh" ? "待生成" : "Not generated yet"
                      : lang === "zh" ? "订单处理中" : "Order pending";
            return (
              <li key={r.chartId} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-base italic text-stone-warm">
                      {r.chartName ?? (lang === "zh" ? "未命名命盘" : "Untitled chart")}
                    </p>
                    <p className="truncate text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
                      {[r.birthDate, r.birthPlace].filter(Boolean).join(" · ")}
                      {" · "}
                      {label}
                    </p>
                  </div>
                  {status === "completed" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        openerRef.current = e.currentTarget;
                        setReaderChartId(r.chartId);
                        setReaderChartName(r.chartName);
                      }}
                      className="flex-none rounded-full border border-gold-dust/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
                    >
                      {lang === "zh" ? "查看" : "Open"}
                    </button>
                  ) : (
                    <span className="flex-none rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                      {r.order?.isLegacy ? (lang === "zh" ? "旧版" : "Legacy") : "—"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {readerChartId && (
        <PremiumReportReader
          open={!!readerChartId}
          chartId={readerChartId}
          chartName={readerChartName}
          onClose={() => {
            setReaderChartId(null);
            requestAnimationFrame(() => openerRef.current?.focus());
          }}
        />
      )}
    </div>
  );
}
