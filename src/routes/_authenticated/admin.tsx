import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
  Legend,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import {
  adminUpdateProfile,
  getAdminStats,
  listAllUsers,
  sendPasswordResetEmail,
  setUserMembership,
  setUserPassword,
} from "@/lib/admin.functions";
import {
  grantPremiumReportAccess,
  listAdminChartsForUser,
  listAdminPremiumOrders,
  type AdminOrderRow,
  type AdminUserChartRow,
} from "@/lib/premium.functions";
import { AdminTicketsSection } from "@/components/AdminTicketsSection";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Council chamber — Admin · Library of Destiny" },
      { name: "description", content: "Admin console for managing registered visitors." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Row = Awaited<ReturnType<typeof listAllUsers>>[number];
type Stats = Awaited<ReturnType<typeof getAdminStats>>;
type Tier = "none" | "sage" | "oracle";

const TIER_LABELS: Record<Tier, string> = {
  none: "凡·访客",
  sage: "贤者",
  oracle: "神谕者",
};
const TIER_STYLES: Record<Tier, string> = {
  none: "border-white/15 text-stone-warm/50",
  sage: "border-emerald-400/50 text-emerald-300 bg-emerald-950/20",
  oracle: "border-gold-dust text-gold-light bg-gold-dust/15",
};

function AdminPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");
  const [editing, setEditing] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancel = false;
    setRows(null);
    setStats(null);
    setErr(null);
    Promise.all([listAllUsers(), getAdminStats()])
      .then(([data, s]) => {
        if (cancel) return;
        setRows(data);
        setStats(s);
      })
      .catch((e: Error) => {
        if (cancel) return;
        setErr(e.message);
        if (e.message.toLowerCase().includes("forbidden")) {
          toast.error("Admins only");
          navigate({ to: "/" });
        }
      });
    return () => {
      cancel = true;
    };
  }, [reload, navigate]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tierFilter !== "all" && r.membershipTier !== tierFilter) return false;
      if (!term) return true;
      return (
        r.email.toLowerCase().includes(term) ||
        (r.displayName ?? "").toLowerCase().includes(term) ||
        (r.phone ?? "").includes(term)
      );
    });
  }, [rows, q, tierFilter]);

  const quickStats = useMemo(() => {
    if (!rows) return null;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const active7 = rows.filter((r) => r.lastSignInAt && now - new Date(r.lastSignInAt).getTime() < 7 * day).length;
    const admins = rows.filter((r) => r.roles.includes("admin")).length;
    return { active7, admins };
  }, [rows]);

  return (
    <div className="relative min-h-screen px-4 pt-28 pb-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">Admin</p>
            <h1 className="mt-2 font-serif text-4xl italic text-stone-warm">议政厅 · Council chamber</h1>
            <p className="mt-2 max-w-xl text-sm text-stone-warm/60">
              查看所有访客、会员档位与近 30 日趋势。可为访客升为「贤者」或「神谕者」。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/60 hover:border-gold-dust/60 hover:text-gold-dust"
            >
              Sign out
            </button>
            <Link
              to="/"
              className="rounded-full border border-gold-dust/40 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
            >
              ← Hall
            </Link>
          </div>
        </div>

        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="访客总数" value={stats.totals.totalUsers} />
            <Stat label="会员总数" value={stats.totals.totalMembers} accent />
            <Stat label="贤者" value={stats.totals.sage} />
            <Stat label="神谕者" value={stats.totals.oracle} accent />
            <Stat label="7日活跃" value={quickStats?.active7 ?? 0} />
          </div>
        )}

        {stats && (
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            <ChartCard title="每日新增用户 · 30d">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,15,0.9)",
                      border: "1px solid rgba(212,175,55,0.3)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="newUsers" stroke="#d4af37" strokeWidth={2} dot={false} name="新增" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="会员转化数 · 30d">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,15,0.9)",
                      border: "1px solid rgba(212,175,55,0.3)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="conversions" fill="#34d399" name="转化会员" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="搜索邮箱、姓名、手机号…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full max-w-md rounded-lg border border-white/10 bg-obsidian/40 px-4 py-2 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
          />
          <div className="flex gap-1 rounded-full border border-white/10 bg-obsidian/40 p-1">
            {(["all", "none", "sage", "oracle"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.24em] transition ${
                  tierFilter === t ? "bg-gold-dust text-obsidian" : "text-stone-warm/60 hover:text-gold-dust"
                }`}
              >
                {t === "all" ? "全部" : TIER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {err && !err.toLowerCase().includes("forbidden") && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {err}
          </p>
        )}

        <div className="glass-card overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-[1.4fr_1.1fr_1fr_0.8fr_0.8fr_1.2fr] gap-3 border-b border-white/10 bg-obsidian/40 px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-stone-warm/50 md:grid">
            <div>访客</div>
            <div>联系方式</div>
            <div>会员</div>
            <div>加入</div>
            <div>最近登录</div>
            <div className="text-right">操作</div>
          </div>
          {filtered === null ? (
            <div className="p-8 text-center text-sm text-stone-warm/50">Reading the registry…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-stone-warm/50">No visitors match.</div>
          ) : (
            filtered.map((r) => <UserRow key={r.id} row={r} onEdit={() => setEditing(r)} />)
          )}
        </div>
      </div>

      <PremiumOrdersSection reloadKey={reload} onReload={() => setReload((n) => n + 1)} />

      <AdminTicketsSection />



      {editing && (
        <EditDrawer
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`glass-card rounded-xl border px-4 py-3 ${accent ? "border-gold-dust/40" : "border-white/10"}`}>
      <div className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">{label}</div>
      <div className={`mt-1 font-serif text-2xl ${accent ? "text-gold-light" : "text-stone-warm"}`}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.32em] text-gold-dust">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.24em] ${TIER_STYLES[tier]}`}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

function UserRow({ row, onEdit }: { row: Row; onEdit: () => void }) {
  const isAdmin = row.roles.includes("admin");
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-white/5 px-4 py-4 last:border-b-0 md:grid-cols-[1.4fr_1.1fr_1fr_0.8fr_0.8fr_1.2fr] md:items-center md:gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2 font-serif text-sm text-stone-warm">
          {row.displayName || "Nameless"}
          {isAdmin && (
            <span className="rounded-full border border-gold-dust/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.24em] text-gold-dust">
              admin
            </span>
          )}
          {!row.emailConfirmedAt && (
            <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.24em] text-amber-300">
              unverified
            </span>
          )}
        </div>
      </div>
      <div className="font-mono text-[11px] text-stone-warm/70">
        <div className="truncate">{row.email}</div>
        {row.phone && <div className="text-stone-warm/50">{row.phone}</div>}
      </div>
      <div className="flex items-center">
        <TierBadge tier={row.membershipTier} />
      </div>
      <div className="text-xs text-stone-warm/60">
        <span className="md:hidden text-stone-warm/40">加入 </span>
        {fmtDate(row.createdAt)}
      </div>
      <div className="text-xs text-stone-warm/60">
        <span className="md:hidden text-stone-warm/40">最近 </span>
        {fmtDate(row.lastSignInAt)}
      </div>
      <div className="flex flex-wrap justify-start gap-2 md:justify-end">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-gold-dust/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-gold-light hover:bg-gold-dust/10"
        >
          管理
        </button>
      </div>
    </div>
  );
}

