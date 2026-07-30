import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

import treeImg from "@/assets/tree-of-destiny.jpg";
import { TraditionModal, type TraditionId } from "@/components/TraditionModal";
import { useLang } from "@/lib/i18n";
import "./traditions-page.css";

export const Route = createFileRoute("/traditions")({
  head: () => ({
    meta: [
      { title: "The Four Traditions · 四大传统 — Library of Destiny" },
      {
        name: "description",
        content:
          "A scholarly primer on the four traditions the library reads together: Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu. 图书馆同时诵读的四大体系：西方占星、印度占星、八字与紫微斗数。",
      },
      { property: "og:title", content: "The Four Traditions · 四大传统" },
      {
        property: "og:description",
        content: "Western Astrology · Vedic Jyotish · BaZi · Zi Wei Dou Shu.",
      },
      { property: "og:url", content: "https://fate-nexus-ai.lovable.app/traditions" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "The Four Traditions · 四大传统" },
      { name: "twitter:description", content: "Western Astrology · Vedic Jyotish · BaZi · Zi Wei Dou Shu." },
    ],
    links: [{ rel: "canonical", href: "https://fate-nexus-ai.lovable.app/traditions" }],
  }),
  component: TraditionsPage,
});

type Bi = [string, string]; // [en, zh]

type Chapter = {
  numeral: string;
  elderId: TraditionId;
  title: Bi;
  subtitle: Bi;
  origin: Bi;
  essay: Bi;
  concepts: { name: Bi; gloss: Bi }[];
  canon: Bi[];
  reveals: Bi[];
};

