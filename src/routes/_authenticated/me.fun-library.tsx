/**
 * /me/fun-library — Fun Library entry page.
 *
 * Access rules (all client-side; the parent _authenticated route
 * already gates unauth):
 *   - Signed-in with a primary chart (chart_role=self, is_primary):
 *       render the flow.
 *   - Signed-in with charts but no primary self chart: prompt to
 *       open ritual or go to Charts & Reports.
 *   - Signed-in with only "other" charts: explain the privacy /
 *       product boundary; do NOT let them test on someone else's chart.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { FunLibraryFlow } from "@/experiences/fun-library/FunLibraryFlow";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/me/fun-library")({
  head: () => ({
    meta: [
      { title: "Fun Library · Cosmic Axis" },
      { name: "description", content: "Fun Library — claim the reader-type meant for you." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: FunLibraryPage,
});

function FunLibraryPage() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const listCharts = useServerFn(listUserCharts);
  const [userId, setUserId] = useState<string | null>(null);
  const [charts, setCharts] = useState<ChartRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (!alive) return;
      setUserId(uid);
      try {
        const rows = await listCharts();
        if (alive) setCharts(rows);
      } catch {
        if (alive) setCharts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listCharts]);

  const primary = charts?.find((c) => c.chart_role === "self" && c.is_primary) ?? null;
  const anySelf = charts?.some((c) => c.chart_role === "self") ?? false;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-6xl px-4 pb-24 pt-6 md:px-8">
      <PersonalWorkspaceNav />
      <header className="mb-6 mt-2">
        <p className="text-[10px] uppercase tracking-[0.34em] text-amber-200/70">
          {isZh ? "趣味图书馆" : "Fun Library"}
        </p>
        <h1 className="mt-2 font-serif text-3xl text-amber-100 md:text-4xl">
          {isZh ? "藏书人格 · 第一册" : "Reader-Types · Volume One"}
        </h1>
      </header>

      {charts === null || userId === null ? (
        <PersonalShellPending />
      ) : !primary && !anySelf && charts.length === 0 ? (
        <EmptyStateNoChart isZh={isZh} />
      ) : !primary && !anySelf && charts.length > 0 ? (
        <EmptyStateOnlyOthers isZh={isZh} />
      ) : !primary ? (
        <EmptyStateNoPrimary isZh={isZh} />
      ) : (
        <FunLibraryFlow userId={userId} chart={primary} />
      )}
    </main>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-amber-300/20 bg-[#100c1c]/70 p-6 md:p-8">
      {children}
    </section>
  );
}

function EmptyStateNoChart({ isZh }: { isZh: boolean }) {
  return (
    <CardShell>
      <h2 className="font-serif text-2xl text-amber-100">
        {isZh ? "先领一份主命盘，再来图书馆" : "Bring a primary chart first"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-stone-200/80">
        {isZh
          ? "趣味图书馆的“藏书人格”会与你的主命盘底色一起阅读。请先完成开启仪式，把你的第一张命盘留在书架上。"
          : "The Fun Library reads your reader-type alongside your own primary chart. Open the ritual first so your first chart lives on the shelf."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/ritual"
          className="inline-flex min-h-11 items-center rounded-full border border-amber-300 bg-amber-300/10 px-5 py-2 text-sm text-amber-100 hover:bg-amber-300/20"
        >
          {isZh ? "开启仪式" : "Open the ritual"}
        </Link>
        <Link
          to="/me/profile"
          className="inline-flex min-h-11 items-center rounded-full border border-amber-300/40 px-5 py-2 text-sm text-amber-200 hover:bg-amber-300/5"
        >
          {isZh ? "前往命盘与报告" : "Charts & Reports"}
        </Link>
      </div>
    </CardShell>
  );
}

function EmptyStateOnlyOthers({ isZh }: { isZh: boolean }) {
  return (
    <CardShell>
      <h2 className="font-serif text-2xl text-amber-100">
        {isZh ? "他人命盘不能替你答题" : "Someone else's chart can't take the quiz"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-stone-200/80">
        {isZh
          ? "你目前只保存了他人命盘。出于隐私与产品逻辑，趣味图书馆只会阅读你自己的主命盘。请先为自己开启一次仪式。"
          : "You've only saved charts belonging to other people. For privacy and product reasons, the Fun Library will only read from your own primary chart. Please open the ritual for yourself first."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/ritual"
          search={{ owner: "self" }}
          className="inline-flex min-h-11 items-center rounded-full border border-amber-300 bg-amber-300/10 px-5 py-2 text-sm text-amber-100 hover:bg-amber-300/20"
        >
          {isZh ? "为自己开启仪式" : "Open ritual for yourself"}
        </Link>
      </div>
    </CardShell>
  );
}

function EmptyStateNoPrimary({ isZh }: { isZh: boolean }) {
  return (
    <CardShell>
      <h2 className="font-serif text-2xl text-amber-100">
        {isZh ? "请先设定主命盘" : "Set your primary chart"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-stone-200/80">
        {isZh
          ? "你有自己的命盘，但尚未标为主命盘。前往“命盘与报告”把其中一张设为主命盘后即可开始。"
          : "You have your own chart(s), but none is marked as primary. Pick one in Charts & Reports first."}
      </p>
      <div className="mt-6">
        <Link
          to="/me/profile"
          className="inline-flex min-h-11 items-center rounded-full border border-amber-300 bg-amber-300/10 px-5 py-2 text-sm text-amber-100 hover:bg-amber-300/20"
        >
          {isZh ? "前往命盘与报告" : "Charts & Reports"}
        </Link>
      </div>
    </CardShell>
  );
}
