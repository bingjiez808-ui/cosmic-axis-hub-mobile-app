/**
 * Panorama Tour · Screens.
 *
 * Three lightweight screens rendered inside GuidedLibraryV2:
 *   - PanoramaEntry: four-signal starfield + "signal from where" drawer.
 *   - RecommendedFirstReadCard: one-domain recommendation with explain-me.
 *   - GuidedDomainReadingView: 10-section domain reading with progressive
 *     reveal (short → full).
 *
 * All content is deterministic (fixtures + score engine). No AI, no
 * random, no server calls. Reduced-motion collapses transitions to
 * instant.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { DomainKey, DomainScoreResult, GuidedDomainReading, RecommendedFirstRead } from "./types";
import { DOMAIN_LABEL, DOMAIN_ORDER, DOMAIN_TAGLINE } from "./types";

const BAND_COPY: Record<DomainScoreResult["band"], string> = {
  high_signal: "高信号",
  mid_signal: "中信号",
  insufficient_facts: "待补资料",
};

const CONF_COPY: Record<DomainScoreResult["confidence"], string> = {
  high: "证据充分",
  mid: "证据中等",
  low: "证据有限",
  reference_only: "仅供参考",
};

interface PanoramaEntryProps {
  scores: DomainScoreResult[];
  recommended: RecommendedFirstRead;
  onPick: (domain: DomainKey) => void;
  onOverview: () => void;
  reducedMotion: boolean;
}

export function PanoramaEntry({ scores, recommended, onPick, onOverview, reducedMotion }: PanoramaEntryProps) {
  const [openSource, setOpenSource] = useState<DomainKey | null>(null);
  const opened = useMemo(
    () => (openSource ? scores.find((s) => s.domain === openSource) ?? null : null),
    [openSource, scores],
  );
  return (
    <section className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-16 text-stone-warm">
      <header className="text-center">
        <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust/70">全景导览 · 第 1 步</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight md:text-4xl">你的命运全景已经展开</h1>
        <p className="mt-3 text-sm text-stone-warm/70">先看见四个领域的信号，再决定从哪一页开始阅读。</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {DOMAIN_ORDER.map((d) => {
          const s = scores.find((x) => x.domain === d)!;
          const isRec = recommended.domain === d;
          return (
            <motion.button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={reducedMotion ? undefined : { y: -2 }}
              className={`group relative overflow-hidden rounded-lg border p-5 text-left transition ${
                isRec
                  ? "border-gold-dust/70 bg-obsidian/70 shadow-[0_0_0_1px_rgba(212,175,120,0.2)]"
                  : "border-stone-warm/15 bg-obsidian/40 hover:border-gold-dust/40"
              }`}
            >
              {isRec && (
                <span className="absolute right-3 top-3 rounded-full border border-gold-dust/50 px-2 py-0.5 font-mono text-[9px] tracking-[0.3em] text-gold-dust">
                  推荐
                </span>
              )}
              <p className="font-mono text-[10px] tracking-[0.3em] text-stone-warm/50">{BAND_COPY[s.band]} · {CONF_COPY[s.confidence]}</p>
              <h2 className="mt-2 font-serif text-xl text-stone-warm">{DOMAIN_LABEL[d]}</h2>
              <p className="mt-1 text-xs text-stone-warm/60">{DOMAIN_TAGLINE[d]}</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-serif text-3xl text-gold-dust">{s.score}</span>
                <span className="pb-1 text-[10px] text-stone-warm/50">/ 100 领域信号</span>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-stone-warm/10">
                <div className="h-full bg-gold-dust/60" style={{ width: `${s.score}%` }} />
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpenSource(d); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setOpenSource(d); } }}
                className="mt-4 inline-block cursor-pointer text-[11px] text-gold-dust/80 underline decoration-dotted underline-offset-4 hover:text-gold-dust"
              >
                这个分数怎么来的？
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="rounded-lg border border-gold-dust/30 bg-obsidian/60 p-6">
        <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust/70">阅读顺序推荐</p>
        <h3 className="mt-2 font-serif text-2xl">{recommended.reason_text}</h3>
        <p className="mt-2 text-[11px] text-stone-warm/50">{recommended.disclaimer}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onPick(recommended.domain)}
            className="rounded-full bg-gold-dust px-5 py-2 font-mono text-[11px] tracking-[0.3em] text-obsidian hover:bg-gold-dust/90"
          >
            从这里开始
          </button>
          <button
            type="button"
            onClick={onOverview}
            className="rounded-full border border-stone-warm/30 px-5 py-2 font-mono text-[11px] tracking-[0.3em] text-stone-warm hover:border-gold-dust/50"
          >
            我想选择其他路径
          </button>
        </div>
      </div>

      <AnimatePresence>
        {opened && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 md:items-center"
            onClick={() => setOpenSource(null)}
          >
            <motion.div
              initial={reducedMotion ? false : { y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-t-2xl border border-stone-warm/20 bg-obsidian p-6 md:rounded-2xl"
            >
              <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust/70">信号从哪里来</p>
              <h4 className="mt-2 font-serif text-xl">{DOMAIN_LABEL[opened.domain]} · {opened.score}</h4>
              <ul className="mt-4 space-y-3 text-sm">
                {opened.system_contributions.map((c) => (
                  <li key={c.system} className={c.available ? "text-stone-warm/90" : "text-stone-warm/40"}>
                    <span className="font-mono text-[10px] tracking-[0.3em] text-gold-dust/60">
                      {c.system.toUpperCase()} · {c.available ? "已使用" : "暂不可用"}
                    </span>
                    <p className="mt-0.5 text-xs">
                      {c.available
                        ? `贡献 ${c.contribution >= 0 ? "+" : ""}${c.contribution.toFixed(1)}`
                        : c.reason_codes.join(" · ") || "该证据暂不可用"}
                    </p>
                  </li>
                ))}
              </ul>
              {opened.contradiction_flags.length > 0 && (
                <p className="mt-4 rounded border border-stone-warm/20 bg-obsidian/50 p-3 text-[11px] text-stone-warm/70">
                  体系之间存在张力：{opened.contradiction_flags.join(" · ")}
                </p>
              )}
              {opened.missing_facts.length > 0 && (
                <p className="mt-3 text-[11px] text-stone-warm/50">
                  暂不可用的事实：{opened.missing_facts.join("、")}
                </p>
              )}
              <button
                type="button"
                onClick={() => setOpenSource(null)}
                className="mt-6 w-full rounded-full border border-stone-warm/30 py-2 font-mono text-[11px] tracking-[0.3em]"
              >
                收起
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

interface DomainReadingViewProps {
  reading: GuidedDomainReading;
  score: DomainScoreResult;
  recommendReason?: string;
  onFull: () => void;
  onBack: () => void;
  fullOpen: boolean;
  onExpand: () => void;
  reducedMotion: boolean;
}

export function GuidedDomainReadingView({
  reading, score, recommendReason, onFull, onBack, fullOpen, onExpand, reducedMotion,
}: DomainReadingViewProps) {
  const s = reading.sections;
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pb-24 pt-14 text-stone-warm">
      <button
        type="button"
        onClick={onBack}
        className="self-start font-mono text-[10px] tracking-[0.4em] text-stone-warm/50 hover:text-gold-dust"
      >
        ← 返回全景
      </button>
      <header>
        <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust/70">
          {DOMAIN_LABEL[reading.domain]} · {BAND_COPY[score.band]} · {CONF_COPY[score.confidence]}
        </p>
        <h1 className="mt-2 font-serif text-3xl">{DOMAIN_LABEL[reading.domain]}</h1>
        {recommendReason && (
          <p className="mt-3 text-[12px] text-stone-warm/60">为什么推荐：{recommendReason}</p>
        )}
      </header>

      <p className="border-l-2 border-gold-dust/50 pl-4 text-sm italic text-stone-warm/85">{s.opening}</p>

      <div>
        <h3 className="font-mono text-[10px] tracking-[0.4em] text-gold-dust/70">三个具体发现</h3>
        <ol className="mt-3 space-y-2 text-sm">
          <li>· {s.per_system.find((p) => p.system === "bazi" && p.available)?.observation ?? "（暂无八字层面观察）"}</li>
          <li>· {s.per_system.find((p) => p.system === "ziwei" && p.available)?.observation ?? "（暂无紫微层面观察）"}</li>
          <li>· {s.consensus_and_conflict}</li>
        </ol>
      </div>

      {!fullOpen ? (
        <button
          type="button"
          onClick={onExpand}
          className="self-start rounded-full border border-gold-dust/50 px-5 py-2 font-mono text-[11px] tracking-[0.3em] text-gold-dust"
        >
          翻开完整章节 →
        </button>
      ) : (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6 border-t border-stone-warm/15 pt-6 text-sm leading-relaxed"
        >
          <SectionBlock title="四个体系分别看见了什么">
            <ul className="space-y-2">
              {s.per_system.map((p) => (
                <li key={p.system} className={p.available ? "" : "text-stone-warm/40"}>
                  <span className="font-mono text-[10px] tracking-[0.3em] text-gold-dust/60">{p.system.toUpperCase()}</span>
                  <p className="mt-0.5">{p.available ? p.observation : "该证据暂不可用。"}</p>
                </li>
              ))}
            </ul>
          </SectionBlock>
          <SectionBlock title="共识与分歧">{s.consensus_and_conflict}</SectionBlock>
          <SectionBlock title="现实中的可能表现">{s.real_life_expression}</SectionBlock>
          <SectionBlock title="优势与可用资源">{s.strengths_and_resources}</SectionBlock>
          <SectionBlock title="容易重复的模式">{s.recurring_patterns}</SectionBlock>
          <SectionBlock title="当前周期与可观察时间窗口">{s.current_cycle_window}</SectionBlock>
          <SectionBlock title="保留 · 停止 · 开始">
            <ul className="space-y-1">
              <li>· {s.keep_stop_start.keep}</li>
              <li>· {s.keep_stop_start.stop}</li>
              <li>· {s.keep_stop_start.start}</li>
            </ul>
          </SectionBlock>
          <SectionBlock title="留给自己的三个问题">
            <ol className="list-decimal space-y-1 pl-5">
              {s.self_inquiry.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </SectionBlock>
          <SectionBlock title="方法与限制">{s.method_and_limits}</SectionBlock>
          <p className="text-[11px] text-stone-warm/40">
            证据索引：{reading.evidence_refs.join("、")}
          </p>
          <button
            type="button"
            onClick={onFull}
            className="rounded-full bg-gold-dust px-5 py-2 font-mono text-[11px] tracking-[0.3em] text-obsidian"
          >
            展开我的完整全景 →
          </button>
        </motion.div>
      )}
    </section>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-mono text-[10px] tracking-[0.4em] text-gold-dust/70">{title}</h3>
      <div className="mt-2 text-stone-warm/85">{children}</div>
    </div>
  );
}
