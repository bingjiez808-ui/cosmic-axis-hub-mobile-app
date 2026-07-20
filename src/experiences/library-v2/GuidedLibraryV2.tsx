/**
 * Guided Library V2 — story-chain container.
 *
 * DEMO ONLY. Fixture data + local persistence. No AI, no payment, no
 * writes to V1 tables. V1 pages (`/`, `/ritual`, `/report`, ...) are
 * completely untouched by this file — nothing here imports from V1.
 *
 * Membership CTAs surfaced by this file DO NOT call V1 payment or
 * entitlement code. They render a preview book and, when the reviewer
 * flips the "以已购身份预览" switch (or opens with `?entitled=1`), the
 * CTA morphs to "继续阅读" and links to the real V1 route via
 * TanStack `<Link>`. Real auth / order lookup happens on that route,
 * not here.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { LIBRARY_EXPERIENCE_VERSION } from "./version";
import {
  BOOKS,
  CLOSING_QUOTE,
  DEMO_FIXTURE,
  FIGURES,
  INSIGHT_BY_TOPIC,
  bookByRef,
} from "./story/fixtures";
import {
  DEMO_PROFILE,
  INITIAL_STORY_STATE,
  ageBandFromDate,
  intakeProgress,
  isIntakeStepValid,
  nextIntakeStep,
  prevIntakeStep,
  topicLabel,
} from "./story/state";
import type {
  BookRef,
  Note,
  NoteAudience,
  ReaderProfile,
  StoryStateV1,
  StoryStep,
  StoryTopic,
  FocusChoice,
} from "./story/types";
import {
  matchFigures,
  matchNotes,
  recommendNext,
} from "./story/matching";
import {
  createNote,
  createReply,
  listNotes,
  listReplies,
  restoreNote,
  restoreReply,
  softDeleteNote,
  softDeleteReply,
} from "./story/repository";
import {
  clearStoryState,
  loadStoryState,
  saveStoryState,
} from "./story/storage";
import { readerPublicNickname } from "./story/privacy";
import {
  applyFeedback,
  type FeedbackKind,
} from "./story/feedback";
import { DURATION, EASE, OPACITY, STAGGER, TRANSITION } from "./motion/tokens";
import { useReducedMotion } from "./motion/reduced-motion";
import {
  logMembership,
  useEntitledPreview,
} from "./membership";

// ---------------- Persistent local actor id (Demo only) ----------------
const ACTOR_KEY = "lod:library-v2:actor-id";
function getActorId(): string {
  if (typeof window === "undefined") return "demo-actor";
  let id = window.localStorage.getItem(ACTOR_KEY);
  if (!id) {
    id = `demo-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(ACTOR_KEY, id);
  }
  return id;
}

/**
 * Toast contract for the note-detail undo action. Kept in-file (no
 * external toast dependency) because the V2 demo intentionally
 * avoids app-wide toast plumbing.
 */
interface UndoToast {
  id: string;
  label: string;
  action: () => void;
  expires_at: number;
}


