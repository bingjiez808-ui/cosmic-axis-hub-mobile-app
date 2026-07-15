import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang, type Lang } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { ChartZoomModal } from "@/components/charts/DestinyCharts";

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

// Turn a birth string into a stable 32-bit seed so every visitor gets a
// different — but consistent — timeline shape.
function birthSeed(birthISO?: string): number {
  const s = birthISO || "0000-00-00";
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
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
  const seed = birthSeed(birthISO);

  const personalTintEn = [
    "For you specifically, this decade tilts toward outward proof more than inward retreat.",
    "For you, this decade rewards steady craft over sudden leaps — the ledger compounds quietly.",
    "In your chart, this decade opens two relationship-shaped doors: choose the slower one.",
    "For you, the second half of this decade is louder than the first — protect early rest.",
    "In your chart, this decade rebuilds around one honest conversation you've postponed.",
    "For you, this decade's real currency is trust — build a small, deep circle over a broad one.",
    "In your chart, this decade tilts your body's demand upward — treat sleep as strategy.",
    "For you, this decade closes with a decision that redefines the next twenty years.",
  ];
  const personalTintZh = [
    "在你的盘里，这十年更偏「向外证明」，而非「向内退守」。",
    "在你的盘里，这十年奖励稳定的手艺胜过突然的跳跃 —— 账本悄悄复利。",
    "在你的盘里，这十年打开两扇「关系形状」的门：选那扇慢的。",
    "在你的盘里，这十年的下半段比上半段更响 —— 提早护住休息。",
    "在你的盘里，这十年围绕一次被拖延的诚实对话，进行重建。",
    "在你的盘里，这十年的真正货币是「信任」—— 养一个小而深的圈子。",
    "在你的盘里，这十年身体的诉求会上抬 —— 把睡眠当作策略。",
    "在你的盘里，这十年以一次「重新定义未来二十年」的决定收束。",
  ];
  const personalTint = (lang === "zh" ? personalTintZh : personalTintEn)[
    ((seed + active * 2654435761) >>> 0) % 8
  ];

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
              {lang === "zh"
                ? `${activeDecade.from}–${activeDecade.to} 岁`
                : `${t.tl_age} ${activeDecade.from}–${activeDecade.to}`}
            </p>
            <h3 className="mb-4 font-serif text-2xl italic text-gold-light">
              {activeDecade.theme[li]}
            </h3>
            <p className="mb-3 font-serif text-lg leading-relaxed text-stone-warm/85">
              {activeDecade.detail[li]}
            </p>
            <p className="mb-6 font-serif text-[15px] italic leading-relaxed text-gold-light/80">
              {personalTint}
            </p>

            <YearByYearChart from={activeDecade.from} to={activeDecade.to} age={age} lang={lang} birthISO={birthISO} />
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// Deterministic pseudo-random from a seed integer.
function prand(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Year-by-year visualization within a decade — energy bar + one-line theme.
function YearByYearChart({
  from,
  to,
  age,
  lang,
  birthISO,
}: {
  from: number;
  to: number;
  age: number | null;
  lang: Lang;
  birthISO?: string;
}) {
  const bs = birthSeed(birthISO);
  const rnd = prand(((bs ^ (from + 1)) >>> 0) || 1);
  const themesEn = [
    "seeding — a quiet beginning",
    "opening — a first door",
    "learning — a skill takes root",
    "friction — a lesson through resistance",
    "breakthrough — visibility rises",
    "harvest — recognition and return",
    "consolidation — you keep what works",
    "shedding — release what no longer fits",
    "pivot — direction quietly changes",
    "integration — the decade completes",
    "signal — a message arrives from far",
    "rebuild — the body asks to be re-parented",
    "witness — someone truly sees you",
    "wager — a small brave bet",
    "return — an old thread reappears",
    "widening — your circle grows deeper",
  ];
  const themesZh = [
    "播种 —— 安静的起点",
    "开门 —— 第一次机会",
    "扎根 —— 一项能力落地",
    "磨合 —— 阻力中习得的功课",
    "突破 —— 可见度上升",
    "收获 —— 被看见与回响",
    "巩固 —— 留下真正有用的",
    "剥离 —— 放下不再合身的",
    "转向 —— 方向悄然改变",
    "整合 —— 十年的收束",
    "信号 —— 远方来的一封信",
    "重建 —— 身体请求被重新照料",
    "被看见 —— 有人真正读懂你",
    "小赌 —— 一次勇敢的下注",
    "回流 —— 旧线索再度出现",
    "拓宽 —— 你的圈子长得更深",
  ];
  const pool = lang === "zh" ? themesZh : themesEn;
  const years = Array.from({ length: to - from }, (_, i) => {
    const yr = from + i;
    const intensity = 0.35 + rnd() * 0.6;
    const themeIdx = Math.floor(rnd() * pool.length);
    return {
      age: yr,
      intensity,
      theme: pool[themeIdx],
      isNow: age != null && age === yr,
      isPast: age != null && age > yr,
    };
  });

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-obsidian/40 p-4 md:p-5">
      <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
        {lang === "zh" ? "逐年细读 · 能量曲线（依你的生日推算）" : "Year by year · energy curve (from your birthdate)"}
      </p>
      <div className="flex items-end gap-1.5 md:gap-2">
        {years.map((y) => (
          <div key={y.age} className="group flex flex-1 flex-col items-center gap-1.5">
            <div className="relative flex h-24 w-full items-end">
              <div
                className={`w-full rounded-t transition-all ${
                  y.isNow
                    ? "bg-gold-dust"
                    : y.isPast
                      ? "bg-gold-dust/40"
                      : "bg-gold-dust/20 group-hover:bg-gold-dust/60"
                }`}
                style={{ height: `${Math.round(y.intensity * 100)}%` }}
              />
              {y.isNow && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 size-2 rounded-full bg-gold-dust shadow-[0_0_10px_hsl(45_70%_60%/0.9)]" />
              )}
            </div>
            <span
              className={`text-[9px] tabular-nums ${
                y.isNow ? "text-gold-light" : "text-stone-warm/50"
              }`}
            >
              {y.age}
              <span className="ml-0.5 text-[8px] text-stone-warm/35">
                {lang === "zh" ? "岁" : "y"}
              </span>
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-1.5 text-[11px] leading-relaxed md:grid-cols-2">
        {years.map((y) => (
          <li
            key={y.age}
            className={`flex items-baseline gap-3 border-b border-white/5 py-1 ${
              y.isNow ? "text-gold-light" : y.isPast ? "text-stone-warm/70" : "text-stone-warm/50"
            }`}
          >
            <span className="w-14 shrink-0 font-serif tabular-nums">
              {y.age} {lang === "zh" ? "岁" : ""}
            </span>
            <span className="flex-1">{y.theme}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}


function ConfidenceBadge({ level, lang }: { level: "high" | "mid" | "low"; lang: Lang }) {
  const meta = {
    high: {
      label: [lang === "zh" ? "高置信" : "High confidence", "★★★"],
      cls: "border-gold-dust/60 bg-gold-dust/15 text-gold-light",
    },
    mid: {
      label: [lang === "zh" ? "中置信" : "Medium confidence", "★★"],
      cls: "border-nebula-purple/50 bg-nebula-purple/10 text-stone-warm",
    },
    low: {
      label: [lang === "zh" ? "低置信" : "Low confidence", "★"],
      cls: "border-white/15 bg-white/[0.03] text-stone-warm/70",
    },
  }[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.28em] ${meta.cls}`}
    >
      <span>{meta.label[1]}</span>
      <span>{meta.label[0]}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════
   Key Events verification — yes/no with story fallback
═══════════════════════════════════════════ */

type Confidence = "high" | "mid" | "low";

type Prompt = {
  age: [number, number]; // age window
  theme: [string, string];
  guess: [string, string];
  confidence: Confidence;
  basis: [string, string]; // why the reading tags this window as "already happened"
};

const PROMPTS: Prompt[] = [
  {
    age: [16, 19],
    theme: ["A first opening", "第一次开门"],
    guess: [
      "Around ages 16–19, the chart shows a first real departure — a school, a city, or a person that pulled you out of your childhood shape.",
      "16–19 岁前后，命盘出现第一次真正的离开 —— 一所学校、一座城市，或一个人，把你从童年的形状里拉了出来。",
    ],
    confidence: "high",
    basis: [
      "Jupiter's first return + BaZi 沐浴/冠带 stage. Three systems converge on a departure event — that's why the reading treats it as almost certainly lived.",
      "木星首次回归 + 八字沐浴/冠带阶段。三个体系同时指向一次「离开事件」，所以命盘几乎必然判定为已发生。",
    ],
  },
  {
    age: [22, 26],
    theme: ["The first identity shock", "第一次身份撞击"],
    guess: [
      "Between 22 and 26, the reading senses a bruise: a rejection, a heartbreak, or a career door that closed — and quietly redirected you.",
      "22–26 岁之间，命盘感知到一次「淤青」：拒绝、心碎、或职业上的关门 —— 它悄悄地把你重新导向了。",
    ],
    confidence: "mid",
    basis: [
      "Progressed Moon square natal Sun + Zi Wei 天梁 in career palace. Two systems agree on a bruise, but the shape (love vs. work) varies by chart.",
      "推运月亮刑本命太阳 + 紫微天梁入事业宫。两个体系一致指向淤青，但具体形状（感情或事业）因盘而异。",
    ],
  },
  {
    age: [28, 32],
    theme: ["Saturn's first return", "土星第一次回归"],
    guess: [
      "Around 28–32, a major re-choice: you either left something (job, city, relationship) or entered the one that lasts.",
      "28–32 岁前后，一次重大的重选：你要么离开了什么（工作、城市、关系），要么走进了那个真正留下的。",
    ],
    confidence: "high",
    basis: [
      "Saturn return is the strongest single transit in Western astrology; BaZi 大运 also swaps pillar here. Nearly every chart records a re-choice event.",
      "土星回归是西方占星最强的单一行运；八字大运在此换柱。几乎每张命盘都会记录一次重选。",
    ],
  },
  {
    age: [33, 38],
    theme: ["A wealth or vocation turn", "财官转向"],
    guess: [
      "Between 33 and 38, the BaZi 大运 shifts to a Wealth/Officer cycle — a promotion, a business, or a first real accumulation of money.",
      "33–38 岁之间，八字大运进入财官之运 —— 升迁、创业，或第一次真正的财富积累。",
    ],
    confidence: "mid",
    basis: [
      "BaZi 财官运 is the primary signal — Jyotish dashā often agrees, but Western transits are quieter here, so the reading calls this likely, not certain.",
      "主要信号来自八字财官大运 —— Jyotish 大运多半一致，但西方行运在此偏静，故只判为「可能」。",
    ],
  },
  {
    age: [40, 45],
    theme: ["The bloom", "盛放之年"],
    guess: [
      "Around 40–45, public visibility peaks. A recognition, a book, a promotion, a stage — the chart wanted the world to see this you.",
      "40–45 岁前后，公众能见度达到高峰。一次被看见、一本书、一次升迁、一个舞台 —— 命盘要世界看到这样的你。",
    ],
    confidence: "low",
    basis: [
      "This is a slower, cumulative phase rather than a sharp transit. The reading flags it because BaZi + Zi Wei both bright, but the timing has ±3 years drift.",
      "此为缓慢累积期，非尖锐行运。八字与紫微皆偏亮，故列出，但时间可漂移 ±3 年，因此置信度较低。",
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
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {t.ke_prompt} · {p.theme[li]} ·{" "}
                    {lang === "zh"
                      ? `${p.age[0]}–${p.age[1]} 岁`
                      : `Age ${p.age[0]}–${p.age[1]}`}
                  </p>
                  <ConfidenceBadge level={p.confidence} lang={lang} />
                </div>
                <p className="mb-3 font-serif text-base leading-relaxed text-stone-warm/85 md:text-lg">
                  {p.guess[li]}
                </p>
                {birthISO && (() => {
                  const bs = birthSeed(birthISO);
                  const tintEn = [
                    "For your specific chart, this node lands closer to the earlier half of the window.",
                    "For you, the shape here reads more like a departure than an arrival.",
                    "For your chart, the person/place involved carries a water-element tone.",
                    "For you, this node quietly rewrote a value, not a plan.",
                    "For your chart, the bruise here left a skill more than a scar.",
                    "For you, this window tilts toward a study/craft event over a romance.",
                    "For your chart, one older figure (mentor / parent / boss) enters this frame.",
                    "For you, the true weight of this node only surfaced 2–3 years later.",
                  ];
                  const tintZh = [
                    "在你的盘里，这个节点更靠近窗口的前半段。",
                    "在你的盘里，这里更像一次「离开」，而不是「到达」。",
                    "在你的盘里，涉及的人 / 地点带着水元素的调性。",
                    "在你的盘里，这个节点悄悄改写了一条价值观，而不是一份计划。",
                    "在你的盘里，这里的淤青，留下的是一项能力，而不是伤疤。",
                    "在你的盘里，这个窗口更偏向「学业 / 手艺事件」，而非恋情。",
                    "在你的盘里，有一位年长者（导师 / 父母 / 上级）在此登场。",
                    "在你的盘里，这个节点的真正分量，是 2–3 年后才浮现的。",
                  ];
                  const idx = ((bs + i * 2654435761) >>> 0) % 8;
                  return (
                    <p className="mb-3 font-serif text-[13px] italic leading-relaxed text-gold-light/85">
                      {(lang === "zh" ? tintZh : tintEn)[idx]}
                    </p>
                  );
                })()}
                <p className="mb-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-stone-warm/55">
                  <span className="mr-2 text-[9px] uppercase tracking-[0.32em] text-gold-dust/60">
                    {lang === "zh" ? "判定依据" : "Why flagged"}
                  </span>
                  {p.basis[li]}
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
   Tarot — 78-card swipeable deck
═══════════════════════════════════════════ */

import { TAROT_78, type TarotCard } from "@/lib/tarot-deck";
import { askOracle } from "@/lib/oracle.functions";

export function TarotDraw() {
  const { t, lang } = useLang();
  const { account } = useAccount();
  const li = lang === "zh" ? 1 : 0;
  const plan = (account?.plan ?? "free") as "free" | "sage" | "oracle";
  const isSage = plan === "sage" || plan === "oracle";

  // Deck is shuffled once per session so the user can swipe through all 78.
  const [deck] = useState<TarotCard[]>(() => {
    const arr = TAROT_78.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const [stage, setStage] = useState<"ask" | "pick" | "reveal">("ask");
  const [question, setQuestion] = useState("");
  const [picks, setPicks] = useState<number[]>([]);
  const [aiReading, setAiReading] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const positions: [string, string][] = [
    ["Past", "过去"],
    ["Present", "此刻"],
    ["Emerging", "将来"],
  ];

  const beginPicks = () => {
    if (!question.trim()) return;
    setPicks([]);
    setAiReading(null);
    setStage("pick");
  };

  const pick = (idx: number) => {
    if (picks.includes(idx) || picks.length >= 3) return;
    const next = [...picks, idx];
    setPicks(next);
    if (next.length === 3) setStage("reveal");
  };

  const reset = () => {
    setPicks([]);
    setAiReading(null);
    setStage("ask");
  };

  const tier = (() => {
    if (picks.length !== 3) return null;
    const total = picks.reduce((s, i) => s + deck[i].score, 0);
    if (total >= 4) return "great" as const;
    if (total >= 2) return "good" as const;
    if (total >= 0) return "mid" as const;
    return "low" as const;
  })();

  const tierLabel: Record<"great" | "good" | "mid" | "low", [string, string]> = {
    great: ["Upper-upper fortune · 上上签", "上上签"],
    good: ["Upper fortune · 上签", "上签"],
    mid: ["Middle fortune · 中签", "中签"],
    low: ["Lower fortune · 下签", "下签"],
  };
  const tierVerdict: Record<"great" | "good" | "mid" | "low", [string, string]> = {
    great: [
      "Three cards land in bright company. The wind is at your back — move on the plans you've been quietly rehearsing.",
      "三张牌落在明亮的位置。风顺 —— 请把你私下反复排练的计划真正动起来。",
    ],
    good: [
      "The reading tilts favorable. Real momentum here, though the middle card asks for one honest admission.",
      "整体偏顺。此刻确实有势能，但中间那张牌，要你诚实说出一句你早已知道的话。",
    ],
    mid: [
      "A balanced draw — neither push nor stop. Gather information; don't force a decision this week.",
      "一次持平的签 —— 既非推进，也非停手。多收集信息，本周不强行下决定。",
    ],
    low: [
      "The draw runs cool. Not disaster — a warning to slow down, protect health and money, delay commitments.",
      "签面偏冷。这不是灾难，而是一份「慢下来」的提醒：护住健康与金钱，推迟需要表演的承诺。",
    ],
  };

  const requestAiReading = async () => {
    if (!isSage || aiLoading || picks.length !== 3) return;
    setAiLoading(true);
    try {
      const cards = picks.map((i, pos) => {
        const c = deck[i];
        const p = positions[pos][li];
        return `${p}: ${c.nameEn} / ${c.nameZh} — ${c.hintEn}`;
      }).join("\n");
      const prompt = lang === "zh"
        ? `占卜问题：${question}\n\n三张塔罗牌（Rider–Waite）：\n${cards}\n\n请以「命运图书馆」贤者的口吻，将三张牌与问题深度整合，给出 3 段（过去成因 / 此刻真相 / 下一步建议），并在结尾给出一个可以在本周执行的具体动作。`
        : `Question: ${question}\n\nThree Rider–Waite tarot cards:\n${cards}\n\nAs the Library of Destiny sage, weave the three cards and the question into a deep reading in three short paragraphs (root cause / present truth / next move), and end with one concrete action the visitor can take this week.`;
      const res = await askOracle({ data: { question: prompt, lang } });
      setAiReading(res.text);
    } catch (e) {
      console.error(e);
      setAiReading(lang === "zh" ? "解读暂时无法生成，请稍后再试。" : "The reading could not be generated. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const openAccount = () => window.dispatchEvent(new Event("lod:open-account"));

  return (
    <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.tarot_kicker}
        </p>
        <h2 className="mb-3 font-serif text-xl italic text-stone-warm sm:text-2xl md:text-3xl">
          {lang === "zh" ? "先提问，再翻牌 · 78 张标准塔罗" : "Ask first, then flip — the full 78-card deck"}
        </h2>
        <p className="mb-6 max-w-3xl text-sm text-stone-warm/60">{t.tarot_hint}</p>

        {/* Stage 1 — question */}
        {stage === "ask" && (
          <div className="rounded-2xl border border-gold-dust/25 bg-obsidian/40 p-5 sm:p-6">
            <label className="mb-3 block text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
              {lang === "zh" ? "你今晚要问的事" : "What you are asking tonight"}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder={lang === "zh" ? "例如：这段关系还值得继续吗？" : "e.g. Should I stay in this relationship?"}
              className="w-full resize-none rounded-xl border border-white/10 bg-obsidian/60 p-4 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust/60 focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                {lang === "zh" ? "写下越具体，签越准" : "The clearer the question, the truer the reading"}
              </p>
              <button
                type="button"
                onClick={beginPicks}
                disabled={!question.trim()}
                className="rounded-full bg-gold-dust px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {lang === "zh" ? "开始翻牌 →" : "Begin the draw →"}
              </button>
            </div>
          </div>
        )}

        {/* Stage 2 — swipeable 78-card deck */}
        {stage === "pick" && (
          <div>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                {picks.length} / 3 — {positions[picks.length]?.[li] ?? ""}
              </p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                {lang === "zh" ? "← 左右滑动 78 张 →" : "← swipe through all 78 →"}
              </p>
            </div>
            <div className="tarot-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:gap-4 sm:px-6">
              {deck.map((c, idx) => {
                const chosen = picks.includes(idx);
                const disabled = chosen || picks.length >= 3;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => pick(idx)}
                    disabled={disabled}
                    whileHover={disabled ? undefined : { y: -6 }}
                    animate={chosen ? { opacity: 0.15 } : { opacity: 1 }}
                    className="relative aspect-[2/3] w-[42vw] max-w-[180px] flex-none snap-center overflow-hidden rounded-xl border border-gold-dust/30 bg-gradient-to-br from-nebula-purple/40 via-void-blue to-obsidian shadow-[0_8px_28px_rgba(0,0,0,0.55)] disabled:cursor-default sm:w-[160px]"
                  >
                    <span className="absolute inset-2 rounded-lg border border-gold-dust/25" />
                    <span className="absolute inset-0 grid place-items-center font-serif text-3xl italic text-gold-dust/50">
                      ✦
                    </span>
                    <span className="absolute bottom-2 left-0 right-0 text-center font-mono text-[9px] tracking-[0.28em] text-gold-dust/50">
                      {String(idx + 1).padStart(2, "0")} / 78
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
              {lang === "zh"
                ? `问题：${question.length > 40 ? question.slice(0, 40) + "…" : question}`
                : `Question: ${question.length > 60 ? question.slice(0, 60) + "…" : question}`}
            </p>
          </div>
        )}

        {/* Stage 3 — reveal */}
        {stage === "reveal" && tier && (
          <div>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {picks.map((cardIdx, pos) => {
                const c = deck[cardIdx];
                return (
                  <motion.div
                    key={c.id}
                    initial={{ rotateY: 180, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.9, delay: pos * 0.15, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06]"
                  >
                    <p className="pt-4 text-center text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                      {positions[pos][li]}
                    </p>
                    <div className="mx-auto mt-3 aspect-[2/3] w-[62%] overflow-hidden rounded-lg border border-gold-dust/20 bg-obsidian/60">
                      <img
                        src={c.image}
                        alt={c.nameEn}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="p-4 text-center">
                      <p className="font-serif text-lg italic text-gold-light">{c.glyph}</p>
                      <p className="mt-1 font-serif text-base text-stone-warm">{c.nameZh} · {c.nameEn}</p>
                      <p className="mt-2 text-xs leading-relaxed text-stone-warm/70">{li === 1 ? c.hintZh : c.hintEn}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mb-6 rounded-2xl border border-gold-dust/40 bg-gradient-to-br from-gold-dust/[0.12] via-nebula-purple/[0.06] to-transparent p-5 sm:p-8"
            >
              <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-light">
                <span className="size-1.5 rounded-full bg-gold-dust" />
                {lang === "zh" ? "签面结论" : "Fortune verdict"}
              </p>
              <p className="mb-3 font-serif text-2xl italic text-gold-light md:text-3xl">
                {tierLabel[tier][li]}
              </p>
              <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                {lang === "zh" ? "关于：" : "On: "}{question}
              </p>
              <p className="font-serif text-base leading-relaxed text-stone-warm/85 md:text-lg">
                {tierVerdict[tier][li]}
              </p>
            </motion.div>

            {/* Sage AI deep reading */}
            <div className="mb-6 rounded-2xl border border-gold-dust/25 bg-obsidian/40 p-5 sm:p-6">
              <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                {lang === "zh" ? "贤者会员 · AI 深度解读" : "Sage members · AI deep reading"}
              </p>
              {isSage ? (
                <>
                  {!aiReading && !aiLoading && (
                    <button
                      type="button"
                      onClick={requestAiReading}
                      className="rounded-full bg-gold-dust px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
                    >
                      {lang === "zh" ? "生成 AI 深度解读 →" : "Generate AI deep reading →"}
                    </button>
                  )}
                  {aiLoading && (
                    <p className="text-sm italic text-stone-warm/60">
                      {lang === "zh" ? "贤者正在书写…" : "The sage is writing…"}
                    </p>
                  )}
                  {aiReading && (
                    <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-stone-warm/90">
                      {aiReading}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-md text-sm text-stone-warm/70">
                    {lang === "zh"
                      ? "开通「贤者」，AI 会将你的问题、三张牌与命盘一起深度解读。"
                      : "Unlock Sage to have the AI weave your question, three cards and chart into one deep reading."}
                  </p>
                  <button
                    type="button"
                    onClick={openAccount}
                    className="rounded-full border border-gold-dust/50 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
                  >
                    {lang === "zh" ? "开通贤者 →" : "Unlock Sage →"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                {picks.map((i) => deck[i].nameZh).join(" · ")}
              </p>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
              >
                {t.tarot_reset}
              </button>
            </div>
          </div>
        )}
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
  detail?: [string, string];
  locked?: boolean;
}[] = [
  {
    year: "2026 · Q3",
    theme: ["Career door opens", "事业开门"],
    note: [
      "A recognizable inflection — say yes carefully; the shape of the yes matters more than the yes itself.",
      "一个可识别的转折 —— 谨慎地说「好」；「好」的形状比「好」本身更重要。",
    ],
    detail: [
      "Jupiter transits your 10th house while BaZi shows a 正官 year — a promotion, an invitation to lead, or a public-facing role. Negotiate scope and title before compensation; the framing you accept now defines the next three years.",
      "木星过境事业宫，八字流年逢正官 —— 晋升、被点名带团队或走到台前的窗口。先谈边界与头衔，再谈薪酬；此刻接受的「框」将定义未来三年的位置。",
    ],
  },
  {
    year: "2027 · spring",
    theme: ["Health reset window", "健康重置窗口"],
    note: [
      "The chart flags a two-month window to rebuild sleep, breath and cardio — small habits with 10-year returns.",
      "命盘标出约两个月的窗口：重建睡眠、呼吸与有氧 —— 小习惯，十年回报。",
    ],
    detail: [
      "Saturn squares your Ascendant while 大运 shifts into a 印 phase — the body asks to be re-parented. Sleep before midnight, morning sunlight, low-intensity cardio 4×/week. Avoid crash diets and stimulants; this is a rebuild, not a sprint.",
      "土星刑上升点，大运走印 —— 身体请求被重新照料。子时前入睡、晨光、每周四次低强度有氧。切忌节食与依赖咖啡因；这是「重建」，不是「冲刺」。",
    ],
  },
  {
    year: "2028",
    theme: ["Meaningful encounter", "重要相遇"],
    note: [
      "The synastry indicates a partnership-shape year. Details on Oracle.",
      "合盘指向一个「关系形状」的年份。神谕者可见细节。",
    ],
    detail: [
      "Venus-Jupiter conjunction in your 7th, and BaZi 桃花 activates on the day pillar. A relationship (romantic or a serious business partnership) arrives with real weight. Do not confuse chemistry with alignment — check three months of behavior before committing structure.",
      "金木合相入夫妻宫，八字日柱桃花开 —— 一段有分量的关系（感情或深度合伙）到来。不要把化学反应当作契合度 —— 观察三个月的行为再落实结构。",
    ],
  },
  {
    year: "2029–2030",
    theme: ["Wealth compounding phase", "财富复利期"],
    note: [
      "Two BaZi wealth stars form a bridge. Details on Oracle.",
      "两颗财星形成桥梁。神谕者可见细节。",
    ],
    detail: [
      "偏财 and 正财 both active while Jupiter enters your 2nd house — passive income, equity, or a side business can materially compound. Move from earning to owning: index funds, equity in your own work, one long-hold asset. Avoid leverage-heavy speculation.",
      "正财、偏财双动，木星入财帛宫 —— 被动收入、股权、副业可实质复利。从「赚薪水」转到「拥有资产」：指数、自身股权、一项长期持有。避开高杠杆投机。",
    ],
  },
  {
    year: "2031",
    theme: ["A quieter chapter", "转入静章"],
    note: [
      "Deliberate slowing. Details on Oracle.",
      "有意识的放慢。神谕者可见细节。",
    ],
    detail: [
      "Saturn return-adjacent for many, and the 大运 shifts into a reflective 食伤 or 印 phase. Output slows, meaning deepens. Take the sabbatical, write the book, mentor. Public metrics dim; inner metrics brighten.",
      "接近土星回归，大运转入食伤或印 —— 输出变慢，意义变深。请长假、写那本书、开始带人。外部指标转暗，内部指标转亮。",
    ],
  },
];

export function FutureWatchlist() {
  const { t, lang } = useLang();
  const { account } = useAccount();
  const plan = (account?.plan ?? "free") as "free" | "sage" | "oracle";
  const isOracle = plan === "oracle";
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
          {WATCHLIST.map((w) => {
            const unlocked = isOracle || !w.locked;
            return (
              <li key={w.year} className="relative">
                <span className="absolute -left-[29px] top-2 size-2.5 rounded-full bg-gold-dust shadow-[0_0_12px_hsl(45_70%_60%/0.6)]" />
                <div className={`rounded-2xl border p-5 ${unlocked ? "border-gold-dust/30 bg-gold-dust/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                    {w.year}
                  </p>
                  <p className="mb-2 font-serif text-lg italic text-stone-warm">
                    {w.theme[li]}
                  </p>
                  {unlocked ? (
                    <>
                      <p className="text-sm leading-relaxed text-stone-warm/70">{w.note[li]}</p>
                      {isOracle && w.detail && (
                        <div className="mt-3 rounded-xl border border-gold-dust/20 bg-obsidian/40 p-4">
                          <p className="mb-1 text-[9px] uppercase tracking-[0.32em] text-gold-dust/80">
                            {lang === "zh" ? "流年运势 · 详解" : "Yearly forecast · detail"}
                          </p>
                          <p className="text-sm leading-relaxed text-stone-warm/85">
                            {w.detail[li]}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-stone-warm/50">
                      <span>🔒</span> {t.fw_locked}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
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
type PayMethod = "wechat" | "alipay" | "unionpay" | "visa";

export function MembershipSection({ birthISO }: { birthISO?: string } = {}) {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const { account, setPlan: persistPlan } = useAccount();
  const plan: Plan = (account?.plan ?? "free") as Plan;
  const setPlan = (p: Plan) => persistPlan(p);
  const [chatOpen, setChatOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<Plan | null>(null);
  const [signInPrompt, setSignInPrompt] = useState(false);
  // Treat the current session as "new" until the user upgrades once — grants the first-time discount.
  const [firstTime, setFirstTime] = useState(true);

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
        desc:
          lang === "zh"
            ? "完整 PDF 报告 · 生命时间轴精解 · 合盘关系分析（贤者专属）。"
            : "Full PDF · life-timeline analysis · Synastry relationship reading (Sage exclusive).",
        price: [`$2.99 / mo`, `¥19.9 / 月`][li],
        highlight: true,
      },
      {
        id: "oracle" as const,
        name: t.mem_oracle,
        desc:
          lang === "zh"
            ? "包含贤者所有权益 · 无限 AI 追问 · 近 90 天状态与时间节点分析（神谕者专属）。"
            : "Everything in Sage · unlimited AI follow-up · 90-day state & window analysis (Oracle exclusive).",
        price: [`$5.99 / mo`, `¥39.9 / 月`][li],
        highlight: false,
      },
    ],
    [t, li, lang],
  );

  const exportPdf = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleUpgradeClick = (target: Plan) => {
    if (!account) {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("lod:open-account"));
      return;
    }
    if (target === "free") {
      setPlan("free");
      return;
    }
    setUpgradeTarget(target);
  };

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.mem_kicker}
        </p>
        <h2 className="mb-6 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.mem_title}
        </h2>

        {/* Login gate */}
        {!account && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold-dust/40 bg-gold-dust/[0.06] p-5">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-light">
                {lang === "zh" ? "请先登录以升级" : "Sign in to upgrade"}
              </p>
              <p className="text-sm text-stone-warm/70">
                {lang === "zh"
                  ? "会员权益需要账户来承载 —— 登录或创建账号后即可选择支付方式。首次升级享专属优惠。"
                  : "Membership requires an account. Sign in or create one to pick a payment method — first-time upgrades get an exclusive discount."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.dispatchEvent(new Event("lod:open-account"));
              }}
              className="rounded-full bg-gold-dust px-5 py-2.5 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light"
            >
              {lang === "zh" ? "登录 / 创建账号" : "Sign in / Create"}
            </button>
          </div>
        )}

        {account && firstTime && (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-nebula-purple/40 bg-nebula-purple/[0.10] px-5 py-3">
            <span className="rounded-full bg-nebula-purple/40 px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-stone-warm">
              {lang === "zh" ? "首次优惠" : "First-time offer"}
            </span>
            <p className="text-sm text-stone-warm/80">
              {lang === "zh"
                ? "新账户首次升级享 -30% 折扣 —— 结算时自动应用。"
                : "New accounts get 30% off their first upgrade — applied automatically at checkout."}
            </p>
          </div>
        )}

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const rank = (x: Plan) => (x === "oracle" ? 2 : x === "sage" ? 1 : 0);
            const userRank = rank(plan);
            const tierRank = rank(p.id);
            const isCurrent = p.id === plan;
            const isIncluded = !isCurrent && tierRank < userRank;
            const disabled = isCurrent || isIncluded;
            const label = isCurrent
              ? t.mem_current
              : isIncluded
                ? lang === "zh" ? "已包含" : "Included"
                : t.mem_upgrade;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                  isCurrent
                    ? "border-gold-dust/70 bg-gold-dust/[0.10]"
                    : isIncluded
                      ? "border-gold-dust/25 bg-gold-dust/[0.03]"
                      : p.highlight
                        ? "border-gold-dust/50 bg-gold-dust/[0.06]"
                        : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {p.highlight && !isIncluded && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold-dust px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-obsidian">
                    ★
                  </span>
                )}
                {isIncluded && (
                  <span className="absolute -top-3 left-6 rounded-full border border-gold-dust/40 bg-obsidian px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-gold-dust">
                    {lang === "zh" ? "已包含" : "Included"}
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
                  onClick={() => handleUpgradeClick(p.id)}
                  disabled={disabled}
                  className={`rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] transition-colors ${
                    disabled
                      ? "cursor-default border border-white/10 text-stone-warm/40"
                      : p.highlight
                        ? "bg-gold-dust text-obsidian hover:bg-gold-light"
                        : "border border-gold-dust/40 text-gold-dust hover:bg-gold-dust/10"
                  }`}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>

        {/* Teaser cards — hidden fully unlocked tier features under blur for lower tiers */}
        <TierTeasers lang={lang} li={li} plan={plan} onUpgrade={handleUpgradeClick} />


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

      {/* Sage-exclusive: Synastry relationship reading */}
      {(plan === "sage" || plan === "oracle") && (
        <div className="mt-10">
          <div className="mx-auto mb-6 flex max-w-5xl items-center gap-3 px-6 md:px-12">
            <span className="h-px flex-1 bg-gold-dust/30" />
            <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">
              {lang === "zh" ? "贤者专属 · 合盘分析" : "Sage exclusive · Synastry"}
            </p>
            <span className="h-px flex-1 bg-gold-dust/30" />
          </div>
          <SynastryPreview userBirthISO={birthISO} />
        </div>
      )}

      {/* Oracle-exclusive: 90-day windows + future watchlist */}
      {plan === "oracle" && (
        <div className="mt-4">
          <div className="mx-auto mb-6 flex max-w-5xl items-center gap-3 px-6 md:px-12">
            <span className="h-px flex-1 bg-gold-dust/30" />
            <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">
              {lang === "zh" ? "神谕者专属 · 近 90 天状态分析" : "Oracle exclusive · 90-day analysis"}
            </p>
            <span className="h-px flex-1 bg-gold-dust/30" />
          </div>
          <RecentWindows birthISO={birthISO} />
          <FutureWatchlist />
        </div>
      )}

      <AIFollowupModal open={chatOpen} onClose={() => setChatOpen(false)} lang={lang} plan={plan} onUpgrade={() => { setChatOpen(false); setUpgradeTarget("oracle"); }} />
      <SignInPromptModal
        open={signInPrompt}
        onClose={() => setSignInPrompt(false)}
        lang={lang}
      />
      <UpgradeCheckoutModal
        target={upgradeTarget}
        firstTime={firstTime}
        lang={lang}
        onClose={() => setUpgradeTarget(null)}
        onConfirm={() => {
          if (upgradeTarget) {
            setPlan(upgradeTarget);
            setFirstTime(false);
          }
          setUpgradeTarget(null);
        }}
      />
    </section>
  );
}

/* Tier teasers — blurred previews of locked perks */
function TierTeasers({
  lang,
  li,
  plan,
  onUpgrade,
}: {
  lang: Lang;
  li: 0 | 1;
  plan: Plan;
  onUpgrade: (target: Plan) => void;
}) {
  const items: {
    target: Plan;
    unlocked: boolean;
    kicker: [string, string];
    title: [string, string];
    bullets: [string, string][];
  }[] = [
    {
      target: "sage",
      unlocked: plan === "sage" || plan === "oracle",
      kicker: ["Sage Synastry · Relationship", "贤者合盘 · 关系分析"],
      title: ["Two charts, one honest reading", "两张命盘的诚实对话"],
      bullets: [
        ["Five axes of resonance — scored, not romanticized.", "五维契合度 —— 有分数，不美化。"],
        ["Where you harmonize; where you generate noise.", "何处和声，何处噪音。"],
        ["A verdict the chart is willing to defend.", "一个命盘愿意为之背书的结论。"],
      ],
    },
    {
      target: "oracle",
      unlocked: plan === "oracle",
      kicker: ["Oracle Now · 90-day windows", "神谕者近况 · 90 天窗口"],
      title: ["The next 90 days, in four windows", "接下来 90 天，四个窗口"],
      bullets: [
        ["A signal week is opening.", "一个「信号周」正在打开。"],
        ["A wealth channel wants a message you've been avoiding.", "一条财路，在等你迟迟未发的消息。"],
        ["A postponed conversation becomes unavoidable.", "一段被拖延的对话，将无法回避。"],
      ],
    },
  ];

  return (
    <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.kicker[0]}
          className="relative overflow-hidden rounded-2xl border border-gold-dust/20 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {it.kicker[li]}
            </p>
            <span className="rounded-full border border-gold-dust/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.28em] text-gold-light">
              {it.target === "sage" ? (lang === "zh" ? "贤者" : "Sage") : lang === "zh" ? "神谕者" : "Oracle"}
            </span>
          </div>
          <p className="mb-4 font-serif text-lg italic text-stone-warm">{it.title[li]}</p>
          <ul className="mb-5 space-y-2 text-sm text-stone-warm/70">
            {it.bullets.map((b) => (
              <li key={b[0]} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold-dust/70" />
                <span className="italic">{b[li]}</span>
              </li>
            ))}
          </ul>
          {!it.unlocked && (
            <>
              <div className="relative mb-4 h-16 overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
                <div className="absolute inset-0 space-y-2 p-3 blur-[6px] select-none">
                  <div className="h-1.5 w-3/4 rounded-full bg-gradient-to-r from-gold-dust to-nebula-purple" />
                  <div className="h-1.5 w-2/3 rounded-full bg-gradient-to-r from-gold-dust to-nebula-purple" />
                  <div className="h-1.5 w-4/5 rounded-full bg-gradient-to-r from-gold-dust to-nebula-purple" />
                  <div className="h-1.5 w-1/2 rounded-full bg-gradient-to-r from-gold-dust to-nebula-purple" />
                </div>
                <div className="absolute inset-0 grid place-items-center bg-obsidian/40">
                  <span className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                    {lang === "zh"
                      ? `⌛ ${it.target === "sage" ? "贤者" : "神谕者"}可见细节`
                      : `⌛ Details on ${it.target === "sage" ? "Sage" : "Oracle"}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpgrade(it.target)}
                className="w-full rounded-full border border-gold-dust/40 px-5 py-2.5 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-colors hover:bg-gold-dust hover:text-obsidian"
              >
                {lang === "zh"
                  ? `升级至${it.target === "sage" ? "贤者" : "神谕者"}，查看详细分析`
                  : `Upgrade to ${it.target === "sage" ? "Sage" : "Oracle"} for the full reading`}
              </button>
            </>
          )}
          {it.unlocked && (
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
              {lang === "zh" ? "✓ 已解锁 —— 详见下方" : "✓ Unlocked — see below"}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* Sign-in prompt (shown when a not-logged-in user clicks Upgrade) */
function SignInPromptModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="glass-card w-full max-w-md rounded-3xl p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
              {lang === "zh" ? "需要登录" : "Sign in required"}
            </p>
            <h3 className="mb-3 font-serif text-2xl italic text-stone-warm">
              {lang === "zh" ? "登录后即可升级" : "Sign in to upgrade"}
            </h3>
            <p className="mb-6 text-sm text-stone-warm/60">
              {lang === "zh"
                ? "请先关闭此窗口并点击右上角「登录 / 创建账号」。首次升级享 -30% 优惠。"
                : "Close this and use the Sign in / Create button at the top-right. First-time upgrades get 30% off."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light"
            >
              {lang === "zh" ? "知道了" : "Got it"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Upgrade checkout — pick a payment method, show first-time discount */
function UpgradeCheckoutModal({
  target,
  firstTime,
  lang,
  onClose,
  onConfirm,
}: {
  target: Plan | null;
  firstTime: boolean;
  lang: Lang;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [method, setMethod] = useState<PayMethod>("wechat");
  const li = lang === "zh" ? 1 : 0;

  const methods: { id: PayMethod; label: [string, string]; hint: [string, string]; emoji: string }[] = [
    {
      id: "wechat",
      label: ["WeChat Pay", "微信支付"],
      hint: ["扫码支付 / Scan & pay", "扫码支付"],
      emoji: "💬",
    },
    {
      id: "alipay",
      label: ["Alipay", "支付宝支付"],
      hint: ["Alipay balance / 花呗", "余额 / 花呗"],
      emoji: "🅰",
    },
    {
      id: "unionpay",
      label: ["UnionPay card", "银联卡支付"],
      hint: ["China UnionPay · debit / credit", "银联借记卡 / 信用卡"],
      emoji: "🀄",
    },
    {
      id: "visa",
      label: ["Visa / Mastercard", "Visa 信用卡"],
      hint: ["International card", "国际信用卡"],
      emoji: "💳",
    },
  ];

  if (!target) return null;

  const basePrice = target === "sage" ? 19.9 : 39.9;
  const discounted = firstTime ? Math.round(basePrice * 0.7 * 10) / 10 : basePrice;

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="glass-card relative w-full max-w-lg rounded-3xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
            >
              {lang === "zh" ? "关闭" : "Close"}
            </button>

            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
              {lang === "zh" ? "升级至" : "Upgrade to"} {target === "sage" ? (lang === "zh" ? "贤者" : "Sage") : (lang === "zh" ? "神谕者" : "Oracle")}
            </p>
            <h3 className="mb-6 font-serif text-2xl italic text-stone-warm">
              {lang === "zh" ? "选择支付方式" : "Choose a payment method"}
            </h3>

            <div className="mb-6 flex items-baseline gap-3">
              <span className="font-serif text-4xl italic text-gold-light">
                ¥{discounted}
              </span>
              {firstTime && (
                <>
                  <span className="text-sm text-stone-warm/40 line-through">¥{basePrice}</span>
                  <span className="rounded-full bg-nebula-purple/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.28em] text-stone-warm">
                    {lang === "zh" ? "首次 -30%" : "-30% first-time"}
                  </span>
                </>
              )}
              <span className="text-xs text-stone-warm/50">/ {lang === "zh" ? "月" : "mo"}</span>
            </div>

            <div className="mb-6 space-y-2">
              {methods.map((m) => {
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                      active
                        ? "border-gold-dust/60 bg-gold-dust/10"
                        : "border-white/10 bg-white/[0.02] hover:border-gold-dust/30"
                    }`}
                  >
                    <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-lg">
                      {m.emoji}
                    </span>
                    <div className="flex-1">
                      <p className="font-serif text-base text-stone-warm">{m.label[li]}</p>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/50">
                        {m.hint[li]}
                      </p>
                    </div>
                    <span
                      className={`grid size-6 place-items-center rounded-full border transition-colors ${
                        active
                          ? "border-gold-dust bg-gold-dust text-obsidian"
                          : "border-white/20 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light"
            >
              {lang === "zh" ? `确认支付 · ¥${discounted}` : `Confirm · ¥${discounted}`}
            </button>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.24em] text-stone-warm/30">
              {lang === "zh"
                ? "这是演示结算 —— 真实支付网关将在正式版接入。"
                : "Demo checkout — real payment gateway to be wired in production."}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



function AIFollowupModal({
  open,
  onClose,
  lang,
  plan,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  plan: "free" | "sage" | "oracle";
  onUpgrade: () => void;
}) {
  const { t } = useLang();
  const { account, saved } = useAccount();
  const isOracle = plan === "oracle";
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<{ role: "user" | "oracle"; text: string }[]>([]);
  const [thinking, setThinking] = useState(false);

  // Enlarged prompt pool — random subset with a "refresh" button.
  const PROMPT_POOL: [string, string][] = [
    ["我这两年适合创业还是继续在大公司积累？请结合我的命盘。", "Should I start something of my own in the next two years, or keep compounding inside a large company — based on my chart?"],
    ["我的感情模式里最需要注意的盲区是什么？如何避免重复？", "What is the biggest blind spot in my relationship pattern, and how do I stop it from repeating?"],
    ["未来12个月里最值得抓住的时间窗口具体是哪些？", "Which specific time windows in the next 12 months are worth prioritizing?"],
    ["我的财富最容易积累的方式是被动收入还是主动收入？", "Given my chart, is my wealth more likely to compound through active or passive income?"],
    ["我和父母的关系里，命盘想让我先修复什么？", "In my relationship with my parents, what does the chart want me to repair first?"],
    ["如果我现在感觉停滞，应该向内修还是向外动？", "If I feel stuck right now, should I turn inward or outward?"],
    ["我此生的核心使命方向是什么？如何在下一步落地？", "What is the core mission of this life — and how do I take the next step?"],
    ["我最适合的合作者是什么样的性格与命盘组合？", "What kind of temperament and chart makes the best collaborator for me?"],
    ["我的健康在未来两年最需要照看的是哪一部分？", "Which part of my health most needs care over the next two years?"],
    ["我天生最容易低估自己的哪一项天赋？", "Which of my innate gifts am I most likely to underestimate?"],
    ["婚姻或长期关系最可能在哪个年龄段稳定下来？", "Around which age is a long-term partnership most likely to settle?"],
    ["有没有一个我一直在回避、但命盘反复提醒的功课？", "Is there a lesson I keep avoiding that the chart keeps circling back to?"],
    ["我做重大决定时，应该更信任直觉还是分析？", "When making big decisions, should I trust intuition or analysis more?"],
    ["我的原生家庭对成年后的哪一部分影响最深？", "Which part of my adult life is most shaped by my family of origin?"],
    ["未来三年最不该错过的一个「转弯」是哪个？", "Which single pivot in the next three years should I not miss?"],
  ];
  const li = lang === "zh" ? 0 : 1;

  // Refreshable random 4-prompt sample.
  const [promptSeed, setPromptSeed] = useState(0);
  const prompts = useMemo(() => {
    const arr = [...PROMPT_POOL];
    // Fisher–Yates with a lightweight seed so "refresh" gives a new set.
    let s = (Date.now() + promptSeed * 9301) >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptSeed, open]);

  // Reset conversation when re-opened.
  useEffect(() => {
    if (open) {
      setThread([]);
      setInput("");
    }
  }, [open]);

  const reading = saved[0];
  const buildChartSnapshot = () => {
    if (!reading) return {};
    const seed = `${reading.name || ""}|${reading.date || ""}|${reading.time || ""}|${reading.place || ""}`;
    return {
      name: reading.name || account?.name,
      astrology: `Birth ${reading.date ?? "?"} ${reading.time ?? ""} @ ${reading.place ?? "?"}. Seed=${seed}`,
      jyotish: "Sidereal Moon-anchored — Vimśottarī Dashā keyed to Moon's Nakshatra.",
      bazi: `Four pillars derived from ${reading.date ?? "?"} ${reading.time ?? ""}; year pillar per 立春.`,
      ziwei: "Palace of Self derived from lunar month + hour branch (approximation).",
    };
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setThread((tr) => [...tr, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    try {
      const { askOracle } = await import("@/lib/oracle.functions");
      const res = await askOracle({
        data: { question: q, lang, chart: buildChartSnapshot() },
      });
      setThread((tr) => [...tr, { role: "oracle", text: res.text || "…" }]);
    } catch (err) {
      console.error("Oracle call failed", err);
      const fallback =
        lang === "zh"
          ? `图书馆的信号今晚不太稳定 —— 请稍后再问。\n\n（若持续发生，可能是本次配额已用尽或网络中断。）`
          : `The library's signal is unsteady tonight — please try again in a moment.\n\n(If this persists, the quota may be exhausted or the network broken.)`;
      setThread((tr) => [...tr, { role: "oracle", text: fallback }]);
    } finally {
      setThinking(false);
    }
  };

  // Typewriter reveal for oracle messages so the reply feels like handwriting.
  const [reveal, setReveal] = useState<Record<number, number>>({});
  useEffect(() => {
    const idx = thread.length - 1;
    if (idx < 0) return;
    const m = thread[idx];
    if (m.role !== "oracle") return;
    if (reveal[idx] != null && reveal[idx] >= m.text.length) return;
    let i = reveal[idx] ?? 0;
    const total = m.text.length;
    const id = setInterval(() => {
      i = Math.min(total, i + 4);
      setReveal((r) => ({ ...r, [idx]: i }));
      if (i >= total) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.length]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#0a0705]"
          onClick={onClose}
        >
          {/* Ambient library scene */}
          <div className="pointer-events-none absolute inset-0">
            {/* Warm candle glow behind the elder */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.55, 0.75, 0.55] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-1/2 top-[18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,163,72,0.35),rgba(212,163,72,0.08)_45%,transparent_70%)] blur-2xl"
            />
            {/* Bookshelf silhouette */}
            <svg
              aria-hidden
              viewBox="0 0 1200 800"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full opacity-[0.28]"
            >
              <defs>
                <linearGradient id="shelf" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#3a2a17" />
                  <stop offset="1" stopColor="#0a0705" />
                </linearGradient>
              </defs>
              {Array.from({ length: 6 }).map((_, row) => (
                <g key={row} transform={`translate(0 ${80 + row * 110})`}>
                  <rect x="0" y="70" width="1200" height="6" fill="#5b3d1e" opacity="0.6" />
                  {Array.from({ length: 40 }).map((__, i) => {
                    const h = 40 + ((i * 37 + row * 11) % 30);
                    const w = 12 + ((i * 13 + row * 7) % 10);
                    const hue = 25 + ((i + row) % 6) * 6;
                    return (
                      <rect
                        key={i}
                        x={10 + i * 30}
                        y={70 - h}
                        width={w}
                        height={h}
                        fill={`hsl(${hue} 40% ${14 + ((i + row) % 5) * 3}%)`}
                        stroke="#000"
                        strokeOpacity="0.4"
                      />
                    );
                  })}
                </g>
              ))}
            </svg>
            {/* Floating dust motes */}
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.span
                key={i}
                aria-hidden
                initial={{ opacity: 0, y: 0 }}
                animate={{
                  opacity: [0, 0.7, 0],
                  y: [0, -60 - (i % 6) * 20, -140],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 4), 0],
                }}
                transition={{ duration: 8 + (i % 5), repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                className="absolute block size-[3px] rounded-full bg-gold-light/70"
                style={{ left: `${(i * 53) % 100}%`, top: `${30 + (i * 17) % 60}%` }}
              />
            ))}
            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]" />
          </div>

          {/* Foreground panel */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 mx-auto flex h-full max-h-[100dvh] w-full max-w-3xl flex-col px-3 pb-[env(safe-area-inset-bottom)] pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-6 sm:pt-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with elder + close */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Elder silhouette */}
                <motion.div
                  aria-hidden
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-gold-dust/40 bg-gradient-to-b from-gold-dust/25 to-obsidian/60 sm:size-16"
                >
                  <svg viewBox="0 0 64 64" className="size-10 sm:size-12">
                    {/* Hooded elder */}
                    <path d="M12 60 C 14 40, 22 30, 32 30 C 42 30, 50 40, 52 60 Z" fill="#2a1a0c" stroke="#d4a348" strokeOpacity="0.6" />
                    <ellipse cx="32" cy="26" rx="10" ry="12" fill="#e9c88a" opacity="0.85" />
                    <path d="M22 22 C 24 12, 40 12, 42 22 L 42 28 C 40 22, 24 22, 22 28 Z" fill="#2a1a0c" />
                    {/* Beard */}
                    <path d="M25 32 Q 32 46 39 32 Q 36 40 32 42 Q 28 40 25 32 Z" fill="#f0e2c2" opacity="0.9" />
                    {/* Eyes */}
                    <circle cx="28.5" cy="27" r="0.9" fill="#0a0705" />
                    <circle cx="35.5" cy="27" r="0.9" fill="#0a0705" />
                  </svg>
                  {/* Candle flicker halo */}
                  <motion.span
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-gold-dust/40"
                  />
                </motion.div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {lang === "zh" ? "神谕图书馆" : "The Oracle's Library"}
                  </p>
                  <h3 className="font-serif text-lg italic text-stone-warm sm:text-2xl">
                    {lang === "zh" ? "向长者提问" : "Ask the Elder"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={lang === "zh" ? "关闭" : "Close"}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-obsidian/70 px-2.5 text-[10px] uppercase tracking-[0.24em] text-stone-warm/70 backdrop-blur transition-colors hover:border-gold-dust/50 hover:text-gold-dust sm:px-3 sm:tracking-[0.28em]"
              >
                <span aria-hidden className="text-base leading-none">×</span>
                <span className="hidden sm:inline">{t.mem_close}</span>
              </button>
            </div>

            {/* Conversation scroll */}
            <div className="mt-3 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 sm:mt-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] p-4 text-sm italic text-stone-warm/85"
              >
                {lang === "zh"
                  ? "「孩子，坐下。烛火还在。你的太阳落火象、日主为阳火 —— 想追问哪一维度？」"
                  : "\u201CChild, sit. The candle still burns. Your Sun rests in Fire, your Day Master is Yang Fire — which thread shall we pull?\u201D"}
              </motion.div>

              {thread.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                      {lang === "zh" ? "从卷轴中挑一题 · 点击即问" : "Pick a scroll · tap to ask"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPromptSeed((s) => s + 1)}
                      className="rounded-full border border-gold-dust/30 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/80 transition hover:border-gold-dust hover:bg-gold-dust/10"
                    >
                      {lang === "zh" ? "换一批 ↻" : "Refresh ↻"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {prompts.map((p, i) => (
                      <motion.button
                        key={p[0]}
                        type="button"
                        disabled={!isOracle}
                        onClick={() => send(p[li])}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55 + i * 0.06 }}
                        whileHover={{ x: 2 }}
                        className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-stone-warm/80 transition hover:border-gold-dust/40 hover:bg-gold-dust/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="mr-2 text-gold-dust/70">§</span>
                        {p[li]}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {thread.map((m, i) => {
                const shown =
                  m.role === "oracle" ? m.text.slice(0, reveal[i] ?? 0) : m.text;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`rounded-2xl border p-4 text-sm leading-relaxed backdrop-blur-sm ${
                      m.role === "user"
                        ? "ml-8 border-gold-dust/30 bg-gold-dust/[0.10] text-stone-warm/95"
                        : "mr-8 border-gold-dust/20 bg-[#1a1108]/70 text-stone-warm/85"
                    }`}
                  >
                    <p className="mb-1 text-[9px] uppercase tracking-[0.32em] text-gold-dust/70">
                      {m.role === "user"
                        ? lang === "zh" ? "你" : "You"
                        : lang === "zh" ? "长者" : "The Elder"}
                    </p>
                    <p className={`whitespace-pre-line ${m.role === "oracle" ? "font-serif italic" : ""}`}>
                      {shown}
                      {m.role === "oracle" && shown.length < m.text.length && (
                        <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-gold-dust align-middle" />
                      )}
                    </p>
                  </motion.div>
                );
              })}
              {thinking && (
                <motion.p
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="text-[11px] uppercase tracking-[0.32em] text-gold-dust/70"
                >
                  {lang === "zh" ? "长者正在翻阅古卷…" : "The elder turns an old page…"}
                </motion.p>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (isOracle) send(input); }}
              className="mt-3 flex items-center gap-2 rounded-full border border-gold-dust/20 bg-obsidian/80 px-3 py-2 backdrop-blur sm:mt-4 sm:px-4"
            >
              <span aria-hidden className="text-gold-dust/60">✒</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!isOracle}
                placeholder={isOracle ? t.mem_ai_placeholder : (lang === "zh" ? "升级神谕者后可提问…" : "Upgrade to Oracle to ask…")}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-stone-warm outline-none placeholder:text-stone-warm/30 disabled:cursor-not-allowed sm:text-sm"
              />
              <button
                type="submit"
                disabled={!isOracle || !input.trim() || thinking}
                className="shrink-0 rounded-full bg-gold-dust px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-obsidian transition-colors hover:bg-gold-light disabled:bg-gold-dust/40 disabled:text-obsidian/50 sm:px-4 sm:tracking-[0.28em]"
              >
                {t.mem_ai_send}
              </button>
            </form>

            {!isOracle && (
              <div className="mt-3 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-4 backdrop-blur">
                <p className="mb-3 font-serif text-sm italic leading-relaxed text-stone-warm/85">
                  {t.mem_ai_upsell}
                </p>
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="w-full rounded-full bg-gold-dust px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
                >
                  {t.mem_upgrade} → {t.mem_oracle}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



/* ═══════════════════════════════════════════
   Synastry preview — 合盘 (Oracle member perk)
═══════════════════════════════════════════ */

type Tradition = {
  tag: [string, string];
  title: [string, string];
  body: [string, string];
  score: number;
};

function TraditionDiagram({ tag }: { tag: string }) {
  // Lightweight, stylised diagrams so each tradition has a recognisable
  // "big picture" when the user zooms in. All decorative — real engines
  // would replace these with authentic charts.
  const size = 320;
  const c = size / 2;
  if (tag.startsWith("Western")) {
    // Circular zodiac with 12 divisions
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={c} cy={c} r={c - 8} fill="none" stroke="var(--gold-dust)" strokeOpacity={0.35} />
        <circle cx={c} cy={c} r={c - 46} fill="none" stroke="var(--gold-dust)" strokeOpacity={0.2} />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          const x1 = c + Math.cos(a) * (c - 46);
          const y1 = c + Math.sin(a) * (c - 46);
          const x2 = c + Math.cos(a) * (c - 8);
          const y2 = c + Math.sin(a) * (c - 8);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--gold-dust)" strokeOpacity={0.25} />;
        })}
        {["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"].map((g, i) => {
          const a = ((i * 30 + 15 - 90) * Math.PI) / 180;
          const r = c - 26;
          return (
            <text key={g} x={c + Math.cos(a) * r} y={c + Math.sin(a) * r + 6}
              textAnchor="middle" fontSize="18" fill="var(--gold-light)">{g}</text>
          );
        })}
        {[0, 3, 5, 8].map((i, k) => {
          const a = ((i * 30 + 15 - 90) * Math.PI) / 180;
          const x = c + Math.cos(a) * (c - 70);
          const y = c + Math.sin(a) * (c - 70);
          return <circle key={k} cx={x} cy={y} r={5} fill="var(--gold-light)" />;
        })}
      </svg>
    );
  }
  if (tag.startsWith("Vedic")) {
    // North-Indian diamond kundali
    const s = size;
    return (
      <svg viewBox={`0 0 ${s} ${s}`} width={s} height={s}>
        <rect x={12} y={12} width={s - 24} height={s - 24} fill="none" stroke="var(--gold-dust)" strokeOpacity={0.5} />
        <line x1={12} y1={12} x2={s - 12} y2={s - 12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={s - 12} y1={12} x2={12} y2={s - 12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={c} y1={12} x2={s - 12} y2={c} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={s - 12} y1={c} x2={c} y2={s - 12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={c} y1={s - 12} x2={12} y2={c} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={12} y1={c} x2={c} y2={12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        {["1","2","3","4","5","6","7","8","9","10","11","12"].map((n, i) => {
          const positions = [
            [c, 40],[s - 60, 40],[s - 40, c],[s - 60, s - 40],
            [c, s - 40],[60, s - 40],[40, c],[60, 40],
            [c - 60, c - 40],[c + 60, c - 40],[c + 60, c + 40],[c - 60, c + 40],
          ][i];
          return (
            <text key={n} x={positions[0]} y={positions[1]} textAnchor="middle"
              fontSize="14" fill="var(--gold-light)" opacity={0.75}>{n}</text>
          );
        })}
      </svg>
    );
  }
  if (tag.startsWith("BaZi")) {
    // Four Pillars grid
    const cols = ["年","月","日","时"];
    const rows = ["天干","地支","藏干","十神"];
    const cw = (size - 20) / 4;
    const rh = (size - 40) / 4;
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {cols.map((col, i) => (
          <text key={col} x={10 + cw * (i + 0.5)} y={22} textAnchor="middle"
            fontSize="14" fill="var(--gold-dust)">{col}</text>
        ))}
        {rows.map((row, r) =>
          cols.map((_, i) => (
            <g key={`${r}-${i}`}>
              <rect x={10 + cw * i} y={30 + rh * r} width={cw - 4} height={rh - 4}
                fill="none" stroke="var(--gold-dust)" strokeOpacity={0.35} />
              <text x={10 + cw * (i + 0.5)} y={30 + rh * (r + 0.5) + 6} textAnchor="middle"
                fontSize="13" fill="var(--stone-warm)" opacity={0.85}>
                {["甲乙丙丁戊己庚辛壬癸"[(i * 3 + r) % 10],
                  "子丑寅卯辰巳午未申酉戌亥"[(i * 5 + r * 2) % 12],
                  "藏","印"][r] ?? ""}
              </text>
            </g>
          )),
        )}
        <text x={c} y={size - 6} textAnchor="middle" fontSize="10"
          fill="var(--stone-warm)" opacity={0.5}>示意 · 非真实排盘</text>
      </svg>
    );
  }
  // Ziwei 12-palace square
  const palaces = ["命宫","兄弟","夫妻","子女","财帛","疾厄","迁移","奴仆","官禄","田宅","福德","父母"];
  const cw = (size - 20) / 4;
  const rh = (size - 20) / 4;
  const layout = [
    [3, 0],[3, 1],[3, 2],[3, 3],
    [2, 3],[1, 3],[0, 3],
    [0, 2],[0, 1],[0, 0],
    [1, 0],[2, 0],
  ];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {layout.map(([col, row], i) => (
        <g key={palaces[i]}>
          <rect x={10 + cw * col} y={10 + rh * row} width={cw - 4} height={rh - 4}
            fill="none" stroke="var(--gold-dust)" strokeOpacity={0.35} />
          <text x={10 + cw * (col + 0.5)} y={10 + rh * (row + 0.5) + 6} textAnchor="middle"
            fontSize="13" fill="var(--gold-light)">{palaces[i]}</text>
        </g>
      ))}
      <text x={c} y={c} textAnchor="middle" fontSize="12" fill="var(--stone-warm)" opacity={0.55}>紫微斗数 · 十二宫</text>
    </svg>
  );
}

function TraditionCard({
  tr,
  li,
  lang,
}: {
  tr: Tradition;
  li: 0 | 1;
  lang: Lang;
}) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.28em] text-gold-dust/70">
          {tr.tag[li]}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gold-dust/30 px-2 py-0.5 text-[9px] text-gold-light">
            {tr.score}
          </span>
          <button
            onClick={() => setZoom(true)}
            className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-stone-warm/60 transition-colors hover:border-gold-dust/50 hover:text-gold-light"
            aria-label={lang === "zh" ? "放大查看" : "Enlarge"}
          >
            {lang === "zh" ? "⤢ 放大" : "⤢ Enlarge"}
          </button>
        </div>
      </div>
      <p className="mb-1 font-serif text-sm italic text-stone-warm">{tr.title[li]}</p>
      <p className="text-[12px] leading-relaxed text-stone-warm/65">{tr.body[li]}</p>

      <ChartZoomModal
        open={zoom}
        onClose={() => setZoom(false)}
        title={tr.tag[li]}
        subtitle={tr.title[li]}
      >
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex justify-center text-stone-warm/50">
            <TraditionDiagram tag={tr.tag[0]} />
          </div>
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {lang === "zh" ? "契合度" : "Compatibility"} · {tr.score}
            </p>
            <p className="mb-4 text-sm leading-relaxed text-stone-warm/85">{tr.body[li]}</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
              {lang === "zh"
                ? "图示为示意版式，仅供理解体系结构 · 精算需接入专业排盘引擎"
                : "Diagram is stylised — for structural understanding only. Precise readings require a professional engine."}
            </p>
          </div>
        </div>
      </ChartZoomModal>
    </div>
  );
}

export function SynastryPreview({ userBirthISO }: { userBirthISO?: string } = {}) {
  const { lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const [partner, setPartner] = useState({ name: "", date: "", time: "", place: "" });
  const [revealed, setRevealed] = useState(false);

  // Deterministic pseudo-score — now blends BOTH birth dates so the reading
  // is personal to the visitor, not just to the partner they typed in.
  const score = useMemo(() => {
    if (!revealed || !partner.date) return null;
    let h = 2166136261 >>> 0;
    const combo = (userBirthISO || "0000-00-00") + "|" + partner.date + "|" + partner.name;
    for (let i = 0; i < combo.length; i++) {
      h ^= combo.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return 62 + (h % 32); // 62–93
  }, [revealed, partner.date, partner.name, userBirthISO]);

  const axes: { label: [string, string]; value: number }[] = useMemo(() => {
    if (score == null) return [];
    const seed = score;
    const jitter = (i: number) => ((seed * 9301 + i * 49297) % 233280) / 233280;
    return [
      { label: ["Emotional resonance", "情感共振"], value: Math.round(55 + jitter(1) * 40) },
      { label: ["Communication rhythm", "沟通节奏"], value: Math.round(50 + jitter(2) * 45) },
      { label: ["Values & long-term fit", "价值观与长期契合"], value: Math.round(45 + jitter(3) * 50) },
      { label: ["Physical / sensual pull", "身体与感官吸引"], value: Math.round(50 + jitter(4) * 40) },
      { label: ["Growth catalyst", "成长催化"], value: Math.round(50 + jitter(5) * 45) },
    ];
  }, [score]);

  const verdict = (score ?? 0) >= 85
    ? ["Rare alignment · a partnership the chart wants you to protect.", "罕见的对齐 —— 命盘希望你保护的关系。"]
    : (score ?? 0) >= 72
      ? ["Warm, workable · differences that teach rather than tear.", "温暖可行 —— 差异用来教导，而非撕裂。"]
      : ["Chemistry present, calibration needed · agree on rhythm before agreeing on future.", "有化学反应，但需校准 —— 先约好节奏，再谈未来。"];

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "会员合盘 · 关系分析" : "Oracle Synastry · Relationship reading"}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {lang === "zh" ? "两张命盘的对话" : "A dialogue between two charts"}
        </h2>
        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">
          {lang === "zh"
            ? "输入对方的出生资料，图书馆会把两张命盘叠合，读出你们之间真正的和声与噪音 —— 而不是浪漫化的猜测。"
            : "Enter your partner's birth data. The library overlays both charts and reads the real harmony — and the real noise — between you, not romanticized guesses."}
        </p>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="ritual-input !text-base"
            placeholder={lang === "zh" ? "对方姓名" : "Partner's name"}
            value={partner.name}
            onChange={(e) => setPartner((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="ritual-input !text-base"
            type="date"
            min="1900-01-01"
            max="2099-12-31"
            value={partner.date}
            onChange={(e) => {
              let val = e.target.value;
              const m = val.match(/^(\d+)(-\d{2}-\d{2})?$/);
              if (m && m[1].length > 4) val = m[1].slice(0, 4) + (m[2] || "");
              setPartner((p) => ({ ...p, date: val }));
            }}
            style={{ colorScheme: "dark" }}
          />
          <input
            className="ritual-input !text-base"
            type="time"
            value={partner.time}
            onChange={(e) => setPartner((p) => ({ ...p, time: e.target.value }))}
            style={{ colorScheme: "dark" }}
          />
          <input
            className="ritual-input !text-base"
            placeholder={lang === "zh" ? "出生地点" : "Birthplace"}
            value={partner.place}
            onChange={(e) => setPartner((p) => ({ ...p, place: e.target.value }))}
          />
        </div>

        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={!partner.date}
          className="rounded-full bg-gold-dust px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-40"
        >
          {lang === "zh" ? "叠合两盘" : "Overlay the charts"}
        </button>

        {score != null && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-8 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-6 md:p-8"
          >
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
              <p className="font-serif text-lg italic text-stone-warm/80">
                {lang === "zh" ? "整体契合度" : "Overall resonance"}
              </p>
              <p className="font-serif text-5xl italic text-gold-light">{score}<span className="text-xl text-stone-warm/50">/100</span></p>
            </div>
            <div className="space-y-3">
              {axes.map((a) => (
                <div key={a.label[0]}>
                  <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
                    <span>{a.label[li]}</span>
                    <span className="text-gold-dust">{a.value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${a.value}%` }}
                      transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-gold-dust via-gold-light to-nebula-purple"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 font-serif text-lg italic leading-relaxed text-stone-warm/85">
              {verdict[li]}
            </p>

            {/* Four-tradition breakdown */}
            <div className="mt-8 border-t border-gold-dust/20 pt-6">
              <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {lang === "zh" ? "四种传统 · 四个角度" : "Four traditions · four angles"}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(() => {
                  const j = (n: number) => Math.round(45 + ((score * 1000 + n * 997) % 45));
                  const traditions: {
                    tag: [string, string];
                    title: [string, string];
                    body: [string, string];
                    score: number;
                  }[] = [
                    {
                      tag: ["Western Astrology", "西方星盘"],
                      title: ["Chart-to-chart aspects", "两盘相位对话"],
                      body: [
                        "Sun–Moon midpoints sit within a soft trine — the day-to-day emotional weather aligns more than it clashes; friction lives in the Mars–Venus square, mostly about pace of intimacy.",
                        "太阳—月亮中点落于柔和三分相 —— 日常情绪同频多于对撞；摩擦来自火星—金星四分相，主要是「亲密节奏」的差异。",
                      ],
                      score: j(1),
                    },
                    {
                      tag: ["Vedic / Jyotish", "印度占星"],
                      title: ["Kuta compatibility · Nakshatra fit", "Kuta 契合 · 二十七宿"],
                      body: [
                        "Ashtakoot-style score points to strong Bhakoot and Nadi channels — the karmic thread is long, though the Gana axis warns of temperament mismatches under stress.",
                        "八项契合（Ashtakoot）中 Bhakoot 与 Nadi 通道良好 —— 因缘线较长；但 Gana 轴提示：压力下的性情差异需要留意。",
                      ],
                      score: j(2),
                    },
                    {
                      tag: ["BaZi 八字", "八字合婚"],
                      title: ["Day-master resonance · Ten Gods", "日主呼应 · 十神关系"],
                      body: [
                        "Day-masters form a partial 合 (union) with light 冲 in the branch — the pair helps each other's Useful God, but a shared 忌神 in the month pillar flags recurring money-topic arguments.",
                        "两方日主见「合」并微「冲」—— 彼此可扶用神；但月柱有共同忌神，暗示围绕「钱」的话题反复出现分歧。",
                      ],
                      score: j(3),
                    },
                    {
                      tag: ["Zi Wei 紫微斗数", "紫微斗数"],
                      title: ["Palace overlay · Star transfers", "宫位叠合 · 星曜互飞"],
                      body: [
                        "Your 夫妻宫 receives their 命宫 主星 — a deep pull toward long-form partnership; but 化忌 lands in 财帛宫, so joint decisions about money and property will be the recurring test.",
                        "对方命宫主星飞入你的夫妻宫 —— 长期伴侣式的深度拉力；化忌落在财帛宫，因此关于「共同金钱与财产」的决定会是反复出现的考验。",
                      ],
                      score: j(4),
                    },
                  ];
                  return traditions.map((tr) => (
                    <TraditionCard key={tr.tag[0]} tr={tr} li={li} lang={lang} />
                  ));
                })()}
              </div>
            </div>

            {/* Recent-relationship read */}
            <div className="mt-6 rounded-2xl border border-nebula-purple/30 bg-nebula-purple/[0.08] p-5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {lang === "zh" ? "最近这段关系 · 现况解读" : "Recent state of the bond"}
              </p>
              <ul className="space-y-2 text-sm text-stone-warm/80">
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "近 30 天基调：" : "Last 30 days · tone: "}
                  </span>
                  {lang === "zh"
                    ? "沟通密度较前 90 天上升，但深度略降 —— 更多「日常报备」，更少「真心话」。"
                    : "Contact frequency rose vs. the prior 90 days, but depth dipped — more logistics, fewer core conversations."}
                </li>
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "情绪流向：" : "Emotional flow: "}
                  </span>
                  {lang === "zh"
                    ? "你付出较多情绪劳动，对方处于「回应模式」而非「主动模式」；不是不在意，是节奏差异。"
                    : "You're carrying more emotional labour; they're in response-mode rather than initiator-mode — not disengagement, a rhythm gap."}
                </li>
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "关键节点：" : "Key inflection: "}
                  </span>
                  {lang === "zh"
                    ? "未来 2–3 周会出现一次「小误会 / 小承诺」，处理得当会成为信任跃迁点。"
                    : "A small misunderstanding or small promise will surface in the next 2–3 weeks — handled well, it becomes a trust jump."}
                </li>
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "建议动作：" : "Suggested move: "}
                  </span>
                  {lang === "zh"
                    ? "主动发起一次不为「解决问题」的对话 —— 只交换感受，不做决策。"
                    : "Initiate one conversation that isn't about solving anything — exchange feelings, defer decisions."}
                </li>
              </ul>
              <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                {lang === "zh" ? "以上仅供参考，请以真实相处为准。" : "For reference only — trust lived experience."}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Recent windows — the next 90 days, personal state
═══════════════════════════════════════════ */

export function RecentWindows({ birthISO }: { birthISO?: string }) {
  const { lang } = useLang();
  const li = lang === "zh" ? 1 : 0;

  // Deterministic per-user rotation of windows.
  const seed = useMemo(() => {
    const base = (birthISO ?? "0000-00-00") + new Date().toISOString().slice(0, 10);
    let h = 0;
    for (const c of base) h = (h * 33 + c.charCodeAt(0)) >>> 0;
    return h;
  }, [birthISO]);

  const fmt = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
  };

  const windows = [
    {
      range: `${fmt(0)} — ${fmt(6)}`,
      tone: ["Signal week", "信号周"] as [string, string],
      body: [
        "Mercury and your Day-Master both talk this week — expect a message, a callback, or a small decision that ripples further than it looks.",
        "水星与日主本周都在发言 —— 会有一条消息、一次回电、或一个看似小的决定，其涟漪比表面更远。",
      ] as [string, string],
      score: 55 + (seed % 30),
    },
    {
      range: `${fmt(7)} — ${fmt(20)}`,
      tone: ["Rest before push", "先歇后进"] as [string, string],
      body: [
        "Energy dips mid-window then rebounds. Protect sleep now; the second half is when doors respond to knocks.",
        "本窗口中段能量下沉，后段回弹。前半段护住睡眠；后半段，你敲的门才会有回应。",
      ] as [string, string],
      score: 45 + ((seed >> 3) % 30),
    },
    {
      range: `${fmt(21)} — ${fmt(45)}`,
      tone: ["Wealth channel opens", "财路开通"] as [string, string],
      body: [
        "A small but real income or opportunity signal. Not a lottery — a channel that rewards a message you've been avoiding sending.",
        "会有一个小而真实的收入或机会信号。不是彩票 —— 而是一条你一直不愿发送的消息，被打开后的回报。",
      ] as [string, string],
      score: 65 + ((seed >> 5) % 25),
    },
    {
      range: `${fmt(46)} — ${fmt(90)}`,
      tone: ["Relationship recalibration", "关系再校准"] as [string, string],
      body: [
        "A conversation you've postponed becomes unavoidable. Handled well, it deepens trust; postponed further, it hardens into resentment.",
        "一段你一直拖延的对话，会变得无法回避。处理得当，信任加深；再拖，就会硬化成怨。",
      ] as [string, string],
      score: 50 + ((seed >> 7) % 30),
    },
  ];

  const stateScore = 45 + (seed % 40);
  const bars: { label: [string, string]; value: number }[] = [
    { label: ["Vitality 元气", "元气"], value: 40 + ((seed >> 2) % 55) },
    { label: ["Focus 专注", "专注"], value: 40 + ((seed >> 4) % 55) },
    { label: ["Mood 情绪", "情绪"], value: 40 + ((seed >> 6) % 55) },
    { label: ["Luck window 运气窗口", "运气窗口"], value: 40 + ((seed >> 8) % 55) },
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "会员近况 · 最近的时间节点与状态" : "Oracle Now · Near-term windows & personal state"}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {lang === "zh" ? "接下来的 90 天，命盘在说什么" : "What the chart is saying, next 90 days"}
        </h2>
        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">
          {lang === "zh"
            ? "四个近期窗口 + 你此刻的四条状态曲线 —— 每天不必再问「今天适不适合」，直接看窗口。"
            : "Four near-term windows and four live state bars — stop asking daily whether today is auspicious; read the window instead."}
        </p>

        <div className="mb-8 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-serif text-lg italic text-stone-warm/85">
              {lang === "zh" ? "此刻状态指数" : "Personal state index"}
            </p>
            <p className="font-serif text-4xl italic text-gold-light">
              {stateScore}<span className="text-base text-stone-warm/50">/100</span>
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {bars.map((b) => (
              <div key={b.label[0]}>
                <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
                  <span>{b.label[li]}</span>
                  <span className="text-gold-dust">{b.value}</span>
                </div>
                <div className="h-1 rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.value}%` }}
                    transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-nebula-purple via-gold-dust to-gold-light"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ol className="relative space-y-4 border-l border-gold-dust/30 pl-6">
          {windows.map((w) => (
            <li key={w.range} className="relative">
              <span className="absolute -left-[29px] top-2 size-2.5 rounded-full bg-gold-dust shadow-[0_0_12px_hsl(45_70%_60%/0.6)]" />
              <div className="rounded-2xl border border-gold-dust/20 bg-white/[0.02] p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">{w.range}</p>
                  <span className="rounded-full border border-gold-dust/30 px-3 py-0.5 text-[9px] uppercase tracking-[0.28em] text-gold-light">
                    {w.tone[li]} · {w.score}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-stone-warm/75">{w.body[li]}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Detailed four-dimension guidance */}
        <div className="mt-10">
          <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
            {lang === "zh" ? "四大维度 · 分点提醒" : "Four life dimensions · pointed guidance"}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(() => {
              const dims: {
                icon: string;
                title: [string, string];
                points: [string, string][];
                cautions: [string, string][];
                mitigations: [string, string][];
              }[] = [
                {
                  icon: "◈",
                  title: ["Career 事业", "事业"],
                  points: [
                    ["Signal week (Days 1–6) — respond fast to inbound messages; a late reply now costs a slot later.", "信号周（第 1–6 天）—— 对主动找来的信息尽快回应；此时的迟回，往后会失去一个位子。"],
                    ["A negotiation window opens around Day 25–35 — prepare numbers, not emotion.", "第 25–35 天出现谈判窗口 —— 准备数字，不是情绪。"],
                    ["Public-facing move (pitch/interview/launch) best placed Day 46–65.", "对外展示（提案 / 面试 / 上线）最佳窗口在第 46–65 天。"],
                  ],
                  cautions: [
                    ["Avoid signing multi-year commitments in the mid-window energy dip (Day 10–18).", "第 10–18 天能量低谷期，避免签署多年期承诺。"],
                    ["Don't argue over Slack/WeChat; misread tone triggers a small-but-lasting rupture.", "别在即时消息中争论；此期语气容易误读，会留下小而持久的裂痕。"],
                  ],
                  mitigations: [
                    ["Draft, then wait 12h before sending anything with financial stakes.", "涉及金钱的内容，写完先搁置 12 小时再发送。"],
                    ["Book one buffer day per week — used for cleanup, not new commitments.", "每周留一天缓冲日 —— 用来收尾，不接新承诺。"],
                  ],
                },
                {
                  icon: "✎",
                  title: ["Study 学业", "学业"],
                  points: [
                    ["Retention is sharper in the first 20 days — front-load memorization / core concepts here.", "前 20 天记忆更清晰 —— 把背诵与核心概念放在前段。"],
                    ["Day 21–45 favours synthesis: essays, coding projects, revision of frameworks.", "第 21–45 天利于综合：写作、项目、框架复盘。"],
                    ["Day 60+ is a good window to seek feedback from a mentor or peer group.", "第 60 天后适合主动寻求导师或同伴反馈。"],
                  ],
                  cautions: [
                    ["Avoid switching study methods mid-window — the chart favours consistency now.", "本季不宜频繁更换学习方法 —— 命盘偏爱稳定。"],
                    ["Late-night marathon sessions after Day 40 will silently erode focus for a week after.", "第 40 天后的熬夜冲刺，会在其后一周悄悄侵蚀专注力。"],
                  ],
                  mitigations: [
                    ["Fixed 90-min blocks + 20-min walk beats variable-length sprints for this window.", "本窗口内，「90 分钟固定 + 20 分钟散步」优于「不定长冲刺」。"],
                    ["Weekly one-page written recap; unwritten knowledge doesn't stick this season.", "每周一页手写复盘；本季未落笔的知识不易内化。"],
                  ],
                },
                {
                  icon: "❥",
                  title: ["Love 爱情", "爱情"],
                  points: [
                    ["Existing bonds: a postponed conversation becomes unavoidable around Day 46–70.", "既有关系：第 46–70 天，一次拖延的对话变得不可回避。"],
                    ["Single: a real (non-lightning) connection appears via a shared-interest context, not apps.", "单身：真正的连结（非闪电式）出现在共同兴趣场景，而非软件。"],
                    ["Physical warmth and small rituals matter more than grand statements this season.", "本季，身体温度与小仪式，比宏大宣言更重要。"],
                  ],
                  cautions: [
                    ["Don't restart with an old ex during Day 7–20 nostalgia dip — it's memory, not signal.", "第 7–20 天的怀旧低谷中，避免与旧人重启 —— 那是记忆，不是信号。"],
                    ["Avoid confessing during the mid-window emotional trough; wait for the rebound.", "情绪中段低谷，不宜表白；等回弹再说。"],
                  ],
                  mitigations: [
                    ["Name feelings without demanding decisions — one honest 5-min talk beats a 2-hour spiral.", "只命名感受，不索取决定 —— 一次 5 分钟的诚实，胜过 2 小时的绕圈。"],
                    ["Screen new interests against 3 concrete behaviours, not vibes.", "用 3 条具体行为检验新对象，而非「感觉」。"],
                  ],
                },
                {
                  icon: "✦",
                  title: ["Health 健康", "健康"],
                  points: [
                    ["Vitality peaks in the last window (Day 60+) — reserve one physical challenge for it.", "元气在最后一个窗口（第 60 天后）到达峰值 —— 把一次身体挑战留到那时。"],
                    ["Sleep architecture matters more than sleep length this season.", "本季，睡眠结构比睡眠长度更重要。"],
                    ["Digestive system is the weak link now — the chart flags stomach / liver signals.", "消化系统是当前的薄弱环节 —— 命盘提示肠胃 / 肝气讯号。"],
                  ],
                  cautions: [
                    ["Avoid new stimulants (strong caffeine, extreme cuts) during Day 10–25.", "第 10–25 天，避免新的刺激物（浓咖啡 / 极端节食）。"],
                    ["Ignoring a small recurring pain now compounds into a Day 60+ setback.", "现在忽视一处反复的小痛，会在第 60 天后放大成阻碍。"],
                  ],
                  mitigations: [
                    ["Fixed sleep window (±30 min) protects mood, focus, and skin this season.", "固定睡眠窗口（前后 30 分钟内），本季能同时护住情绪、专注与皮肤。"],
                    ["One warm meal per day + a 20-min walk after dinner — small, non-negotiable.", "每日一顿温热正餐 + 饭后 20 分钟步行 —— 小而不可让步。"],
                  ],
                },
              ];
              return dims.map((d) => (
                <div
                  key={d.title[0]}
                  className="rounded-2xl border border-gold-dust/20 bg-white/[0.02] p-5"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-lg text-gold-light">{d.icon}</span>
                    <p className="font-serif text-lg italic text-stone-warm">{d.title[li]}</p>
                  </div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                    {lang === "zh" ? "关键提示" : "Key signals"}
                  </p>
                  <ul className="mb-3 space-y-1.5 text-[13px] leading-relaxed text-stone-warm/75">
                    {d.points.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-gold-dust/70">·</span>
                        <span>{p[li]}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-nebula-purple/80">
                    {lang === "zh" ? "注意事项" : "Cautions"}
                  </p>
                  <ul className="mb-3 space-y-1.5 text-[13px] leading-relaxed text-stone-warm/70">
                    {d.cautions.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-nebula-purple/80">△</span>
                        <span>{p[li]}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-gold-light/80">
                    {lang === "zh" ? "规避方式" : "Mitigations"}
                  </p>
                  <ul className="space-y-1.5 text-[13px] leading-relaxed text-stone-warm/70">
                    {d.mitigations.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-gold-light/80">✓</span>
                        <span>{p[li]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ));
            })()}
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
            {lang === "zh" ? "以上均为命盘趋势参考 · 请结合自身判断" : "Trend reference only · combine with your own judgement"}
          </p>
        </div>
      </div>
    </section>
  );
}
