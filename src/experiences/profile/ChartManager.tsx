/**
 * ChartManager — the "Destiny Library Bookshelf" for a user's charts.
 *
 * Visual model (per Phase 2 spec):
 *   • The primary self-chart is rendered as a large, glowing "main book".
 *   • The user's other self-charts are compact spine cards.
 *   • Charts marked as other-people belong to a private "relationship
 *     shelf" — these lead with a "Compatibility" action.
 *   • Charts that share the same normalised birth details as another
 *     row on the shelf are visually merged behind a "Show duplicates"
 *     disclosure so the shelf never floods the viewport.
 *   • Every secondary action (rename, change role, delete) is tucked
 *     under a per-card "…" menu so the primary CTA stays clean.
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

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

/** Non-canonical identity key used purely for visual duplicate grouping. */
function identityKey(c: ChartRow): string {
  return [
    (c.birth_date ?? "").trim(),
    (c.birth_time ?? "").trim(),
    (c.birth_place ?? "").trim().toLowerCase(),
  ].join("|");
}

type ChartGroup = {
  key: string;
  head: ChartRow;
  duplicates: ChartRow[];
};

function groupByIdentity(rows: ChartRow[]): ChartGroup[] {
  const seen = new Map<string, ChartGroup>();
  for (const r of rows) {
    const k = identityKey(r);
    const g = seen.get(k);
    if (!g) {
      seen.set(k, { key: k, head: r, duplicates: [] });
    } else {
      g.duplicates.push(r);
    }
  }
  return [...seen.values()];
}

