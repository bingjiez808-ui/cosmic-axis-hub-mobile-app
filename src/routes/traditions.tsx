import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

import astrologyImg from "@/assets/tradition-astrology.jpg";
import jyotishImg from "@/assets/tradition-jyotish.jpg";
import baziImg from "@/assets/tradition-bazi.jpg";
import ziweiImg from "@/assets/tradition-ziwei.jpg";

export const Route = createFileRoute("/traditions")({
  head: () => ({
    meta: [
      { title: "The Four Traditions — Library of Destiny" },
      {
        name: "description",
        content:
          "A scholarly primer on the four traditions the library reads together: Western Astrology, Vedic Jyotish, Chinese BaZi and Zi Wei Dou Shu.",
      },
      { property: "og:title", content: "The Four Traditions — Library of Destiny" },
      {
        property: "og:description",
        content: "Western Astrology · Vedic Jyotish · BaZi · Zi Wei Dou Shu.",
      },
    ],
  }),
  component: TraditionsPage,
});

type Chapter = {
  numeral: string;
  title: string;
  subtitle: string;
  origin: string;
  essay: string;
  concepts: { name: string; gloss: string }[];
  canon: string[];
  reveals: string[];
  image: string;
};

const chapters: Chapter[] = [
  {
    numeral: "I",
    title: "Western Astrology",
    subtitle: "The dialogue between psyche and sky",
    origin:
      "From Babylonian observation through Hellenistic geometry, refined in the twentieth century by Jungian depth psychology.",
    essay:
      "Western astrology treats the natal chart as a psychological architecture — a snapshot of the sky at the moment of first breath. Planets carry archetypal functions, houses locate them inside a life, and aspects describe the tension or harmony between them. Modern practice reads this less as prediction than as a map of temperament, motive and unfolding development.",
    concepts: [
      { name: "The Sun", gloss: "essential self, will" },
      { name: "The Moon", gloss: "inner life, feeling" },
      { name: "The Ascendant", gloss: "the mask of arrival" },
      { name: "The Ten Planets", gloss: "psychic functions" },
      { name: "Twelve Houses", gloss: "life domains" },
      { name: "Aspects", gloss: "planetary conversation" },
    ],
    canon: [
      "Tetrabiblos — Claudius Ptolemy",
      "The Inner Sky — Steven Forrest",
      "Parker's Astrology — Julia & Derek Parker",
      "Astrology for the Soul — Jan Spiller",
    ],
    reveals: [
      "Character architecture",
      "Emotional patterning",
      "Relational grammar",
      "Life themes and lessons",
    ],
    image: astrologyImg,
  },
  {
    numeral: "II",
    title: "Jyotish",
    subtitle: "The science of light — India's Vedic astrology",
    origin:
      "Rooted in the Vedas, refined by classical treatises over two millennia, still practiced continuously today.",
    essay:
      "Jyotish emphasises karma — the ripening of past causes — and gives an unusually granular treatment of time. Twenty-seven Nakshatras (lunar mansions) divide the ecliptic, and layered Dasha cycles reveal when the seeds of a chart are set to bloom. Jyotish is famous for its precision in timing marriage, vocation, wealth and spiritual awakening.",
    concepts: [
      { name: "Lagna", gloss: "rising sign — vehicle of the soul" },
      { name: "Grahas", gloss: "the nine seizers (planets)" },
      { name: "Nakshatras", gloss: "27 lunar mansions" },
      { name: "Bhavas", gloss: "twelve life-fields" },
      { name: "Dasha", gloss: "planetary time-lord periods" },
      { name: "Gochar", gloss: "current transits" },
    ],
    canon: [
      "Brihat Parashara Hora Shastra",
      "Jataka Parijata",
      "Phaladeepika",
      "Saravali",
    ],
    reveals: [
      "Karmic timing",
      "Life mission",
      "Marriage and partnership",
      "Wealth and spiritual growth",
    ],
    image: jyotishImg,
  },
  {
    numeral: "III",
    title: "BaZi — 八字",
    subtitle: "The Four Pillars of Destiny",
    origin:
      "A Chinese system distilled from Yin-Yang cosmology and the Five Elements, formalised through the Tang and Song dynasties.",
    essay:
      "BaZi translates the moment of birth into eight characters — one Heavenly Stem and one Earthly Branch for the year, month, day and hour. The resulting formula reveals the balance of Wood, Fire, Earth, Metal and Water in a person, the strength of the Ten Gods around the Day Master, and the Great Luck cycles that carry a life forward one decade at a time.",
    concepts: [
      { name: "天干", gloss: "ten Heavenly Stems" },
      { name: "地支", gloss: "twelve Earthly Branches" },
      { name: "五行", gloss: "five elements in dynamic flow" },
      { name: "十神", gloss: "the Ten Gods around Day Master" },
      { name: "格局", gloss: "the chart's structural pattern" },
      { name: "大运", gloss: "ten-year Great Luck cycles" },
    ],
    canon: [
      "滴天髓 · The Drops of Heavenly Essence",
      "穷通宝鉴 · Qiong Tong Bao Jian",
      "三命通会 · The Complete Guide to Three Fates",
      "渊海子平 · Yuan Hai Zi Ping",
    ],
    reveals: [
      "Elemental temperament",
      "Career and wealth capacity",
      "Marriage timing",
      "Health tendencies and cycles",
    ],
    image: baziImg,
  },
  {
    numeral: "IV",
    title: "Zi Wei Dou Shu — 紫微斗数",
    subtitle: "The Purple Star Astrology of the Chinese imperium",
    origin:
      "Traditionally attributed to the Song-dynasty sage Chen Xiyi. Reserved for centuries as an imperial system of destiny.",
    essay:
      "Zi Wei arranges a life across twelve palaces — Self, Wealth, Career, Marriage, Children, Migration and more — and populates them with fourteen major stars led by the Emperor Star, Zi Wei. Four Transformations (化禄, 化权, 化科, 化忌) shift the reading across decades and years, producing an unusually detailed map of the shape of a life.",
    concepts: [
      { name: "命宫", gloss: "Palace of Self" },
      { name: "身宫", gloss: "Palace of Body — later life" },
      { name: "十四主星", gloss: "the fourteen major stars" },
      { name: "辅星", gloss: "auxiliary and minor stars" },
      { name: "四化", gloss: "four transformations" },
      { name: "大限 · 流年", gloss: "great limits and annual flows" },
    ],
    canon: [
      "紫微斗数全书",
      "斗数宣微",
      "紫微斗数全集",
    ],
    reveals: [
      "Overall life pattern",
      "Career and wealth structure",
      "Marriage and children",
      "Migration, health, siblings",
    ],
    image: ziweiImg,
  },
];

