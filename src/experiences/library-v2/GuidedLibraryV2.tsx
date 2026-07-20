/**
 * Guided Library V2 — main container.
 *
 * DEMO ONLY. All copy and evidence in this file are fixtures. This
 * component MUST NOT read/write real user data, call the AI gateway, or
 * touch payment endpoints.
 *
 * The V1 marketing/product surface (/, /ritual, /report, ...) is not
 * imported here — V2 is fully self-contained so V1 stays byte-identical
 * while V2 evolves.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LIBRARY_EXPERIENCE_VERSION, type LibraryFocus } from "./version";
import {
  DEMO_BOOKS,
  DEMO_FIXTURE,
  FOCUS_CARDS,
  TRADITIONS,
  nextBookAfter,
  recommendedOrderFor,
  type BookKey,
  type DemoBook,
} from "./fixtures";
import {
  INITIAL_STATE,
  cardProgress,
  isCardStepValid,
  nextStep,
  prevStep,
  type BorrowCard,
  type GuidedState,
  type Step,
} from "./state";

const TOUR_STORAGE_KEY = "lod:library-v2:tour-seen";

// -----------------------------------------------------------------------
// Root
// -----------------------------------------------------------------------
export function GuidedLibraryV2() {
  const [state, setState] = useState<GuidedState>(() => ({ ...INITIAL_STATE }));
  const [tourOpen, setTourOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect prefers-reduced-motion once. Timeline animations must respect this.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // First-time librarian tour: exactly once per browser, then collapse to a
  // bookmark. Persist in localStorage but load lazily so SSR is stable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(TOUR_STORAGE_KEY) === "1";
    if (seen) {
      setState((s) => ({ ...s, tourSeen: true }));
    }
  }, []);

  // Open the tour once when the user lands on the library screen.
  useEffect(() => {
    if (state.step === "library" && !state.tourSeen) setTourOpen(true);
  }, [state.step, state.tourSeen]);

  const dismissTour = () => {
    setTourOpen(false);
    setState((s) => ({ ...s, tourSeen: true }));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOUR_STORAGE_KEY, "1");
    }
  };

  const openBook = (key: BookKey) =>
    setState((s) => ({ ...s, step: "book", activeBook: key, mode: "quick" }));

  return (
    <div className="min-h-[100dvh] bg-obsidian text-stone-warm">
      <DemoBanner />
      <div
        className="relative mx-auto w-full max-w-[1120px] px-4 pb-24 pt-6 sm:px-6"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        {state.step === "home" && (
          <HomeStep
            onPick={(focus) =>
              setState((s) => ({ ...s, focus, step: "card_name" }))
            }
          />
        )}

        {state.step.startsWith("card_") && (
          <BorrowCardStep
            state={state}
            onChange={(card) => setState((s) => ({ ...s, card }))}
            onNext={() =>
              setState((s) => ({
                ...s,
                step: s.step === "card_confirm" ? "archive" : nextStep(s.step),
              }))
            }
            onBack={() =>
              setState((s) => ({ ...s, step: prevStep(s.step) }))
            }
          />
        )}

        {state.step === "archive" && (
          <ArchiveTransition
            reducedMotion={reducedMotion}
            onDone={() => setState((s) => ({ ...s, step: "library" }))}
          />
        )}

        {state.step === "library" && (
          <LibraryOverview
            focus={state.focus!}
            read={state.read}
            onOpen={openBook}
            onOpenPremiumNote={() =>
              setState((s) => ({ ...s, step: "premium_note" }))
            }
            tourSeen={state.tourSeen}
            onOpenBookmark={() => setTourOpen(true)}
          />
        )}

        {state.step === "book" && state.activeBook && (
          <BookReader
            book={DEMO_BOOKS.find((b) => b.key === state.activeBook)!}
            mode={state.mode}
            onToggleMode={() =>
              setState((s) => ({ ...s, mode: s.mode === "quick" ? "deep" : "quick" }))
            }
            onBack={() =>
              setState((s) => {
                const read = new Set(s.read);
                if (s.activeBook) read.add(s.activeBook);
                return { ...s, step: "library", read };
              })
            }
            next={
              state.activeBook && state.focus
                ? nextBookAfter(state.focus, state.activeBook)
                : null
            }
            onNext={(key) => {
              setState((s) => {
                const read = new Set(s.read);
                if (s.activeBook) read.add(s.activeBook);
                return { ...s, activeBook: key, mode: "quick", read };
              });
            }}
          />
        )}

        {state.step === "premium_note" && (
          <PremiumNote onBack={() => setState((s) => ({ ...s, step: "library" }))} />
        )}

        <FooterMeta />
      </div>

      {tourOpen && <LibrarianTour onDone={dismissTour} />}
    </div>
  );
}

// -----------------------------------------------------------------------
// Demo banner + footer
// -----------------------------------------------------------------------
function DemoBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 border-b border-gold-dust/25 bg-obsidian/95 px-4 py-2 text-center text-[11px] tracking-[0.24em] text-gold-dust backdrop-blur-md"
    >
      DEMO · {LIBRARY_EXPERIENCE_VERSION}
      {DEMO_FIXTURE ? " · 演示数据 / fixture" : ""}
    </div>
  );
}

function FooterMeta() {
  return (
    <div className="mt-16 border-t border-white/5 pt-6 text-center text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
      Guided Library V2 · 仅供预览 · 未连接账户、AI 或支付
    </div>
  );
}

// -----------------------------------------------------------------------
// Home
// -----------------------------------------------------------------------
function HomeStep({ onPick }: { onPick: (f: LibraryFocus) => void }) {
  return (
    <section className="grid gap-10 pt-6 sm:pt-12">
      <header className="max-w-2xl">
        <p className="font-mono text-[10px] tracking-[0.4em] text-gold-dust">
          THE LIBRARY OF DESTINY · V2
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-tight text-stone-warm">
          四种古老传统，
          <br className="hidden sm:block" />
          共同读懂同一个你。
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-warm/75 sm:text-lg">
          从你此刻最关心的问题开始。西方占星、印度吠陀、中国八字、紫微斗数
          汇成同一份阅读。
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.28em] text-stone-warm/45">
          约 2 分钟 · 基础解读免费 · 结果可永久保存
        </p>
      </header>

      <div>
        <p className="mb-4 text-sm text-stone-warm/60">选择一本你想先翻开的书：</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FOCUS_CARDS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onPick(f.key)}
              className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-gold-dust/20 bg-white/[0.02] p-5 text-left transition-all hover:border-gold-dust/60 hover:bg-gold-dust/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
            >
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-dust/40 text-xl text-gold-dust transition-colors group-hover:bg-gold-dust/10"
              >
                {f.glyph}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-serif text-xl text-stone-warm">
                  {f.title_zh}
                </span>
                <span className="mt-0.5 block truncate text-xs tracking-wide text-stone-warm/55">
                  {f.subtitle_zh}
                </span>
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPick("unsure")}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-gold-dust px-7 py-3 text-sm font-medium tracking-widest text-obsidian transition-colors hover:bg-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
        >
          开始认识自己
        </button>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------
// Borrow card (4 steps)
// -----------------------------------------------------------------------
function BorrowCardStep({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: GuidedState;
  onChange: (card: BorrowCard) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const progress = cardProgress(state.step)!;
  const valid = isCardStepValid(state.step, state.card);
  const purposeCopy: Record<string, string> = {
    card_name: "我们只用这个称呼在馆内向你打招呼。",
    card_birth: "决定四张盘的落点，越准越好；不确定时段可先选大致时段。",
    card_place: "计算真太阳时与地方分野；性别只影响紫微与部分传统体系。",
    card_confirm: "确认无误后进入馆藏整理阶段——这是唯一一步无法修改的地方。",
  };

  return (
    <section className="grid gap-8 pt-6 sm:pt-10">
      <header className="grid gap-3">
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-stone-warm/55">
          <span>借阅证 · {progress.index} / {progress.total}</span>
          <span className="h-px flex-1 bg-gradient-to-r from-gold-dust/60 to-transparent" />
        </div>
        <h2 className="font-serif text-2xl text-stone-warm sm:text-3xl">
          {state.step === "card_name" && "你想让我们怎么称呼你？"}
          {state.step === "card_birth" && "你出生的那一刻。"}
          {state.step === "card_place" && "出生的地方，与你的性别。"}
          {state.step === "card_confirm" && "确认你的借阅证。"}
        </h2>
        <p className="text-sm text-stone-warm/60">{purposeCopy[state.step]}</p>
      </header>

      <div className="grid gap-4 rounded-2xl border border-gold-dust/20 bg-white/[0.02] p-5 sm:p-7">
        {state.step === "card_name" && (
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-stone-warm/55">
              称呼
            </span>
            <input
              type="text"
              autoComplete="off"
              value={state.card.name}
              onChange={(e) => onChange({ ...state.card, name: e.target.value })}
              placeholder="例如：小溪"
              className="w-full rounded-xl border border-white/10 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
            />
          </label>
        )}

        {state.step === "card_birth" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-stone-warm/55">
                出生日期
              </span>
              <input
                type="date"
                value={state.card.birth_date}
                onChange={(e) => onChange({ ...state.card, birth_date: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm focus:border-gold-dust focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-stone-warm/55">
                出生时间
              </span>
              <input
                type="time"
                value={state.card.birth_time}
                onChange={(e) => onChange({ ...state.card, birth_time: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm focus:border-gold-dust focus:outline-none"
              />
            </label>
          </div>
        )}

        {state.step === "card_place" && (
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-stone-warm/55">
                出生地点
              </span>
              <input
                type="text"
                autoComplete="off"
                value={state.card.place}
                onChange={(e) => onChange({ ...state.card, place: e.target.value })}
                placeholder="例如：杭州"
                className="w-full rounded-xl border border-white/10 bg-obsidian/40 px-4 py-3 text-[16px] text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust focus:outline-none"
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-xs uppercase tracking-[0.24em] text-stone-warm/55">
                性别 · 仅用于紫微与部分传统
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(["female", "male", "other"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => onChange({ ...state.card, gender: g })}
                    aria-pressed={state.card.gender === g}
                    className={`min-h-11 rounded-xl border px-3 py-3 text-sm transition-colors ${
                      state.card.gender === g
                        ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                        : "border-white/10 text-stone-warm/70 hover:border-gold-dust/50"
                    }`}
                  >
                    {g === "female" ? "女" : g === "male" ? "男" : "其他"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {state.step === "card_confirm" && (
          <dl className="grid gap-3 text-sm text-stone-warm/85">
            <ConfirmRow label="称呼" value={state.card.name} />
            <ConfirmRow
              label="出生"
              value={`${state.card.birth_date || "—"} ${state.card.birth_time || ""}`}
            />
            <ConfirmRow label="地点" value={state.card.place} />
            <ConfirmRow
              label="性别"
              value={
                state.card.gender === "female"
                  ? "女"
                  : state.card.gender === "male"
                    ? "男"
                    : state.card.gender === "other"
                      ? "其他"
                      : "—"
              }
            />
          </dl>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-xs uppercase tracking-[0.24em] text-stone-warm/70 transition-colors hover:border-gold-dust/60 hover:text-gold-dust"
        >
          返回
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!valid}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold-dust px-7 py-3 text-sm font-medium tracking-widest text-obsidian transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state.step === "card_confirm" ? "整理馆藏" : "下一步"}
        </button>
      </div>
    </section>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,5rem)_minmax(0,1fr)] gap-3 border-b border-white/5 pb-2 last:border-none last:pb-0">
      <dt className="text-xs uppercase tracking-[0.24em] text-stone-warm/50">{label}</dt>
      <dd className="min-w-0 truncate">{value || "—"}</dd>
    </div>
  );
}

// -----------------------------------------------------------------------
// Archive transition
// -----------------------------------------------------------------------
function ArchiveTransition({
  reducedMotion,
  onDone,
}: {
  reducedMotion: boolean;
  onDone: () => void;
}) {
  const [lit, setLit] = useState<number>(reducedMotion ? TRADITIONS.length : 0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      const t = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }, 400);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    TRADITIONS.forEach((_, i) => {
      timers.push(setTimeout(() => setLit(i + 1), 700 * (i + 1)));
    });
    timers.push(
      setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }, 3800),
    );
    return () => timers.forEach(clearTimeout);
  }, [reducedMotion, onDone]);

  return (
    <section className="grid min-h-[60vh] place-items-center pt-6">
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-gold-dust">
          馆藏整理中
        </p>
        <h2 className="mt-3 font-serif text-2xl text-stone-warm sm:text-3xl">
          正在为你合上四本古书。
        </h2>

        <ul className="mt-8 grid gap-3">
          {TRADITIONS.map((t, i) => {
            const on = i < lit;
            return (
              <li
                key={t.key}
                className={`flex items-center gap-3 rounded-full border px-4 py-3 text-left transition-all ${
                  on
                    ? "border-gold-dust/60 bg-gold-dust/10"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    on ? "bg-gold-light shadow-[0_0_10px_var(--gold-dust)]" : "bg-white/20"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-stone-warm/85">
                  {t.label_zh}
                </span>
                <span className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/45">
                  {t.detail_zh}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-xs text-stone-warm/50">
          {lit >= TRADITIONS.length ? "正在寻找共同的线索…" : ""}
        </p>

        <button
          type="button"
          onClick={onDone}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 py-3 text-xs uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/60 hover:text-gold-dust"
        >
          跳过动画
        </button>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------
// Library overview (6 books)
// -----------------------------------------------------------------------
function LibraryOverview({
  focus,
  read,
  onOpen,
  onOpenPremiumNote,
  tourSeen,
  onOpenBookmark,
}: {
  focus: LibraryFocus;
  read: Set<BookKey>;
  onOpen: (k: BookKey) => void;
  onOpenPremiumNote: () => void;
  tourSeen: boolean;
  onOpenBookmark: () => void;
}) {
  const order = useMemo(() => recommendedOrderFor(focus), [focus]);
  const orderedBooks = order
    .map((k) => DEMO_BOOKS.find((b) => b.key === k))
    .filter((b): b is DemoBook => Boolean(b));
  const featured = orderedBooks[0];
  const rest = orderedBooks.slice(1);
  const nextUnread = orderedBooks.find((b) => !read.has(b.key));

  return (
    <section className="grid gap-10 pt-6 sm:pt-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-gold-dust">
            馆藏总览
          </p>
          <h2 className="mt-2 font-serif text-2xl text-stone-warm sm:text-3xl">
            这是为你准备的书架。
          </h2>
          <p className="mt-2 text-sm text-stone-warm/60">
            已阅读 {read.size} / {orderedBooks.length}
            {nextUnread ? ` · 下一本推荐《${nextUnread.title_zh}》` : " · 已读完全部演示书"}
          </p>
        </div>
        {tourSeen && (
          <button
            type="button"
            onClick={onOpenBookmark}
            aria-label="馆员书签"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-dust/40 text-gold-dust hover:bg-gold-dust/10"
          >
            ✦
          </button>
        )}
      </header>

      <FeaturedBook book={featured} onOpen={() => onOpen(featured.key)} read={read.has(featured.key)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((b) => (
          <BookTile key={b.key} book={b} read={read.has(b.key)} onOpen={() => onOpen(b.key)} />
        ))}
      </div>

      <PurposeStrip onOpenPremiumNote={onOpenPremiumNote} />
    </section>
  );
}

function FeaturedBook({
  book,
  onOpen,
  read,
}: {
  book: DemoBook;
  onOpen: () => void;
  read: boolean;
}) {
  return (
    <article className="grid gap-4 rounded-3xl border border-gold-dust/30 bg-gradient-to-br from-gold-dust/[0.08] to-transparent p-6 sm:p-8">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em] text-gold-dust">
        <span>为你推荐 · 第一本</span>
        {read && <span className="text-stone-warm/50">已阅读</span>}
      </div>
      <h3 className="font-serif text-3xl text-stone-warm sm:text-4xl">
        <span aria-hidden="true" className="mr-3 text-gold-dust">
          {book.icon}
        </span>
        {book.title_zh}
      </h3>
      <p className="max-w-xl text-base text-stone-warm/75 sm:text-lg">{book.quick.verdict}</p>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold-dust px-6 py-3 text-sm font-medium tracking-widest text-obsidian hover:bg-gold-light"
        >
          翻开这本书
        </button>
        <span className="text-xs text-stone-warm/50">约 {book.read_minutes} 分钟</span>
      </div>
    </article>
  );
}

function BookTile({
  book,
  read,
  onOpen,
}: {
  book: DemoBook;
  read: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-left transition-all hover:border-gold-dust/50 hover:bg-gold-dust/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold-dust/40 text-lg text-gold-dust"
        >
          {book.icon}
        </span>
        <h3 className="min-w-0 flex-1 truncate font-serif text-lg text-stone-warm">
          {book.title_zh}
        </h3>
        {read && (
          <span className="shrink-0 rounded-full border border-gold-dust/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-gold-dust">
            已读
          </span>
        )}
      </div>
      <p className="text-sm text-stone-warm/65">{book.quick.verdict}</p>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-stone-warm/45">
        <span>约 {book.read_minutes} 分钟</span>
        <span className="text-gold-dust group-hover:text-gold-light">打开 →</span>
      </div>
    </button>
  );
}

function PurposeStrip({ onOpenPremiumNote }: { onOpenPremiumNote: () => void }) {
  const items = [
    { title: "基础报告", body: "覆盖当下最相关的六本书，随时回来续读。" },
    { title: "生命时间轴", body: "未来 12 个月能量曲线与关键窗口。" },
    { title: "长老对话", body: "带着一个具体问题，与四位传统的守护者对话。" },
    { title: "树洞", body: "写下不想说出口的话，只有你自己能看到。" },
    { title: "同门社区", body: "看别人如何解读自己，找到相似的星群。" },
    {
      title: "高级 24 章 · ¥79",
      body: "一次生成、账户内长期保存；预览环境不触发真实生成或支付。",
      cta: onOpenPremiumNote,
    },
  ];
  return (
    <div className="grid gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.28em] text-stone-warm/50">馆内还有</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li key={it.title} className="grid gap-1">
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm text-stone-warm">{it.title}</span>
              {it.cta && (
                <button
                  type="button"
                  onClick={it.cta}
                  className="text-[10px] uppercase tracking-[0.24em] text-gold-dust hover:text-gold-light"
                >
                  了解
                </button>
              )}
            </div>
            <p className="text-xs text-stone-warm/55">{it.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -----------------------------------------------------------------------
// Book reader (quick / deep)
// -----------------------------------------------------------------------
function BookReader({
  book,
  mode,
  onToggleMode,
  onBack,
  next,
  onNext,
}: {
  book: DemoBook;
  mode: "quick" | "deep";
  onToggleMode: () => void;
  onBack: () => void;
  next: BookKey | null;
  onNext: (k: BookKey) => void;
}) {
  const nextBook = next ? DEMO_BOOKS.find((b) => b.key === next) : null;
  return (
    <section className="grid gap-6 pt-6 sm:pt-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/60 hover:text-gold-dust"
          >
            ← 返回馆藏
          </button>
          <h2 className="mt-3 flex items-center gap-3 font-serif text-2xl text-stone-warm sm:text-3xl">
            <span aria-hidden="true" className="text-gold-dust">{book.icon}</span>
            <span className="min-w-0 truncate">{book.title_zh}</span>
          </h2>
        </div>
        <button
          type="button"
          onClick={onToggleMode}
          aria-pressed={mode === "deep"}
          className="shrink-0 rounded-full border border-gold-dust/40 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-dust hover:bg-gold-dust/10"
        >
          {mode === "quick" ? "展开深读" : "回到快读"}
        </button>
      </header>

      <article className="grid gap-4 rounded-2xl border border-gold-dust/25 bg-white/[0.03] p-6 sm:p-8">
        <p className="text-lg leading-relaxed text-stone-warm/90 sm:text-xl">
          {book.quick.verdict}
        </p>
        <div className="flex flex-wrap gap-2">
          {book.quick.keywords.map((k) => (
            <span
              key={k}
              className="rounded-full border border-gold-dust/40 px-3 py-1 text-xs tracking-widest text-gold-dust"
            >
              {k}
            </span>
          ))}
        </div>
        <ReaderRow title="现实里的样子">{book.quick.manifest}</ReaderRow>
        <ReaderRow title="一个建议">{book.quick.suggestion}</ReaderRow>
        <ReaderRow title="一个注意点">{book.quick.caution}</ReaderRow>
      </article>

      {mode === "deep" && (
        <article className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <h3 className="font-serif text-xl text-stone-warm">四体系依据</h3>
          <ul className="grid gap-2 text-sm text-stone-warm/80">
            <li><b className="text-gold-dust">西方 · </b>{book.deep.western}</li>
            <li><b className="text-gold-dust">印度 · </b>{book.deep.vedic}</li>
            <li><b className="text-gold-dust">八字 · </b>{book.deep.bazi}</li>
            <li><b className="text-gold-dust">紫微 · </b>{book.deep.ziwei}</li>
          </ul>
          <ReaderRow title="共识">{book.deep.consensus}</ReaderRow>
          <ReaderRow title="差异">{book.deep.tension}</ReaderRow>

          {book.deep.career_detail && (
            <div className="grid gap-2 rounded-xl border border-white/10 p-4 text-sm text-stone-warm/80">
              <p><b className="text-gold-dust">行业族群 · </b>{book.deep.career_detail.industry}</p>
              <p><b className="text-gold-dust">岗位画像 · </b>{book.deep.career_detail.role}</p>
              <p><b className="text-gold-dust">组织环境 · </b>{book.deep.career_detail.environment}</p>
            </div>
          )}
          {book.deep.love_detail && (
            <div className="grid gap-2 rounded-xl border border-white/10 p-4 text-sm text-stone-warm/80">
              <p><b className="text-gold-dust">情感需求 · </b>{book.deep.love_detail.need}</p>
              <p><b className="text-gold-dust">伴侣特质 · </b>{book.deep.love_detail.partner}</p>
              <p><b className="text-gold-dust">冲突模式 · </b>{book.deep.love_detail.conflict}</p>
            </div>
          )}

          <details className="rounded-xl border border-white/10 bg-obsidian/40 p-4">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.24em] text-stone-warm/60">
              证据与置信度
            </summary>
            <ul className="mt-3 grid gap-1 font-mono text-[11px] text-stone-warm/60">
              {book.deep.evidence.map((e) => (
                <li key={e}>· {e}</li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
              演示置信度：0.72 · 数值为 fixture
            </p>
          </details>
          <p className="text-xs italic text-stone-warm/55">{book.deep.premium_hook}</p>
        </article>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-full border border-white/15 px-5 py-3 text-xs uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/60"
        >
          回到书架
        </button>
        {nextBook && (
          <button
            type="button"
            onClick={() => onNext(nextBook.key)}
            className="min-h-11 rounded-full bg-gold-dust px-6 py-3 text-sm tracking-widest text-obsidian hover:bg-gold-light"
          >
            下一本：{nextBook.title_zh} →
          </button>
        )}
      </div>

      <p className="text-center text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
        文化与自我反思用途 · 不承诺唯一正缘、必然收益、疾病或灾祸
      </p>
    </section>
  );
}

function ReaderRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/50">{title}</p>
      <p className="text-sm text-stone-warm/85 sm:text-base">{children}</p>
    </div>
  );
}

// -----------------------------------------------------------------------
// Premium note (no real functionality)
// -----------------------------------------------------------------------
function PremiumNote({ onBack }: { onBack: () => void }) {
  return (
    <section className="grid gap-6 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="justify-self-start text-[11px] uppercase tracking-[0.24em] text-stone-warm/60 hover:text-gold-dust"
      >
        ← 返回书架
      </button>
      <div className="grid gap-4 rounded-2xl border border-gold-dust/30 bg-white/[0.03] p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-stone-warm sm:text-3xl">
          高级 AI 深度报告
        </h2>
        <p className="text-sm text-stone-warm/70 sm:text-base">
          24 章 · 一次生成 · 账户内长期保存。
        </p>
        <ul className="grid gap-2 text-sm text-stone-warm/70">
          <li>· 覆盖事业、情感、财富、时间轴、人生课题等主题的深入展开</li>
          <li>· 计算模块提供事实，AI 只解释；每章带证据与置信度</li>
          <li>· 生成后重复打开不再扣费、不再调用 AI</li>
        </ul>
        <p className="rounded-xl border border-white/10 bg-obsidian/40 p-4 text-[11px] uppercase tracking-[0.24em] text-stone-warm/55">
          预览环境说明 · 此按钮不会真实生成、不会发起支付、不会调用 AI。
        </p>
        <button
          type="button"
          disabled
          className="min-h-11 cursor-not-allowed rounded-full bg-gold-dust/50 px-6 py-3 text-sm tracking-widest text-obsidian/70"
        >
          解锁完整报告 ¥79 · 预览禁用
        </button>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------
// Librarian tour (3 steps, one-time)
// -----------------------------------------------------------------------
function LibrarianTour({ onDone }: { onDone: () => void }) {
  const steps = [
    {
      title: "我是馆员，只负责带路。",
      body: "馆员会帮你从一本书跳到下一本；他不会替你解读，也不同于「树洞」。",
    },
    {
      title: "你随时可以换书。",
      body: "每本书右上角可以切换「快读 / 深读」。快读 1 分钟，深读展开四体系依据。",
    },
    {
      title: "接下来发生的事。",
      body: "读完这一批书后，你可以打开生命时间轴，或者进入高级 24 章报告。所有内容会留在你的账户里。",
    },
  ];
  const [i, setI] = useState(0);
  const cur = steps[i];
  const last = i === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="馆员导览"
      className="fixed inset-0 z-50 grid place-items-end bg-obsidian/70 backdrop-blur-sm p-4 sm:place-items-center"
      onClick={onDone}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="grid w-full max-w-md gap-4 rounded-2xl border border-gold-dust/40 bg-obsidian p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-gold-dust">
          馆员导览 · {i + 1} / {steps.length}
        </p>
        <h3 className="font-serif text-xl text-stone-warm">{cur.title}</h3>
        <p className="text-sm text-stone-warm/70">{cur.body}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDone}
            className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/55 hover:text-gold-dust"
          >
            跳过
          </button>
          <button
            type="button"
            onClick={() => (last ? onDone() : setI(i + 1))}
            className="min-h-11 rounded-full bg-gold-dust px-5 py-2 text-xs uppercase tracking-[0.24em] text-obsidian hover:bg-gold-light"
          >
            {last ? "开始阅读" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
