/**
 * 后台 · 众生之厅审核台 — admin moderation for the letter hall.
 *
 * Reads a redacted overview RPC and offers the four moderation verbs the
 * backend supports (approve / hide / reject / redact) plus participation
 * control. Every action is written to the moderation audit log server-side.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getCommunityHallAdminOverview,
  getCommunityHallMetrics,
  type HallMetrics,
  moderateCommunityLetter,
  moderateCommunityReply,
  setCommunityParticipation,
  type AdminHallOverview,
} from "@/lib/community-hall-admin.functions";
import { useCommunityHall } from "@/lib/i18n-community-hall";

const KEY = ["admin", "community-hall"] as const;

export function AdminCommunityHallSection() {
  const c = useCommunityHall();
  const qc = useQueryClient();
  const load = useServerFn(getCommunityHallAdminOverview);
  const letterFn = useServerFn(moderateCommunityLetter);
  const replyFn = useServerFn(moderateCommunityReply);
  const participationFn = useServerFn(setCommunityParticipation);
  const [tab, setTab] = useState<
    "metrics" | "reports" | "letters" | "replies" | "deliveries" | "people" | "log"
  >("metrics");
  const loadMetrics = useServerFn(getCommunityHallMetrics);
  const metrics = useQuery<HallMetrics>({
    queryKey: ["admin", "community-hall", "metrics", 30],
    queryFn: () => loadMetrics({ data: { days: 30 } }),
    staleTime: 60_000,
  });

  const overview = useQuery<AdminHallOverview>({
    queryKey: KEY,
    queryFn: () => load(),
    staleTime: 15_000,
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: KEY });

  const letterAction = useMutation({
    mutationFn: (data: { letterId: string; action: "approve" | "hide" | "reject" | "redact" | "redispatch" }) =>
      letterFn({ data }),
    onSuccess: () => {
      toast.success(c.saved);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyAction = useMutation({
    mutationFn: (data: { replyId: string; action: "approve" | "hide" | "reject" | "redact" }) =>
      replyFn({ data }),
    onSuccess: () => {
      toast.success(c.saved);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const peopleAction = useMutation({
    mutationFn: (data: { userId: string; status: "active" | "paused" | "banned" }) =>
      participationFn({ data }),
    onSuccess: () => {
      toast.success(c.saved);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = overview.data;
  const tabs = [
    { key: "metrics" as const, label: c.metricsTitle, n: metrics.data?.letters.total ?? 0 },
    { key: "reports" as const, label: c.isZh ? "举报" : "Reports", n: data?.reports.length ?? 0 },
    { key: "letters" as const, label: c.isZh ? "信件" : "Letters", n: data?.letters.length ?? 0 },
    { key: "replies" as const, label: c.isZh ? "回音" : "Replies", n: data?.replies.length ?? 0 },
    {
      key: "deliveries" as const,
      label: c.isZh ? "投递" : "Deliveries",
      n: data?.deliveries.length ?? 0,
    },
    { key: "people" as const, label: c.isZh ? "成员" : "People", n: data?.participants.length ?? 0 },
    { key: "log" as const, label: c.isZh ? "日志" : "Audit", n: data?.events.length ?? 0 },
  ];

  return (
    <section className="mt-10 rounded-2xl border border-primary/15 bg-background/50 p-6 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          {c.isZh ? "众生之厅 · 审核台" : "Hall of Beings · Moderation"}
        </h2>
        <Button variant="ghost" size="sm" onClick={refresh}>
          {c.isZh ? "刷新" : "Refresh"}
        </Button>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              tab === t.key
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-primary/15 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} · {t.n}
          </button>
        ))}
      </div>

      {overview.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">{c.loading}</p>
      ) : overview.error ? (
        <p className="mt-6 text-sm text-destructive">{(overview.error as Error).message}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {tab === "metrics" && <MetricsPanel data={metrics.data} labels={c} />}

          {tab === "reports" &&
            (data?.reports ?? []).map((r) => (
              <Row key={r.id} title={`${r.targetType} · ${r.reason}`} meta={r.status}>
                <p className="text-sm text-muted-foreground">{r.details ?? "—"}</p>
                {r.targetType === "letter" ? (
                  <Actions
                    onAction={(a) =>
                      letterAction.mutate({ letterId: r.targetId, action: a as "hide" })
                    }
                    labels={c}
                  />
                ) : r.targetType === "reply" ? (
                  <Actions
                    onAction={(a) => replyAction.mutate({ replyId: r.targetId, action: a as "hide" })}
                    labels={c}
                  />
                ) : null}
              </Row>
            ))}

          {tab === "letters" &&
            (data?.letters ?? []).map((l) => (
              <Row
                key={l.id}
                title={l.subject ?? c.topic(l.topic)}
                meta={`${c.letterStatus(l.status)} · ${c.ageBand(l.targetAgeBand)} · ${c.deliveredCount} ${l.deliveredCount} · ${c.replyCount} ${l.replyCount}`}
              >
                <p className="line-clamp-3 text-sm text-muted-foreground">{l.body}</p>
                <Actions
                  extra="redispatch"
                  onAction={(a) => letterAction.mutate({ letterId: l.id, action: a as "hide" })}
                  labels={c}
                />
              </Row>
            ))}

          {tab === "replies" &&
            (data?.replies ?? []).map((r) => (
              <Row key={r.id} title={c.sectionEchoes} meta={c.letterStatus(r.status)}>
                <p className="line-clamp-3 text-sm text-muted-foreground">{r.body}</p>
                <Actions
                  onAction={(a) => replyAction.mutate({ replyId: r.id, action: a as "hide" })}
                  labels={c}
                />
              </Row>
            ))}

          {tab === "deliveries" &&
            (data?.deliveries ?? []).map((d) => (
              <Row
                key={d.id}
                title={`${c.deliveredAt} ${new Date(d.deliveredAt).toLocaleString()}`}
                meta={c.deliveryStatus(d.status)}
              >
                <p className="text-xs text-muted-foreground">
                  {c.filterRead}: {d.readAt ? new Date(d.readAt).toLocaleString() : "—"} ·{" "}
                  {c.filterReplied}: {d.repliedAt ? new Date(d.repliedAt).toLocaleString() : "—"}
                </p>
              </Row>
            ))}

          {tab === "people" &&
            (data?.participants ?? []).map((p) => (
              <Row
                key={p.userId}
                title={p.alias ?? p.userId.slice(0, 8)}
                meta={`${c.ageBand(p.ageBand)} · ${p.status}`}
              >
                <div className="flex flex-wrap gap-2">
                  {(["active", "paused", "banned"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => peopleAction.mutate({ userId: p.userId, status: s })}
                      className="rounded-full border border-primary/20 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {c.moderationResult(`set_status_${s}`)}
                    </button>
                  ))}
                </div>
              </Row>
            ))}

          {tab === "log" &&
            (data?.events ?? []).map((e) => (
              <Row
                key={e.id}
                title={`${e.targetType} · ${c.moderationResult(e.action)}`}
                meta={new Date(e.createdAt).toLocaleString()}
              >
                <p className="text-sm text-muted-foreground">{e.notes ?? "—"}</p>
              </Row>
            ))}
        </div>
      )}
    </section>
  );
}

function MetricsPanel({
  data,
  labels,
}: {
  data: HallMetrics | undefined;
  labels: ReturnType<typeof useCommunityHall>;
}) {
  if (!data) return <p className="text-sm text-muted-foreground">{labels.loading}</p>;
  const rate = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
  const stats: Array<[string, string]> = [
    [labels.metricLetters, String(data.letters.total ?? 0)],
    [labels.metricDeliveries, String(data.deliveries.total ?? 0)],
    [labels.metricReplies, String(data.replies.total ?? 0)],
    [labels.metricReports, String(data.reports.total ?? 0)],
    [labels.metricParticipants, String(data.participants.active ?? 0)],
    [labels.metricReadRate, rate(data.deliveries.read ?? 0, data.deliveries.total ?? 0)],
    [labels.metricReplyRate, rate(data.deliveries.replied ?? 0, data.deliveries.total ?? 0)],
    [
      labels.metricMedianEcho,
      data.medianFirstEchoHours != null
        ? `${data.medianFirstEchoHours} ${labels.metricHours}`
        : labels.metricNoData,
    ],
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {labels.metricsRange(data.days)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-primary/12 bg-background/60 p-4">
            <p className="text-[0.7rem] text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-primary/12 bg-background/60 p-4">
          <p className="text-[0.7rem] text-muted-foreground">{labels.ageBand(undefined)}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {data.ageBands.length === 0 ? (
              <li>{labels.metricNoData}</li>
            ) : (
              data.ageBands.map((b) => (
                <li key={b.band}>
                  {labels.ageBand(b.band)} · {b.count}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-primary/12 bg-background/60 p-4">
          <p className="text-[0.7rem] text-muted-foreground">{labels.metricsTitle}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {data.moderation.length === 0 ? (
              <li>{labels.metricNoData}</li>
            ) : (
              data.moderation.map((m) => (
                <li key={m.action}>
                  {labels.moderationResult(m.action)} · {m.count}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-xl border border-primary/12 bg-background/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[0.7rem] text-muted-foreground">{meta}</span>
      </div>
      <div className="mt-2 space-y-3">{children}</div>
    </article>
  );
}

function Actions({
  onAction,
  labels,
  extra,
}: {
  onAction: (action: string) => void;
  labels: ReturnType<typeof useCommunityHall>;
  extra?: string;
}) {
  const actions = ["approve", "hide", "reject", "redact", ...(extra ? [extra] : [])];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onAction(a)}
          className="rounded-full border border-primary/20 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {labels.moderationResult(a)}
        </button>
      ))}
    </div>
  );
}