function TraditionsPage() {
  return (
    <div className="pt-32 pb-32">
      {/* Header */}
      <header className="mx-auto max-w-4xl px-6 pb-24 text-center">
        <p className="mb-4 text-[10px] uppercase tracking-[0.42em] text-gold-dust">
          The Archive
        </p>
        <h1 className="mb-6 font-serif text-5xl leading-[1.05] text-stone-warm md:text-7xl">
          Four <span className="italic gold-gradient-text">languages</span> for
          <br /> the same silence
        </h1>
        <p className="mx-auto max-w-2xl font-light text-stone-warm/60">
          Each of the four traditions is a self-contained cosmology, developed over centuries
          with its own canonical texts. The library holds them side by side so their answers
          can converse.
        </p>
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
                  alt={`${c.title} diagram`}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="aspect-square w-full object-cover"
                />
              </div>
            </div>
            <div className={`lg:col-span-7 ${idx % 2 === 1 ? "lg:order-1" : ""}`}>
              <p className="mb-4 font-serif text-2xl italic text-gold-dust">
                {c.numeral}.
              </p>
              <h2 className="mb-3 font-serif text-4xl text-stone-warm md:text-5xl">
                {c.title}
              </h2>
              <p className="mb-8 text-sm uppercase tracking-[0.3em] text-stone-warm/50">
                {c.subtitle}
              </p>
              <p className="mb-6 text-sm italic text-stone-warm/70">
                <span className="mr-2 not-italic text-gold-dust">Origin —</span>
                {c.origin}
              </p>
              <p className="mb-10 max-w-[62ch] text-base leading-relaxed text-stone-warm/80">
                {c.essay}
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    Core concepts
                  </p>
                  <ul className="space-y-2 text-sm text-stone-warm/75">
                    {c.concepts.map((cc) => (
                      <li key={cc.name} className="flex justify-between gap-6 border-b border-white/5 pb-2">
                        <span className="font-serif text-gold-light">{cc.name}</span>
                        <span className="text-right text-stone-warm/50">{cc.gloss}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    Canonical texts
                  </p>
                  <ul className="mb-8 space-y-2 text-sm italic text-stone-warm/70">
                    {c.canon.map((k) => (
                      <li key={k}>· {k}</li>
                    ))}
                  </ul>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    What it reveals
                  </p>
                  <ul className="space-y-1 text-sm text-stone-warm/75">
                    {c.reveals.map((r) => (
                      <li key={r}>— {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="mx-auto mt-32 max-w-3xl px-6 text-center">
        <h3 className="mb-8 font-serif text-3xl italic text-stone-warm md:text-4xl">
          The library reads all four — <span className="gold-gradient-text">at once.</span>
        </h3>
        <Link
          to="/ritual"
          className="inline-flex rounded-full bg-gold-dust px-10 py-4 text-xs font-medium uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
        >
          Begin the ritual
        </Link>
      </div>
    </div>
  );
}
