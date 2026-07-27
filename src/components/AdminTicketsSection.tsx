import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  adminListTickets,
  adminUpdateTicket,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  type AdminTicket,
  type TicketStatus,
  type TicketPriority,
  type TicketCategory,
} from "@/lib/tickets.functions";

const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "新建",
  in_progress: "处理中",
  waiting_user: "等待用户",
  resolved: "已解决",
  closed: "已关闭",
};

const CAT_LABEL: Record<TicketCategory, string> = {
  product: "产品",
  device: "设备",
  order: "订单",
  payment: "支付",
  subscription: "订阅",
};

const STATUS_STYLE: Record<TicketStatus, string> = {
  new: "border-sky-400/40 bg-sky-950/25 text-sky-200",
  in_progress: "border-gold-dust/40 bg-gold-dust/10 text-gold-light",
  waiting_user: "border-amber-400/40 bg-amber-950/25 text-amber-200",
  resolved: "border-emerald-400/40 bg-emerald-950/25 text-emerald-200",
  closed: "border-white/15 bg-white/[0.03] text-stone-warm/60",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function AdminTicketsSection() {
  const list = useServerFn(adminListTickets);
  const update = useServerFn(adminUpdateTicket);
  const [rows, setRows] = useState<AdminTicket[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [catFilter, setCatFilter] = useState<"all" | TicketCategory>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AdminTicket | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancel = false;
    setRows(null);
    setErr(null);
    list({
      data: {
        status: statusFilter === "all" ? undefined : statusFilter,
        category: catFilter === "all" ? undefined : catFilter,
        q: q.trim() || undefined,
        limit: 100,
      },
    })
      .then((data) => {
        if (!cancel) setRows(data);
      })
      .catch((e: Error) => !cancel && setErr(e.message));
    return () => {
      cancel = true;
    };
  }, [list, statusFilter, catFilter, q, reload]);

  const counts = useMemo(() => {
    const map: Record<TicketStatus, number> = {
      new: 0,
      in_progress: 0,
      waiting_user: 0,
      resolved: 0,
      closed: 0,
    };
    for (const r of rows ?? []) map[r.status] += 1;
    return map;
  }, [rows]);

  return (
    <section className="mx-auto mt-10 max-w-6xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">
            Feedback & tickets
          </p>
          <h2 className="mt-1 font-serif text-2xl italic text-stone-warm">反馈与工单</h2>
          <p className="mt-1 text-xs text-stone-warm/60">
            仅产品 / 设备 / 订单 / 支付 / 订阅问题。心理陪伴、命理解读与无关内容不进入这里。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.24em]">
          {(Object.keys(counts) as TicketStatus[]).map((s) => (
            <span key={s} className={`rounded-full border px-2 py-0.5 ${STATUS_STYLE[s]}`}>
              {STATUS_LABEL[s]} · {counts[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="搜索工单号 / 主题 / 内容…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-white/10 bg-obsidian/40 px-3 py-1.5 text-xs text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-white/10 bg-obsidian/40 px-2 py-1.5 text-xs text-stone-warm focus:border-gold-dust focus:outline-none"
        >
          <option value="all">状态：全部</option>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              状态：{STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as typeof catFilter)}
          className="rounded-lg border border-white/10 bg-obsidian/40 px-2 py-1.5 text-xs text-stone-warm focus:border-gold-dust focus:outline-none"
        >
          <option value="all">类别：全部</option>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              类别：{CAT_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {err && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {err}
        </p>
      )}

      <div className="glass-card overflow-hidden rounded-2xl border border-white/10">
        <div className="hidden grid-cols-[1.1fr_0.7fr_1.8fr_0.9fr_0.7fr_0.9fr] gap-3 border-b border-white/10 bg-obsidian/40 px-4 py-3 text-[10px] uppercase tracking-[0.24em] text-stone-warm/50 md:grid">
          <div>工单号</div>
          <div>类别</div>
          <div>主题</div>
          <div>状态</div>
          <div>优先级</div>
          <div>创建时间</div>
        </div>
        {rows === null ? (
          <div className="p-8 text-center text-sm text-stone-warm/50">Loading tickets…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-warm/50">暂无工单</div>
        ) : (
          rows.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpen(t)}
              className="grid w-full grid-cols-1 gap-1 border-b border-white/5 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.02] md:grid-cols-[1.1fr_0.7fr_1.8fr_0.9fr_0.7fr_0.9fr] md:items-center md:gap-3"
            >
              <div className="font-mono text-[11px] text-gold-light">{t.ticket_code}</div>
              <div className="text-xs text-stone-warm/70">{CAT_LABEL[t.category]}</div>
              <div className="truncate text-sm text-stone-warm">{t.subject ?? "—"}</div>
              <div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] ${STATUS_STYLE[t.status]}`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <div className="text-xs text-stone-warm/70">{t.priority}</div>
              <div className="text-xs text-stone-warm/60">{fmt(t.created_at)}</div>
            </button>
          ))
        )}
      </div>

      {open && (
        <TicketDrawer
          ticket={open}
          onClose={() => setOpen(null)}
          onSave={async (patch) => {
            const updated = await update({ data: { id: open.id, ...patch } });
            setOpen(updated);
            setReload((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}

function TicketDrawer({
  ticket,
  onClose,
  onSave,
}: {
  ticket: AdminTicket;
  onClose: () => void;
  onSave: (patch: {
    status?: TicketStatus;
    priority?: TicketPriority;
    admin_note?: string | null;
  }) => Promise<void>;
}) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [note, setNote] = useState(ticket.admin_note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSave({ status, priority, admin_note: note.trim() ? note.trim() : null });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gold-dust/30 bg-obsidian/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-gold-dust/20 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
              {CAT_LABEL[ticket.category]} · {ticket.ticket_code}
            </p>
            <h3 className="mt-1 font-serif text-lg text-stone-warm">{ticket.subject ?? "—"}</h3>
            <p className="mt-1 text-[11px] text-stone-warm/60">
              {ticket.user_email ?? ticket.user_id ?? "unknown user"} · {fmt(ticket.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-stone-warm/60 hover:text-gold-light"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4 text-sm text-stone-warm">
          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">用户提交</p>
            <p className="mt-1 whitespace-pre-line rounded-lg border border-white/10 bg-obsidian/50 p-3 text-[13px] leading-relaxed">
              {ticket.message}
            </p>
            {ticket.order_id && (
              <p className="mt-2 text-[11px] text-stone-warm/60">
                关联订单：<span className="font-mono">{ticket.order_id}</span>
              </p>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-stone-warm/70">
              状态
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="mt-1 w-full rounded-md border border-white/10 bg-obsidian/70 px-2 py-1.5 text-sm text-stone-warm focus:border-gold-dust focus:outline-none"
              >
                {TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-stone-warm/70">
              优先级
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="mt-1 w-full rounded-md border border-white/10 bg-obsidian/70 px-2 py-1.5 text-sm text-stone-warm focus:border-gold-dust focus:outline-none"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">
              内部备注（用户看不到）
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={4000}
              className="mt-1 w-full resize-none rounded-md border border-white/10 bg-obsidian/70 p-2 text-sm text-stone-warm focus:border-gold-dust focus:outline-none"
              placeholder="仅管理员可见"
            />
          </section>

          {ticket.user_reply && (
            <section>
              <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">用户补充</p>
              <p className="mt-1 whitespace-pre-line rounded-lg border border-white/10 bg-obsidian/50 p-2 text-[13px]">
                {ticket.user_reply}
              </p>
            </section>
          )}

          {err && (
            <p className="rounded-md border border-red-500/30 bg-red-950/30 px-2 py-1 text-sm text-red-300">
              {err}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gold-dust/20 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-stone-warm/80 hover:border-gold-dust/40"
          >
            关闭
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-full border border-gold-dust/40 bg-gold-dust/15 px-4 py-1.5 text-xs text-gold-light hover:bg-gold-dust/25 disabled:opacity-40"
          >
            {busy ? "保存中…" : "保存修改"}
          </button>
        </div>
      </div>
    </div>
  );
}
