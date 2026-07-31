/**
 * EntrustPanel — the librarian picks a traveler to entrust a letter to.
 *
 * Two jobs: narrow a long helper list down fast (search, academy / element /
 * age band preference, and history-based buckets such as "never entrusted" or
 * "has replied before"), and reuse phrasing through editable note templates
 * kept in localStorage.
 */
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import {
  fillTemplate,
  loadNoteTemplates,
  saveNoteTemplates,
  type NoteTemplate,
} from "@/lib/assign-note-templates";
import type { LibrarianHelper } from "@/lib/sage-council.server";

type HistoryFilter = "all" | "new" | "replied" | "idle" | "busy";

export function EntrustPanel({
  helpers,
  topicLabel,
  pending,
  error,
  onAssign,
}: {
  helpers: LibrarianHelper[];
  topicLabel: string;
  pending: boolean;
  error: string | null;
  onAssign: (assigneeId: string, note: string | null) => void;
}) {
  const c = useCommunityHall();
  const zh = c.lang !== "en";

  const [q, setQ] = useState("");
  const [academy, setAcademy] = useState("");
  const [element, setElement] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [history, setHistory] = useState<HistoryFilter>("all");
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");

  const [templates, setTemplates] = useState<NoteTemplate[]>(() => loadNoteTemplates());
  const [manageOpen, setManageOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const academies = useMemo(
    () => Array.from(new Set(helpers.map((h) => h.academy).filter(Boolean) as string[])).sort(),
    [helpers],
  );
  const elements = useMemo(
    () => Array.from(new Set(helpers.map((h) => h.element).filter(Boolean) as string[])).sort(),
    [helpers],
  );
  const ageBands = useMemo(
    () => Array.from(new Set(helpers.map((h) => h.ageBand).filter(Boolean) as string[])).sort(),
    [helpers],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return helpers.filter((h) => {
      if (needle && !(h.alias ?? "").toLowerCase().includes(needle)) return false;
      if (academy && h.academy !== academy) return false;
      if (element && h.element !== element) return false;
      if (ageBand && h.ageBand !== ageBand) return false;
      if (history === "new" && h.assignedCount > 0) return false;
      if (history === "replied" && h.repliedCount === 0) return false;
      if (history === "busy" && h.pendingCount === 0) return false;
      if (history === "idle") {
        const last = h.lastAssignedAt ? new Date(h.lastAssignedAt).getTime() : 0;
        if (last > monthAgo) return false;
      }
      return true;
    });
  }, [helpers, q, academy, element, ageBand, history]);

  const selected = filtered.find((h) => h.userId === assignee) ?? null;
  const aliasOf = (h: LibrarianHelper | null) => h?.alias ?? (zh ? "旅者" : "traveler");

  const historyOptions: Array<{ value: HistoryFilter; label: string }> = [
    { value: "all", label: zh ? "全部" : "All" },
    { value: "new", label: zh ? "从未受托" : "Never entrusted" },
    { value: "replied", label: zh ? "回过信" : "Has replied" },
    { value: "idle", label: zh ? "近30天空闲" : "Idle 30d" },
    { value: "busy", label: zh ? "手上有信" : "Has open letters" },
  ];

  const resetFilters = () => {
    setQ("");
    setAcademy("");
    setElement("");
    setAgeBand("");
    setHistory("all");
  };

  return (
    <div className="hall-inset mt-4 space-y-4 px-4 py-4">
      {/* --- filters ------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[9rem] flex-1 text-xs text-muted-foreground">
            {zh ? "搜索化名" : "Search alias"}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={zh ? "输入化名…" : "Type an alias…"}
              className="hall-field hall-tap mt-1.5 text-sm"
            />
          </label>
          {academies.length > 0 ? (
            <label className="text-xs text-muted-foreground">
              {zh ? "学院" : "Academy"}
              <select
                value={academy}
                onChange={(e) => setAcademy(e.target.value)}
                className="hall-field hall-tap mt-1.5 text-sm"
              >
                <option value="">{zh ? "不限" : "Any"}</option>
                {academies.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {elements.length > 0 ? (
            <label className="text-xs text-muted-foreground">
              {zh ? "五行" : "Element"}
              <select
                value={element}
                onChange={(e) => setElement(e.target.value)}
                className="hall-field hall-tap mt-1.5 text-sm"
              >
                <option value="">{zh ? "不限" : "Any"}</option>
                {elements.map((el) => (
                  <option key={el} value={el}>
                    {el}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {ageBands.length > 0 ? (
            <label className="text-xs text-muted-foreground">
              {zh ? "年龄段" : "Age band"}
              <select
                value={ageBand}
                onChange={(e) => setAgeBand(e.target.value)}
                className="hall-field hall-tap mt-1.5 text-sm"
              >
                <option value="">{zh ? "不限" : "Any"}</option>
                {ageBands.map((b) => (
                  <option key={b} value={b}>
                    {c.ageBand(b as never)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {historyOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setHistory(opt.value)}
              aria-pressed={history === opt.value}
              className={`hall-tap rounded-full border px-3 py-1 text-xs transition-colors ${
                history === opt.value
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="hall-tap ml-auto text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {zh ? "清除筛选" : "Clear filters"}
          </button>
        </div>
      </div>

      {/* --- candidate list ------------------------------------------ */}
      <p className="text-xs text-muted-foreground">
        {zh
          ? `符合条件的旅者：${filtered.length} / ${helpers.length}`
          : `Matching travelers: ${filtered.length} of ${helpers.length}`}
      </p>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {zh ? "没有符合条件的旅者，试着放宽筛选。" : "No traveler matches — try widening the filters."}
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {filtered.map((h) => {
            const active = assignee === h.userId;
            return (
              <li key={h.userId}>
                <button
                  type="button"
                  onClick={() => setAssignee(active ? "" : h.userId)}
                  aria-pressed={active}
                  className={`hall-tap w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/40 hover:border-primary/40"
                  }`}
                >
                  <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-foreground">
                    <span className="font-semibold">{aliasOf(h)}</span>
                    <span className="text-xs text-muted-foreground">
                      {h.ageBand ? c.ageBand(h.ageBand as never) : ""}
                      {h.academy ? ` · ${h.academy}` : ""}
                      {h.element ? ` · ${h.element}` : ""}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {zh
                      ? `受托 ${h.assignedCount} · 回信 ${h.repliedCount} · 婉拒 ${h.declinedCount} · 待办 ${h.pendingCount}`
                      : `Entrusted ${h.assignedCount} · replied ${h.repliedCount} · declined ${h.declinedCount} · open ${h.pendingCount}`}
                    {h.lastAssignedAt
                      ? ` · ${zh ? "上次" : "last"} ${new Date(h.lastAssignedAt).toLocaleDateString()}`
                      : ` · ${zh ? "尚未托付过" : "never entrusted"}`}
                  </span>
                  {h.quote ? (
                    <span className="mt-1 block truncate text-xs italic text-muted-foreground/80">
                      “{h.quote}”
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* --- note + templates ---------------------------------------- */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{zh ? "附言模板" : "Note templates"}</span>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                setNote(
                  fillTemplate(t.body, { alias: aliasOf(selected), topic: topicLabel }).slice(0, 300),
                )
              }
              className="hall-tap rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            className="hall-tap text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {manageOpen ? (zh ? "收起模板" : "Close") : zh ? "管理模板" : "Manage"}
          </button>
        </div>

        {manageOpen ? (
          <div className="rounded-xl border border-border/40 p-3 text-xs">
            <p className="text-muted-foreground">
              {zh
                ? "可用变量：{alias} 旅者化名、{topic} 来信主题。"
                : "Variables: {alias} traveler alias, {topic} letter topic."}
            </p>
            <ul className="mt-2 space-y-1">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-muted-foreground">
                    {t.label} — {t.body}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = templates.filter((x) => x.id !== t.id);
                      setTemplates(next);
                      saveNoteTemplates(next);
                    }}
                    className="hall-tap text-destructive"
                  >
                    {zh ? "删除" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-muted-foreground">
                {zh ? "模板名称" : "Template name"}
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value.slice(0, 24))}
                  className="hall-field hall-tap mt-1 text-sm"
                />
              </label>
              <Button
                size="sm"
                variant="outline"
                className="hall-tap"
                disabled={!newLabel.trim() || !note.trim()}
                onClick={() => {
                  const next = [
                    ...templates,
                    {
                      id: `t-${Date.now()}`,
                      label: newLabel.trim(),
                      body: note.trim(),
                    },
                  ];
                  setTemplates(next);
                  saveNoteTemplates(next);
                  setNewLabel("");
                }}
              >
                {zh ? "把当前附言存为模板" : "Save current note as template"}
              </Button>
            </div>
          </div>
        ) : null}

        <label className="block text-xs text-muted-foreground">
          {zh ? "给对方的一句话（可选）" : "A note to them (optional)"}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            className="hall-field hall-tap mt-1.5 text-sm"
          />
        </label>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Button
        size="sm"
        className="hall-tap"
        disabled={!assignee || pending}
        onClick={() => onAssign(assignee, note.trim() || null)}
      >
        {pending
          ? c.sending
          : zh
            ? `托付给 ${aliasOf(selected)}`
            : `Entrust to ${aliasOf(selected)}`}
      </Button>
    </div>
  );
}
