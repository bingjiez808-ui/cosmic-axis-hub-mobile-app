import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

import astrologyImg from "@/assets/tradition-astrology.jpg";
import jyotishImg from "@/assets/tradition-jyotish.jpg";
import baziImg from "@/assets/tradition-bazi.jpg";
import ziweiImg from "@/assets/tradition-ziwei.jpg";
import treeImg from "@/assets/tree-of-destiny.jpg";
import { TraditionModal, type TraditionId } from "@/components/TraditionModal";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://fate-nexus-ai.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://fate-nexus-ai.lovable.app/" }],
  }),
  component: LandingPage,
});

const traditions = [
  {
    id: "astrology",
    title: "Astrology",
    subtitle: "Western · Hellenistic",
    citation: "TETRABIBLOS · PTOLEMY",
    blurb:
      "The dialogue between the psyche and the stars — archetypes read through planets, houses and aspects.",
    image: astrologyImg,
    tone: "from-gold-dust/20",
  },
  {
    id: "jyotish",
    title: "Jyotish",
    subtitle: "Vedic · India",
    citation: "BRIHAT PARASHARA HORA SHASTRA",
    blurb:
      "The science of light. Karmic timing decoded through the twenty-seven Nakshatras and the Dasha cycles.",
    image: jyotishImg,
    tone: "from-nebula-purple/25",
  },
  {
    id: "bazi",
    title: "Four Pillars",
    subtitle: "BaZi · China 八字",
    citation: "滴天髓 · 渊海子平",
    blurb:
      "Eight characters, five elements. A molecular formula of Yin, Yang and seasonal flow across a lifetime.",
    image: baziImg,
    tone: "from-gold-dust/25",
  },
  {
    id: "ziwei",
    title: "Purple Star",
    subtitle: "Zi Wei Dou Shu · 紫微斗数",
    citation: "紫微斗数全书",
    blurb:
      "The imperial map. Twelve palaces, fourteen major stars, and four transformations tracing your destiny.",
    image: ziweiImg,
    tone: "from-nebula-purple/20",
  },
];


// Focus comparison — how each tradition approaches the same life dimension.
type FocusRow = {
  key: "character" | "vocation" | "wealth" | "love" | "health" | "family" | "mission";
  focus: {
    astrology: [string, string];
    jyotish: [string, string];
    bazi: [string, string];
    ziwei: [string, string];
  };
};