const chapters: Chapter[] = [
  {
    numeral: "I",
    elderId: "astrology",
    title: ["Western Astrology", "西方占星"],
    subtitle: ["The dialogue between psyche and sky", "灵魂与星空的对话"],
    origin: [
      "From Babylonian observation through Hellenistic geometry, refined in the twentieth century by Jungian depth psychology.",
      "从巴比伦的观测，经希腊化时期的几何化整理，到二十世纪由荣格深度心理学再次精炼。",
    ],
    essay: [
      "Western astrology treats the natal chart as a psychological architecture — a snapshot of the sky at the moment of first breath. Planets carry archetypal functions, houses locate them inside a life, and aspects describe the tension or harmony between them. Modern practice reads this less as prediction than as a map of temperament, motive and unfolding development.",
      "西方占星把出生盘视为一份心理结构 —— 你第一次呼吸时天空的定格。行星承载原型功能，宫位标示它们落在人生的哪一处，相位描述其间的张力与和声。现代实践与其说是预测，不如说是一张关于性情、动机与生长脉络的地图。",
    ],
    concepts: [
      { name: ["The Sun", "太阳"], gloss: ["essential self, will", "本质自我 · 意志"] },
      { name: ["The Moon", "月亮"], gloss: ["inner life, feeling", "内在生活 · 情感"] },
      { name: ["The Ascendant", "上升"], gloss: ["the mask of arrival", "登场时的面具"] },
      { name: ["The Ten Planets", "十大行星"], gloss: ["psychic functions", "十种心理功能"] },
      { name: ["Twelve Houses", "十二宫位"], gloss: ["life domains", "人生的十二个领域"] },
      { name: ["Aspects", "相位"], gloss: ["planetary conversation", "行星之间的对话"] },
    ],
    canon: [
      ["Tetrabiblos — Claudius Ptolemy", "《四书》 · 托勒密"],
      ["The Inner Sky — Steven Forrest", "《内在天空》 · 史蒂文·福雷斯特"],
      ["Parker's Astrology — Julia & Derek Parker", "《帕克占星学》 · 帕克夫妇"],
      ["Astrology for the Soul — Jan Spiller", "《为灵魂而读的占星》 · 简·斯皮勒"],
    ],
    reveals: [
      ["Character architecture", "性格结构"],
      ["Emotional patterning", "情感模式"],
      ["Relational grammar", "关系的语法"],
      ["Life themes and lessons", "人生主题与功课"],
    ],
  },
  {
    numeral: "II",
    elderId: "jyotish",
    title: ["Jyotish", "印度占星 · Jyotish"],
    subtitle: ["The science of light — India's Vedic astrology", "光的科学 —— 印度吠陀占星"],
    origin: [
      "Rooted in the Vedas, refined by classical treatises over two millennia, still practiced continuously today.",
      "根植于吠陀经典，经两千余年的古典典籍精炼，至今仍在被持续实践。",
    ],
    essay: [
      "Jyotish emphasises karma — the ripening of past causes — and gives an unusually granular treatment of time. Twenty-seven Nakshatras (lunar mansions) divide the ecliptic, and layered Dasha cycles reveal when the seeds of a chart are set to bloom. Jyotish is famous for its precision in timing marriage, vocation, wealth and spiritual awakening.",
      "Jyotish 强调「业」的成熟 —— 前因结果 —— 并以异常精细的方式处理时间。二十七宿（Nakshatra）划分黄道，层层叠叠的 Dasha 大运告诉你命盘中的种子何时开花。它以判断婚姻、事业、财富与灵性觉醒的时机之精确而著称。",
    ],
    concepts: [
      { name: ["Lagna", "Lagna 上升"], gloss: ["rising sign — vehicle of the soul", "灵魂的载具"] },
      { name: ["Grahas", "九曜 Graha"], gloss: ["the nine seizers (planets)", "九个「持取者」（行星）"] },
      { name: ["Nakshatras", "二十七宿"], gloss: ["27 lunar mansions", "月的二十七所居所"] },
      { name: ["Bhavas", "十二宫 Bhāva"], gloss: ["twelve life-fields", "十二个人生领域"] },
      { name: ["Dasha", "大运 Daśā"], gloss: ["planetary time-lord periods", "行星主管的时段"] },
      { name: ["Gochar", "行运 Gochar"], gloss: ["current transits", "当下行运"] },
    ],
    canon: [
      ["Brihat Parashara Hora Shastra", "《大帕拉萨拉何拉论》"],
      ["Jataka Parijata", "《生辰珠花》 Jātaka Pārijāta"],
      ["Phaladeepika", "《果报明灯》 Phaladīpikā"],
      ["Saravali", "《精粹环》 Sārāvalī"],
    ],
    reveals: [
      ["Karmic timing", "业力的时序"],
      ["Life mission", "此生的使命"],
      ["Marriage and partnership", "婚姻与伴侣"],
      ["Wealth and spiritual growth", "财富与灵性成长"],
    ],
  },
  {
    numeral: "III",
    elderId: "bazi",
    title: ["BaZi — 八字", "八字 · 四柱"],
    subtitle: ["The Four Pillars of Destiny", "命运的四柱"],
    origin: [
      "A Chinese system distilled from Yin-Yang cosmology and the Five Elements, formalised through the Tang and Song dynasties.",
      "自阴阳宇宙观与五行学说提炼而成的中国体系，于唐宋之间定型。",
    ],
    essay: [
      "BaZi translates the moment of birth into eight characters — one Heavenly Stem and one Earthly Branch for the year, month, day and hour. The resulting formula reveals the balance of Wood, Fire, Earth, Metal and Water in a person, the strength of the Ten Gods around the Day Master, and the Great Luck cycles that carry a life forward one decade at a time.",
      "八字把出生的一刻化为八个字 —— 年月日时各一天干、一地支。由此得出的公式，揭示一个人身上木火土金水的平衡、日主周围「十神」的强弱，以及以十年为一步、推动一生前行的「大运」。",
    ],
    concepts: [
      { name: ["天干", "十天干"], gloss: ["ten Heavenly Stems", "十个天干"] },
      { name: ["地支", "十二地支"], gloss: ["twelve Earthly Branches", "十二个地支"] },
      { name: ["五行", "五行"], gloss: ["five elements in dynamic flow", "五种动态流转的元素"] },
      { name: ["十神", "十神"], gloss: ["the Ten Gods around Day Master", "围绕日主的十种角色"] },
      { name: ["格局", "格局"], gloss: ["the chart's structural pattern", "命局的结构形态"] },
      { name: ["大运", "大运"], gloss: ["ten-year Great Luck cycles", "十年一步的运程"] },
    ],
    canon: [
      ["滴天髓 · The Drops of Heavenly Essence", "《滴天髓》"],
      ["穷通宝鉴 · Qiong Tong Bao Jian", "《穷通宝鉴》"],
      ["三命通会 · The Complete Guide to Three Fates", "《三命通会》"],
      ["渊海子平 · Yuan Hai Zi Ping", "《渊海子平》"],
    ],
    reveals: [
      ["Elemental temperament", "五行性情"],
      ["Career and wealth capacity", "事业与财富格局"],
      ["Marriage timing", "婚期"],
      ["Health tendencies and cycles", "身体倾向与周期"],
    ],
  },
  {
    numeral: "IV",
    elderId: "ziwei",
    title: ["Zi Wei Dou Shu — 紫微斗数", "紫微斗数"],
    subtitle: ["The Purple Star Astrology of the Chinese imperium", "中华帝国的紫微星占"],
    origin: [
      "Traditionally attributed to the Song-dynasty sage Chen Xiyi. Reserved for centuries as an imperial system of destiny.",
      "相传源于宋代高士陈希夷，数百年间作为宫廷所秘藏的命运体系。",
    ],
    essay: [
      "Zi Wei arranges a life across twelve palaces — Self, Wealth, Career, Marriage, Children, Migration and more — and populates them with fourteen major stars led by the Emperor Star, Zi Wei. Four Transformations (化禄, 化权, 化科, 化忌) shift the reading across decades and years, producing an unusually detailed map of the shape of a life.",
      "紫微斗数将一生铺陈在十二宫中 —— 命、财帛、官禄、夫妻、子女、迁移……—— 并以「紫微」为首的十四主星安放其中。四化（化禄、化权、化科、化忌）在大限与流年之间流转，形成一张异常精细的人生地图。",
    ],
    concepts: [
      { name: ["命宫", "命宫"], gloss: ["Palace of Self", "自我之宫"] },
      { name: ["身宫", "身宫"], gloss: ["Palace of Body — later life", "后半生的着力点"] },
      { name: ["十四主星", "十四主星"], gloss: ["the fourteen major stars", "十四颗主星"] },
      { name: ["辅星", "辅星"], gloss: ["auxiliary and minor stars", "辅曜与杂曜"] },
      { name: ["四化", "四化"], gloss: ["four transformations", "禄权科忌四化"] },
      { name: ["大限 · 流年", "大限 · 流年"], gloss: ["great limits and annual flows", "大限与流年"] },
    ],
    canon: [
      ["紫微斗数全书", "《紫微斗数全书》"],
      ["斗数宣微", "《斗数宣微》"],
      ["紫微斗数全集", "《紫微斗数全集》"],
    ],
    reveals: [
      ["Overall life pattern", "整体命局"],
      ["Career and wealth structure", "事业与财富格局"],
      ["Marriage and children", "婚姻与子女"],
      ["Migration, health, siblings", "迁移 · 疾厄 · 兄弟"],
    ],
  },
];

