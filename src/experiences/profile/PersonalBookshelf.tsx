/**
 * PersonalBookshelf — the visual bookshelf on /me/profile.
 *
 * Distinct from the legacy ChartManager list. It renders:
 *   • A glowing "main spine" for the primary self-chart with a
 *     completeness ring bound to real chart fields (date/time/place)
 *     and whether any report has been generated.
 *   • A horizontal-scrolling shelf of the user's other self-charts.
 *   • A horizontal-scrolling relationship shelf for other-people.
 *   • Ambient stardust particles anchored to the main spine.
 *
 * All data comes from real server functions; no fabricated content.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import {
  deleteChart,
  listUserCharts,
  renameChart,
  setChartRelationshipLabel,
  setChartRole,
  setPrimaryChart,
  type ChartRow,
} from "@/lib/reports-store.functions";
import { useDaily } from "@/lib/i18n-daily";

export type PersonalBookshelfProps = {
  charts: ChartRow[];
  onChanged: (next: ChartRow[]) => void;
};

/* -------------------- helpers -------------------- */

function identityKey(c: ChartRow): string {
  return [
    (c.birth_date ?? "").trim(),
    (c.birth_time ?? "").trim(),
    (c.birth_place ?? "").trim().toLowerCase(),
  ].join("|");
}

type Group = { key: string; head: ChartRow; duplicates: ChartRow[] };

function groupByIdentity(rows: ChartRow[]): Group[] {
  const seen = new Map<string, Group>();
  for (const r of rows) {
    const k = identityKey(r);
    const g = seen.get(k);
    if (!g) seen.set(k, { key: k, head: r, duplicates: [] });
    else g.duplicates.push(r);
  }
  return [...seen.values()];
}

function completenessFor(c: ChartRow): {
  pct: number;
  missing: Array<"time" | "place" | "report">;
} {
  const missing: Array<"time" | "place" | "report"> = [];
  let score = 25; // birth_date is always present for saved charts
  if (c.birth_time) score += 25;
  else missing.push("time");
  if (c.birth_place) score += 25;
  else missing.push("place");
  const hasReport = c.reports?.some((r) => r.status === "completed" || r.status === "ready");
  if (hasReport) score += 25;
  else missing.push("report");
  return { pct: score, missing };
}

/* -------------------- root -------------------- */

