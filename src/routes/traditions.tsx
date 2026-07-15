import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";

import astrologyImg from "@/assets/tradition-astrology.jpg";
import jyotishImg from "@/assets/tradition-jyotish.jpg";
import baziImg from "@/assets/tradition-bazi.jpg";
import ziweiImg from "@/assets/tradition-ziwei.jpg";
import { TraditionModal, type TraditionId } from "@/components/TraditionModal";
import { useLang } from "@/lib/i18n";

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
    ],
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
  image: string;
};

const chapters: Chapter[] = [
  {
    numeral: "I",
    elderId: "astrology",
    title: ["Western Astrology", "西方占星"],
    subtitle: [
      "The dialogue between psyche and sky",
      "灵魂与星空的对话",
    ],
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
    image: astrologyImg,
  },
  {
    numeral: "II",
    elderId: "jyotish",
    title: ["Jyotish", "印度占星 · Jyotish"],
    subtitle: [
      "The science of light — India's Vedic astrology",
      "光的科学 —— 印度吠陀占星",
    ],
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
    image: jyotishImg,
  },
  {
    numeral: "III",
    elderId: "bazi",
    title: ["BaZi — 八字", "八字 · 四柱"],
    subtitle: [
      "The Four Pillars of Destiny",
      "命运的四柱",
    ],
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
    image: baziImg,
  },
  {
    numeral: "IV",
    elderId: "ziwei",
    title: ["Zi Wei Dou Shu — 紫微斗数", "紫微斗数"],
    subtitle: [
      "The Purple Star Astrology of the Chinese imperium",
      "中华帝国的紫微星占",
    ],
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
    image: ziweiImg,
  },
];

const HEADER = {
  kicker: ["The Archive", "档案室"] as Bi,
  h1a: ["Four ", "四种"] as Bi,
  h1b: ["languages", "语言"] as Bi,
  h1c: [" for", "，同一片"] as Bi,
  h1d: ["the same silence", "沉默"] as Bi,
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

function TraditionsPage() {
  const { lang } = useLang();
  const li: 0 | 1 = lang === "zh" ? 1 : 0;
  const [openTradition, setOpenTradition] = useState<TraditionId | null>(null);

  return (
    <div className="pt-32 pb-32">
      {/* Header */}
      <header className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          {HEADER.kicker[li]}
        </p>
        <h1 className="mb-6 font-serif text-5xl leading-[1.05] text-stone-warm md:text-7xl">
          {HEADER.h1a[li]}
          <span className="italic gold-gradient-text">{HEADER.h1b[li]}</span>
          {HEADER.h1c[li]}
          <br /> {HEADER.h1d[li]}
        </h1>
        <p className="mx-auto max-w-2xl font-light text-stone-warm/60">{HEADER.lead[li]}</p>
      </header>

      {/* Chapters */}
      <div className="mx-auto max-w-6xl space-y-32 px-6 md:px-12">
        {chapters.map((c, idx) => (
          <motion.article
            key={c.numeral}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
            className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16"
          >
            <div className={`lg:col-span-5 ${idx % 2 === 1 ? "lg:order-2" : ""}`}>
              <div className="glass-card overflow-hidden rounded-3xl">
                <img
                  src={c.image}
                  alt={`${c.title[0]} diagram`}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>
            <div className={`lg:col-span-7 ${idx % 2 === 1 ? "lg:order-1" : ""}`}>
              <p className="mb-4 font-serif text-2xl italic text-gold-dust">{c.numeral}.</p>
              <h2 className="mb-3 font-serif text-4xl text-stone-warm md:text-5xl">
                {c.title[li]}
              </h2>
              <p className="mb-8 text-sm uppercase tracking-[0.3em] text-stone-warm/50">
                {c.subtitle[li]}
              </p>
              <p className="mb-6 text-sm italic text-stone-warm/70">
                <span className="mr-2 not-italic text-gold-dust">{HEADER.origin[li]} —</span>
                {c.origin[li]}
              </p>
              <p className="mb-10 max-w-[62ch] text-base leading-relaxed text-stone-warm/80">
                {c.essay[li]}
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {HEADER.concepts[li]}
                  </p>
                  <ul className="space-y-2 text-sm text-stone-warm/75">
                    {c.concepts.map((cc) => (
                      <li key={cc.name[0]} className="flex justify-between gap-6 border-b border-white/5 pb-2">
                        <span className="font-serif text-gold-light">{cc.name[li]}</span>
                        <span className="text-right text-stone-warm/50">{cc.gloss[li]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {HEADER.canon[li]}
                  </p>
                  <ul className="mb-8 space-y-2 text-sm italic text-stone-warm/70">
                    {c.canon.map((k) => (
                      <li key={k[0]}>· {k[li]}</li>
                    ))}
                  </ul>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {HEADER.reveals[li]}
                  </p>
                  <ul className="space-y-1 text-sm text-stone-warm/75">
                    {c.reveals.map((r) => (
                      <li key={r[0]}>— {r[li]}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpenTradition(c.elderId)}
                className="mt-10 inline-flex items-center gap-2 rounded-full border border-gold-dust/40 px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-colors hover:bg-gold-dust/10"
              >
                {lang === "zh" ? "请这位长老开口" : "Consult this elder"}
                <span className="text-sm">→</span>
              </button>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="mx-auto mt-32 max-w-3xl px-6 text-center">
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