const HEADER = {
  kicker: ["The Archive", "档案室"] as Bi,
  h1a: ["Four ", "四种"] as Bi,
  h1b: ["languages", "语言"] as Bi,
  h1c: [",", "，"] as Bi,
  h1d: ["for the same silence", "同一片沉默"] as Bi,
  lead: [
    "Each of the four traditions is a self-contained cosmology, developed over centuries with its own canonical texts. The library holds them side by side so their answers can converse.",
    "四大传统各自是一个自洽的宇宙观，经数百年沉淀，各有其经典。图书馆将它们并列诵读，让四种回答彼此对话。",
  ] as Bi,
  origin: ["Origin", "源流"] as Bi,
  concepts: ["Core concepts", "核心概念"] as Bi,
  canon: ["Canonical texts", "经典文本"] as Bi,
  reveals: ["What it reveals", "所揭示的"] as Bi,
  footer: ["The library reads all four — ", "图书馆同时诵读四家 —— "] as Bi,
  footerEm: ["at once.", "在同一时刻。"] as Bi,
  cta: ["Begin the ritual", "开始仪式"] as Bi,
};

// ─────────── Focus comparison (moved off the homepage) ───────────
type FocusRow = {
  key: "character" | "vocation" | "wealth" | "love" | "health" | "family" | "mission";
  focus: {
    astrology: Bi;
    jyotish: Bi;
    bazi: Bi;
    ziwei: Bi;
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

function FocusComparison() {
  const { lang, t } = useLang();
  const li: 0 | 1 = lang === "zh" ? 1 : 0;
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
        <p className="mx-auto mt-4 max-w-xl text-sm text-stone-warm/75">{t.focus_hint}</p>
      </div>
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
            <span
              aria-hidden
              className={`mr-2 inline-block h-1.5 w-1.5 rounded-full bg-gold-dust ${active === k ? "trad-pulse" : "opacity-40"}`}
            />
            {dimLabels[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AnimatePresence mode="popLayout" initial={false}>
          {cards.map((c, i) => (
            <motion.div
              key={`${active}-${c.key}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.32, 0.72, 0, 1] }}
              className="trad-panel trad-hover group flex h-full flex-col p-6"
            >
              <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                {c.label}
              </p>
              <p className="font-serif text-base leading-relaxed text-stone-warm">{c.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function TraditionsPage() {
  const { lang, t } = useLang();
  const li: 0 | 1 = lang === "zh" ? 1 : 0;
  const [openTradition, setOpenTradition] = useState<TraditionId | null>(null);

  return (
    <div className="pt-32 pb-32">
      {/* Header */}
      <header className="trad-head mx-auto max-w-4xl px-5 py-10 text-center sm:px-8 md:px-12 md:py-12">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {HEADER.kicker[li]}
        </p>
        <h1 className="trad-h1 mb-6 font-serif text-stone-warm">
          <span className="trad-h1-line">
            {HEADER.h1a[li]}
            {HEADER.h1b[li]}
            {HEADER.h1c[li]}
          </span>
          <span className="trad-h1-line">{HEADER.h1d[li]}</span>
        </h1>
        <p className="mx-auto max-w-2xl text-balance font-light text-stone-warm/85">
          {HEADER.lead[li]}
        </p>
      </header>

      <div className="h-16" />

      {/* Four Pillars — moved from homepage */}
      <section id="four-pillars" className="mx-auto max-w-6xl px-6 pb-16 md:px-12">
        <p className="mb-3 text-center text-[10px] uppercase tracking-[0.4em] text-gold-dust">
          {t.pillars_kicker}
        </p>
        <h2 className="trad-h2-hero mx-auto mb-12 max-w-3xl text-center font-serif text-stone-warm">
          <span className="trad-h1-line">{t.pillars_title_a}</span>
          <span className="trad-h1-line">{t.pillars_title_em}</span>
        </h2>
      </section>

      {/* Chapters */}
      <div className="mx-auto max-w-6xl space-y-32 px-6 md:px-12">
        {chapters.map((c) => (
          <motion.article
            key={c.numeral}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
            className="grid grid-cols-1"
          >
            <div className="trad-copy trad-glass p-6 md:p-9">



              <p className="mb-4 font-serif text-2xl italic text-gold-dust">{c.numeral}.</p>
              <h2 className="mb-3 font-serif text-4xl text-stone-warm md:text-5xl">{c.title[li]}</h2>
              <p className="mb-8 text-sm uppercase tracking-[0.3em] text-stone-warm/70">
                {c.subtitle[li]}
              </p>
              <p className="mb-6 text-sm italic text-stone-warm/85">
                <span className="mr-2 not-italic text-gold-dust">{HEADER.origin[li]} —</span>
                {c.origin[li]}
              </p>
              <p className="mb-10 max-w-[62ch] text-base leading-relaxed text-stone-warm">
                {c.essay[li]}
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {HEADER.concepts[li]}
                  </p>
                  <ul className="space-y-2 text-sm text-stone-warm/85">
                    {c.concepts.map((cc) => (
                      <li
                        key={cc.name[0]}
                        className="trad-row flex justify-between gap-6 border-b border-white/10 pb-2"
                      >
                        <span className="font-serif text-gold-light">{cc.name[li]}</span>
                        <span className="text-right text-stone-warm/70">{cc.gloss[li]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {HEADER.canon[li]}
                  </p>
                  <ul className="mb-8 space-y-2 text-sm italic text-stone-warm/85">
                    {c.canon.map((k) => (
                      <li key={k[0]}>· {k[li]}</li>
                    ))}
                  </ul>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {HEADER.reveals[li]}
                  </p>
                  <ul className="space-y-1 text-sm text-stone-warm/85">
                    {c.reveals.map((r) => (
                      <li key={r[0]}>— {r[li]}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpenTradition(c.elderId)}
                className="group/cta mt-10 inline-flex items-center gap-2 rounded-full border border-gold-dust/40 px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-all hover:border-gold-dust hover:bg-gold-dust/10 hover:shadow-[0_0_24px_rgba(198,161,87,0.25)]"
              >
                {lang === "zh" ? "请这位长老开口" : "Consult this elder"}
                <span className="text-sm transition-transform duration-300 group-hover/cta:translate-x-1">→</span>
              </button>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Same question, four instruments — moved from homepage */}
      <FocusComparison />

      {/* AI synthesis showcase — moved from homepage */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:px-12">
        <div className="trad-panel overflow-hidden rounded-[2.5rem]">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 md:p-16">
              <p className="mb-6 text-[10px] font-medium uppercase tracking-[0.42em] text-gold-dust">
                {t.show_kicker}
              </p>
              <h3 className="mb-8 font-serif text-4xl italic leading-tight text-stone-warm md:text-5xl">
                {t.show_title}
              </h3>
              <p className="mb-10 text-base font-light leading-relaxed text-stone-warm/85 md:text-lg">
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
                alt="The Tree of Destiny"
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

      {/* Eight dimensions preview — moved from homepage */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16 md:px-12">
        <div className="mb-10 text-center">
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
              className="trad-panel trad-tile flex h-24 cursor-default items-center justify-center px-4 text-center text-sm uppercase tracking-[0.28em] text-stone-warm/85"
            >
              {d}
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto mt-24 max-w-3xl px-6 text-center">
        <h3 className="mb-8 font-serif text-3xl italic text-stone-warm md:text-4xl">
          {HEADER.footer[li]}
          <span className="gold-gradient-text">{HEADER.footerEm[li]}</span>
        </h3>
        <Link
          to="/ritual"
          className="inline-flex rounded-full bg-gold-dust px-10 py-4 text-xs font-medium uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
        >
          {HEADER.cta[li]}
        </Link>
      </div>

      <TraditionModal id={openTradition} onClose={() => setOpenTradition(null)} />
    </div>
  );
}
