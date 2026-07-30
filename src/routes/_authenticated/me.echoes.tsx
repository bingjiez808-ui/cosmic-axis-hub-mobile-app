import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { HistoricalEcho } from "@/experiences/life-guidance/HistoricalEcho";
import { LifeChapterCard } from "@/experiences/life-guidance/LifeChapterCard";
import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { loadDailyRoomFixture } from "@/experiences/daily-room/fixtures";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import {
  computeAge,
  defaultStageForAge,
  type LifeStage,
} from "@/lib/life-guidance-v1";
import { useDaily } from "@/lib/i18n-daily";
import { useLang } from "@/lib/i18n";

/**
 * /me/echoes — direct-linkable Historical Echoes hub. Loads the
 * caller's primary chart, resolves their current life stage from
 * age, and renders the HistoricalEcho deck as a standalone page so
 * the shelf nav never has to depend on a fragile /me/home#echoes
 * hash anchor.
 */
export const Route = createFileRoute("/_authenticated/me/echoes")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: EchoesPage,
});

function EchoesPage() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const load = useServerFn(listUserCharts);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "no-birth" }
    | { kind: "ready"; stage: LifeStage; birthDate: string }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const charts: ChartRow[] = await load();
        if (cancelled) return;
        const primary = charts.find((c) => c.is_primary && c.chart_role === "self");
        const birthDate = primary?.birth_date ?? null;
        if (!birthDate) {
          setState({ kind: "no-birth" });
          return;
        }
        const stage = defaultStageForAge(computeAge(birthDate, new Date().toISOString().slice(0, 10)));
        if (!stage) {
          setState({ kind: "no-birth" });
          return;
        }
        setState({ kind: "ready", stage, birthDate });
      } catch (err) {
        if (!cancelled)
          setState({ kind: "error", message: err instanceof Error ? err.message : "unknown" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0a0a12]/55 text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <PersonalWorkspaceNav active="/me/echoes" />
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.24em] text-amber-300/60">
            {isZh ? "历史回声" : "Historical Echoes"}
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">
            {isZh ? "历史回声" : "Historical Echoes"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-amber-100/70">
            {isZh
              ? "根据你所在的人生阶段，从历史人物中找到与你相似的处境。可以书签，也可以写下自己的批注。"
              : "Historical figures matched to the chapter of life you're in right now. Dog-ear the pages you want to keep, or write your own marginal notes."}
          </p>
        </header>

        {state.kind === "loading" && (
          <div className="rounded-xl border border-amber-400/15 bg-black/20 p-6 text-sm text-amber-200/70">
            {isZh ? "读取中…" : "Loading…"}
          </div>
        )}
        {state.kind === "no-birth" && (
          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
            <p className="text-sm text-amber-100/85">
              {isZh
                ? "请先在“开启仪式”登记出生日期，才能匹配同龄或同阶段的历史回声。"
                : "Register your birth date in the Ritual first — that's how we pick echoes from a matching chapter of life."}
            </p>
          </div>
        )}
        {state.kind === "error" && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-950/20 p-6 text-sm text-rose-300/85">
            {isZh ? `读取失败：${state.message}` : `Load failed: ${state.message}`}
          </div>
        )}
        {state.kind === "ready" && (
          <>
            <LifeChapterCardFromFixture
              primaryBirthDate={state.birthDate}
              todayISO={new Date().toISOString().slice(0, 10)}
            />
            <HistoricalEcho
              stage={state.stage}
              domain={null}
              concern={null}
              domainSignal={null}
              domainLabel={null}
              initialExpanded
            />
          </>
        )}
      </div>
    </div>
  );
}

function LifeChapterCardFromFixture({
  primaryBirthDate,
  todayISO,
}: {
  primaryBirthDate: string;
  todayISO: string;
}) {
  const d = useDaily();
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai"
      : "Asia/Shanghai";
  const fixture = loadDailyRoomFixture("working_adult", todayISO, tz);
  return (
    <div className="mb-8">
      <LifeChapterCard
        primaryBirthDate={primaryBirthDate}
        todayISO={todayISO}
        domainScores={fixture.score.domains}
        domainLabels={{
          love: d.domain.love,
          study: d.domain.study,
          career: d.domain.career,
          body_mind: d.domain.body_mind,
          finance: d.domain.finance,
        }}
      />
    </div>
  );
}