function EditDrawer({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(row.displayName ?? "");
  const [tier, setTier] = useState<Tier>(row.membershipTier);
  const [expiresAt, setExpiresAt] = useState<string>(
    row.membershipExpiresAt ? row.membershipExpiresAt.slice(0, 10) : "",
  );
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true);
    try {
      await adminUpdateProfile({ data: { userId: row.id, displayName: displayName.trim() || null } });
      toast.success("称呼已更新");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveMembership() {
    setBusy(true);
    try {
      const iso = tier === "none" ? null : expiresAt ? new Date(`${expiresAt}T23:59:59Z`).toISOString() : null;
      await setUserMembership({ data: { userId: row.id, tier, expiresAt: iso } });
      toast.success("会员档位已更新");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (newPassword.length < 8) {
      toast.error("口令至少 8 位");
      return;
    }
    if (!confirm(`Set a new password for ${row.email}?`)) return;
    setBusy(true);
    try {
      await setUserPassword({ data: { userId: row.id, password: newPassword } });
      toast.success("口令已重铸");
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gold-dust/20 p-6 md:rounded-3xl md:p-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">管理访客</p>
            <h2 className="mt-1 font-serif text-xl text-stone-warm">{row.email}</h2>
            {row.phone && <p className="mt-0.5 font-mono text-[11px] text-stone-warm/50">{row.phone}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-stone-warm/50 hover:text-gold-dust">
            ✕
          </button>
        </div>

        <section className="mb-6">
          <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">称呼</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-2.5 text-sm text-stone-warm focus:border-gold-dust focus:outline-none"
          />
          <button
            type="button"
            onClick={saveProfile}
            disabled={busy}
            className="mt-3 rounded-full bg-gold-dust px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50"
          >
            保存称呼
          </button>
        </section>

        <section className="mb-6 border-t border-white/10 pt-6">
          <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">会员档位</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["none", "sage", "oracle"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`rounded-lg border px-3 py-2 text-xs transition ${
                  tier === t
                    ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                    : "border-white/10 text-stone-warm/60 hover:border-gold-dust/40"
                }`}
              >
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>
          {tier !== "none" && (
            <div className="mt-3">
              <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">到期日</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-2.5 text-sm text-stone-warm focus:border-gold-dust focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-stone-warm/40">留空表示无到期日</p>
            </div>
          )}
          <button
            type="button"
            onClick={saveMembership}
            disabled={busy}
            className="mt-3 rounded-full bg-gold-dust px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50"
          >
            保存会员
          </button>
        </section>

        <section className="mb-6 border-t border-white/10 pt-6">
          <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">代寄取回信</label>
          <button
            type="button"
            onClick={async () => {
              try {
                await sendPasswordResetEmail({ data: { email: row.email } });
                toast.success(`取回信已寄至 ${row.email}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
              }
            }}
            className="mt-2 rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10"
          >
            寄送重铸邮件
          </button>
        </section>

        <section className="border-t border-white/10 pt-6">
          <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">直接重铸口令</label>
          <input
            type="text"
            placeholder="新口令（至少 8 位）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-obsidian/40 px-4 py-2.5 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
          />
          <button
            type="button"
            onClick={resetPassword}
            disabled={busy || newPassword.length < 8}
            className="mt-3 rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10 disabled:opacity-40"
          >
            重铸口令
          </button>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Premium PDF orders — admin console section
═══════════════════════════════════════════ */

function PremiumOrdersSection({
  reloadKey,
  onReload,
}: {
  reloadKey: number;
  onReload: () => void;
}) {
  const [rows, setRows] = useState<AdminOrderRow[] | null>(null);
  const [status, setStatus] = useState<"all" | "pending" | "paid" | "failed" | "refunded">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<AdminOrderRow | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancel = false;
    setRows(null);
    listAdminPremiumOrders({ data: { status, search: search || undefined } })
      .then((r) => {
        if (!cancel) setRows(r);
      })
      .catch((e: Error) => {
        if (!cancel) toast.error(e.message);
      });
    return () => {
      cancel = true;
    };
  }, [reloadKey, status, search]);

  const doGrant = async () => {
    if (!confirming) return;
    if (note.trim().length < 4) {
      toast.error("请填写备注（至少 4 字）");
      return;
    }
    if (!window.confirm(`确认将订单标记为已付款并解锁高级深度报告？\n邮箱：${confirming.email ?? confirming.userId}`))
      return;
    setBusy(true);
    try {
      await grantPremiumReportAccess({
        data: { userId: confirming.userId, chartId: confirming.chartId, note: note.trim() },
      });
      toast.success("已开通");
      setConfirming(null);
      setNote("");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-6xl px-6 pb-16">
      <h2 className="mb-4 font-serif text-2xl italic text-stone-warm">
        高级深度报告订单 · Premium Deep Reading orders
      </h2>

      <GrantByChartPanel onGranted={onReload} />

      <div className="glass-card rounded-2xl border border-white/10 p-4">

        <div className="mb-4 flex flex-wrap items-center gap-3">
          {(["all", "pending", "paid", "failed", "refunded"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] ${
                status === s
                  ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                  : "border-white/10 text-stone-warm/60 hover:border-gold-dust/40"
              }`}
            >
              {s}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="邮箱 / 订单号 / 命盘名"
            className="ml-auto w-64 rounded-full border border-white/10 bg-obsidian/40 px-4 py-1.5 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
          />
        </div>

        {rows === null ? (
          <p className="p-6 text-center text-sm text-stone-warm/50">Reading orders…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-stone-warm/50">No orders match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">
                <tr>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Chart</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Report</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Created</th>
                  <th className="px-2 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-stone-warm/80">
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-2 py-2">{r.email ?? "—"}</td>
                    <td className="px-2 py-2">{r.chartName ?? r.chartId.slice(0, 8)}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.28em] ${
                          r.status === "paid"
                            ? "border-gold-dust text-gold-light"
                            : r.status === "pending"
                              ? "border-nebula-purple/50 text-nebula-purple"
                              : "border-white/10 text-stone-warm/40"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[11px] text-stone-warm/60">
                      {r.reportStatus ?? "—"}
                      {r.isLegacy ? " · legacy" : ""}
                    </td>
                    <td className="px-2 py-2">
                      {r.currency} {(r.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-[11px]">{fmtDate(r.createdAt)}</td>
                    <td className="px-2 py-2 text-right">
                      {r.status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => setConfirming(r)}
                          className="rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10"
                        >
                          手动开通
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-gold-dust/30 p-6">
            <h3 className="mb-3 font-serif text-xl text-stone-warm">
              手动开通 ¥79 高级深度报告
            </h3>
            <p className="mb-2 text-[13px] text-stone-warm/70">
              {confirming.email ?? confirming.userId}
            </p>
            <p className="mb-4 text-[11px] text-stone-warm/50">
              命盘：{confirming.chartName ?? confirming.chartId}
            </p>
            <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
              收款凭证 / 备注（必填）
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：微信收款 2026-07-16 · 单号 xxxx · 备注"
              className="mt-2 w-full rounded-lg border border-white/10 bg-obsidian/40 px-3 py-2 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
            />
            <p className="mt-2 text-[10px] text-stone-warm/40">
              该操作会写入审计日志（谁 / 何时 / 备注），并将订单状态置为 paid。
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirming(null);
                  setNote("");
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/60 hover:border-gold-dust/40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={doGrant}
                disabled={busy}
                className="rounded-full bg-gold-dust px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light disabled:opacity-50"
              >
                二次确认并开通
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Grant-by-chart — pick user + one of their charts
   and issue a test grant (source=admin_test_grant).
═══════════════════════════════════════════ */

function GrantByChartPanel({ onGranted }: { onGranted: () => void }) {
  const [query, setQuery] = useState("");
  const [charts, setCharts] = useState<AdminUserChartRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("admin_test_grant");
  const [granting, setGranting] = useState<string | null>(null);

  const doLookup = async () => {
    if (query.trim().length < 3) {
      toast.error("请输入邮箱或用户 UUID");
      return;
    }
    setLoading(true);
    try {
      const rows = await listAdminChartsForUser({ data: { query: query.trim() } });
      setCharts(rows);
      if (rows.length === 0) toast.message("未找到该用户或该用户没有命盘");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const doGrant = async (row: AdminUserChartRow) => {
    if (note.trim().length < 4) {
      toast.error("备注至少 4 字");
      return;
    }
    if (row.hasLegacyPaid) {
      toast.error("该命盘已有历史 paid 订单，无需再次开通");
      return;
    }
    if (!window.confirm(`确认为 ${row.email ?? row.userId} 的命盘「${row.name ?? row.chartId.slice(0, 8)}」授予测试权益？`))
      return;
    setGranting(row.chartId);
    try {
      await grantPremiumReportAccess({
        data: { userId: row.userId, chartId: row.chartId, note: note.trim() },
      });
      toast.success("已授予测试权益");
      await doLookup();
      onGranted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGranting(null);
    }
  };

  return (
    <div className="mb-4 glass-card rounded-2xl border border-gold-dust/30 p-4">
      <h3 className="mb-2 font-serif text-lg italic text-gold-light">
        按命盘授予测试权益 · Grant test access by chart
      </h3>
      <p className="mb-3 text-[11px] text-stone-warm/50">
        输入用户邮箱或 UUID → 选择其命盘 → 幂等授予 ¥79 高级深度报告 paid 订单，不触发真实扣款。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") doLookup();
          }}
          placeholder="user@example.com or UUID"
          className="w-72 rounded-full border border-white/10 bg-obsidian/40 px-4 py-1.5 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
        />
        <button
          type="button"
          onClick={doLookup}
          disabled={loading}
          className="rounded-full border border-gold-dust/50 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10 disabled:opacity-50"
        >
          {loading ? "查询中…" : "查询命盘"}
        </button>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（写入审计日志，最少 4 字）"
          className="ml-auto w-72 rounded-full border border-white/10 bg-obsidian/40 px-4 py-1.5 text-[11px] text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
        />
      </div>

      {charts && charts.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">
              <tr>
                <th className="px-2 py-2">Chart</th>
                <th className="px-2 py-2">Birth</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-stone-warm/80">
              {charts.map((c) => {
                const alreadyPaid = c.hasCurrentPaid || c.hasLegacyPaid;
                return (
                  <tr key={c.chartId} className="border-t border-white/5">
                    <td className="px-2 py-2">{c.name ?? c.chartId.slice(0, 8)}</td>
                    <td className="px-2 py-2 text-[11px] text-stone-warm/60">
                      {[c.birthDate, c.birthTime, c.birthPlace].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-2 text-[10px] uppercase tracking-[0.24em]">
                      {c.hasLegacyPaid
                        ? "legacy paid"
                        : c.hasCurrentPaid
                          ? "paid"
                          : c.hasCurrentPending
                            ? "pending"
                            : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => doGrant(c)}
                        disabled={alreadyPaid || granting === c.chartId}
                        className="rounded-full border border-gold-dust/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/10 disabled:opacity-40"
                      >
                        {alreadyPaid
                          ? "已开通"
                          : granting === c.chartId
                            ? "开通中…"
                            : "授予测试权益"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


