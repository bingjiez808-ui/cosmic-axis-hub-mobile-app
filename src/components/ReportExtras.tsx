import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang, type Lang } from "@/lib/i18n";
import { useAccount } from "@/lib/account";

/* ═══════════════════════════════════════════
   Life Timeline — 大运 / Dashā decades
═══════════════════════════════════════════ */

type Decade = {
  from: number;
  to: number;
  theme: [string, string];
  detail: [string, string];
};

const DECADES: Decade[] = [
  { from: 0, to: 10, theme: ["Root", "扎根"], detail: [
    "Family shapes the temperament — the chart lays its foundation quietly.",
    "家庭塑造性情 —— 命盘在此静静打地基。",
  ] },
  { from: 10, to: 20, theme: ["Sprout", "萌发"], detail: [
    "Mind opens, first attractions and ambitions surface.",
    "心智开启，第一批渴望与野心浮现。",
  ] },
  { from: 20, to: 30, theme: ["Search", "求索"], detail: [
    "Career takes its first real shape; relationships teach more than they last.",
    "事业初具雏形；感情多在教你，而非陪你走远。",
  ] },
  { from: 30, to: 40, theme: ["Forge", "锻造"], detail: [
    "The chart's Officer/Wealth cycle turns — the years you build who you are.",
    "官运财运齐动的十年 —— 你在此炼成真正的自己。",
  ] },
  { from: 40, to: 50, theme: ["Bloom", "盛放"], detail: [
    "Peak of vocation and public influence. The library reads this decade brightest.",
    "事业与影响力的顶峰。此十年最为明亮。",
  ] },
  { from: 50, to: 60, theme: ["Harvest", "收获"], detail: [
    "Wealth compounds, teaching begins. Time to translate — not to prove.",
    "财富开始复利，教学之时。宜翻译传承，不再证明。",
  ] },
  { from: 60, to: 70, theme: ["Return", "回归"], detail: [
    "Inward turn. Relationships and meaning outweigh position and title.",
    "向内回转。关系与意义，重于位置与头衔。",
  ] },
  { from: 70, to: 80, theme: ["Distill", "凝定"], detail: [
    "The chart's quiet chapter — health and legacy come into focus.",
    "命盘中安静的一章 —— 健康与传承，成为主线。",
  ] },
];

function computeCurrentAge(birthISO?: string): number | null {
  if (!birthISO) return null;
  const d = new Date(birthISO);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, Math.min(age, 90));
}