const focusData: FocusRow[] = [
  {
    key: "character",
    focus: {
      astrology: [
        "Reads temperament as a dialogue between Sun, Moon and Ascendant — psychological archetypes.",
        "以太阳、月亮与上升的对话读性格 —— 心理原型的语言。",
      ],
      jyotish: [
        "Sees personality through the Moon's Nakshatra — the karmic imprint of this lifetime.",
        "从月亮的 Nakshatra 读性格 —— 此生的业力印记。",
      ],
      bazi: [
        "Distills character as the Day Master and the balance of five elements around it.",
        "以日主与其周围五行的平衡，提炼一个人的本质。",
      ],
      ziwei: [
        "Fixes the self in the 命宫 (Palace of Self) — the star seated there governs your grain.",
        "以命宫定人 —— 坐守命宫的主星，决定你的底色。",
      ],
    },
  },
  {
    key: "vocation",
    focus: {
      astrology: [
        "The 10th house and its ruler describe how you meet the world in work.",
        "第十宫与其主星，描绘你在事业中面对世界的姿态。",
      ],
      jyotish: [
        "Strongest in career timing — Dashā cycles show when a vocation ripens.",
        "在时机上最擅长 —— Dashā 大运告诉你何时功成。",
      ],
      bazi: [
        "The Officer, Wealth and Output stars measure suitability for leadership or craft.",
        "官星、财星、食伤，衡量你适合领导、执行还是创造。",
      ],
      ziwei: [
        "The 官禄宫 (Career Palace) is unusually detailed — down to the flavour of the role.",
        "官禄宫极为细致 —— 甚至能读出岗位的气质。",
      ],
    },
  },
  {
    key: "wealth",
    focus: {
      astrology: [
        "The 2nd and 8th houses read your own resources vs. resources through others.",
        "第二宫与第八宫，读你自己的资源与他人给你的资源。",
      ],
      jyotish: [
        "Dhana Yogas — combinations of wealth-lords — are the classical strength here.",
        "以 Dhana Yoga（财富组合）著称，是此系的经典强项。",
      ],
      bazi: [
        "Wealth stars 正财 / 偏财 and their roots reveal earning shape and stability.",
        "以正财、偏财及其根气，读收入形态与稳定度。",
      ],
      ziwei: [
        "The 财帛宫 shows how you earn; the 田宅宫 shows what you keep.",
        "财帛宫看进账，田宅宫看留存。",
      ],
    },
  },
  {
    key: "love",
    focus: {
      astrology: [
        "Venus, Mars, and the 7th house draw the shape of desire and partnership.",
        "金星、火星与第七宫，勾勒欲望与伴侣关系的形状。",
      ],
      jyotish: [
        "The 7th lord, Venus and Jupiter time marriage with unusual precision.",
        "七宫主、金星与木星，能相当精准地判断婚期。",
      ],
      bazi: [
        "The spouse palace and hidden stems reveal partner traits and compatibility.",
        "夫妻宫与藏干，透露伴侣的样子与合婚气场。",
      ],
      ziwei: [
        "The 夫妻宫 with its main stars and 四化 draws marriage as a story arc.",
        "夫妻宫的主星与四化，把婚姻画成一条剧情弧线。",
      ],
    },
  },
  {
    key: "health",
    focus: {
      astrology: [
        "The 6th house and Ascendant ruler mark stress patterns and body constitution.",
        "第六宫与命主星，标记压力模式与身体底子。",
      ],
      jyotish: [
        "Reads dosha, chronic tendencies, and karmic health cycles through the 6th and 8th.",
        "从六宫、八宫读体质、慢性倾向与业力健康周期。",
      ],
      bazi: [
        "Five-element imbalance (excess Fire, weak Water…) predicts organ tendencies.",
        "五行偏枯（火旺、水弱…）预示脏腑倾向。",
      ],
      ziwei: [
        "The 疾厄宫 flags susceptible body zones and stress signatures.",
        "疾厄宫标出易感的身体部位与压力印记。",
      ],
    },
  },
  {
    key: "family",
    focus: {
      astrology: [
        "The 4th house and Moon read your roots — the family climate that shaped you.",
        "第四宫与月亮 —— 读你的根系，塑造你的家庭气候。",
      ],
      jyotish: [
        "Chandra (Moon), Matru-karaka and the 4th bhava layer mother, home and inner soil.",
        "月亮、母亲卡拉卡与第四宫，层层叠出母亲、家园与内在土壤。",
      ],
      bazi: [
        "The year and month pillars record ancestry; 印星 (Resource stars) show how parents nourish or press.",
        "年柱与月柱记录祖脉；印星揭示父母如何滋养或压制你。",
      ],
      ziwei: [
        "The 父母宫 and 田宅宫 draw parents, home and the shape of family destiny.",
        "父母宫与田宅宫 —— 描绘父母、家庭与家宅的命运轮廓。",
      ],
    },
  },
  {
    key: "mission",
    focus: {
      astrology: [
        "The lunar nodes trace the karmic direction of the soul in this lifetime.",
        "南北交点，描绘此生灵魂的业力方向。",
      ],
      jyotish: [
        "Dharma houses (1, 5, 9) and Rahu-Ketu reveal your purpose axis.",
        "达摩三宫（1/5/9）与 Rahu-Ketu，读你的使命轴线。",
      ],
      bazi: [
        "The 用神 (favourable element) is the north star of what your life is for.",
        "以「用神」为北极星，指出这一生的用力方向。",
      ],
      ziwei: [
        "命宫 + 迁移宫 + 福德宫 together stage your mission across contexts.",
        "命宫、迁移宫与福德宫三位一体，铺陈使命的舞台。",
      ],
    },
  },
];

function HeroLanguageChooser() {
  const { lang, setLang, t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.4 }}
      className="relative z-10 mb-10 flex flex-col items-center gap-3"
    >
      <p className="text-[10px] uppercase tracking-[0.42em] text-stone-warm/40">
        {t.hero_lang_kicker}
      </p>
      <div className="glass-card flex items-center gap-1 rounded-full p-1">
        {(["en", "zh"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`rounded-full px-5 py-2 font-serif text-sm italic transition-colors ${
              lang === l
                ? "bg-gold-dust/15 text-gold-light"
                : "text-stone-warm/60 hover:text-gold-dust"
            }`}
          >
            {l === "en" ? t.hero_lang_en : t.hero_lang_zh}
          </button>
        ))}
      </div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/30">
        {t.hero_lang_prompt} {lang === "en" ? t.hero_lang_en : t.hero_lang_zh}
      </p>
    </motion.div>
  );
}

