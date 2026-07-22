/**
 * ChartManager — shared bookshelf UI for a user's saved charts.
 *
 * Extracted from `/me/home` so `/me/profile` (the new dedicated
 * personal space) owns the primary/other management surface, and the
 * daily-room page can stay focused on today's reading.
 *
 * Behavior contract matches the previous inline implementation:
 * rename / set-primary / mark-other / delete, one row at a time, with
 * confirm() gate before delete and error surfacing per row.
 */

import { useState } from "react";

import {
  deleteChart,
  listUserCharts,
  renameChart,
  setChartRole,
  setPrimaryChart,
  type ChartRow,
} from "@/lib/reports-store.functions";
import { useDaily } from "@/lib/i18n-daily";

export type ChartManagerProps = {
  charts: ChartRow[];
  onChanged: (next: ChartRow[]) => void;
};

export function ChartManager({ charts, onChanged }: ChartManagerProps) {
  const d = useDaily();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const primary = charts.find((c) => c.is_primary && c.chart_role === "self") ?? null;
  const others = charts.filter((c) => c.id !== primary?.id);

  const refresh = async () => {
    try {
      const next = await listUserCharts();
      onChanged(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    }
  };

  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setBusyId(null);
    }
  };

  const startRename = (c: ChartRow) => {
    setEditingId(c.id);
    setDraftName(c.name ?? "");
    setError(null);
  };

  const commitRename = async (id: string) => {
    const name = draftName.trim();
    if (!name) {
      setError(d.charts_name_empty_error);
      return;
    }
    if (name.length > 120) {
      setError(d.charts_name_too_long_error);
      return;
    }
    await runAction(id, async () => {
      await renameChart({ data: { chartId: id, name } });
      setEditingId(null);
    });
  };

  return (
    <div className="space-y-4" data-testid="chart-manager">
      <div className="text-amber-200/70">{d.my_charts_count(charts.length)}</div>
      {charts.length === 0 && (
        <div className="text-amber-200/60">{d.my_charts_empty}</div>
      )}
      {error && <div className="text-rose-300/80">{d.charts_error_generic(error)}</div>}

      {/* Primary slot — the "main book" */}
      <div className="rounded-lg border border-amber-300/40 bg-gradient-to-br from-amber-500/10 via-transparent to-purple-500/5 p-3 shadow-[0_0_24px_rgba(251,191,36,0.08)]">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-widest text-amber-200">
          <span>{d.charts_primary_title}</span>
          <span className="rounded-full border border-amber-300/50 px-2 py-0.5 text-[10px] text-amber-100">
            {d.charts_role_self}
          </span>
        </div>
        {primary ? (
          <ChartRowCard
            c={primary}
            isPrimary
            busy={busyId === primary.id}
            editing={editingId === primary.id}
            draftName={draftName}
            onDraftName={setDraftName}
            onStartRename={() => startRename(primary)}
            onCancelRename={() => setEditingId(null)}
            onCommitRename={() => commitRename(primary.id)}
            onMakeOther={() =>
              runAction(primary.id, () =>
                setChartRole({ data: { chartId: primary.id, role: "other" } }),
              )
            }
            onSetPrimary={() => {}}
            onDelete={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm(
                  d.charts_delete_confirm(primary.name ?? d.charts_untitled_other),
                )
              ) {
                return;
              }
              void runAction(primary.id, () =>
                deleteChart({ data: { chartId: primary.id, scope: "chart" } }),
              );
            }}
          />
        ) : (
          <div className="text-amber-100/80">
            <div className="font-medium text-amber-100">{d.charts_primary_missing_title}</div>
            <p className="mt-1 text-amber-200/70">{d.charts_primary_missing_body}</p>
          </div>
        )}
      </div>

      {/* Others */}
      {others.length > 0 && (
        <div className="rounded-lg border border-amber-400/15 bg-black/20 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-amber-200/70">
            {d.charts_others_title}
          </div>
          <div className="space-y-2">
            {others.map((c) => (
              <ChartRowCard
                key={c.id}
                c={c}
                isPrimary={false}
                busy={busyId === c.id}
                editing={editingId === c.id}
                draftName={draftName}
                onDraftName={setDraftName}
                onStartRename={() => startRename(c)}
                onCancelRename={() => setEditingId(null)}
                onCommitRename={() => commitRename(c.id)}
                onMakeOther={() => {}}
                onSetPrimary={() =>
                  runAction(c.id, () => setPrimaryChart({ data: { chartId: c.id } }))
                }
                onDelete={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm(
                      d.charts_delete_confirm(c.name ?? d.charts_untitled_other),
                    )
                  ) {
                    return;
                  }
                  void runAction(c.id, () =>
                    deleteChart({ data: { chartId: c.id, scope: "chart" } }),
                  );
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-amber-200/50">{d.charts_privacy_notice}</p>
        </div>
      )}
    </div>
  );
}

function ChartRowCard(props: {
  c: ChartRow;
  isPrimary: boolean;
  busy: boolean;
  editing: boolean;
  draftName: string;
  onDraftName: (s: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
  onSetPrimary: () => void;
  onMakeOther: () => void;
  onDelete: () => void;
}) {
  const d = useDaily();
  const { c, isPrimary, busy, editing } = props;
  const displayName = c.name ?? (isPrimary ? d.my_charts_unnamed : d.charts_untitled_other);
  return (
    <div className="rounded-md border border-amber-400/10 bg-black/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              type="text"
              value={props.draftName}
              onChange={(e) => props.onDraftName(e.target.value)}
              placeholder={d.charts_name_placeholder}
              maxLength={120}
              className="flex-1 min-w-[10rem] rounded border border-amber-400/30 bg-black/40 px-2 py-1 text-amber-100 outline-none focus:border-amber-300"
              autoFocus
            />
            <button
              type="button"
              disabled={busy}
              onClick={props.onCommitRename}
              className="min-h-11 rounded border border-emerald-400/40 px-3 py-1 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              {busy ? d.charts_saving : d.charts_action_save}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={props.onCancelRename}
              className="min-h-11 rounded border border-amber-400/20 px-3 py-1 text-amber-200 hover:bg-amber-500/5 disabled:opacity-50"
            >
              {d.charts_action_cancel}
            </button>
          </div>
        ) : (
          <>
            <div className="text-amber-100">
              <div className="font-medium">{displayName}</div>
              <div className="text-[11px] text-amber-200/60">
                {c.birth_date ?? d.my_charts_missing_date} {c.birth_time ?? ""}
                {c.birth_place ? ` · ${c.birth_place}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={props.onStartRename}
                className="min-h-11 rounded border border-amber-400/25 px-3 py-1 text-amber-200 hover:bg-amber-500/5 disabled:opacity-50"
              >
                {d.charts_action_rename}
              </button>
              {isPrimary ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={props.onMakeOther}
                  className="min-h-11 rounded border border-amber-400/25 px-3 py-1 text-amber-200 hover:bg-amber-500/5 disabled:opacity-50"
                >
                  {busy ? d.charts_setting_primary : d.charts_action_make_other}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={props.onSetPrimary}
                  className="min-h-11 rounded border border-emerald-400/40 px-3 py-1 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  {busy ? d.charts_setting_primary : d.charts_action_set_primary}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={props.onDelete}
                className="min-h-11 rounded border border-rose-400/30 px-3 py-1 text-rose-200 hover:bg-rose-500/5 disabled:opacity-50"
              >
                {d.charts_action_delete}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
