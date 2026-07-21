import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { computeCompatibility, type CompatResult } from "@/lib/compatibility-score";
import { MATCH_DEMO, type MatchDemoKey } from "@/experiences/daily-room/match-fixtures";
import { ensureSocialPreviewAllowed } from "@/experiences/daily-room/route-guard";

export const Route = createFileRoute("/_authenticated/me/match")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => {
    ensureSocialPreviewAllowed();
  },
  component: MatchPage,
});

const KEYS: MatchDemoKey[] = ["friend_pair", "complementary_pair", "clash_pair", "partial_pair"];

const BAND_CLASS: Record<string, string> = {
  high: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  mid: "text-amber-200 border-amber-400/40 bg-amber-500/10",
  low: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

function MatchPage() {
  const [key, setKey] = useState<MatchDemoKey>("friend_pair");
  const [mode, setMode] = useState<CompatResult["mode"]>("friendship");
  const [revoked, setRevoked] = useState(false);

  const pair = MATCH_DEMO[key];
  const result = useMemo(
    () =>
      computeCompatibility({
        a: { userId: pair.a.userId, chartId: pair.a.chartId, facets: pair.a.facets },
        b: { userId: pair.b.userId, chartId: pair.b.chartId, facets: pair.b.facets },
        mode,
      }),
    [pair, mode],
  );

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          DEMO 预览 · 互动适配指数（compatibility-score-v1） · 演示 fixture，不写云端，不调用 AI。
        </div>

        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-300/60">
            Bilateral Chart Match · Demo
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">
            互动适配（双方授权后可见）
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-amber-100/70">
            这是<strong className="text-amber-200"> 互动适配指数</strong>，用于观察两个人在
            沟通、情绪支持、行动节奏、边界修复、共同成长上的样貌，<strong className="text-amber-200">
            不是关系成功率、婚姻结果或命运判定</strong>。真实使用时，需要好友关系 + 双方选择命盘 +
            双方明确同意，任一方撤回，结果立即失效。
          </p>
        </header>

        {/* Consent flow visualization */}
        <section className="mb-6 rounded-xl border border-amber-400/20 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">授权状态（模拟）</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <ConsentCard label={pair.a.displayName} chart={pair.a.chartLabel} consented={!revoked} />
            <ConsentCard label={pair.b.displayName} chart={pair.b.chartLabel} consented={!revoked} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRevoked((r) => !r)}
              className="rounded-full border border-rose-400/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
            >
              {revoked ? "重新授权" : "模拟一方撤回"}
            </button>
            <span className="text-xs text-amber-200/60">
              撤回后：结果立即失效，缓存分数清空，另一方看不到本次结果。
            </span>
          </div>
        </section>

        {/* Controls */}
        <section className="mb-6 flex flex-wrap gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKey(k);
                setRevoked(false);
              }}
              aria-pressed={key === k}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                key === k
                  ? "border-amber-300 bg-amber-300/10 text-amber-100"
                  : "border-amber-400/20 text-amber-200/70 hover:border-amber-300/60"
              }`}
            >
              {MATCH_DEMO[k].label}
            </button>
          ))}
          <span className="mx-2 self-center text-xs text-amber-200/40">|</span>
          {(["friendship", "romantic", "family", "work"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                mode === m
                  ? "border-amber-300 bg-amber-300/10 text-amber-100"
                  : "border-amber-400/20 text-amber-200/70 hover:border-amber-300/60"
              }`}
            >
              {m === "friendship"
                ? "朋友"
                : m === "romantic"
                  ? "亲密"
                  : m === "family"
                    ? "家人"
                    : "搭档"}
            </button>
          ))}
        </section>

        {revoked ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 p-8 text-center text-sm text-rose-100/80">
            结果已失效 —— 一方撤回授权后，本次匹配结果立即从双方界面移除。
          </div>
        ) : (
          <ResultPanel result={result} />
        )}

        <p className="mt-8 text-xs text-amber-200/50">
          version <code className="text-amber-300/70">{result.version}</code> · pair-key{" "}
          <code className="text-amber-300/70">{result.pairKey}</code> · 顺序无关 ·
          纯确定性计算，无 AI。
        </p>
      </div>
    </div>
  );
}

function ConsentCard({
  label,
  chart,
  consented,
}: {
  label: string;
  chart: string;
  consented: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${
        consented
          ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-100"
          : "border-rose-400/30 bg-rose-500/5 text-rose-100"
      }`}
    >
      <div className="text-xs uppercase tracking-widest opacity-70">
        {consented ? "已选择命盘并同意" : "已撤回"}
      </div>
      <div className="mt-2 text-base">{label}</div>
      <div className="mt-1 text-xs opacity-70">{chart}</div>
    </div>
  );
}

function ResultPanel({ result }: { result: CompatResult }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
        <div className="text-xs uppercase tracking-widest text-amber-200/70">互动适配指数</div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className="text-6xl font-serif text-amber-100">{result.overall}</div>
          <div className="text-xs text-amber-200/60">/ 100 · {result.mode}</div>
          {result.partial && (
            <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
              事实不完整 · confidence {result.confidence}
            </span>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {result.dimensions.map((d) => (
          <div key={d.key} className="rounded-xl border border-amber-400/20 bg-black/30 p-4">
            <div className="text-xs text-amber-200/70">{d.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-serif text-amber-100">{d.score}</div>
              <div className="text-[10px] text-amber-200/50">/ 100</div>
            </div>
            <div
              className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_CLASS[d.band]}`}
            >
              {d.band}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <BulletCard title="共鸣点" items={result.resonances} tone="emerald" />
        <BulletCard title="互补点" items={result.complements} tone="amber" />
        <BulletCard title="误解点" items={result.frictions} tone="rose" />
        <BulletCard title="相处建议" items={result.suggestions} tone="amber" />
      </section>

      <section className="rounded-xl border border-amber-400/15 bg-black/20 p-5 text-xs leading-relaxed text-amber-100/70">
        {result.disclaimer}
      </section>
    </div>
  );
}

function BulletCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "emerald" | "rose" | "amber";
}) {
  const border =
    tone === "emerald"
      ? "border-emerald-400/25"
      : tone === "rose"
        ? "border-rose-400/25"
        : "border-amber-400/25";
  return (
    <div className={`rounded-xl border ${border} bg-black/30 p-5`}>
      <div className="text-xs uppercase tracking-widest text-amber-200/70">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-amber-50/90">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-amber-300/70">·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