// ---------------- Root ----------------
export function GuidedLibraryV2() {
  const [state, setState] = useState<StoryStateV1>(() => ({
    ...INITIAL_STORY_STATE,
  }));
  const [hydrated, setHydrated] = useState(false);
  const reducedMotion = useReducedMotion();
  const actorId = useMemo(() => getActorId(), []);
  const { entitled, setEntitled } = useEntitledPreview();
  const [toast, setToast] = useState<UndoToast | null>(null);

  useEffect(() => {
    const loaded = loadStoryState();
    setState({
      ...loaded,
      // Mark first-visit-at on the first mount that persists to storage,
      // so the gate can shorten its ceremony next time.
      first_visit_at: loaded.first_visit_at ?? Date.now(),
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveStoryState(state);
  }, [state, hydrated]);

  // Expire the undo toast when its window closes.
  useEffect(() => {
    if (!toast) return;
    const ms = Math.max(0, toast.expires_at - Date.now());
    const t = window.setTimeout(() => setToast(null), ms);
    return () => window.clearTimeout(t);
  }, [toast]);

  const patchProfile = (p: Partial<ReaderProfile>) =>
    setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));

  const goto = (step: StoryStep) => setState((s) => ({ ...s, step }));

  const restart = () => {
    clearStoryState();
    setState({ ...INITIAL_STORY_STATE, first_visit_at: Date.now() });
  };

  const useDemoProfile = () => {
    setState((s) => ({
      ...s,
      profile: { ...DEMO_PROFILE, age_band: ageBandFromDate(DEMO_PROFILE.birth_date) },
    }));
  };

  const onFeedback = (kind: FeedbackKind) => {
    setState((s) => {
      const topic = s.profile.topic;
      // Overview readers explicitly opted out of a single topic;
      // never nudge a per-topic feedback weight under panoramic mode.
      if (!topic || topic === "overview") return s;
      return {
        ...s,
        feedback_weights: applyFeedback(s.feedback_weights, topic, kind),
      };
    });
  };

  const showUndoToast = (label: string, action: () => void) => {
    setToast({
      id: `t-${Date.now()}`,
      label,
      action,
      expires_at: Date.now() + 10_000,
    });
  };

  const returning = !!(state.first_visit_at && Date.now() - state.first_visit_at > 60_000);

  return (
    <div className="min-h-[100dvh] bg-obsidian text-stone-warm">
      <TopBar
        step={state.step}
        onRestart={restart}
        onDemo={useDemoProfile}
        onHome={() => goto("gate")}
        entitled={entitled}
        onToggleEntitled={setEntitled}
      />
      <main className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-6 sm:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.step}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
            transition={TRANSITION.fadeShort}
          >
            {state.step === "gate" && (
              <Gate
                onEnter={() => goto("focus")}
                reducedMotion={reducedMotion}
                returning={returning}
              />
            )}
            {state.step === "focus" && (
              <DestinyMap
                topic={state.profile.topic}
                onConfirm={(t, overview) => {
                  // "全景阅读" is a UX-only choice — matching, shelf ordering
                  // and recommendations still need a concrete StoryTopic, so
                  // we safe-map it to "career" (the widest default fixture
                  // set) and mark the entry in reading_history. Existing
                  // matchers and recommenders are unchanged.
                  const underlying: StoryTopic = overview ? "career" : t;
                  setState((s) => ({
                    ...s,
                    profile: { ...s.profile, topic: underlying },
                    reading_history: overview
                      ? [
                          ...s.reading_history,
                          { kind: "recommendation_clicked", ref: "overview", at: Date.now() },
                        ]
                      : s.reading_history,
                    step: "intake_name",
                  }));
                }}
                reducedMotion={reducedMotion}
              />
            )}
            {(state.step === "intake_name"
              || state.step === "intake_birth"
              || state.step === "intake_place") && (
              <Intake
                step={state.step}
                profile={state.profile}
                onChange={patchProfile}
                onBack={() => goto(prevIntakeStep(state.step))}
                onNext={() => {
                  if (state.step === "intake_place") {
                    const ab = ageBandFromDate(state.profile.birth_date);
                    patchProfile({ age_band: ab });
                  }
                  goto(nextIntakeStep(state.step));
                }}
              />
            )}
            {state.step === "first_insight" && state.profile.topic && (
              <FirstInsight
                topic={state.profile.topic}
                onNext={() => goto("shelf")}
                onFeedback={onFeedback}
                weights={state.feedback_weights}
                reducedMotion={reducedMotion}
              />
            )}
            {state.step === "shelf" && (
              <Shelf
                profile={state.profile}
                readBooks={state.read_books}
                entitled={entitled}
                onOpenBook={(ref) => {
                  setState((s) => ({
                    ...s,
                    step: "book",
                    active_book: ref,
                    read_books: s.read_books.includes(ref)
                      ? s.read_books
                      : [...s.read_books, ref],
                    reading_history: [
                      ...s.reading_history,
                      { kind: "book_opened", ref, at: Date.now() },
                    ],
                  }));
                }}
                onHistory={() => goto("history")}
                onRecommend={() => goto("recommendations")}
                onNotes={() => goto("notes")}
                reducedMotion={reducedMotion}
              />
            )}
            {state.step === "book" && state.active_book && (
              <BookReader
                ref={state.active_book}
                entitled={entitled}
                onBack={() => goto("shelf")}
              />
            )}
            {state.step === "history" && (
              <History
                profile={state.profile}
                filter={state.history_filter}
                onFilter={(f) => setState((s) => ({ ...s, history_filter: f }))}
                onOpen={(id) => setState((s) => ({ ...s, step: "figure", active_figure_id: id }))}
                onBack={() => goto("shelf")}
                reducedMotion={reducedMotion}
              />
            )}
            {state.step === "figure" && state.active_figure_id && (
              <FigureDetail
                id={state.active_figure_id}
                onBack={() => goto("history")}
                reducedMotion={reducedMotion}
              />
            )}
            {state.step === "recommendations" && (
              <Recommendations
                profile={state.profile}
                readBookRefs={state.read_books}
                weights={state.feedback_weights}
                onChangeTopic={(t) => patchProfile({ topic: t })}
                onOpenBook={(ref) => {
                  setState((s) => ({
                    ...s,
                    step: "book",
                    active_book: ref,
                    read_books: s.read_books.includes(ref) ? s.read_books : [...s.read_books, ref],
                  }));
                }}
                onBack={() => goto("shelf")}
              />
            )}
            {(state.step === "notes"
              || state.step === "note_compose"
              || state.step === "note_detail") && (
              <NotesArea
                state={state}
                actorId={actorId}
                setState={setState}
                goto={goto}
                showUndoToast={showUndoToast}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <UndoToastPortal
        toast={toast}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}



// ---------------- TopBar ----------------
function TopBar({
  step,
  onRestart,
  onDemo,
  onHome,
  entitled,
  onToggleEntitled,
}: {
  step: StoryStep;
  onRestart: () => void;
  onDemo: () => void;
  onHome: () => void;
  entitled?: boolean;
  onToggleEntitled?: (v: boolean) => void;
}) {

  return (
    <div
      className="sticky top-0 z-30 border-b border-gold-dust/15 bg-obsidian/85 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-5 py-2.5 sm:px-8">
        <button
          type="button"
          onClick={onHome}
          className="min-h-11 font-mono text-[10px] tracking-[0.35em] text-gold-dust"
        >
          ✦ 命运图书馆 · DEMO
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[9px] tracking-[0.3em] text-stone-warm/40 sm:inline">
            {LIBRARY_EXPERIENCE_VERSION}
          </span>
          {onToggleEntitled && (
            <button
              type="button"
              onClick={() => onToggleEntitled(!entitled)}
              aria-pressed={!!entitled}
              title="以已购身份预览：Demo 演示，不涉及真实订单"
              className={`min-h-11 rounded-full border px-3 text-xs transition ${
                entitled
                  ? "border-gold-dust bg-gold-dust/15 text-stone-warm"
                  : "border-stone-warm/20 text-stone-warm/70 hover:bg-stone-warm/5"
              }`}
            >
              {entitled ? "✓ 已购身份预览" : "以已购身份预览"}
            </button>
          )}
          {step !== "gate" && (
            <button
              type="button"
              onClick={onDemo}
              className="min-h-11 rounded-full border border-gold-dust/30 px-3 text-xs text-stone-warm/80 hover:bg-gold-dust/10"
            >
              使用演示资料
            </button>
          )}
          <button
            type="button"
            onClick={onRestart}
            className="min-h-11 rounded-full border border-stone-warm/20 px-3 text-xs text-stone-warm/70 hover:bg-stone-warm/5"
          >
            重新开始
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-[1100px] px-5 pb-10 pt-4 text-center font-mono text-[9px] tracking-[0.4em] text-stone-warm/35 sm:px-8">
      DEMO FIXTURE · NO REAL AI · NO REAL PAYMENT ·{" "}
      {DEMO_FIXTURE ? LIBRARY_EXPERIENCE_VERSION : ""}
    </footer>
  );
}

function UndoToastPortal({
  toast,
  onDismiss,
}: {
  toast: UndoToast | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-gold-dust/30 bg-obsidian/95 px-4 py-2 text-xs text-stone-warm shadow-lg backdrop-blur"
    >
      <span className="mr-3">{toast.label}</span>
      <button
        type="button"
        onClick={() => {
          toast.action();
          onDismiss();
        }}
        className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dust hover:text-gold-dust/80"
      >
        撤销
      </button>
    </div>,
    document.body,
  );
}


// ---------------- 1. Gate ----------------
function Gate({
  onEnter,
  reducedMotion,
  returning,
}: {
  onEnter: () => void;
  reducedMotion: boolean;
  returning?: boolean;
}) {
  const [entering, setEntering] = useState(false);
  const [parallax, setParallax] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) - 0.5;
      const ny = (e.clientY / window.innerHeight) - 0.5;
      setParallax({ x: nx, y: ny });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reducedMotion]);

  const trigger = () => {
    if (reducedMotion || returning) {
      onEnter();
      return;
    }
    setEntering(true);
    setTimeout(onEnter, 550);
  };

  const enterDuration = returning ? 0.2 : DURATION.long;
  const p = reducedMotion ? { x: 0, y: 0 } : parallax;

  return (
    <section className="relative min-h-[70dvh] overflow-hidden pt-8 text-center">
      {/* Three layered parallax planes: bookshelf silhouette / star ring / dust. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `translate3d(${p.x * -14}px, ${p.y * -8}px, 0)`,
          transition: reducedMotion ? undefined : "transform 220ms ease-out",
          background:
            "radial-gradient(ellipse at 50% 85%, oklch(0.22 0.02 60 / 0.55), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `translate3d(${p.x * -28}px, ${p.y * -14}px, 0)`,
          transition: reducedMotion ? undefined : "transform 320ms ease-out",
          background:
            "radial-gradient(circle at 50% 32%, oklch(0.5 0.08 285 / 0.14), transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          entering ? "opacity-100" : "opacity-40"
        }`}
        style={{
          transform: `translate3d(${p.x * -46}px, ${p.y * -22}px, 0)`,
          transition: reducedMotion ? undefined : "transform 500ms ease-out, opacity 500ms",
          background:
            "radial-gradient(ellipse at 50% 30%, oklch(0.28 0.05 85 / 0.35), transparent 60%)",
        }}
      />
      {/* Door-crack light on hover/press — expressed via `entering`. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-gradient-to-b from-gold-dust/60 via-gold-dust/10 to-transparent"
        style={{
          opacity: entering ? 1 : 0,
          transition: reducedMotion ? undefined : "opacity 420ms",
          filter: "blur(2px)",
        }}
      />

      {returning && (
        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={TRANSITION.fadeShort}
          className="relative mb-2 font-mono text-[10px] tracking-[0.4em] text-gold-dust/80"
        >
          WELCOME BACK · 继续上次阅读
        </motion.p>
      )}
      <motion.p
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: enterDuration, ease: EASE.standard }}
        className="relative font-mono text-[10px] tracking-[0.4em] text-gold-dust"
      >
        THE LIBRARY OF DESTINY
      </motion.p>
      <motion.h1
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: enterDuration, ease: EASE.standard, delay: returning ? 0 : STAGGER.line }}
        className="relative mx-auto mt-6 max-w-[22ch] font-serif text-4xl leading-[1.25] text-stone-warm sm:text-5xl"
      >
        每一种文明，都在追问同一个问题
      </motion.h1>
      <motion.p
        initial={reducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: enterDuration, ease: EASE.standard, delay: returning ? 0 : STAGGER.line * 2 }}
        className="relative mx-auto mt-4 max-w-[22ch] font-serif text-3xl text-gold-light sm:text-4xl"
      >
        你，是谁？
      </motion.p>
      <p className="relative mx-auto mt-6 max-w-[28ch] text-sm text-stone-warm/70">
        西方占星 · 印度占星 · 八字 · 紫微。四种传统，共同读懂同一个你。
      </p>
      <button
        type="button"
        onClick={trigger}
        disabled={entering}
        className="group relative mt-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-gold-dust px-8 py-3 font-serif text-base text-obsidian shadow-[0_0_40px_oklch(0.76_0.11_85/0.35)] transition hover:bg-gold-light disabled:opacity-70"
      >
        <span
          aria-hidden
          className="absolute inset-0 rounded-full ring-2 ring-gold-dust/0 transition group-hover:ring-gold-dust/40"
        />
        {returning ? "继续上次阅读 →" : "步入图书馆 →"}
      </button>
      <p className="relative mt-6 text-xs text-stone-warm/45">
        约 2 分钟 · 基础解读免费 · 完全演示体验
      </p>
    </section>
  );
}


const FOCUS_TOPICS: StoryTopic[] = ["career", "love", "wealth", "recent"];




// ---------------- 2. Destiny Map ----------------
//
// A restrained "life map" replaces the four vertical questionnaire cards.
// Five explorable nodes (four topics + one panoramic entry) fan out from a
// glowing centre. Clicking a node opens a preview panel that explains what
// the chapter analyses, what the reader will get, and which V1 modules feed
// it — no leading questions, no promises. Only confirming from the preview
// commits a topic and advances the story chain.

type MapChoice = StoryTopic | "overview";

interface MapNodeDef {
  key: MapChoice;
  label: string;
  caption: string;
  // Desktop absolute position on the 100×62 map (percentages of container).
  x: number;
  y: number;
  // Mobile column horizontal offset (-1 = left, 0 = centre, 1 = right).
  offset: -1 | 0 | 1;
  glyph: "compass" | "orbit" | "river" | "moon" | "dome";
}

const MAP_NODES: MapNodeDef[] = [
  { key: "overview", label: "全景阅读", caption: "先不选择主题，浏览完整人生地图", x: 50, y: 14, offset: 0, glyph: "dome" },
  { key: "career", label: "事业与方向", caption: "看见能力、位置与下一步方向", x: 16, y: 44, offset: -1, glyph: "compass" },
  { key: "love", label: "关系与情感", caption: "理解亲密模式、需要与边界", x: 84, y: 44, offset: 1, glyph: "orbit" },
  { key: "wealth", label: "财富与资源", caption: "理解积累方式、机会与风险偏好", x: 26, y: 78, offset: -1, glyph: "river" },
  { key: "recent", label: "当下与变化", caption: "辨认所处阶段与未来时间窗口", x: 74, y: 78, offset: 1, glyph: "moon" },
];

interface ChapterPreview {
  analyzes: [string, string, string];
  gains: [string, string];
  modules: string[];
}

const CHAPTER_PREVIEW: Record<MapChoice, ChapterPreview> = {
  career: {
    analyzes: [
      "你更容易发挥优势的工作方式",
      "适合承担的位置与组织环境",
      "当前周期更适合积累、调整还是尝试",
    ],
    gains: [
      "一份可验证的优势与风险摘要",
      "推荐继续阅读的事业章节与可观察的时间窗口",
    ],
    modules: ["八字十神与格局解读", "紫微命宫与事业宫解读", "西方占星第十宫与流年"],
  },
  love: {
    analyzes: [
      "你在亲密关系中稳定出现的需要",
      "你与他人形成连结与冲突的互动模式",
      "近期更适合建立边界还是打开对话的窗口",
    ],
    gains: [
      "一份关系需要与互动风格的画像",
      "推荐继续阅读的情感章节与可观察的时间窗口",
    ],
    modules: ["八字日主与配偶宫", "紫微夫妻宫", "西方占星第七宫与金星"],
  },
  wealth: {
    analyzes: [
      "你获取与保存资源的惯性方式",
      "你与风险、机会之间的真实距离",
      "近期更适合关注积累、周转还是投入的时期",
    ],
    gains: [
      "一份资源结构与风险偏好的摘要",
      "推荐继续阅读的财富章节与可观察的时间窗口",
    ],
    modules: ["八字财官印食伤", "紫微财帛宫与福德宫", "西方占星第二宫与第八宫"],
  },
  recent: {
    analyzes: [
      "你此刻所处的人生阶段与主线",
      "跨体系反复出现的信号（八字/紫微/西方）",
      "未来数月中值得观察的窗口",
    ],
    gains: [
      "一份当前阶段的摘要与关注建议",
      "推荐继续阅读的时间轴章节与可观察的时间窗口",
    ],
    modules: ["八字大运流年", "紫微大限与流年", "西方占星次限推进与行运"],
  },
  overview: {
    analyzes: [
      "四个领域的整体画像与相互影响",
      "跨体系反复出现的关键信号",
      "适合你的第一条深入路径建议",
    ],
    gains: [
      "一份人生地图总览",
      "由你自己决定接下来深入哪一章",
    ],
    modules: ["八字全盘概览", "紫微十二宫摘要", "西方占星全宫位摘要"],
  },
};

function glyphPath(g: MapNodeDef["glyph"]): React.ReactNode {
  switch (g) {
    case "compass":
      return (
        <>
          <circle cx="0" cy="0" r="7" fill="none" strokeWidth="0.6" />
          <path d="M0 -6 L1.5 0 L0 6 L-1.5 0 Z" strokeWidth="0.5" />
        </>
      );
    case "orbit":
      return (
        <>
          <ellipse cx="-1.6" cy="0" rx="5.5" ry="2.2" fill="none" strokeWidth="0.5" />
          <ellipse cx="1.6" cy="0" rx="5.5" ry="2.2" fill="none" strokeWidth="0.5" />
        </>
      );
    case "river":
      return (
        <path
          d="M-7 -3 C -3 -3, -3 3, 0 3 C 3 3, 3 -3, 7 -3"
          fill="none"
          strokeWidth="0.6"
        />
      );
    case "moon":
      return (
        <>
          <circle cx="0" cy="0" r="6" fill="none" strokeWidth="0.5" />
          <path d="M-2 -5 A 6 6 0 0 0 -2 5 A 4 5 0 0 1 -2 -5 Z" strokeWidth="0.4" />
        </>
      );
    case "dome":
      return (
        <>
          <path d="M-7 3 A 7 6 0 0 1 7 3" fill="none" strokeWidth="0.6" />
          <path d="M-7 3 L 7 3" strokeWidth="0.4" />
          <path d="M0 -3 L0 3" strokeWidth="0.35" />
        </>
      );
  }
}

function DestinyMap({
  topic,
  onConfirm,
  reducedMotion,
}: {
  topic: FocusChoice | null;
  onConfirm: (t: FocusChoice) => void;
  reducedMotion?: boolean;
}) {
  // Which node the reader is *previewing* right now (may differ from the
  // committed topic — a reader can peek at a second node before deciding).
  const [preview, setPreview] = useState<MapChoice | null>(null);
  // Nodes the reader has looked at at least once — drawn as a bookmark
  // pip on the map so exploration feels persistent, not lost.
  const [visited, setVisited] = useState<Set<MapChoice>>(new Set());
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const openPreview = (key: MapChoice) => {
    setPreview(key);
    setVisited((s) => {
      if (s.has(key)) return s;
      const next = new Set(s);
      next.add(key);
      return next;
    });
    // Move keyboard focus into the panel for screen-reader / keyboard users.
    window.setTimeout(() => {
      previewRef.current?.querySelector<HTMLButtonElement>("[data-preview-primary]")?.focus();
    }, 60);
  };

  const closePreview = () => setPreview(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && preview !== null) {
        e.preventDefault();
        closePreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const previewDef = preview ? MAP_NODES.find((n) => n.key === preview) : null;
  const previewData = preview ? CHAPTER_PREVIEW[preview] : null;

  return (
    <section className="pt-4">
      <p className="font-mono text-[10px] tracking-[0.35em] text-gold-dust">
        第 1 页 · 选择阅读路径
      </p>
      <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-warm sm:text-4xl">
        选择你的第一条阅读路径
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-warm/65">
        没有标准答案。你可以从此刻最想理解的领域开始，也可以交给图书馆为你展开全景。
      </p>

      {/* Desktop map — abstract star-atlas layout */}
      <div
        ref={containerRef}
        className="relative mx-auto mt-10 hidden aspect-[16/10] w-full max-w-[900px] sm:block"
        aria-label="命运地图"
      >
        {/* Backdrop: layered gradients evoking a dark library dome + star field */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl border border-gold-dust/10">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 55%, oklch(0.28 0.03 250 / 0.65), transparent 65%), radial-gradient(ellipse at 50% 100%, oklch(0.22 0.04 60 / 0.35), transparent 60%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 12% 20%, oklch(0.76 0.11 85 / 0.35) 0 1px, transparent 1.5px), radial-gradient(circle at 78% 12%, oklch(0.76 0.11 85 / 0.3) 0 1px, transparent 1.5px), radial-gradient(circle at 30% 82%, oklch(0.76 0.11 85 / 0.25) 0 1px, transparent 1.5px), radial-gradient(circle at 88% 74%, oklch(0.76 0.11 85 / 0.3) 0 1px, transparent 1.5px), radial-gradient(circle at 55% 30%, oklch(0.76 0.11 85 / 0.2) 0 1px, transparent 1.5px)",
            }}
          />
        </div>

        {/* SVG connectors */}
        <svg
          viewBox="0 0 100 62"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <radialGradient id="dm-center-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.86 0.11 85)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="oklch(0.76 0.11 85)" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Halo behind centre */}
          <circle cx="50" cy="50" r="7" fill="url(#dm-center-glow)" />
          {MAP_NODES.map((n, i) => {
            const active = preview === n.key || topic === n.key;
            return (
              <motion.line
                key={n.key}
                x1="50"
                y1="50"
                x2={n.x}
                y2={n.y}
                stroke="oklch(0.76 0.11 85)"
                strokeWidth={active ? 0.35 : 0.18}
                strokeDasharray="0.6 0.9"
                initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: active ? 0.85 : 0.45 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.55,
                  delay: reducedMotion ? 0 : 0.15 + i * 0.08,
                  ease: EASE.standard,
                }}
              />
            );
          })}
          {/* Centre mark */}
          <circle cx="50" cy="50" r="1.1" fill="oklch(0.86 0.11 85)" />
          <circle cx="50" cy="50" r="2.4" fill="none" stroke="oklch(0.76 0.11 85 / 0.55)" strokeWidth="0.2" />
        </svg>

        {/* Centre label */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ transform: "translate(-50%, calc(-50% + 22px))" }}
        >
          <p className="font-mono text-[9px] tracking-[0.35em] text-stone-warm/55">
            此刻的我 · 起点
          </p>
        </div>

        {/* Nodes */}
        {MAP_NODES.map((n, i) => {
          const active = preview === n.key;
          const chosen = topic === n.key || (topic !== null && n.key === "overview" && false);
          return (
            <MapNodeButton
              key={n.key}
              node={n}
              active={active}
              chosen={chosen}
              visited={visited.has(n.key)}
              onOpen={() => openPreview(n.key)}
              reducedMotion={reducedMotion}
              delay={0.35 + i * 0.08}
              style={{
                position: "absolute",
                left: `${n.x}%`,
                top: `${n.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
      </div>

      {/* Mobile vertical journey — S-curve, no horizontal overflow */}
      <div className="mt-8 flex flex-col gap-3 sm:hidden" role="list" aria-label="命运地图">
        {MAP_NODES.map((n, i) => (
          <div
            key={n.key}
            role="listitem"
            className={`flex ${n.offset === -1 ? "justify-start" : n.offset === 1 ? "justify-end" : "justify-center"}`}
          >
            <MapNodeButton
              node={n}
              active={preview === n.key}
              chosen={topic === n.key}
              visited={visited.has(n.key)}
              onOpen={() => openPreview(n.key)}
              reducedMotion={reducedMotion}
              delay={0.05 + i * 0.05}
              mobile
            />
          </div>
        ))}
      </div>

      {/* Chapter preview panel */}
      <AnimatePresence initial={false}>
        {preview && previewDef && previewData && (
          <motion.div
            ref={previewRef}
            key={preview}
            role="region"
            aria-label={`${previewDef.label} · 你将在这一章读到`}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 6 }}
            transition={TRANSITION.fadeMedium}
            className="mt-8 overflow-hidden rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.04] p-6 shadow-[0_20px_60px_oklch(0.15_0.02_250/0.5)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] tracking-[0.35em] text-gold-dust">
                {previewDef.label.toUpperCase()}
              </p>
              <p className="font-mono text-[10px] tracking-[0.25em] text-stone-warm/45">
                你将在这一章读到
              </p>
            </div>
            <h3 className="mt-3 font-serif text-2xl leading-snug text-stone-warm">
              {previewDef.caption}
            </h3>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.3em] text-stone-warm/55">
                  分析什么
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-warm/85">
                  {previewData.analyzes.map((a) => (
                    <li key={a} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-gold-dust/70" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.3em] text-stone-warm/55">
                  你会获得
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-warm/85">
                  {previewData.gains.map((g) => (
                    <li key={g} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-gold-dust/70" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.3em] text-stone-warm/55">
                  使用的解读模块
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-warm/85">
                  {previewData.modules.map((m) => (
                    <li key={m} className="flex gap-2">
                      <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-gold-dust/70" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-6 text-[11px] leading-relaxed text-stone-warm/45">
              结果用于自我理解，不替代医疗、法律或投资建议。
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={closePreview}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-stone-warm/25 px-5 text-sm text-stone-warm/80 hover:border-stone-warm/45"
              >
                返回地图
              </button>
              <button
                type="button"
                data-preview-primary
                onClick={() => {
                  const isOverview = preview === "overview";
                  onConfirm(isOverview ? "career" : (preview as StoryTopic), isOverview);
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold-dust px-6 text-sm text-obsidian hover:bg-gold-light"
              >
                从这一章开始 →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function MapNodeButton({
  node,
  active,
  chosen,
  visited,
  onOpen,
  reducedMotion,
  delay,
  style,
  mobile,
}: {
  node: MapNodeDef;
  active: boolean;
  chosen: boolean;
  visited: boolean;
  onOpen: () => void;
  reducedMotion?: boolean;
  delay: number;
  style?: React.CSSProperties;
  mobile?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-pressed={active}
      aria-current={chosen ? "true" : undefined}
      initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : delay, ease: EASE.standard }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      style={style}
      className={`group inline-flex ${mobile ? "w-[78%]" : "w-[190px]"} min-h-[44px] items-center gap-3 rounded-2xl border p-3 pr-4 text-left backdrop-blur-sm transition-colors ${
        active
          ? "border-gold-dust bg-gold-dust/10 shadow-[0_0_28px_oklch(0.76_0.11_85/0.25)]"
          : chosen
            ? "border-gold-dust/60 bg-gold-dust/[0.06]"
            : "border-stone-warm/15 bg-obsidian/60 hover:border-gold-dust/40"
      }`}
    >
      <span
        aria-hidden
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${
          active || chosen ? "border-gold-dust/70 bg-gold-dust/10" : "border-stone-warm/20 bg-obsidian/70"
        }`}
      >
        <svg viewBox="-10 -10 20 20" className="h-6 w-6 stroke-gold-dust" fill="none">
          {glyphPath(node.glyph)}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-serif text-[15px] leading-tight text-stone-warm">
            {node.label}
          </span>
          {visited && (
            <span
              aria-label="已探索"
              title="已探索"
              className="inline-block h-1.5 w-1.5 rounded-full bg-gold-dust"
            />
          )}
        </span>
        <span className="mt-1 block text-[11px] leading-snug text-stone-warm/60">
          {node.caption}
        </span>
      </span>
    </motion.button>
  );
}



// ---------------- 3. Intake ----------------
function Intake({
  step,
  profile,
  onChange,
  onBack,
  onNext,
}: {
  step: StoryStep;
  profile: ReaderProfile;
  onChange: (p: Partial<ReaderProfile>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const progress = intakeProgress(step);
  const valid = isIntakeStepValid(step, profile);
  const title = {
    intake_name: "这本书属于谁",
    intake_birth: "故事从什么时候开始",
    intake_place: "你从哪里出发",
  }[step as "intake_name" | "intake_birth" | "intake_place"];
  const cta = step === "intake_place" ? "打开我的第一章 →" : "继续 →";
  return (
    <section className="pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
        >
          ← 返回
        </button>
        {progress && (
          <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
            {progress.index}/{progress.total}
          </p>
        )}
      </div>
      <h2 className="mt-4 font-serif text-3xl text-stone-warm">{title}</h2>
      <div className="mt-6 max-w-[520px]">
        {step === "intake_name" && (
          <div className="space-y-4">
            <FieldLabel>你的称呼</FieldLabel>
            <input
              value={profile.nickname}
              onChange={(e) => onChange({ nickname: e.target.value.slice(0, 20) })}
              placeholder="怎么称呼你"
              className="w-full rounded-xl border border-stone-warm/15 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm outline-none focus:border-gold-dust"
            />
            <FieldLabel>性别</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(["female", "male", "other"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => onChange({ gender: g })}
                  aria-pressed={profile.gender === g}
                  className={`min-h-11 rounded-full border px-4 text-sm ${
                    profile.gender === g
                      ? "border-gold-dust bg-gold-dust/15 text-stone-warm"
                      : "border-stone-warm/20 text-stone-warm/70"
                  }`}
                >
                  {g === "female" ? "女" : g === "male" ? "男" : "其他 / 不便说明"}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === "intake_birth" && (
          <div className="space-y-4">
            <FieldLabel>出生日期</FieldLabel>
            <input
              type="date"
              value={profile.birth_date}
              onChange={(e) => onChange({ birth_date: e.target.value })}
              className="w-full rounded-xl border border-stone-warm/15 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm outline-none focus:border-gold-dust"
            />
            <FieldLabel>出生时间</FieldLabel>
            <input
              type="time"
              value={profile.birth_time}
              disabled={profile.time_unknown}
              onChange={(e) => onChange({ birth_time: e.target.value })}
              className="w-full rounded-xl border border-stone-warm/15 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm outline-none focus:border-gold-dust disabled:opacity-40"
            />
            <label className="flex items-center gap-2 text-sm text-stone-warm/70">
              <input
                type="checkbox"
                checked={profile.time_unknown}
                onChange={(e) =>
                  onChange({
                    time_unknown: e.target.checked,
                    birth_time: e.target.checked ? "" : profile.birth_time,
                  })
                }
              />
              不知道准确时间（Demo 会用近似时间）
            </label>
          </div>
        )}
        {step === "intake_place" && (
          <div className="space-y-4">
            <FieldLabel>出生城市</FieldLabel>
            <input
              value={profile.place}
              onChange={(e) => onChange({ place: e.target.value })}
              placeholder="例如：杭州 / New York"
              className="w-full rounded-xl border border-stone-warm/15 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm outline-none focus:border-gold-dust"
            />
            <p className="text-xs text-stone-warm/45">
              Demo 环境不会把出生城市写入任何公共数据，也不会用于匿名匹配。
            </p>
          </div>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!valid}
          onClick={onNext}
          className="min-h-12 rounded-full bg-gold-dust px-6 text-obsidian hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {cta}
        </button>
      </div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
      {children}
    </p>
  );
}

// ---------------- 4. First insight ----------------
function FirstInsight({
  topic,
  onNext,
  onFeedback,
  reducedMotion,
}: {
  topic: StoryTopic;
  onNext: () => void;
  onFeedback?: (kind: FeedbackKind) => void;
  weights?: Partial<Record<StoryTopic, number>>;
  reducedMotion?: boolean;
}) {
  const ins = INSIGHT_BY_TOPIC[topic];
  const [openKey, setOpenKey] = useState<"why" | "next" | "when" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackKind | null>(null);
  const clickFeedback = (k: FeedbackKind) => {
    setFeedback(k);
    onFeedback?.(k);
    if (k === "want_more") {
      logMembership("membership_impression", "first_insight_want_more");
    }
  };
  const sentences = ins.headline.split(/(?<=[。！？])/g).filter((s) => s.trim().length);
  return (
    <section className="pt-6">
      <DemoBadge>你的第一条洞察 · 演示样本</DemoBadge>
      <div className="mt-3">
        {sentences.map((s, i) => (
          <motion.p
            key={i}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.short, ease: EASE.standard, delay: i * STAGGER.line }}
            className="font-serif text-2xl leading-relaxed text-stone-warm sm:text-3xl"
          >
            {s}
          </motion.p>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(
          [
            ["why", "为什么会这样"],
            ["next", "接下来怎么做"],
            ["when", "哪个时间会变化"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setOpenKey(k)}
            className="min-h-16 rounded-xl border border-stone-warm/15 bg-obsidian/30 p-4 text-left hover:border-gold-dust/40"
          >
            <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
              📑 {label}
            </p>
            <p className="mt-2 text-sm text-stone-warm/70">展开阅读 →</p>
          </button>
        ))}
      </div>
      <div className="mt-8 rounded-xl border border-stone-warm/10 bg-obsidian/30 p-4">
        <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
          这段像你吗？
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["resonant", "像我"],
              ["not_me", "不太像"],
              ["want_more", "想继续了解"],
            ] as [FeedbackKind, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => clickFeedback(k)}
              aria-pressed={feedback === k}
              className={`min-h-11 rounded-full border px-4 text-sm transition ${
                feedback === k
                  ? "border-gold-dust bg-gold-dust/15 text-stone-warm"
                  : "border-stone-warm/20 text-stone-warm/75 hover:bg-stone-warm/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {feedback && (
          <p className="mt-3 text-xs text-stone-warm/55">
            {feedback === "resonant"
              ? "记下了。稍后书架会把和这段共振的章节排在前面。"
              : feedback === "not_me"
              ? "记下了。我们会把这段的相关内容稍稍往后排。"
              : "记下了。为你保留一个更完整的入口——不打断当前阅读。"}
          </p>
        )}
      </div>
      <div className="mt-10">
        <button
          type="button"
          onClick={onNext}
          className="min-h-12 rounded-full bg-gold-dust px-6 text-obsidian hover:bg-gold-light"
        >
          去我的书架 →
        </button>
      </div>
      {openKey && (
        <Drawer
          title={
            openKey === "why"
              ? "为什么会这样"
              : openKey === "next"
              ? "接下来怎么做"
              : "哪个时间会变化"
          }
          onClose={() => setOpenKey(null)}
        >
          <p className="text-base leading-relaxed text-stone-warm/85">
            {ins[openKey]}
          </p>
          <p className="mt-6 text-xs text-stone-warm/50">
            演示数据。真实用户接入时，这一段会由 V1 的确定性事实模块给出，
            AI 只解释事实，不会替你排盘。
          </p>
        </Drawer>
      )}
    </section>
  );
}


// ---------------- 5. Shelf ----------------
function Shelf({
  profile,
  readBooks,
  onOpenBook,
  onHistory,
  onRecommend,
  onNotes,
  entitled,
}: {
  profile: ReaderProfile;
  readBooks: BookRef[];
  onOpenBook: (r: BookRef) => void;
  onHistory: () => void;
  onRecommend: () => void;
  onNotes: () => void;
  entitled?: boolean;
  reducedMotion?: boolean;
}) {

  const primary: BookRef =
    profile.topic === "career"
      ? "career"
      : profile.topic === "love"
      ? "love"
      : profile.topic === "wealth"
      ? "wealth"
      : "self";
  const primaryBook = bookByRef(primary);
  const topicOrder: Record<StoryTopic, BookRef[]> = {
    career: ["career", "wealth", "timeline", "premium", "sage", "self", "love"],
    love: ["love", "self", "timeline", "sage", "premium", "career", "wealth"],
    wealth: ["wealth", "career", "timeline", "premium", "sage", "self", "love"],
    recent: ["self", "timeline", "sage", "premium", "career", "love", "wealth"],
  };
  const order = profile.topic ? topicOrder[profile.topic] : BOOKS.map((b) => b.ref);
  const orderedShelf = order
    .map((r) => BOOKS.find((b) => b.ref === r))
    .filter((b): b is (typeof BOOKS)[number] => !!b);
  const nextRecs = orderedShelf
    .filter((b) => b.ref !== primary && !readBooks.includes(b.ref))
    .slice(0, 2);
  return (
    <section className="pt-4">
      <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
        MY SHELF
      </p>
      <h2 className="mt-2 font-serif text-3xl text-stone-warm">
        欢迎回来，{readerPublicNickname(profile)}
      </h2>
      <p className="mt-2 text-sm text-stone-warm/60">
        你正在阅读的一本书在最上面；下面是我建议你接下来翻的两页。
      </p>
      <div className="mt-6 rounded-2xl border border-gold-dust/30 bg-gold-dust/5 p-6">
        <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
          你正在阅读
        </p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-4">
          <h3 className="font-serif text-2xl text-stone-warm">
            {primaryBook.icon} {primaryBook.title}
          </h3>
          <span className="text-xs text-stone-warm/50">
            约 {primaryBook.minutes} 分钟
          </span>
        </div>
        <p className="mt-2 text-sm text-stone-warm/70">{primaryBook.subtitle}</p>
        <button
          type="button"
          onClick={() => onOpenBook(primary)}
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-gold-dust px-5 text-sm text-obsidian hover:bg-gold-light"
        >
          继续阅读 →
        </button>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {nextRecs.map((b) => (
          <button
            key={b.ref}
            type="button"
            onClick={() => onOpenBook(b.ref)}
            className="rounded-xl border border-stone-warm/15 p-4 text-left hover:border-gold-dust/40"
          >
            <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
              推荐下一页
            </p>
            <h4 className="mt-2 font-serif text-lg text-stone-warm">
              {b.icon} {b.title}
            </h4>
            <p className="mt-1 text-xs text-stone-warm/60">{b.subtitle}</p>
          </button>
        ))}
      </div>
      <MembershipBookPreview
        topic={profile.topic}
        entitled={!!entitled}
        slot="shelf_premium_book"
      />
      <div className="mt-8">
        <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">书架全景</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {orderedShelf.map((b) => (
            <button
              key={b.ref}
              type="button"
              onClick={() => onOpenBook(b.ref)}
              className="min-h-[64px] rounded-lg border border-stone-warm/10 p-3 text-left hover:border-gold-dust/30"
            >
              <span className="mr-2 text-gold-dust">{b.icon}</span>
              <span className="text-sm text-stone-warm/85">{b.title}</span>
              {readBooks.includes(b.ref) && (
                <span className="ml-2 text-[10px] text-gold-dust">已读</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <ShelfLink label="历史的回声" hint="曾面对相似问题的人" onClick={onHistory} />
        <ShelfLink label="为你推荐下一页" hint="根据你的选择动态调整" onClick={onRecommend} />
        <ShelfLink label="命运纸条" hint="向同页者 / 对页者发问" onClick={onNotes} />
      </div>
    </section>
  );
}

function MembershipBookPreview({
  topic,
  entitled,
  slot,
}: {
  topic: StoryTopic | null;
  entitled: boolean;
  slot: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const impressionLogged = useRef(false);
  const [openPreview, setOpenPreview] = useState(false);
  useEffect(() => {
    if (impressionLogged.current) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !impressionLogged.current) {
            impressionLogged.current = true;
            logMembership("membership_impression", slot);
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [slot]);

  const bullets =
    topic === "career"
      ? ["你适合被推举的位置", "上一个岔口错过了什么", "未来 24 个月的关键窗口"]
      : topic === "love"
      ? ["你重复被吸引的类型", "你真正需要的关系模式", "关系的时间窗口"]
      : topic === "wealth"
      ? ["财富在你身上流动的方式", "适合你长期持有的类型", "关键决策的时间点"]
      : ["四体系合读的整体画像", "近 90 天的主线", "下一步该往哪里走"];

  return (
    <div
      ref={ref}
      className="mt-8 rounded-2xl border border-gold-dust/25 bg-gradient-to-br from-obsidian/60 to-gold-dust/[0.06] p-5"
    >
      <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
        📖 下一页 · 完整深度报告
      </p>
      <h3 className="mt-2 font-serif text-xl text-stone-warm">
        把这段阅读放回你的完整命盘
      </h3>
      <ul className="mt-3 space-y-1.5 text-sm text-stone-warm/75">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-gold-dust">·</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3">
        {entitled ? (
          <a
            href="/report"
            onClick={() => logMembership("membership_entitled_continue", slot)}
            className="inline-flex min-h-11 items-center rounded-full bg-gold-dust px-5 text-sm text-obsidian hover:bg-gold-light"
          >
            继续阅读 →
          </a>
        ) : (
          <>
            <a
              href="/report"
              onClick={() => logMembership("membership_cta_click", slot)}
              className="inline-flex min-h-11 items-center rounded-full bg-gold-dust px-5 text-sm text-obsidian hover:bg-gold-light"
            >
              解锁完整报告 ¥79
            </a>
            <button
              type="button"
              onClick={() => {
                setOpenPreview((v) => !v);
                logMembership("membership_preview_open", slot);
              }}
              className="inline-flex min-h-11 items-center rounded-full border border-stone-warm/25 px-5 text-sm text-stone-warm/85 hover:bg-stone-warm/5"
            >
              {openPreview ? "收起目录" : "先看目录"}
            </button>
          </>
        )}
      </div>
      {openPreview && !entitled && (
        <div className="mt-4 rounded-xl border border-stone-warm/10 bg-obsidian/40 p-4 text-sm text-stone-warm/75">
          <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">目录预览</p>
          <ol className="mt-2 space-y-1 text-xs text-stone-warm/70">
            <li>第 1 章 · 你的整体画像</li>
            <li>第 2 章 · 天赋与结构</li>
            <li>第 3 章 · 事业与位置</li>
            <li>第 4 章 · 关系模式</li>
            <li>第 5 章 · 财富格局</li>
            <li>… 共 24 章 · 完整版本在报告页展开</li>
          </ol>
        </div>
      )}
      <p className="mt-3 text-xs text-stone-warm/45">
        Demo 环境仅展示会员书封与目录预览,不会真实扣费。
      </p>
    </div>
  );
}



function ShelfLink({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[80px] rounded-xl border border-gold-dust/25 bg-obsidian/40 p-4 text-left hover:bg-gold-dust/5"
    >
      <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
        {label} →
      </p>
      <p className="mt-2 text-xs text-stone-warm/60">{hint}</p>
    </button>
  );
}

// ---------------- Book reader (Demo, quick/deep) ----------------
function BookReader({ ref, onBack }: { ref: BookRef; onBack: () => void; entitled?: boolean }) {
  const book = bookByRef(ref);
  const [deep, setDeep] = useState(false);
  return (
    <section className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
      >
        ← 回到书架
      </button>
      <DemoBadge className="mt-3">{book.demo_note}</DemoBadge>
      <h2 className="mt-3 font-serif text-3xl text-stone-warm">
        {book.icon} {book.title}
      </h2>
      <p className="mt-1 text-sm text-stone-warm/60">
        {book.subtitle} · 约 {book.minutes} 分钟
      </p>
      <div className="mt-6 rounded-2xl border border-gold-dust/20 bg-gold-dust/5 p-5">
        <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
          一句结论
        </p>
        <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-stone-warm/90">
          {book.quick}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDeep((v) => !v)}
        className="mt-4 min-h-11 rounded-full border border-gold-dust/40 px-5 text-sm text-stone-warm hover:bg-gold-dust/10"
      >
        {deep ? "收起深读" : "展开深读"}
      </button>
      {deep && (
        <div className="mt-4 rounded-2xl border border-stone-warm/10 p-5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-stone-warm/85">
            {book.deep}
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------- 6. History echoes ----------------
function History({
  profile,
  filter,
  onFilter,
  onOpen,
  onBack,
}: {
  profile: ReaderProfile;
  filter: "all" | "east" | "west" | "different_choice";
  onFilter: (f: "all" | "east" | "west" | "different_choice") => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  reducedMotion?: boolean;
}) {

  const list = matchFigures(profile, filter);
  return (
    <section className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
      >
        ← 回到书架
      </button>
      <p className="mt-3 font-mono text-[10px] tracking-[0.3em] text-gold-dust">
        HISTORY · ECHOES
      </p>
      <h2 className="mt-2 font-serif text-3xl text-stone-warm">
        曾面对相似问题的人
      </h2>
      <p className="mt-2 max-w-[52ch] text-sm text-stone-warm/70">
        你们并不拥有相同的命运，但曾面对相似的问题。这里只匹配"处境"与"人生阶段"，
        不匹配"同命"，也不显示任何相似度百分比。
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["all", "全部"],
            ["east", "东方人物"],
            ["west", "西方人物"],
            ["different_choice", "做出不同选择的人"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => onFilter(k)}
            aria-pressed={filter === k}
            className={`min-h-11 rounded-full border px-4 text-sm ${
              filter === k
                ? "border-gold-dust bg-gold-dust/15"
                : "border-stone-warm/20 text-stone-warm/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Selection-path connector: subtle vertical line from active chip
          to the results grid, letting the eye follow the chosen path. */}
      <div className="relative mt-2 h-4" aria-hidden>
        <motion.span
          layoutId="history-path"
          className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-gold-dust/60 to-transparent"
          transition={TRANSITION.fadeShort}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={filter}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={TRANSITION.fadeShort}
          className="mt-3 grid gap-3 sm:grid-cols-2"
        >
          {list.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onOpen(f.id)}
              className="min-h-[132px] rounded-xl border border-stone-warm/15 p-5 text-left transition-colors hover:border-gold-dust/40"
            >
              <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
                {f.tradition === "east" ? "东方" : "西方"} · {f.age_band}
              </p>
              <h3 className="mt-2 font-serif text-xl text-stone-warm break-words">{f.name}</h3>
              <p className="mt-2 line-clamp-3 break-words text-sm text-stone-warm/70">
                {f.situation}
              </p>
            </button>
          ))}
          {list.length === 0 && (
            <p className="text-sm text-stone-warm/50">
              这个过滤下暂无相似处境的记录。换一个筛选看看？
            </p>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-10 rounded-2xl border border-gold-dust/25 bg-gold-dust/5 p-6 text-center">
        <p className="mx-auto max-w-[36ch] font-serif text-lg leading-relaxed text-stone-warm">
          {CLOSING_QUOTE}
        </p>
      </div>
    </section>
  );
}

function FigureDetail({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
  reducedMotion?: boolean;
}) {

  const f = FIGURES.find((x) => x.id === id);
  if (!f) {
    return (
      <div className="pt-6">
        <p className="text-stone-warm/60">这条记录已经不可见。</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 min-h-11 rounded-full border border-stone-warm/20 px-4 text-sm"
        >
          返回
        </button>
      </div>
    );
  }
  const rows: [string, string][] = [
    ["面对什么", f.situation],
    ["如何选择", f.choice],
    ["带来什么", f.outcome],
    ["代价", f.cost],
    ["可迁移的经验", f.transferable],
  ];
  return (
    <section className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
      >
        ← 返回历史的回声
      </button>
      <p className="mt-3 font-mono text-[10px] tracking-[0.3em] text-gold-dust">
        {f.tradition === "east" ? "东方" : "西方"} · {f.age_band}
      </p>
      <h2 className="mt-2 font-serif text-3xl text-stone-warm">{f.name}</h2>
      <div className="mt-6 space-y-4">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-stone-warm/10 p-4">
            <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
              {k}
            </p>
            <p className="mt-2 text-sm text-stone-warm/85">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-gold-dust/25 bg-gold-dust/5 p-4">
        <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
          与你的关系 · 现在可尝试
        </p>
        <ul className="mt-2 space-y-1 text-sm text-stone-warm/85">
          <li>保留：那些让你区别于同岗位其他人的判断风格。</li>
          <li>停止：把每一次小失望累积成对整段关系的否认。</li>
          <li>开始：给下一次决定写一句"我为什么这么选"，只写给自己看。</li>
        </ul>
      </div>
      <div className="mt-6 rounded-xl border border-stone-warm/10 p-4 text-xs text-stone-warm/55">
        <p>{f.warning}</p>
        <p className="mt-2">
          来源占位：{f.source_title} · {f.source_url}
        </p>
      </div>
    </section>
  );
}

// ---------------- 7. Recommendations ----------------
function Recommendations({
  profile,
  readBookRefs,
  onChangeTopic,
  onOpenBook,
  onBack,
}: {
  profile: ReaderProfile;
  readBookRefs: BookRef[];
  onChangeTopic: (t: StoryTopic) => void;
  onOpenBook: (ref: BookRef) => void;
  onBack: () => void;
  weights?: Partial<Record<StoryTopic, number>>;
}) {

  const recs = recommendNext(profile, readBookRefs);
  return (
    <section className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
      >
        ← 回到书架
      </button>
      <p className="mt-3 font-mono text-[10px] tracking-[0.3em] text-gold-dust">
        NEXT PAGE FOR YOU
      </p>
      <h2 className="mt-2 font-serif text-3xl text-stone-warm">下一页推荐</h2>
      <p className="mt-2 text-sm text-stone-warm/60">
        我更想先看关于：
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FOCUS_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChangeTopic(t)}
            aria-pressed={profile.topic === t}
            className={`min-h-11 rounded-full border px-4 text-sm ${
              profile.topic === t
                ? "border-gold-dust bg-gold-dust/15"
                : "border-stone-warm/20 text-stone-warm/70"
            }`}
          >
            {topicLabel(t)}
          </button>
        ))}
      </div>
      <RecommendationList recs={recs} onOpenBook={onOpenBook} />

    </section>
  );
}

function RecommendationList({
  recs,
  onOpenBook,
}: {
  recs: ReturnType<typeof recommendNext>;
  onOpenBook: (ref: BookRef) => void;
}) {
  if (recs.length === 0) {
    return (
      <p className="mt-6 text-sm text-stone-warm/60">
        你已经读完了主线的书,换个主题试试。
      </p>
    );
  }
  return (
    <div className="mt-6 space-y-3">
      {recs.map((r) => (
        <RecommendationCard key={r.id} r={r} onOpenBook={onOpenBook} />
      ))}
    </div>
  );
}

function RecommendationCard({
  r,
  onOpenBook,
}: {
  r: ReturnType<typeof recommendNext>[number];
  onOpenBook: (ref: BookRef) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative rounded-2xl border border-stone-warm/15 p-5 hover:border-gold-dust/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="absolute right-4 top-4 min-h-9 rounded-full border border-gold-dust/30 px-3 text-[10px] tracking-[0.2em] text-gold-dust hover:bg-gold-dust/10"
      >
        {open ? "收起" : "为什么推荐"}
      </button>
      <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
        {r.kind === "book" ? "书籍" : r.kind === "figure" ? "人物" : "纸条"}
      </p>
      <h3 className="mt-2 font-serif text-lg text-stone-warm">{r.title}</h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={TRANSITION.fadeShort}
            className="mt-3 overflow-hidden rounded-lg border border-gold-dust/20 bg-gold-dust/5 p-3 text-sm text-stone-warm/85"
          >
            {r.reason}
          </motion.p>
        )}
      </AnimatePresence>
      {r.kind === "book" && (
        <button
          type="button"
          onClick={() => onOpenBook(r.ref as BookRef)}
          className="mt-3 min-h-11 rounded-full bg-gold-dust px-4 text-sm text-obsidian hover:bg-gold-light"
        >
          打开这一本 →
        </button>
      )}
    </div>
  );
}



// ---------------- 8. Notes ----------------
function NotesArea({
  state,
  actorId,
  setState,
  goto,
  showUndoToast,
}: {
  state: StoryStateV1;
  actorId: string;
  setState: React.Dispatch<React.SetStateAction<StoryStateV1>>;
  goto: (s: StoryStep) => void;
  showUndoToast?: (label: string, action: () => void) => void;
}) {

  const [tick, setTick] = useState(0);
  const notes = useMemo(() => {
    const list = listNotes(Date.now());
    return matchNotes(list, state.profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, state.profile.topic]);

  if (state.step === "notes") {
    return (
      <section className="pt-4">
        <button
          type="button"
          onClick={() => goto("shelf")}
          className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
        >
          ← 回到书架
        </button>
        <p className="mt-3 font-mono text-[10px] tracking-[0.3em] text-gold-dust">
          FATE NOTES
        </p>
        <h2 className="mt-2 font-serif text-3xl text-stone-warm">命运纸条</h2>
        <p className="mt-2 max-w-[52ch] text-sm text-stone-warm/70">
          有些问题，命盘只能照见轮廓。写下一张纸条，让走过相似道路的人，或与你完全不同的人，给你另一种答案。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => goto("note_compose")}
            className="min-h-12 rounded-full bg-gold-dust px-6 text-obsidian hover:bg-gold-light"
          >
            + 写一张新纸条
          </button>
        </div>
        <div className="mt-8 space-y-3">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.button
                layout
                key={n.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={TRANSITION.fadeShort}
                onClick={() =>
                  setState((s) => ({ ...s, step: "note_detail", active_note_id: n.id }))
                }
                className="block w-full rounded-2xl border border-stone-warm/15 p-5 text-left hover:border-gold-dust/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
                    {topicLabel(n.topic)} · {audienceLabel(n.audience)}
                  </p>
                  <span className="text-[10px] text-stone-warm/40">
                    {relTime(n.created_at)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 break-words text-sm text-stone-warm/85">{n.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.match_traits.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-gold-dust/30 px-2 py-0.5 text-[10px] text-gold-dust"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          {notes.length === 0 && (
            <p className="text-sm text-stone-warm/50">图书馆还没有相关纸条。写第一张？</p>
          )}
        </div>
      </section>
    );
  }

  if (state.step === "note_compose") {
    return (
      <NoteCompose
        profile={state.profile}
        actorId={actorId}
        onCancel={() => goto("notes")}
        onSubmit={() => {
          setTick((t) => t + 1);
          goto("notes");
        }}
      />
    );
  }

  if (state.step === "note_detail" && state.active_note_id) {
    return (
      <NoteDetail
        noteId={state.active_note_id}
        actorId={actorId}
        profile={state.profile}
        onBack={() => goto("notes")}
        bump={() => setTick((t) => t + 1)}
        showUndoToast={showUndoToast}
      />
    );
  }
  return null;
}

function audienceLabel(a: NoteAudience): string {
  return {
    similar: "写给同页者",
    opposite: "写给对页者",
    experienced: "写给经历过的人",
    librarian: "交给图书馆",
  }[a];
}

function relTime(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

function NoteCompose({
  profile,
  actorId,
  onCancel,
  onSubmit,
}: {
  profile: ReaderProfile;
  actorId: string;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const [topic, setTopic] = useState<StoryTopic>(profile.topic ?? "career");
  const [audience, setAudience] = useState<NoteAudience>("similar");
  const [body, setBody] = useState("");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("仅支持 JPG / PNG / WEBP");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("单张图片不能超过 5MB");
      return;
    }
    const r = new FileReader();
    r.onload = () => setImgUrl(String(r.result));
    r.readAsDataURL(f);
    setError(null);
  };
  const submit = () => {
    if (body.trim().length < 5) {
      setError("再写多一点，让别人有能回答的地方。");
      return;
    }
    createNote({
      author_id: actorId,
      author_nickname: readerPublicNickname(profile),
      topic,
      body,
      image_data_url: imgUrl,
      audience,
      age_band: profile.age_band,
    });
    onSubmit();
  };
  return (
    <section className="pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
      >
        ← 返回纸条列表
      </button>
      <h2 className="mt-3 font-serif text-3xl text-stone-warm">写一张纸条</h2>
      <div className="mt-6 space-y-5">
        <div>
          <FieldLabel>关于</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {FOCUS_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                aria-pressed={topic === t}
                className={`min-h-11 rounded-full border px-4 text-sm ${
                  topic === t
                    ? "border-gold-dust bg-gold-dust/15"
                    : "border-stone-warm/20 text-stone-warm/70"
                }`}
              >
                {topicLabel(t)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>希望谁看到</FieldLabel>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                ["similar", "与我相似的人"],
                ["opposite", "与我不同的人"],
                ["experienced", "经历过这件事的人"],
                ["librarian", "交给图书馆选择"],
              ] as [NoteAudience, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAudience(k)}
                aria-pressed={audience === k}
                className={`min-h-12 rounded-xl border px-3 text-left text-sm ${
                  audience === k
                    ? "border-gold-dust bg-gold-dust/10"
                    : "border-stone-warm/20 text-stone-warm/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>正文</FieldLabel>
          <textarea
            value={body}
            maxLength={800}
            onChange={(e) => setBody(e.target.value)}
            placeholder="请不要写具体的出生日期与出生城市——图书馆不需要这些。"
            className="mt-2 min-h-[160px] w-full rounded-xl border border-stone-warm/15 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm outline-none focus:border-gold-dust"
          />
          <p className="mt-1 text-[11px] text-stone-warm/40">{body.length}/800</p>
        </div>
        <div>
          <FieldLabel>可选：附一张图（本地预览 · Demo 不上传）</FieldLabel>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFile}
            className="mt-2 text-xs text-stone-warm/70"
          />
          {imgUrl && (
            <img
              src={imgUrl}
              alt=""
              className="mt-3 max-h-48 rounded-lg border border-stone-warm/10 object-contain"
            />
          )}
        </div>
        <p className="text-xs text-stone-warm/50">
          隐私提醒：你的出生日期、时间、城市与真实姓名不会出现在这张纸条中，也不会用于匹配算法。
        </p>
        {error && <p className="text-sm text-red-400/80">{error}</p>}
        <button
          type="button"
          onClick={submit}
          className="min-h-12 rounded-full bg-gold-dust px-6 text-obsidian hover:bg-gold-light"
        >
          将纸条放入图书馆 →
        </button>
      </div>
    </section>
  );
}

function NoteDetail({
  noteId,
  actorId,
  profile,
  onBack,
  bump,
  showUndoToast,
}: {
  noteId: string;
  actorId: string;
  profile: ReaderProfile;
  onBack: () => void;
  bump: () => void;
  showUndoToast?: (label: string, action: () => void) => void;
}) {
  const [tick, setTick] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const note = useMemo(() => {
    const all = listNotes(Date.now());
    return all.find((n) => n.id === noteId) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, tick]);
  const replies = useMemo(() => listReplies(noteId), [noteId, tick]);
  const [reply, setReply] = useState({
    faced: "",
    chose: "",
    cost: "",
    if_again: "",
    one_consideration: "",
  });
  if (!note) {
    return (
      <div className="pt-6">
        <p className="text-stone-warm/60">这张纸条已被作者收回。</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 min-h-11 rounded-full border border-stone-warm/20 px-4 text-sm"
        >
          返回
        </button>
      </div>
    );
  }
  const isOwn = note.author_id === actorId;
  const submitReply = () => {
    if (reply.faced.trim().length < 2) return;
    createReply({
      note_id: note.id,
      author_id: actorId,
      author_nickname: readerPublicNickname(profile),
      ...reply,
    });
    setReply({ faced: "", chose: "", cost: "", if_again: "", one_consideration: "" });
    setTick((t) => t + 1);
    bump();
  };
  const confirmDelete = () => {
    setConfirmOpen(false);
    const noteIdToDelete = note.id;
    softDeleteNote(noteIdToDelete, actorId);
    bump();
    showUndoToast?.("已收回纸条", () => {
      restoreNote(noteIdToDelete, actorId);
      bump();
    });
    onBack();
  };
  const deleteReply = (replyId: string) => {
    softDeleteReply(replyId, actorId);
    setTick((t) => t + 1);
    bump();
    showUndoToast?.("已收回回信", () => {
      restoreReply(replyId, actorId);
      setTick((t) => t + 1);
      bump();
    });
  };
  return (
    <section className="pt-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-11 text-sm text-stone-warm/60 hover:text-stone-warm"
      >
        ← 回到纸条列表
      </button>
      <div className="mt-4 rounded-2xl border border-stone-warm/15 p-5">
        <div className="flex flex-wrap justify-between gap-2">
          <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
            {topicLabel(note.topic)} · {audienceLabel(note.audience)}
          </p>
          <span className="text-[10px] text-stone-warm/40">
            {relTime(note.created_at)}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-stone-warm/90">
          {note.body}
        </p>
        {note.image_data_url && (
          <img
            src={note.image_data_url}
            alt=""
            className="mt-4 max-h-72 rounded-lg border border-stone-warm/10 object-contain"
          />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {note.match_traits.map((t) => (
            <span
              key={t}
              className="rounded-full border border-gold-dust/30 px-2 py-0.5 text-[10px] text-gold-dust"
            >
              {t}
            </span>
          ))}
        </div>
        {isOwn && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="mt-4 min-h-11 rounded-full border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10"
          >
            收回我的纸条
          </button>
        )}
      </div>
      <h3 className="mt-8 font-serif text-xl text-stone-warm">读者的回信</h3>
      <div className="relative mt-3 space-y-2">
        <AnimatePresence initial={false}>
          {replies.map((r, i) => (
            <motion.div
              layout
              key={r.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={TRANSITION.fadeShort}
              // Slight stacked/overlap feel between adjacent replies.
              style={{ marginTop: i === 0 ? undefined : -6 }}
              className="rounded-xl border border-stone-warm/10 bg-obsidian/60 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.25)] backdrop-blur"
            >
              <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
                {r.author_nickname} · {relTime(r.created_at)}
              </p>
              <ReplyRow k="我曾面对的情况" v={r.faced} />
              <ReplyRow k="当时的选择" v={r.chose} />
              <ReplyRow k="代价" v={r.cost} />
              <ReplyRow k="如果重来" v={r.if_again} />
              <ReplyRow k="给你的一个考虑" v={r.one_consideration} />
              {r.author_id === actorId && (
                <button
                  type="button"
                  onClick={() => deleteReply(r.id)}
                  className="mt-2 text-xs text-red-300/80 hover:text-red-300"
                >
                  收回这条回信
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {replies.length === 0 && (
          <p className="text-xs text-stone-warm/45">还没有回信。你可以第一个回复。</p>
        )}
      </div>
      <div className="mt-8 rounded-2xl border border-gold-dust/25 bg-gold-dust/5 p-5">
        <h4 className="font-serif text-lg text-stone-warm">给这张纸条写一封回信</h4>
        <p className="mt-1 text-xs text-stone-warm/60">
          回信按下面五行分段填，帮别人真正被回答。
        </p>
        {(
          [
            ["faced", "我曾面对的情况"],
            ["chose", "当时的选择"],
            ["cost", "代价"],
            ["if_again", "如果重来"],
            ["one_consideration", "给你的一个考虑"],
          ] as [keyof typeof reply, string][]
        ).map(([k, label]) => (
          <div key={k} className="mt-3">
            <FieldLabel>{label}</FieldLabel>
            <textarea
              value={reply[k]}
              onChange={(e) => setReply((s) => ({ ...s, [k]: e.target.value }))}
              className="mt-1 min-h-[64px] w-full rounded-lg border border-stone-warm/15 bg-obsidian/40 px-3 py-2 text-[16px] text-stone-warm outline-none focus:border-gold-dust"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={submitReply}
          className="mt-4 min-h-12 rounded-full bg-gold-dust px-6 text-obsidian hover:bg-gold-light"
        >
          寄出这封回信 →
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="确认收回这张纸条？"
        body="收回后其他读者将不再看到它。10 秒内你可以撤销这次操作。"
        confirmLabel="收回"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[85] flex items-center justify-center bg-obsidian/80 px-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl border border-gold-dust/30 bg-obsidian p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-stone-warm">{title}</h3>
        <p className="mt-2 text-sm text-stone-warm/70">{body}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full border border-stone-warm/25 px-5 text-sm text-stone-warm/80 hover:bg-stone-warm/5"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-full border border-red-500/50 bg-red-500/10 px-5 text-sm text-red-200 hover:bg-red-500/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReplyRow({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <p className="mt-2 text-sm text-stone-warm/85">
      <span className="mr-2 font-mono text-[9px] tracking-[0.3em] text-gold-dust">
        {k}
      </span>
      {v}
    </p>
  );
}

// ---------------- Building blocks ----------------
function DemoBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`inline-block rounded-full border border-gold-dust/30 bg-gold-dust/5 px-3 py-1 font-mono text-[10px] tracking-[0.3em] text-gold-dust ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-obsidian/80 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-[560px] rounded-t-2xl border border-gold-dust/30 bg-obsidian p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-[0.3em] text-gold-dust">
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="min-h-11 min-w-11 rounded-full border border-stone-warm/20 text-stone-warm/70"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