export function ChartManager({ charts, onChanged }: ChartManagerProps) {
  const d = useDaily();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [expandedDupes, setExpandedDupes] = useState<Set<string>>(new Set());

  const primary = charts.find((c) => c.is_primary && c.chart_role === "self") ?? null;
  const otherSelf = charts.filter(
    (c) => c.chart_role === "self" && !c.is_primary,
  );
  const relations = charts.filter((c) => c.chart_role === "other");

  const otherSelfGroups = useMemo(() => groupByIdentity(otherSelf), [otherSelf]);
  const relationGroups = useMemo(() => groupByIdentity(relations), [relations]);

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
      setOpenMenu(null);
    }
  };

  const startRename = (c: ChartRow) => {
    setEditingId(c.id);
    setDraftName(c.name ?? "");
    setError(null);
    setOpenMenu(null);
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

  const toggleDupes = (key: string) => {
    setExpandedDupes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmDelete = (c: ChartRow) => {
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
  };

  return (
    <div className="space-y-8" data-testid="chart-manager">
      {error && (
        <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {d.charts_error_generic(error)}
        </div>
      )}

      {/* Primary — the glowing main book */}
      <section>
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
          <span>{d.bookshelf_main_book_label}</span>
        </div>
        {primary ? (
          <MainBookCard
            c={primary}
            busy={busyId === primary.id}
            editing={editingId === primary.id}
            draftName={draftName}
            menuOpen={openMenu === primary.id}
            onOpenMenu={() =>
              setOpenMenu(openMenu === primary.id ? null : primary.id)
            }
            onCloseMenu={() => setOpenMenu(null)}
            onDraftName={setDraftName}
            onStartRename={() => startRename(primary)}
            onCancelRename={() => setEditingId(null)}
            onCommitRename={() => commitRename(primary.id)}
            onMakeOther={() =>
              runAction(primary.id, () =>
                setChartRole({ data: { chartId: primary.id, role: "other" } }),
              )
            }
            onDelete={() => confirmDelete(primary)}
          />
        ) : (
          <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-6 text-amber-100/80">
            <div className="text-lg font-serif">{d.charts_primary_missing_title}</div>
            <p className="mt-2 text-sm text-amber-200/70">{d.charts_primary_missing_body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/ritual"
                className="min-h-11 rounded-full border border-amber-300/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
              >
                {d.charts_primary_missing_cta_ritual}
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Other self charts — spine cards */}
      <section>
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
          <span>{d.profile_section_others}</span>
        </div>
        {otherSelfGroups.length === 0 ? (
          <p className="text-sm text-amber-200/50">{d.bookshelf_no_others}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {otherSelfGroups.map((g) => (
              <SpineCard
                key={g.head.id}
                group={g}
                busyId={busyId}
                editingId={editingId}
                draftName={draftName}
                openMenu={openMenu}
                expanded={expandedDupes.has(g.key)}
                onToggleDupes={() => toggleDupes(g.key)}
                onOpenMenu={(id) => setOpenMenu(openMenu === id ? null : id)}
                onCloseMenu={() => setOpenMenu(null)}
                onDraftName={setDraftName}
                onStartRename={startRename}
                onCancelRename={() => setEditingId(null)}
                onCommitRename={commitRename}
                onSetPrimary={(id) =>
                  runAction(id, () => setPrimaryChart({ data: { chartId: id } }))
                }
                onMarkOther={(id) =>
                  runAction(id, () =>
                    setChartRole({ data: { chartId: id, role: "other" } }),
                  )
                }
                onDelete={confirmDelete}
                variant="self"
              />
            ))}
          </div>
        )}
      </section>

      {/* Relationship shelf — other people */}
      <section>
        <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
          <span>{d.profile_section_relations}</span>
        </div>
        <p className="mb-3 text-xs text-amber-200/60">{d.bookshelf_relations_privacy}</p>
        {relationGroups.length === 0 ? (
          <p className="text-sm text-amber-200/50">{d.bookshelf_no_relations}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {relationGroups.map((g) => (
              <SpineCard
                key={g.head.id}
                group={g}
                busyId={busyId}
                editingId={editingId}
                draftName={draftName}
                openMenu={openMenu}
                expanded={expandedDupes.has(g.key)}
                onToggleDupes={() => toggleDupes(g.key)}
                onOpenMenu={(id) => setOpenMenu(openMenu === id ? null : id)}
                onCloseMenu={() => setOpenMenu(null)}
                onDraftName={setDraftName}
                onStartRename={startRename}
                onCancelRename={() => setEditingId(null)}
                onCommitRename={commitRename}
                onSetPrimary={(id) =>
                  runAction(id, () => setPrimaryChart({ data: { chartId: id } }))
                }
                onMarkOther={(id) =>
                  runAction(id, () =>
                    setChartRole({ data: { chartId: id, role: "self" } }),
                  )
                }
                onDelete={confirmDelete}
                variant="relation"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main book — the glowing primary chart                              */
/* ------------------------------------------------------------------ */

function MainBookCard(props: {
  c: ChartRow;
  busy: boolean;
  editing: boolean;
  draftName: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onDraftName: (s: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
  onMakeOther: () => void;
  onDelete: () => void;
}) {
  const d = useDaily();
  const { c, busy, editing } = props;
  const name = c.name ?? d.my_charts_unnamed;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/15 via-purple-500/5 to-transparent p-5 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_60%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <RenameField
              value={props.draftName}
              busy={busy}
              onChange={props.onDraftName}
              onCommit={props.onCommitRename}
              onCancel={props.onCancelRename}
            />
          ) : (
            <>
              <div className="truncate font-serif text-2xl text-amber-50">{name}</div>
              <div className="mt-1 text-xs text-amber-200/70">
                {c.birth_date ?? d.my_charts_missing_date} {c.birth_time ?? ""}
                {c.birth_place ? ` · ${c.birth_place}` : ""}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="relative flex flex-wrap gap-2">
            <Link
              to="/me/home"
              className="min-h-11 rounded-full border border-amber-300/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
            >
              {d.bookshelf_open_today}
            </Link>
            <Link
              to="/report"
              search={{ readingId: c.id }}
              className="min-h-11 rounded-full border border-amber-400/30 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/5"
            >
              {d.bookshelf_open_report}
            </Link>
            <MoreMenu
              busy={busy}
              open={props.menuOpen}
              onToggle={props.onOpenMenu}
              onClose={props.onCloseMenu}
              items={[
                { label: d.charts_action_rename, onClick: props.onStartRename },
                {
                  label: d.bookshelf_role_toggle_other,
                  onClick: props.onMakeOther,
                },
                {
                  label: d.charts_action_delete,
                  onClick: props.onDelete,
                  danger: true,
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spine card — used for other-self and relationship charts           */
/* ------------------------------------------------------------------ */

function SpineCard(props: {
  group: ChartGroup;
  busyId: string | null;
  editingId: string | null;
  draftName: string;
  openMenu: string | null;
  expanded: boolean;
  onToggleDupes: () => void;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
  onDraftName: (s: string) => void;
  onStartRename: (c: ChartRow) => void;
  onCancelRename: () => void;
  onCommitRename: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onMarkOther: (id: string) => void;
  onDelete: (c: ChartRow) => void;
  variant: "self" | "relation";
}) {
  const d = useDaily();
  const { group } = props;
  const c = group.head;
  const name = c.name ?? (props.variant === "relation" ? d.charts_untitled_other : d.my_charts_unnamed);
  const editing = props.editingId === c.id;
  const busy = props.busyId === c.id;

  return (
    <div
      className={`rounded-xl border p-4 ${
        props.variant === "relation"
          ? "border-purple-400/25 bg-black/30"
          : "border-amber-400/20 bg-black/30"
      }`}
    >
      {editing ? (
        <RenameField
          value={props.draftName}
          busy={busy}
          onChange={props.onDraftName}
          onCommit={() => props.onCommitRename(c.id)}
          onCancel={props.onCancelRename}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-lg text-amber-50">{name}</div>
              <div className="mt-0.5 text-[11px] text-amber-200/60">
                {c.birth_date ?? d.my_charts_missing_date} {c.birth_time ?? ""}
                {c.birth_place ? ` · ${c.birth_place}` : ""}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-amber-300/50">
                {props.variant === "relation"
                  ? d.bookshelf_relation_card_label
                  : d.charts_role_self}
              </div>
            </div>
            <MoreMenu
              busy={busy}
              open={props.openMenu === c.id}
              onToggle={() => props.onOpenMenu(c.id)}
              onClose={props.onCloseMenu}
              items={
                props.variant === "self"
                  ? [
                      {
                        label: d.charts_action_set_primary,
                        onClick: () => props.onSetPrimary(c.id),
                      },
                      { label: d.charts_action_rename, onClick: () => props.onStartRename(c) },
                      {
                        label: d.bookshelf_role_toggle_other,
                        onClick: () => props.onMarkOther(c.id),
                      },
                      {
                        label: d.charts_action_delete,
                        onClick: () => props.onDelete(c),
                        danger: true,
                      },
                    ]
                  : [
                      { label: d.charts_action_rename, onClick: () => props.onStartRename(c) },
                      {
                        label: d.bookshelf_role_toggle_self,
                        onClick: () => props.onMarkOther(c.id),
                      },
                      {
                        label: d.charts_action_delete,
                        onClick: () => props.onDelete(c),
                        danger: true,
                      },
                    ]
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {props.variant === "relation" ? (
              <Link
                to="/me/match"
                className="min-h-11 rounded-full border border-purple-300/40 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-100 hover:bg-purple-500/20"
              >
                {d.bookshelf_open_match}
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => props.onSetPrimary(c.id)}
                className="min-h-11 rounded-full border border-emerald-400/40 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                {busy ? d.charts_setting_primary : d.charts_action_set_primary}
              </button>
            )}
          </div>

          {group.duplicates.length > 0 && (
            <div className="mt-3 border-t border-amber-400/10 pt-3">
              <button
                type="button"
                onClick={props.onToggleDupes}
                className="text-[11px] text-amber-200/70 underline decoration-dotted underline-offset-2 hover:text-amber-100"
              >
                {d.bookshelf_duplicates_found(group.duplicates.length)} ·{" "}
                {props.expanded ? d.bookshelf_hide_duplicates : d.bookshelf_show_duplicates}
              </button>
              {props.expanded && (
                <ul className="mt-2 space-y-1 text-[11px] text-amber-200/60">
                  {group.duplicates.map((dup) => (
                    <li
                      key={dup.id}
                      className="flex items-center justify-between gap-2 rounded border border-amber-400/10 bg-black/30 px-2 py-1"
                    >
                      <span className="truncate">{dup.name ?? d.my_charts_unnamed}</span>
                      <button
                        type="button"
                        disabled={props.busyId === dup.id}
                        onClick={() => props.onDelete(dup)}
                        className="min-h-8 rounded border border-rose-400/30 px-2 py-0.5 text-[10px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        {d.charts_action_delete}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared primitives                                                  */
/* ------------------------------------------------------------------ */

function RenameField(props: {
  value: string;
  busy: boolean;
  onChange: (s: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const d = useDaily();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={d.charts_name_placeholder}
        maxLength={120}
        className="min-w-[10rem] flex-1 rounded border border-amber-400/30 bg-black/40 px-2 py-1 text-amber-100 outline-none focus:border-amber-300"
        autoFocus
      />
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onCommit}
        className="min-h-11 rounded border border-emerald-400/40 px-3 py-1 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
      >
        {props.busy ? d.charts_saving : d.charts_action_save}
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onCancel}
        className="min-h-11 rounded border border-amber-400/20 px-3 py-1 text-amber-200 hover:bg-amber-500/5 disabled:opacity-50"
      >
        {d.charts_action_cancel}
      </button>
    </div>
  );
}

function MoreMenu(props: {
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: Array<{ label: string; onClick: () => void; danger?: boolean }>;
}) {
  const d = useDaily();
  return (
    <div className="relative">
      <button
        type="button"
        disabled={props.busy}
        onClick={props.onToggle}
        aria-label={d.bookshelf_more_menu}
        aria-expanded={props.open}
        className="min-h-11 min-w-11 rounded-full border border-amber-400/25 px-3 py-1 text-amber-200 hover:bg-amber-500/5 disabled:opacity-50"
      >
        ⋯
      </button>
      {props.open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={props.onClose}
            className="fixed inset-0 z-10 cursor-default"
          />
          <ul
            role="menu"
            className="absolute right-0 z-20 mt-1 min-w-[10rem] rounded-md border border-amber-400/25 bg-[#12121b] p-1 shadow-lg"
          >
            {props.items.map((it, i) => (
              <li key={i}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    it.onClick();
                    props.onClose();
                  }}
                  className={`block w-full rounded px-3 py-2 text-left text-sm ${
                    it.danger
                      ? "text-rose-200 hover:bg-rose-500/10"
                      : "text-amber-100 hover:bg-amber-500/10"
                  }`}
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