export function PersonalBookshelf({ charts, onChanged }: PersonalBookshelfProps) {
  const d = useDaily();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [expandedDupes, setExpandedDupes] = useState<Set<string>>(new Set());

  const primary = charts.find((c) => c.is_primary && c.chart_role === "self") ?? null;
  const otherSelf = charts.filter((c) => c.chart_role === "self" && !c.is_primary);
  const relations = charts.filter((c) => c.chart_role === "other");

  const otherSelfGroups = useMemo(() => groupByIdentity(otherSelf), [otherSelf]);
  const relationGroups = useMemo(() => groupByIdentity(relations), [relations]);

  const refresh = async () => {
    try {
      onChanged(await listUserCharts());
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
    if (!name) return setError(d.charts_name_empty_error);
    if (name.length > 120) return setError(d.charts_name_too_long_error);
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
      !window.confirm(d.charts_delete_confirm(c.name ?? d.charts_untitled_other))
    )
      return;
    void runAction(c.id, () => deleteChart({ data: { chartId: c.id, scope: "chart" } }));
  };

  return (
    <div className="space-y-10" data-testid="personal-bookshelf">
      {error && (
        <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {d.charts_error_generic(error)}
        </div>
      )}

      {/* ---------- Main Spine ---------- */}
      <section aria-labelledby="bookshelf-primary">
        <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
          {d.bookshelf_main_book_label}
        </div>
        {primary ? (
          <MainSpine
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
          <MissingPrimary />
        )}
      </section>

      {/* ---------- Other-self shelf ---------- */}
      <ShelfRow
        title={d.profile_section_others}
        emptyMsg={d.bookshelf_no_others}
        groups={otherSelfGroups}
        variant="self"
        busyId={busyId}
        editingId={editingId}
        draftName={draftName}
        openMenu={openMenu}
        expandedDupes={expandedDupes}
        onToggleDupes={toggleDupes}
        onOpenMenu={(id) => setOpenMenu(openMenu === id ? null : id)}
        onCloseMenu={() => setOpenMenu(null)}
        onDraftName={setDraftName}
        onStartRename={startRename}
        onCancelRename={() => setEditingId(null)}
        onCommitRename={commitRename}
        onSetPrimary={(id) =>
          runAction(id, () => setPrimaryChart({ data: { chartId: id } }))
        }
        onFlipRole={(id) =>
          runAction(id, () =>
            setChartRole({ data: { chartId: id, role: "other" } }),
          )
        }
        onDelete={confirmDelete}
      />

      {/* ---------- Relationship shelf ---------- */}
      <div>
        <p className="mb-3 text-xs text-amber-200/60">{d.bookshelf_relations_privacy}</p>
        <ShelfRow
          title={d.profile_section_relations}
          emptyMsg={d.bookshelf_no_relations}
          groups={relationGroups}
          variant="relation"
          busyId={busyId}
          editingId={editingId}
          draftName={draftName}
          openMenu={openMenu}
          expandedDupes={expandedDupes}
          onToggleDupes={toggleDupes}
          onOpenMenu={(id) => setOpenMenu(openMenu === id ? null : id)}
          onCloseMenu={() => setOpenMenu(null)}
          onDraftName={setDraftName}
          onStartRename={startRename}
          onCancelRename={() => setEditingId(null)}
          onCommitRename={commitRename}
          onSetPrimary={(id) =>
            runAction(id, () => setPrimaryChart({ data: { chartId: id } }))
          }
          onFlipRole={(id) =>
            runAction(id, () =>
              setChartRole({ data: { chartId: id, role: "self" } }),
            )
          }
          onDelete={confirmDelete}
        />
      </div>
    </div>
  );
}

/* -------------------- MissingPrimary -------------------- */