function FocusComparison() {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const [active, setActive] = useState<FocusRow["key"]>("character");
  const row = focusData.find((r) => r.key === active)!;

  const dimLabels: Record<FocusRow["key"], string> = {
    character: t.focus_dim_character,
    vocation: t.focus_dim_vocation,
    wealth: t.focus_dim_wealth,
    love: t.focus_dim_love,
    health: t.focus_dim_health,
    family: t.focus_dim_family,
    mission: t.focus_dim_mission,
  };

  const cards = [
    { key: "astrology", label: t.four_traditions[0], text: row.focus.astrology[li] },
    { key: "jyotish", label: t.four_traditions[1], text: row.focus.jyotish[li] },
    { key: "bazi", label: t.four_traditions[2], text: row.focus.bazi[li] },
    { key: "ziwei", label: t.four_traditions[3], text: row.focus.ziwei[li] },
  ];

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12">
      <div className="mb-10 text-center">
        <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
          {t.focus_kicker}
        </p>
        <h3 className="font-serif text-4xl leading-tight text-stone-warm md:text-5xl">
          {t.focus_title}
          <span className="italic gold-gradient-text">{t.focus_title_em}</span>
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-sm text-stone-warm/50">{t.focus_hint}</p>
      </div>

      {/* Dimension tabs */}
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {(Object.keys(dimLabels) as FocusRow["key"][]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setActive(k)}
            className={`rounded-full border px-5 py-2 text-[11px] uppercase tracking-[0.28em] transition-all ${
              active === k
                ? "border-gold-dust bg-gold-dust/10 text-gold-light"
                : "border-white/10 text-stone-warm/60 hover:border-gold-dust/40 hover:text-gold-dust"
            }`}
          >
            {dimLabels[k]}
          </button>
        ))}
      </div>

      {/* Four focus cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {cards.map((c, i) => (
            <motion.div
              key={`${active}-${c.key}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
              className="glass-card group flex h-full flex-col rounded-2xl p-6"
            >
              <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                {c.label}
              </p>
              <p className="font-serif text-base leading-relaxed text-stone-warm/85">
                {c.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function LandingPage() {
  const { t } = useLang();
  const [openTradition, setOpenTradition] = useState<TraditionId | null>(null);
  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-24 text-center">
        <div className="pointer-events-none absolute h-[820px] w-[820px] rounded-full border border-white/5 animate-slow-rotate" />
        <div className="pointer-events-none absolute h-[600px] w-[600px] rounded-full border border-gold-dust/10 animate-slow-rotate-reverse" />
        <div className="pointer-events-none absolute h-[380px] w-[380px] rounded-full border border-nebula-purple/20 animate-slow-rotate" />

        <HeroLanguageChooser />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
          className="relative z-10 mb-8 text-[11px] font-light uppercase tracking-[0.42em] text-gold-dust"
        >
          {t.hero_kicker}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="relative z-10 max-w-5xl font-serif text-fluid-hero text-stone-warm"
        >
          {t.hero_h1_a}
          <br />
          <span className="italic gold-gradient-text">{t.hero_h1_b}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.9 }}
          className="relative z-10 mt-10 font-serif text-xl italic text-stone-warm/60 md:text-2xl"
        >
          {t.hero_quote}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 1.1 }}
          className="relative z-10 mt-4 max-w-2xl px-2 text-sm leading-relaxed text-stone-warm/55 md:mt-6 md:text-base"
        >
          {t.hero_subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="relative z-10 mt-10 md:mt-14"
        >
          <Link
            to="/ritual"
            className="group relative inline-flex overflow-hidden rounded-full border border-gold-dust/40 bg-obsidian/80 px-10 py-4 backdrop-blur-sm transition-colors hover:border-gold-dust md:px-12 md:py-5"
          >
            <span className="relative z-10 text-xs font-medium uppercase tracking-[0.32em] text-gold-dust">
              {t.hero_cta}
            </span>
            <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
          </Link>
        </motion.div>


        <div className="absolute bottom-10 flex flex-col items-center">
          <div className="h-16 w-px bg-gradient-to-b from-transparent to-gold-dust/50" />
          <span className="mt-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
            {t.hero_scroll}
          </span>
        </div>
      </section>

      {/* ─────────── PHILOSOPHY BRIDGE ─────────── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-32 text-center">
        <p className="font-serif text-2xl leading-relaxed text-stone-warm/70 md:text-3xl">
          {t.philosophy_a} <span className="italic text-gold-light">{t.philosophy_em}</span>
        </p>
      </section>

      {/* ─────────── FOUR TRADITIONS ─────────── */}
      <section id="traditions" className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:px-12">
        <div className="mb-16 flex items-end justify-between">
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
              {t.pillars_kicker}
            </p>
            <h2 className="max-w-2xl font-serif text-4xl leading-tight text-stone-warm md:text-5xl">
              {t.pillars_title_a}<span className="italic">{t.pillars_title_em}</span>
            </h2>
          </div>
          <Link
            to="/traditions"
            className="hidden text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:text-gold-dust md:block"
          >
            {t.pillars_archive}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {traditions.map((tr, i) => (
            <motion.button
              key={tr.id}
              type="button"
              onClick={() => setOpenTradition(tr.id as TraditionId)}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: [0.32, 0.72, 0, 1] }}
              className={`glass-card group relative flex h-[520px] cursor-pointer flex-col overflow-hidden rounded-3xl p-6 text-left transition-colors duration-700 hover:border-gold-dust/40 focus:outline-none focus-visible:border-gold-dust ${i % 2 === 1 ? "lg:mt-12" : ""}`}
              aria-label={`Open ${tr.title} details`}
            >
              <div className="mb-6 aspect-square overflow-hidden rounded-2xl bg-white/5">
                <img
                  src={tr.image}
                  alt={`${tr.title} diagram`}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="h-full w-full object-cover transition-transform duration-[1400ms] group-hover:scale-110"
                />
              </div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-gold-dust/80">
                {tr.subtitle}
              </p>
              <h3 className="mb-3 font-serif text-2xl text-stone-warm">{tr.title}</h3>
              <p className="text-sm font-light leading-relaxed text-stone-warm/60">{tr.blurb}</p>
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className="text-[10px] uppercase tracking-[0.28em] text-gold-dust/50">
                  {tr.citation}
                </span>
                <div className="grid size-8 place-items-center rounded-full border border-white/10 text-stone-warm/60 transition-colors group-hover:border-gold-dust group-hover:text-gold-dust">
                  →
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ─────────── FOCUS COMPARISON ─────────── */}
      <FocusComparison />

      {/* ─────────── AI SYNTHESIS SHOWCASE ─────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-32 md:px-12">
        <div className="glass-card overflow-hidden rounded-[2.5rem]">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 md:p-16">
              <p className="mb-6 text-[10px] font-medium uppercase tracking-[0.42em] text-gold-dust">
                {t.show_kicker}
              </p>
              <h3 className="mb-8 font-serif text-4xl italic leading-tight text-stone-warm md:text-5xl">
                {t.show_title}
              </h3>
              <p className="mb-10 text-base font-light leading-relaxed text-stone-warm/60 md:text-lg">
                {t.show_body}
              </p>
              <ul className="space-y-4 text-sm text-stone-warm/80">
                {[t.show_b1, t.show_b2, t.show_b3, t.show_b4].map((line) => (
                  <li key={line} className="flex items-center gap-4">
                    <span className="size-1.5 rounded-full bg-gold-dust" />
                    {line}
                  </li>
                ))}
              </ul>
              <Link
                to="/ritual"
                className="mt-12 inline-flex rounded-full bg-gold-dust px-8 py-3 text-xs font-medium uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
              >
                {t.show_cta}
              </Link>
            </div>
            <div className="relative border-l border-white/5 bg-void-blue/40">
              <img
                src={treeImg}
                alt="The Tree of Destiny — a glowing tree of light representing the AI synthesis of four traditions"
                loading="lazy"
                width={1280}
                height={1280}
                className="h-full min-h-[420px] w-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-transparent to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 text-center">
                <p className="text-[10px] uppercase tracking-[0.4em] text-gold-dust/70">
                  {t.show_tree}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── DIMENSIONS PREVIEW ─────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12">
        <div className="mb-12 text-center">
          <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
            {t.dims_kicker}
          </p>
          <h3 className="font-serif text-3xl italic text-stone-warm md:text-4xl">
            {t.dims_title}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {t.dims_list.map((d) => (
            <div
              key={d}
              className="glass-card group flex h-24 items-center justify-center rounded-2xl px-4 text-center text-sm uppercase tracking-[0.28em] text-stone-warm/70 transition-colors hover:border-gold-dust/40 hover:text-gold-dust"
            >
              {d}
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── CTA ─────────── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-32 text-center">
        <h2 className="mb-8 font-serif text-4xl italic leading-tight text-stone-warm md:text-6xl">
          {t.cta_a}<br /><span className="gold-gradient-text">{t.cta_em}</span>
        </h2>
        <p className="mx-auto mb-12 max-w-xl font-light text-stone-warm/60">
          {t.cta_body}
        </p>
        <Link
          to="/ritual"
          className="group inline-flex overflow-hidden rounded-full border border-gold-dust/30 px-12 py-5 transition-colors hover:border-gold-dust"
        >
          <span className="relative z-10 text-xs font-medium uppercase tracking-[0.32em] text-gold-dust">
            {t.cta_btn}
          </span>
        </Link>
      </section>

      <TraditionModal id={openTradition} onClose={() => setOpenTradition(null)} />
    </>
  );
}