export function LifeTimeline({ birthISO }: { birthISO?: string }) {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const age = computeCurrentAge(birthISO);
  const [active, setActive] = useState<number>(() => {
    if (age == null) return 3;
    return Math.min(DECADES.length - 1, Math.floor(age / 10));
  });

  const nowPct = age == null ? null : Math.min(100, (age / 80) * 100);
  const activeDecade = DECADES[active];

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.tl_kicker}
            </p>
            <h2 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
              {t.tl_title}
            </h2>
          </div>
          {age != null && (
            <span className="rounded-full border border-gold-dust/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-light">
              {t.tl_now} · {age} {lang === "zh" ? "岁" : ""}
            </span>
          )}
        </div>

        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">{t.tl_hint}</p>

        <div className="relative mb-10">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-gold-dust/40 to-transparent" />
          {nowPct != null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${nowPct}%` }}
            >
              <span className="block size-3 animate-pulse-gold rounded-full bg-gold-dust shadow-[0_0_20px_hsl(45_70%_60%/0.7)]" />
            </motion.div>
          )}
          <div className="relative grid grid-cols-8 gap-2">
            {DECADES.map((d, i) => {
              const isActive = i === active;
              const isPast = age != null && age >= d.to;
              const isNow = age != null && age >= d.from && age < d.to;
              return (
                <button
                  key={d.from}
                  type="button"
                  onClick={() => setActive(i)}
                  className="group flex flex-col items-center gap-3 py-2"
                >
                  <span
                    className={`size-4 rounded-full border transition-all ${
                      isActive
                        ? "border-gold-dust bg-gold-dust scale-125"
                        : isNow
                          ? "border-gold-dust bg-gold-dust/40"
                          : isPast
                            ? "border-gold-dust/40 bg-gold-dust/20"
                            : "border-white/20 bg-transparent group-hover:border-gold-dust/60"
                    }`}
                  />
                  <span
                    className={`text-[10px] uppercase tracking-[0.22em] transition-colors ${
                      isActive ? "text-gold-light" : "text-stone-warm/50 group-hover:text-gold-dust"
                    }`}
                  >
                    {d.from}–{d.to}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-gold-dust/20 bg-gold-dust/[0.04] p-6 md:p-8"
          >
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.tl_age} {activeDecade.from}–{activeDecade.to}
            </p>
            <h3 className="mb-4 font-serif text-2xl italic text-gold-light">
              {activeDecade.theme[li]}
            </h3>
            <p className="font-serif text-lg leading-relaxed text-stone-warm/85">
              {activeDecade.detail[li]}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Key Events verification — yes/no with story fallback
═══════════════════════════════════════════ */

type Prompt = {
  age: [number, number]; // age window
  theme: [string, string];
  guess: [string, string];
};

const PROMPTS: Prompt[] = [
  {
    age: [16, 19],
    theme: ["A first opening", "第一次开门"],
    guess: [
      "Around ages 16–19, the chart shows a first real departure — a school, a city, or a person that pulled you out of your childhood shape.",
      "16–19 岁前后，命盘出现第一次真正的离开 —— 一所学校、一座城市，或一个人，把你从童年的形状里拉了出来。",
    ],
  },
  {
    age: [22, 26],
    theme: ["The first identity shock", "第一次身份撞击"],
    guess: [
      "Between 22 and 26, the reading senses a bruise: a rejection, a heartbreak, or a career door that closed — and quietly redirected you.",
      "22–26 岁之间，命盘感知到一次「淤青」：拒绝、心碎、或职业上的关门 —— 它悄悄地把你重新导向了。",
    ],
  },
  {
    age: [28, 32],
    theme: ["Saturn's first return", "土星第一次回归"],
    guess: [
      "Around 28–32, a major re-choice: you either left something (job, city, relationship) or entered the one that lasts.",
      "28–32 岁前后，一次重大的重选：你要么离开了什么（工作、城市、关系），要么走进了那个真正留下的。",
    ],
  },
  {
    age: [33, 38],
    theme: ["A wealth or vocation turn", "财官转向"],
    guess: [
      "Between 33 and 38, the BaZi 大运 shifts to a Wealth/Officer cycle — a promotion, a business, or a first real accumulation of money.",
      "33–38 岁之间，八字大运进入财官之运 —— 升迁、创业，或第一次真正的财富积累。",
    ],
  },
  {
    age: [40, 45],
    theme: ["The bloom", "盛放之年"],
    guess: [
      "Around 40–45, public visibility peaks. A recognition, a book, a promotion, a stage — the chart wanted the world to see this you.",
      "40–45 岁前后，公众能见度达到高峰。一次被看见、一本书、一次升迁、一个舞台 —— 命盘要世界看到这样的你。",
    ],
  },
];

type Answer = { status: "unset" | "yes" | "no"; story: string; saved: boolean };

export function KeyEventsVerification({ birthISO }: { birthISO?: string }) {
  const { t, lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const [answers, setAnswers] = useState<Record<number, Answer>>({});

  const age = computeCurrentAge(birthISO);

  // Only ask about windows the user has already lived through.
  // If age can't be computed, fall back to the first three prompts.
  const visiblePrompts = useMemo(() => {
    if (age == null) return PROMPTS.slice(0, 3).map((p, i) => ({ p, i }));
    return PROMPTS
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => age >= p.age[0]);
  }, [age]);

  const set = (i: number, patch: Partial<Answer>) =>
    setAnswers((a) => {
      const prev: Answer = a[i] ?? { status: "unset", story: "", saved: false };
      return { ...a, [i]: { ...prev, ...patch } };
    });

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.ke_kicker}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.ke_title}
        </h2>
        <p className="mb-3 max-w-3xl text-sm text-stone-warm/60">{t.ke_hint}</p>
        {age != null && (
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-dust/30 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-light">
            <span className="size-1.5 rounded-full bg-gold-dust" />
            {lang === "zh"
              ? `你的当前年龄 · ${age} 岁 — 只回顾你已经走过的年份`
              : `Your current age · ${age} — only reviewing the years you've already lived`}
          </p>
        )}
        {visiblePrompts.length === 0 && (
          <p className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-stone-warm/60">
            {lang === "zh"
              ? "你还很年轻 —— 命盘的第一批可验证节点尚未到来。请先阅读上方的大运轴，静待第一次开门。"
              : "You're still early — the chart's first verifiable milestones haven't arrived yet. Read the timeline above and wait for the first door to open."}
          </p>
        )}


        <div className="space-y-4">
          {visiblePrompts.map(({ p, i }) => {
            const a = answers[i] ?? { status: "unset", story: "", saved: false };
            return (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6"
              >
                <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {t.ke_prompt} · {p.theme[li]} · {lang === "zh" ? "岁" : "Age"} {p.age[0]}–{p.age[1]}
                </p>
                <p className="mb-4 font-serif text-base leading-relaxed text-stone-warm/85 md:text-lg">
                  {p.guess[li]}
                </p>

                {a.status === "unset" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => set(i, { status: "yes" })}
                      className="rounded-full bg-gold-dust px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
                    >
                      {t.ke_yes}
                    </button>
                    <button
                      type="button"
                      onClick={() => set(i, { status: "no" })}
                      className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
                    >
                      {t.ke_no}
                    </button>
                  </div>
                )}

                {a.status === "yes" && (
                  <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-gold-light">
                    <span className="size-1.5 rounded-full bg-gold-dust" />
                    {t.ke_verified}
                  </p>
                )}

                {a.status === "no" && (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-stone-warm/70">{t.ke_story_prompt}</p>
                    <textarea
                      value={a.story}
                      onChange={(e) => set(i, { story: e.target.value, saved: false })}
                      placeholder={t.ke_story_ph}
                      rows={3}
                      className="ritual-input !py-3 !text-base w-full"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={!a.story.trim()}
                        onClick={() => set(i, { saved: true })}
                        className="rounded-full bg-gold-dust px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian disabled:opacity-40 hover:bg-gold-light"
                      >
                        {t.ke_save_story}
                      </button>
                      {a.saved && (
                        <span className="text-[10px] uppercase tracking-[0.24em] text-gold-light">
                          {t.ke_saved}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-[0.24em] text-stone-warm/30">
          {t.ke_note}
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Tarot — three cards
═══════════════════════════════════════════ */

const TAROT: {
  name: [string, string];
  glyph: string;
  read: [string, string];
}[] = [
  { name: ["The Fool", "愚者"], glyph: "0", read: ["A new beginning without a map.", "无地图的启程。"] },
  { name: ["The Magician", "魔术师"], glyph: "I", read: ["The tools are already in your hands.", "工具早已在你手中。"] },
  { name: ["The High Priestess", "女祭司"], glyph: "II", read: ["Listen to what you already know.", "倾听你已经知道的。"] },
  { name: ["The Empress", "女皇"], glyph: "III", read: ["Abundance ripens where you nourish.", "你滋养之处，丰盈自会生长。"] },
  { name: ["The Lovers", "恋人"], glyph: "VI", read: ["A choice about values, not just love.", "关于价值观的抉择，不仅是感情。"] },
  { name: ["The Chariot", "战车"], glyph: "VII", read: ["Willpower steers two opposing forces.", "意志驾驭两股相反之力。"] },
  { name: ["Strength", "力量"], glyph: "VIII", read: ["Gentleness is your real strength.", "温柔才是你真正的力量。"] },
  { name: ["The Hermit", "隐者"], glyph: "IX", read: ["Withdraw to see clearly.", "退一步，才看得清。"] },
  { name: ["Wheel of Fortune", "命运之轮"], glyph: "X", read: ["A cycle turns beyond your control.", "一轮周期，超出你的控制。"] },
  { name: ["The Star", "星星"], glyph: "XVII", read: ["Quiet hope after difficulty.", "低谷之后，安静的希望。"] },
  { name: ["The Moon", "月亮"], glyph: "XVIII", read: ["Not everything visible is real.", "所见并非皆真。"] },
  { name: ["The Sun", "太阳"], glyph: "XIX", read: ["Clarity, warmth, arrival.", "澄澈、温暖、抵达。"] },
];

export function TarotDraw() {
  const { t, lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const [deck] = useState(() => TAROT.slice());
  const [picks, setPicks] = useState<number[]>([]);
  const positions = [t.tarot_pos_past, t.tarot_pos_present, t.tarot_pos_future];

  const pick = (idx: number) => {
    if (picks.includes(idx) || picks.length >= 3) return;
    setPicks((p) => [...p, idx]);
  };
  const reset = () => setPicks([]);

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.tarot_kicker}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.tarot_title}
        </h2>
        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">{t.tarot_hint}</p>

        {/* Deck */}
        <div className="mb-8 grid grid-cols-4 gap-3 md:grid-cols-6">
          {deck.map((_, idx) => {
            const chosen = picks.includes(idx);
            const disabled = chosen || picks.length >= 3;
            return (
              <motion.button
                key={idx}
                type="button"
                onClick={() => pick(idx)}
                disabled={disabled}
                whileHover={disabled ? undefined : { y: -6, rotate: -1 }}
                animate={chosen ? { opacity: 0.15, y: 0 } : { opacity: 1 }}
                className="relative aspect-[2/3] rounded-xl border border-gold-dust/30 bg-gradient-to-br from-nebula-purple/30 via-void-blue to-obsidian shadow-[0_0_20px_rgba(0,0,0,0.4)] disabled:cursor-default"
              >
                <span className="absolute inset-2 rounded-lg border border-gold-dust/20" />
                <span className="absolute inset-0 grid place-items-center font-serif text-2xl italic text-gold-dust/60">
                  ✦
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Revealed cards */}
        {picks.length > 0 && (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {picks.map((cardIdx, pos) => {
              const c = deck[cardIdx];
              return (
                <motion.div
                  key={cardIdx}
                  initial={{ rotateY: 180, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                  className="rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-6 text-center"
                >
                  <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                    {positions[pos]}
                  </p>
                  <p className="mb-2 font-serif text-4xl italic text-gold-light">{c.glyph}</p>
                  <p className="mb-3 font-serif text-lg text-stone-warm">{c.name[li]}</p>
                  <p className="text-sm leading-relaxed text-stone-warm/70">{c.read[li]}</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Three-card synthesis */}
        {picks.length === 3 && (() => {
          const scores = [0, 2, 1, 2, 1, 1, 2, 0, 0, 2, -1, 2];
          const total = picks.reduce((s, i) => s + scores[i], 0);
          let tier: "great" | "good" | "mid" | "low";
          if (total >= 4) tier = "great";
          else if (total >= 2) tier = "good";
          else if (total >= 0) tier = "mid";
          else tier = "low";

          const label: Record<typeof tier, [string, string]> = {
            great: ["Upper Upper Fortune · 上上签", "上上签"],
            good: ["Upper Fortune · 上签", "上签"],
            mid: ["Middle Fortune · 中签", "中签"],
            low: ["Lower Fortune · 下签", "下签"],
          };
          const verdict: Record<typeof tier, [string, string]> = {
            great: [
              "Three cards land in bright company. The past you carried gave you tools, the present is opening, and the future is warming — this is a rare aligned draw. Move on the plans you've been quietly rehearsing.",
              "三张牌落在明亮的位置。过去给你留下了工具，此刻正在开门，未来在升温 —— 这是一次难得对齐的抽签。请把你私下反复排练的计划真正动起来。",
            ],
            good: [
              "The reading tilts favorable. There's real momentum here, though something in one position asks you to be honest — usually the middle card names the truth you already know.",
              "整体偏顺。此刻确实有真实的势能，但有一张牌要你诚实一点 —— 通常中间那张，说的是你早已知道的实话。",
            ],
            mid: [
              "A balanced draw — neither push nor stop. This is a listening moment: gather more information, don't force a decision this week, and let the future card mature before naming it.",
              "一次持平的签 —— 既非推进，也非停手。此刻是聆听时刻：多收集信息，别在这一周强行下决定，让代表未来的那张牌先熟成。",
            ],
            low: [
              "The draw runs cool. It's not disaster — it's a warning to slow down, protect health and money, and delay any commitment that requires you to perform. Rest is a strategy this month.",
              "签面偏冷。这不是灾难，而是一份「慢下来」的提醒：护住健康与金钱，推迟一切需要「表演」的承诺。这个月，休息本身就是策略。",
            ],
          };

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mb-6 rounded-2xl border border-gold-dust/40 bg-gradient-to-br from-gold-dust/[0.10] via-nebula-purple/[0.06] to-transparent p-6 md:p-8"
            >
              <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-light">
                <span className="size-1.5 rounded-full bg-gold-dust" />
                {lang === "zh" ? "三牌综述" : "Three-card synthesis"}
              </p>
              <p className="mb-3 font-serif text-2xl italic text-gold-light md:text-3xl">
                {label[tier][li]}
              </p>
              <p className="font-serif text-base leading-relaxed text-stone-warm/85 md:text-lg">
                {verdict[tier][li]}
              </p>
              <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                {picks.map((i) => deck[i].name[li]).join(" · ")}
              </p>
            </motion.div>
          );
        })()}


        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
            {picks.length} / 3 — {picks.length < 3 ? t.tarot_pick : t.tarot_read}
          </p>
          {picks.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
            >
              {t.tarot_reset}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Future Watchlist — Oracle members
═══════════════════════════════════════════ */

const WATCHLIST: {
  year: string;
  theme: [string, string];
  note: [string, string];
  locked?: boolean;
}[] = [
  {
    year: "2026 · Q3",
    theme: ["Career door opens", "事业开门"],
    note: [
      "A recognizable inflection — say yes carefully; the shape of the yes matters more than the yes itself.",
      "一个可识别的转折 —— 谨慎地说「好」；「好」的形状比「好」本身更重要。",
    ],
  },
  {
    year: "2027 · spring",
    theme: ["Health reset window", "健康重置窗口"],
    note: [
      "The chart flags a two-month window to rebuild sleep, breath and cardio — small habits with 10-year returns.",
      "命盘标出约两个月的窗口：重建睡眠、呼吸与有氧 —— 小习惯，十年回报。",
    ],
  },
  {
    year: "2028",
    theme: ["Meaningful encounter", "重要相遇"],
    locked: true,
    note: [
      "The synastry indicates a partnership-shape year. Details on Oracle.",
      "合盘指向一个「关系形状」的年份。神谕者可见细节。",
    ],
  },
  {
    year: "2029–2030",
    theme: ["Wealth compounding phase", "财富复利期"],
    locked: true,
    note: [
      "Two BaZi wealth stars form a bridge. Details on Oracle.",
      "两颗财星形成桥梁。神谕者可见细节。",
    ],
  },
  {
    year: "2031",
    theme: ["A quieter chapter", "转入静章"],
    locked: true,
    note: [
      "Deliberate slowing. Details on Oracle.",
      "有意识的放慢。神谕者可见细节。",
    ],
  },
];

export function FutureWatchlist() {
  const { t, lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.fw_kicker}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.fw_title}
        </h2>
        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">{t.fw_hint}</p>

        <ol className="relative space-y-4 border-l border-gold-dust/30 pl-6">
          {WATCHLIST.map((w) => (
            <li key={w.year} className="relative">
              <span className="absolute -left-[29px] top-2 size-2.5 rounded-full bg-gold-dust shadow-[0_0_12px_hsl(45_70%_60%/0.6)]" />
              <div className={`rounded-2xl border p-5 ${w.locked ? "border-white/10 bg-white/[0.02]" : "border-gold-dust/30 bg-gold-dust/[0.06]"}`}>
                <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                  {w.year}
                </p>
                <p className="mb-2 font-serif text-lg italic text-stone-warm">
                  {w.theme[li]}
                </p>
                {w.locked ? (
                  <p className="flex items-center gap-2 text-sm text-stone-warm/50">
                    <span>🔒</span> {t.fw_locked}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed text-stone-warm/70">{w.note[li]}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Save-this-reading (uses local account)
═══════════════════════════════════════════ */

export function SaveReadingBar({
  reading,
  onOpenAccount,
}: {
  reading: { name?: string; date?: string; time?: string; place?: string; lang?: "en" | "zh" };
  onOpenAccount: () => void;
}) {
  const { t } = useLang();
  const { account, saveReading, saved } = useAccount();
  const [justSaved, setJustSaved] = useState(false);

  const alreadySaved = saved.some(
    (s) => s.name === (reading.name ?? "") && s.date === reading.date && s.place === reading.place,
  );

  const handleSave = () => {
    if (!account) return onOpenAccount();
    saveReading({
      name: reading.name ?? "Anonymous",
      date: reading.date,
      time: reading.time,
      place: reading.place,
      lang: reading.lang,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2400);
  };

  return (
    <div className="mx-auto mb-10 max-w-5xl px-6 print:hidden md:px-12">
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-full px-6 py-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
          {account ? `${t.acc_signed_as} · ${account.name}` : t.acc_desc}
        </p>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-gold-dust px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
        >
          {justSaved || alreadySaved ? t.acc_reading_saved : t.acc_save_reading}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Membership + PDF export + AI follow-up
═══════════════════════════════════════════ */

type Plan = "free" | "sage" | "oracle";

export function MembershipSection() {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const [plan] = useState<Plan>("free");
  const [chatOpen, setChatOpen] = useState(false);

  const plans = useMemo(
    () => [
      {
        id: "free" as const,
        name: t.mem_free,
        desc: t.mem_free_desc,
        price: [`$0`, `¥0`][li],
        highlight: false,
      },
      {
        id: "sage" as const,
        name: t.mem_sage,
        desc: t.mem_sage_desc,
        price: [`$9 / mo`, `¥68 / 月`][li],
        highlight: true,
      },
      {
        id: "oracle" as const,
        name: t.mem_oracle,
        desc: t.mem_oracle_desc,
        price: [`$24 / mo`, `¥168 / 月`][li],
        highlight: false,
      },
    ],
    [t, li],
  );

  const exportPdf = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.mem_kicker}
        </p>
        <h2 className="mb-10 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.mem_title}
        </h2>

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = p.id === plan;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                  p.highlight
                    ? "border-gold-dust/50 bg-gold-dust/[0.06]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold-dust px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-obsidian">
                    ★
                  </span>
                )}
                <p className="mb-1 font-serif text-xl text-stone-warm">{p.name}</p>
                <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                  {p.price}
                </p>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-stone-warm/60">
                  {p.desc}
                </p>
                <button
                  type="button"
                  disabled={isCurrent}
                  className={`rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] transition-colors ${
                    isCurrent
                      ? "cursor-default border border-white/10 text-stone-warm/40"
                      : p.highlight
                        ? "bg-gold-dust text-obsidian hover:bg-gold-light"
                        : "border border-gold-dust/40 text-gold-dust hover:bg-gold-dust/10"
                  }`}
                >
                  {isCurrent ? t.mem_current : t.mem_upgrade}
                </button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={exportPdf}
            className="glass-card group flex items-center justify-between rounded-2xl p-6 text-left transition-colors hover:border-gold-dust/40"
          >
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {t.mem_export_pdf}
              </p>
              <p className="font-serif text-lg text-stone-warm">
                {lang === "zh" ? "打印或另存为 PDF" : "Print or save as PDF"}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-full border border-gold-dust/40 text-gold-dust transition-colors group-hover:bg-gold-dust group-hover:text-obsidian">
              ↓
            </span>
          </button>

          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="glass-card group flex items-center justify-between rounded-2xl p-6 text-left transition-colors hover:border-gold-dust/40"
          >
            <div>
              <p className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {t.mem_ai_followup}
                <span className="rounded-full border border-gold-dust/40 px-2 py-0.5 text-[8px] tracking-[0.28em] text-gold-light">
                  {t.mem_ai_locked}
                </span>
              </p>
              <p className="font-serif text-lg text-stone-warm">{t.mem_ai_followup_desc}</p>
            </div>
            <span className="grid size-10 place-items-center rounded-full border border-gold-dust/40 text-gold-dust transition-colors group-hover:bg-gold-dust group-hover:text-obsidian">
              ✦
            </span>
          </button>
        </div>
      </div>

      <AIFollowupModal open={chatOpen} onClose={() => setChatOpen(false)} lang={lang} />
    </section>
  );
}

function AIFollowupModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}) {
  const { t } = useLang();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-obsidian/70 backdrop-blur-md md:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="glass-card relative m-4 w-full max-w-lg rounded-3xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
            >
              {t.mem_close}
            </button>
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.mem_ai_followup}
            </p>
            <h3 className="mb-6 font-serif text-2xl italic text-stone-warm">
              {lang === "zh" ? "开启一场私密对话" : "Open a private conversation"}
            </h3>

            <div className="mb-6 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-stone-warm/70">
                {lang === "zh"
                  ? "「你的太阳落火象、日主为阳火 —— 想追问哪一维度？」"
                  : "“Your Sun sits in Fire and your Day Master is Yang Fire — which dimension would you like to explore?”"}
              </div>
            </div>

            <div className="mb-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2">
              <input
                disabled
                placeholder={t.mem_ai_placeholder}
                className="flex-1 bg-transparent text-sm text-stone-warm/70 outline-none placeholder:text-stone-warm/30"
              />
              <button
                disabled
                className="rounded-full bg-gold-dust/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-obsidian/50"
              >
                {t.mem_ai_send}
              </button>
            </div>

            <div className="rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-5">
              <p className="mb-4 font-serif text-base italic leading-relaxed text-stone-warm/85">
                {t.mem_ai_upsell}
              </p>
              <button
                type="button"
                className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
              >
                {t.mem_upgrade} → {t.mem_oracle}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
