import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { loadDailyRoomFixture, type DailyRoomFixtureKey } from "@/experiences/daily-room/fixtures";
import { ensureSocialPreviewAllowed } from "@/experiences/daily-room/route-guard";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * /me/home — Today's Reading Room (preview only).
 *
 * Access is guarded by host (DEV / localhost / id-preview--*.lovable.app).
 * Production and other lovable domains are blocked and redirected to `/`.
 *
 * When a signed-in user's real charts are available, we surface them via a
 * read-only capability-detected adapter. Otherwise we show typed DEMO
 * fixtures with a clearly-labelled banner. No AI, no writes.
 */
export const Route = createFileRoute("/_authenticated/me/home")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => {
    ensureSocialPreviewAllowed();
  },
  component: DailyRoomPage,
});

const FIXTURE_KEYS: DailyRoomFixtureKey[] = [
  "student_youth",
  "working_adult",
  "adult_transition",
  "no_birth_time",
];

const BAND_COLOR: Record<string, string> = {
  supportive: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  neutral: "text-amber-200 border-amber-400/40 bg-amber-500/10",
  mixed: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  caution: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

const DOMAIN_LABEL: Record<string, string> = {
  study: "学业与认知",
  career: "事业与方向",
  love: "关系与情感",
  wealth: "财富与资源",
};

function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function DailyRoomPage() {
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai"
      : "Asia/Shanghai";
  const today = todayInTz(tz);
  const [fixtureKey, setFixtureKey] = useState<DailyRoomFixtureKey>("working_adult");
  const [showEvidence, setShowEvidence] = useState(false);

  const fixture = loadDailyRoomFixture(fixtureKey, today, tz);
  const { facts, score } = fixture;

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        {/* Demo banner */}
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          DEMO 预览 · 今日阅览室（daily-reading-v1） · 本页数据为演示 fixture，未写入任何账户，未调用 AI。
        </div>

        {/* Welcome */}
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-300/60">Today's Reading Room</div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">今日阅览室</h1>
          <div className="mt-2 text-sm text-amber-100/70">
            {today} · {tz} · 命盘：<span className="text-amber-200">{fixture.chartLabel}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {FIXTURE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFixtureKey(k)}
                aria-pressed={fixtureKey === k}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  fixtureKey === k
                    ? "border-amber-300 bg-amber-300/10 text-amber-100"
                    : "border-amber-400/20 text-amber-200/70 hover:border-amber-300/60"
                }`}
              >
                {loadDailyRoomFixture(k, today, tz).label}
              </button>
            ))}
          </div>
        </header>

        {/* Overall + theme */}
        <section className="mb-8 grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
            <div className="text-xs uppercase tracking-widest text-amber-200/60">
              今日综合信号
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="text-5xl font-serif text-amber-100">{score.overall.score}</div>
              <div className="text-xs text-amber-200/70">/ 100</div>
            </div>
            <div
              className={`mt-3 inline-block rounded-full border px-2 py-0.5 text-xs ${BAND_COLOR[score.overall.band]}`}
            >
              {score.overall.band}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-amber-100/70">
              这是"今日领域信号"，不是成功率或好运概率。以下建议仅供参考，现实情境优先。
            </p>
          </div>

          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
            <div className="text-xs uppercase tracking-widest text-amber-200/60">今日主题</div>
            <div className="mt-3 text-lg text-amber-100">
              {score.partial
                ? "今日星象计算待接入 / 缺关键事实。"
                : `月相 ${facts?.moon.phase.replace("_", " ")} · 主题词 ${score.overall.theme_keywords.join(" · ") || "静观"}`}
            </div>
            {score.contradictions.length > 0 && (
              <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">
                <div className="mb-1 font-semibold text-amber-200">领域间存在张力</div>
                {score.contradictions.map((c, i) => (
                  <div key={i}>{c}</div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Four domain signals */}
        <section className="mb-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {score.domains.map((d) => (
            <div
              key={d.domain}
              className="rounded-xl border border-amber-400/20 bg-black/30 p-4"
            >
              <div className="text-xs text-amber-200/70">{DOMAIN_LABEL[d.domain]}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-3xl font-serif text-amber-100">{d.score}</div>
                <div className="text-[10px] text-amber-200/50">/ 100</div>
              </div>
              <div
                className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_COLOR[d.band]}`}
              >
                {d.band} · 置信度 {d.confidence}
              </div>
            </div>
          ))}
        </section>

        {/* Actions */}
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-5">
            <div className="text-xs uppercase tracking-widest text-emerald-200/80">
              今天更适合做的事
            </div>
            <ul className="mt-3 space-y-2 text-sm text-emerald-50/90">
              {(score.supportive_signals.length ? score.supportive_signals : ["今日 supportive 演示：把手上一件搁置的小任务收尾。", "花 15 分钟整理近期学习/工作的笔记。"]).slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-300">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-5">
            <div className="text-xs uppercase tracking-widest text-rose-200/80">
              需要观察的事
            </div>
            <ul className="mt-3 space-y-2 text-sm text-rose-50/90">
              {(score.caution_signals.length ? score.caution_signals : ["今日 caution 演示：涉及金钱的重要决定，多留一天再定。", "沟通中避免二选一句式，多问对方的语境。"]).slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-rose-300">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Countercondition + reflection */}
        <section className="mb-8 rounded-xl border border-amber-400/20 bg-black/30 p-5 text-sm">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">如果现实不同</div>
          <p className="mt-2 text-amber-100/80">
            如果现实情境与今日信号相反（例如实际推进得比预想更顺利），以现实为准；今日读数只是"值得留意的可能性"。
          </p>
          <div className="mt-4 text-xs uppercase tracking-widest text-amber-200/70">自我探问</div>
          <p className="mt-2 text-amber-100/80">
            "今天有没有一件事，我是因为惯性去做，而不是真的想做？"
          </p>
        </section>

        {/* Evidence */}
        <section className="mb-16 rounded-xl border border-amber-400/15 bg-black/20">
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            aria-expanded={showEvidence}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm text-amber-100/80"
          >
            <span>为什么这样判断</span>
            <span className="text-amber-300/70">{showEvidence ? "收起" : "展开"}</span>
          </button>
          {showEvidence && (
            <div className="border-t border-amber-400/10 px-5 py-5 text-xs leading-relaxed text-amber-100/80">
              <div className="mb-3">
                <div className="text-amber-200/80">采样时间</div>
                <div className="text-amber-100/70">
                  {facts ? facts.sample_utc : "(missing)"} · calculator{" "}
                  <code className="text-amber-300/80">daily-facts-v1</code> ·{" "}
                  <code className="text-amber-300/80">daily-domain-score-v1</code>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-amber-200/80">较慢周期背景</div>
                <div className="text-amber-100/70">
                  Vedic：{fixture.slower.vedic} · BaZi：{fixture.slower.bazi} · Ziwei：{fixture.slower.ziwei}
                </div>
                <div className="mt-1 text-amber-100/50">
                  较慢周期仅作背景，绝不推导为"今日必然发生"。项目未计算日干支/日盘/日 Nakshatra。
                </div>
              </div>
              <div className="mb-3">
                <div className="text-amber-200/80">证据引用</div>
                {score.domains.map((d) => (
                  <div key={d.domain} className="mt-2">
                    <div className="text-amber-300/80">{DOMAIN_LABEL[d.domain]}</div>
                    {d.evidence_refs.length === 0 ? (
                      <div className="text-amber-100/50">（本领域今日无强证据；请以现实为准。）</div>
                    ) : (
                      <ul className="ml-3 list-disc text-amber-100/70">
                        {d.evidence_refs.map((r, i) => (
                          <li key={i}>
                            <code className="text-[11px] text-amber-200/80">{r}</code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              {score.missing_facts.length > 0 && (
                <div className="mb-3">
                  <div className="text-amber-200/80">缺失的事实</div>
                  <ul className="ml-3 list-disc text-amber-100/70">
                    {score.missing_facts.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 border-t border-amber-400/10 pt-3 text-amber-100/50">
                本页为 DEMO；实际生产会绑定用户已保存命盘并按当地日午夜刷新。
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
