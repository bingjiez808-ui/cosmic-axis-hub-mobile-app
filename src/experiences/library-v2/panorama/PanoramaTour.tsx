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
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
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

      <ul
        role="list"
        aria-label="四领域信号卡"
        className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4"
      >
        {DOMAIN_ORDER.map((d) => {
          const s = scores.find((x) => x.domain === d)!;
          const isRec = recommended.domain === d;
          const labelId = `panorama-card-${d}-label`;
          return (
            <motion.li
              key={d}
              role="listitem"
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={reducedMotion ? undefined : { y: -2 }}
              aria-labelledby={labelId}
              className={`group relative overflow-hidden rounded-lg border p-5 text-left transition ${
                isRec
                  ? "border-gold-dust/70 bg-obsidian/70 shadow-[0_0_0_1px_rgba(212,175,120,0.2)]"
                  : "border-stone-warm/15 bg-obsidian/40 hover:border-gold-dust/40"
              }`}
            >
              {isRec && (
                <span
                  className="absolute right-3 top-3 rounded-full border border-gold-dust/50 px-2 py-0.5 font-mono text-[9px] tracking-[0.3em] text-gold-dust"
                  aria-hidden="true"
                >
                  推荐
                </span>
              )}
              <p className="font-mono text-[10px] tracking-[0.3em] text-stone-warm/50">{BAND_COPY[s.band]} · {CONF_COPY[s.confidence]}</p>
              <h2 id={labelId} className="mt-2 font-serif text-xl text-stone-warm">
                {DOMAIN_LABEL[d]}
                {isRec && <span className="sr-only">（推荐首读）</span>}
              </h2>
              <p className="mt-1 text-xs text-stone-warm/60">{DOMAIN_TAGLINE[d]}</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-serif text-3xl text-gold-dust" aria-label={`领域信号 ${s.score} 分（满分 100）`}>{s.score}</span>
                <span className="pb-1 text-[10px] text-stone-warm/50" aria-hidden="true">/ 100 领域信号</span>
              </div>
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-stone-warm/10" aria-hidden="true">
                <div className="h-full bg-gold-dust/60" style={{ width: `${s.score}%` }} />
              </div>
              {/* Two independent, non-nested actions. Neither button
                  contains the other, and the outer <li> is not a button —
                  so keyboard Tab visits exactly two focusable stops per
                  card and Enter/Space only triggers the focused one. */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onPick(d)}
                  aria-current={isRec ? "true" : undefined}
                  aria-describedby={labelId}
                  className={`inline-flex min-h-11 items-center rounded-full px-4 font-mono text-[11px] tracking-[0.3em] transition ${
                    isRec
                      ? "bg-gold-dust text-obsidian hover:bg-gold-dust/90"
                      : "border border-stone-warm/30 text-stone-warm hover:border-gold-dust/50"
                  }`}
                >
                  选择此领域
                </button>
                <button
                  type="button"
                  onClick={() => setOpenSource(d)}
                  aria-haspopup="dialog"
                  aria-expanded={openSource === d}
                  aria-describedby={labelId}
                  className="inline-flex min-h-11 items-center text-[11px] text-gold-dust/80 underline decoration-dotted underline-offset-4 hover:text-gold-dust"
                >
                  这个分数怎么来的？
                </button>
              </div>
            </motion.li>
          );
        })}
      </ul>


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

/* ------------------------- Full Panorama Reader ---------------------- */

export interface PanoramaFullSection {
  id: string;
  label: string;
  /** Short summary shown before the reader chooses to open a V1 route. */
  summary: string;
  /** V1 route to open when the reader taps "翻开完整章节". Null =
   *  section is self-contained inside V2 (e.g. history-echoes). */
  v1_route?: { to: string; label: string; requiresEntitlement?: boolean };
  /** For "history" and "recommendations", the section renders a V2
   *  in-experience button instead of a V1 route link. */
  v2_action?: { label: string; onClick: () => void };
}

interface PanoramaFullProps {
  scores: DomainScoreResult[];
  readings: Record<DomainKey, GuidedDomainReading>;
  recommended: RecommendedFirstRead;
  entitled: boolean;
  initialAnchor?: string | null;
  onAnchorChange?: (id: string) => void;
  onBack: () => void;
  onOpenHistory: () => void;
  onOpenRecommendations: () => void;
  reducedMotion: boolean;
}