function MissingPrimary() {
  const d = useDaily();
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-transparent p-6">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <Stardust />
      </div>
      <div className="relative">
        <div className="font-serif text-xl text-amber-50">
          {d.charts_primary_missing_title}
        </div>
        <p className="mt-2 text-sm text-amber-200/70">
          {d.charts_primary_missing_body}
        </p>
        <div className="mt-4">
          <Link
            to="/ritual"
            className="min-h-11 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
          >
            {d.charts_primary_missing_cta_ritual}
          </Link>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Main Spine -------------------- */

function MainSpine(props: {
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
  const { pct, missing } = completenessFor(c);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-500/15 via-purple-500/10 to-transparent p-5 shadow-[0_0_60px_rgba(251,191,36,0.15)] md:p-7"
      data-testid="bookshelf-main-spine"
    >
      {/* Ambient stardust */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Stardust />
      </div>
      {/* Gilt edge */}
      <div className="pointer-events-none absolute inset-y-4 left-2 hidden w-[3px] rounded-full bg-gradient-to-b from-amber-300/60 via-amber-400/30 to-amber-300/60 md:block" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
        {/* Completeness ring */}
        <div className="flex items-center gap-4">
          <CompletenessRing pct={pct} />
          <div className="md:hidden">
            <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
              {pct === 100 ? d.bookshelf_completeness_full : d.bookshelf_completeness(pct)}
            </div>
          </div>
        </div>

        {/* Book details */}
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
              <div className="truncate font-serif text-2xl text-amber-50 md:text-3xl">
                {name}
              </div>
              <div className="mt-1 text-xs text-amber-200/70">
                {c.birth_date ?? d.my_charts_missing_date}
                {c.birth_time ? ` · ${c.birth_time}` : ""}
                {c.birth_place ? ` · ${c.birth_place}` : ""}
              </div>
              <div className="mt-2 hidden text-[11px] uppercase tracking-widest text-amber-200/70 md:block">
                {pct === 100 ? d.bookshelf_completeness_full : d.bookshelf_completeness(pct)}
              </div>
              {missing.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-amber-200/60">
                  {missing.includes("time") && <li>· {d.bookshelf_missing_time}</li>}
                  {missing.includes("place") && <li>· {d.bookshelf_missing_place}</li>}
                  {missing.includes("report") && <li>· {d.bookshelf_missing_report}</li>}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
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
                { label: d.bookshelf_role_toggle_other, onClick: props.onMakeOther },
                { label: d.charts_action_delete, onClick: props.onDelete, danger: true },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Completeness Ring -------------------- */

function CompletenessRing({ pct }: { pct: number }) {
  const size = 72;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circ * (1 - clamped / 100);
  return (
    <div className="relative" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} className="block" role="img">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="fill-none stroke-amber-400/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="fill-none stroke-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-serif text-sm text-amber-100">
        {clamped}%
      </div>
    </div>
  );
}

/* -------------------- Stardust -------------------- */

function Stardust() {
  // Deterministic star positions — no random per render.
  const stars = [
    { top: "10%", left: "8%", size: 2, delay: "0s" },
    { top: "22%", left: "62%", size: 3, delay: "0.4s" },
    { top: "48%", left: "18%", size: 2, delay: "1.2s" },
    { top: "70%", left: "80%", size: 2, delay: "0.8s" },
    { top: "82%", left: "35%", size: 3, delay: "1.6s" },
    { top: "30%", left: "88%", size: 2, delay: "2.0s" },
    { top: "58%", left: "50%", size: 2, delay: "2.4s" },
    { top: "12%", left: "42%", size: 2, delay: "1.0s" },
  ];
  return (
    <>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute animate-pulse-gold rounded-full bg-amber-200/70"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            boxShadow: "0 0 6px rgba(251,191,36,0.65)",
          }}
        />
      ))}
    </>
  );
}

/* -------------------- Horizontal shelf -------------------- */

