import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  adminUpdateProfile,
  listAllUsers,
  sendPasswordResetEmail,
  setUserPassword,
} from "@/lib/admin.functions";

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

function AdminPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancel = false;
    setRows(null);
    setErr(null);
    listAllUsers()
      .then((data) => {
        if (!cancel) setRows(data);
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
    if (!term) return rows;
    return rows.filter(
      (r) => r.email.toLowerCase().includes(term) || (r.displayName ?? "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const active7 = rows.filter((r) => r.lastSignInAt && now - new Date(r.lastSignInAt).getTime() < 7 * day).length;
    const active30 = rows.filter((r) => r.lastSignInAt && now - new Date(r.lastSignInAt).getTime() < 30 * day).length;
    const admins = rows.filter((r) => r.roles.includes("admin")).length;
    return { total: rows.length, active7, active30, admins };
  }, [rows]);

  return (
    <div className="relative min-h-screen px-4 pt-28 pb-24 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">Admin</p>
            <h1 className="mt-2 font-serif text-4xl italic text-stone-warm">议政厅 · Council chamber</h1>
            <p className="mt-2 max-w-xl text-sm text-stone-warm/60">
              后台所有注册的访客与最近入席记录。可代访客发送口令重铸信、直接重铸口令、或调整称呼。
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
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Registered" value={stats.total} />
            <Stat label="Active · 7d" value={stats.active7} />
            <Stat label="Active · 30d" value={stats.active30} />
            <Stat label="Admins" value={stats.admins} />
          </div>
        )}

        <input
          type="search"
          placeholder="Search email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-4 w-full max-w-md rounded-lg border border-white/10 bg-obsidian/40 px-4 py-2 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
        />

        {err && !err.toLowerCase().includes("forbidden") && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {err}
          </p>
        )}

        <div className="glass-card overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_0.7fr_1.4fr] gap-3 border-b border-white/10 bg-obsidian/40 px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-stone-warm/50 md:grid">
            <div>Visitor</div>
            <div>Email</div>
            <div>Joined</div>
            <div>Last seen</div>
            <div>Method</div>
            <div className="text-right">Actions</div>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card rounded-xl border border-white/10 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">{label}</div>
      <div className="mt-1 font-serif text-2xl text-gold-light">{value}</div>
    </div>
  );
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function UserRow({ row, onEdit }: { row: Row; onEdit: () => void }) {
  const isAdmin = row.roles.includes("admin");
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-white/5 px-4 py-4 last:border-b-0 md:grid-cols-[1.5fr_1.2fr_0.8fr_0.8fr_0.7fr_1.4fr] md:items-center md:gap-3">
      <div>
        <div className="flex items-center gap-2 font-serif text-sm text-stone-warm">
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
        <div className="mt-0.5 font-mono text-[10px] text-stone-warm/40 md:hidden">{row.email}</div>
      </div>
      <div className="hidden font-mono text-xs text-stone-warm/70 md:block">{row.email}</div>
      <div className="text-xs text-stone-warm/60">
        <span className="md:hidden text-stone-warm/40">Joined </span>
        {fmtDate(row.createdAt)}
      </div>
      <div className="text-xs text-stone-warm/60">
        <span className="md:hidden text-stone-warm/40">Last seen </span>
        {fmtDate(row.lastSignInAt)}
      </div>
      <div className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">{row.provider}</div>
      <div className="flex flex-wrap justify-start gap-2 md:justify-end">
        <button
          type="button"
          onClick={async () => {
            try {
              await sendPasswordResetEmail({ data: { email: row.email } });
              toast.success(`Recovery letter sent to ${row.email}`);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e));
            }
          }}
          className="rounded-full border border-gold-dust/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-gold-light hover:bg-gold-dust/10"
        >
          Send reset email
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/60 hover:text-gold-dust"
        >
          Manage
        </button>
      </div>
    </div>
  );
}

function EditDrawer({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const [displayName, setDisplayName] = useState(row.displayName ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true);
    try {
      await adminUpdateProfile({ data: { userId: row.id, displayName: displayName.trim() || null } });
      toast.success("Profile updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!confirm(`Set a new password for ${row.email}? The visitor will need to be told the new password out of band.`)) return;
    setBusy(true);
    try {
      await setUserPassword({ data: { userId: row.id, password: newPassword } });
      toast.success("Password reset");
      setNewPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-lg rounded-t-3xl border border-gold-dust/20 p-6 md:rounded-3xl md:p-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">Manage visitor</p>
            <h2 className="mt-1 font-serif text-xl text-stone-warm">{row.email}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-stone-warm/50 hover:text-gold-dust">✕</button>
        </div>

        <section className="mb-6">
          <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">Display name</label>
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
            Save name
          </button>
        </section>

        <section className="border-t border-white/10 pt-6">
          <label className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">Set a new password directly</label>
          <p className="mt-1 text-[11px] text-stone-warm/50">
            Prefer the email path when possible — this bypasses the user's inbox.
          </p>
          <input
            type="text"
            placeholder="New password (min 8 chars)"
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
            Set password
          </button>
        </section>
      </div>
    </div>
  );
}