export function PanoramaFull({
  scores, readings, recommended, entitled, initialAnchor, onAnchorChange,
  onBack, onOpenHistory, onOpenRecommendations, reducedMotion,
}: PanoramaFullProps) {
  const sections: PanoramaFullSection[] = useMemo(() => [
    { id: "overview", label: "全景摘要",
      summary: "把学业、事业、情感、财富放在同一张地图上，先看整体走向，再决定翻哪一页。" },
    ...DOMAIN_ORDER.map<PanoramaFullSection>((d) => ({
      id: d,
      label: DOMAIN_LABEL[d],
      summary: readings[d].sections.opening,
      v1_route: {
        to: "/report",
        label: entitled ? "翻开完整章节 →" : "解锁完整报告 ¥79",
        requiresEntitlement: !entitled,
      },
    })),
    { id: "timeline", label: "生命时间轴",
      summary: "确定性大运/流年能量曲线，按年查看每个可观察窗口。",
      v1_route: { to: "/report", label: entitled ? "打开时间轴 →" : "解锁完整报告 ¥79" } },
    { id: "history", label: "历史回声",
      summary: "阅读一位与你此刻情境相似的历史人物，看看不同选择带来的不同代价。",
      v2_action: { label: "翻到历史回声 →", onClick: onOpenHistory } },
    { id: "recommendations", label: "推荐下一页",
      summary: `我们此刻建议你先读：${DOMAIN_LABEL[recommended.domain]}。原因：${recommended.reason_text.split("：").slice(-1)[0]}`,
      v2_action: { label: "查看推荐 →", onClick: onOpenRecommendations } },
  ], [readings, recommended, entitled, onOpenHistory, onOpenRecommendations]);

  const [active, setActive] = useState<string>(initialAnchor ?? "overview");
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const clickLockRef = useRef(0);

  // Restore initial anchor on mount.
  useEffect(() => {
    if (!initialAnchor) return;
    const el = sectionRefs.current[initialAnchor];
    if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
  }, [initialAnchor]);

  // IntersectionObserver-based scroll spy.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < clickLockRef.current) return;
        // Pick the entry with the highest intersection ratio that is visible.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).dataset.sectionId;
          if (id && id !== active) {
            setActive(id);
            onAnchorChange?.(id);
          }
        }
      },
      { root, rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const s of sections) {
      const el = sectionRefs.current[s.id];
      if (el) io.observe(el);
    }
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.length]);

  // Keep the active tab visible in the mobile scroller.
  useEffect(() => {
    const tabsEl = tabsRef.current;
    if (!tabsEl) return;
    const btn = tabsEl.querySelector<HTMLButtonElement>(`[data-tab-id="${active}"]`);
    if (!btn) return;
    const left = btn.offsetLeft - tabsEl.clientWidth / 2 + btn.clientWidth / 2;
    tabsEl.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });
  }, [active, reducedMotion]);

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    clickLockRef.current = Date.now() + 700;
    setActive(id);
    onAnchorChange?.(id);
    el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col md:flex-row">
      {/* Sidebar (desktop) / horizontal tabs (mobile) */}
      <nav
        aria-label="全景阅读导航"
        className="border-b border-stone-warm/10 bg-obsidian/70 md:w-56 md:shrink-0 md:border-b-0 md:border-r"
      >
        <div className="hidden md:block sticky top-0 max-h-[calc(100dvh-64px)] overflow-y-auto p-5">
          <button
            type="button"
            onClick={onBack}
            className="mb-4 font-mono text-[10px] tracking-[0.4em] text-stone-warm/50 hover:text-gold-dust"
          >
            ← 返回全景
          </button>
          <ul className="space-y-1">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm transition ${
                    active === s.id
                      ? "bg-gold-dust/15 text-gold-dust"
                      : "text-stone-warm/70 hover:text-stone-warm"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* Mobile horizontal scroller — never overflows the viewport. */}
        <div
          ref={tabsRef}
          className="flex gap-2 overflow-x-auto px-4 py-3 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 rounded-full border border-stone-warm/20 px-3 py-1.5 text-[11px] text-stone-warm/60"
          >
            ← 返回
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              data-tab-id={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] transition ${
                active === s.id
                  ? "border-gold-dust bg-gold-dust/15 text-gold-dust"
                  : "border-stone-warm/20 text-stone-warm/70"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Scrollable content */}
      <div ref={contentRef} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8">
          {sections.map((s) => {
            const scoreForSection = DOMAIN_ORDER.find((d) => d === s.id) as DomainKey | undefined;
            const sc = scoreForSection ? scores.find((x) => x.domain === scoreForSection) : undefined;
            return (
              <section
                key={s.id}
                ref={(el) => { sectionRefs.current[s.id] = el; }}
                data-section-id={s.id}
                className="scroll-mt-6 border-b border-stone-warm/10 py-8 first:pt-2 last:border-b-0"
              >
                <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust/70">
                  {s.id === "overview" ? "全景 · 摘要" : s.label}
                </p>
                <h2 className="mt-2 font-serif text-2xl text-stone-warm">{s.label}</h2>
                {sc && (
                  <p className="mt-1 text-[11px] text-stone-warm/50">
                    领域信号 {sc.score}/100 · {BAND_COPY[sc.band]} · {CONF_COPY[sc.confidence]}
                  </p>
                )}
                <p className="mt-3 text-sm leading-relaxed text-stone-warm/85">{s.summary}</p>
                <div className="mt-4">
                  {s.v1_route && (
                    <Link
                      to={s.v1_route.to}
                      className="inline-block rounded-full border border-gold-dust/50 px-4 py-2 font-mono text-[11px] tracking-[0.3em] text-gold-dust hover:bg-gold-dust/10"
                    >
                      {s.v1_route.label}
                    </Link>
                  )}
                  {s.v2_action && (
                    <button
                      type="button"
                      onClick={s.v2_action.onClick}
                      className="inline-block rounded-full border border-gold-dust/50 px-4 py-2 font-mono text-[11px] tracking-[0.3em] text-gold-dust hover:bg-gold-dust/10"
                    >
                      {s.v2_action.label}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
          <p className="mt-6 text-center text-[10px] text-stone-warm/40">
            全景导览 · deterministic · 不构成医疗、法律或投资建议
          </p>
        </div>
      </div>
    </div>
  );
}