function ShelfRow(props: {
  title: string;
  emptyMsg: string;
  groups: Group[];
  variant: "self" | "relation";
  busyId: string | null;
  editingId: string | null;
  draftName: string;
  openMenu: string | null;
  expandedDupes: Set<string>;
  onToggleDupes: (key: string) => void;
  onOpenMenu: (id: string) => void;
  onCloseMenu: () => void;
  onDraftName: (s: string) => void;
  onStartRename: (c: ChartRow) => void;
  onCancelRename: () => void;
  onCommitRename: (id: string) => void;
  onSetPrimary: (id: string) => void;
  onFlipRole: (id: string) => void;
  onDelete: (c: ChartRow) => void;
}) {
  const d = useDaily();
  const scrollRef = useRef<HTMLDivElement>(null);
  const canScroll = props.groups.length > 2;
  return (
    <section aria-label={props.title}>
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-amber-200/70">
        <span>{props.title}</span>
        {canScroll && (
          <span className="hidden text-[10px] normal-case tracking-normal text-amber-200/50 md:inline">
            {d.bookshelf_shelf_scroll_hint}
          </span>
        )}
      </div>
      {props.groups.length === 0 ? (
        <p className="text-sm text-amber-200/50">{props.emptyMsg}</p>
      ) : (
        <div
          ref={scrollRef}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {props.groups.map((g) => (
            <SpineCard
              key={g.head.id}
              group={g}
              variant={props.variant}
              busyId={props.busyId}
              editingId={props.editingId}
              draftName={props.draftName}
              openMenu={props.openMenu}
              expanded={props.expandedDupes.has(g.key)}
              onToggleDupes={() => props.onToggleDupes(g.key)}
              onOpenMenu={props.onOpenMenu}
              onCloseMenu={props.onCloseMenu}
              onDraftName={props.onDraftName}
              onStartRename={props.onStartRename}
              onCancelRename={props.onCancelRename}
              onCommitRename={props.onCommitRename}
              onSetPrimary={props.onSetPrimary}
              onFlipRole={props.onFlipRole}
              onDelete={props.onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------- Spine Card -------------------- */

function SpineCard(props: {
  group: Group;
  variant: "self" | "relation";
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
  onFlipRole: (id: string) => void;
  onDelete: (c: ChartRow) => void;
}) {
  const d = useDaily();
  const c = props.group.head;
  const name =
    c.name ??
    (props.variant === "relation" ? d.charts_untitled_other : d.my_charts_unnamed);
  const editing = props.editingId === c.id;
  const busy = props.busyId === c.id;
  const isRel = props.variant === "relation";

  return (
    <article
      className={`relative flex min-w-[260px] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border p-4 transition-transform hover:-translate-y-1 ${
        isRel
          ? "border-purple-400/30 bg-gradient-to-b from-purple-500/10 via-black/40 to-black/60"
          : "border-amber-400/25 bg-gradient-to-b from-amber-500/10 via-black/40 to-black/60"
      }`}
    >
      {/* Gilt edge */}
      <div
        className={`pointer-events-none absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${
          isRel ? "bg-purple-300/50" : "bg-amber-300/60"
        }`}
      />
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
          <div className="flex items-start justify-between gap-2 pl-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-lg text-amber-50">{name}</div>
              <div className="mt-1 text-[11px] text-amber-200/60">
                {c.birth_date ?? d.my_charts_missing_date}
                {c.birth_time ? ` · ${c.birth_time}` : ""}
              </div>
              {c.birth_place && (
                <div className="truncate text-[11px] text-amber-200/50">
                  {c.birth_place}
                </div>
              )}
              <div
                className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                  isRel
                    ? "border-purple-300/40 text-purple-200/80"
                    : "border-amber-300/40 text-amber-300/80"
                }`}
              >
                {isRel ? d.bookshelf_relation_card_label : d.charts_role_self}
              </div>
            </div>
            <MoreMenu
              busy={busy}
              open={props.openMenu === c.id}
              onToggle={() => props.onOpenMenu(c.id)}
              onClose={props.onCloseMenu}
              items={
                isRel
                  ? [
                      { label: d.charts_action_rename, onClick: () => props.onStartRename(c) },
                      { label: d.bookshelf_role_toggle_self, onClick: () => props.onFlipRole(c.id) },
                      { label: d.charts_action_delete, onClick: () => props.onDelete(c), danger: true },
                    ]
                  : [
                      { label: d.charts_action_set_primary, onClick: () => props.onSetPrimary(c.id) },
                      { label: d.charts_action_rename, onClick: () => props.onStartRename(c) },
                      { label: d.bookshelf_role_toggle_other, onClick: () => props.onFlipRole(c.id) },
                      { label: d.charts_action_delete, onClick: () => props.onDelete(c), danger: true },
                    ]
              }
            />
          </div>

          <div className="mt-3 pl-3">
            {isRel ? (
              <Link
                to="/me/match"
                className="min-h-11 inline-flex items-center rounded-full border border-purple-300/40 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-100 hover:bg-purple-500/20"
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

          {props.group.duplicates.length > 0 && (
            <div className="mt-3 border-t border-amber-400/10 pt-3 pl-3">
              <button
                type="button"
                onClick={props.onToggleDupes}
                className="text-[11px] text-amber-200/70 underline decoration-dotted underline-offset-2 hover:text-amber-100"
              >
                {d.bookshelf_duplicates_found(props.group.duplicates.length)} ·{" "}
                {props.expanded ? d.bookshelf_hide_duplicates : d.bookshelf_show_duplicates}
              </button>
              {props.expanded && (
                <ul className="mt-2 space-y-1 text-[11px] text-amber-200/60">
                  {props.group.duplicates.map((dup) => (
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
    </article>
  );
}

/* -------------------- Shared primitives -------------------- */

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
