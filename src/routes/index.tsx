import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

import astrologyImg from "@/assets/tradition-astrology.jpg";
import jyotishImg from "@/assets/tradition-jyotish.jpg";
import baziImg from "@/assets/tradition-bazi.jpg";
import ziweiImg from "@/assets/tradition-ziwei.jpg";
import treeImg from "@/assets/tree-of-destiny.jpg";

export const Route = createFileRoute("/")({
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

const dimensions = [
  "Character",
  "Vocation",
  "Wealth",
  "Love",
  "Family",
  "Health",
  "Life Mission",
  "Cycles",
];

function LandingPage() {
  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-24 text-center">
        <div className="pointer-events-none absolute h-[820px] w-[820px] rounded-full border border-white/5 animate-slow-rotate" />
        <div className="pointer-events-none absolute h-[600px] w-[600px] rounded-full border border-gold-dust/10 animate-slow-rotate-reverse" />
        <div className="pointer-events-none absolute h-[380px] w-[380px] rounded-full border border-nebula-purple/20 animate-slow-rotate" />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
          className="relative z-10 mb-8 text-[11px] font-light uppercase tracking-[0.42em] text-gold-dust"
        >
          An AI synthesis of human destiny
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="relative z-10 max-w-5xl font-serif text-5xl leading-[1.05] text-stone-warm md:text-7xl lg:text-[5.5rem]"
        >
          Every civilization has tried to
          <br />
          <span className="italic gold-gradient-text">answer the same question.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.9 }}
          className="relative z-10 mt-10 font-serif text-xl italic text-stone-warm/60 md:text-2xl"
        >
          “Who are you?”
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="relative z-10 mt-14"
        >
          <Link
            to="/ritual"
            className="group relative inline-flex overflow-hidden rounded-full border border-gold-dust/30 px-12 py-5 transition-colors hover:border-gold-dust"
          >
            <span className="relative z-10 text-xs font-medium uppercase tracking-[0.32em] text-gold-dust">
              Enter the Library
            </span>
            <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
          </Link>
        </motion.div>

        <div className="absolute bottom-10 flex flex-col items-center">
          <div className="h-16 w-px bg-gradient-to-b from-transparent to-gold-dust/50" />
          <span className="mt-3 text-[10px] uppercase tracking-[0.32em] text-stone-warm/40">
            Scroll to explore
          </span>
        </div>
      </section>

      {/* ─────────── PHILOSOPHY BRIDGE ─────────── */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-32 text-center">
        <p className="font-serif text-2xl leading-relaxed text-stone-warm/70 md:text-3xl">
          Four civilizations — separated by oceans and centuries — each built a language for
          the same silence inside a human being. <span className="italic text-gold-light">This
          library reads all four at once.</span>
        </p>
      </section>

      {/* ─────────── FOUR TRADITIONS ─────────── */}
      <section id="traditions" className="relative z-10 mx-auto max-w-7xl px-6 py-24 md:px-12">
        <div className="mb-16 flex items-end justify-between">
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.4em] text-gold-dust">
              I — IV
            </p>
            <h2 className="max-w-2xl font-serif text-4xl leading-tight text-stone-warm md:text-5xl">
              The four pillars of the <span className="italic">reading</span>
            </h2>
          </div>
          <Link
            to="/traditions"
            className="hidden text-[10px] uppercase tracking-[0.32em] text-stone-warm/60 transition-colors hover:text-gold-dust md:block"
          >
            Read the archive →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {traditions.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: [0.32, 0.72, 0, 1] }}
              className={`glass-card group relative flex h-[520px] flex-col overflow-hidden rounded-3xl p-6 transition-colors duration-700 hover:border-gold-dust/40 ${i % 2 === 1 ? "lg:mt-12" : ""}`}
            >
              <div className="mb-6 aspect-square overflow-hidden rounded-2xl bg-white/5">
                <img
                  src={t.image}
                  alt={`${t.title} diagram`}
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="h-full w-full object-cover transition-transform duration-[1400ms] group-hover:scale-110"
                />
              </div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-gold-dust/80">
                {t.subtitle}
              </p>
              <h3 className="mb-3 font-serif text-2xl text-stone-warm">{t.title}</h3>
              <p className="text-sm font-light leading-relaxed text-stone-warm/60">{t.blurb}</p>
              <div className="mt-auto flex items-center justify-between pt-6">
                <span className="text-[10px] uppercase tracking-[0.28em] text-gold-dust/50">
                  {t.citation}
                </span>
                <div className="grid size-8 place-items-center rounded-full border border-white/10 text-stone-warm/60 transition-colors group-hover:border-gold-dust group-hover:text-gold-dust">
                  →
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─────────── AI SYNTHESIS SHOWCASE ─────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-32 md:px-12">
        <div className="glass-card overflow-hidden rounded-[2.5rem]">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 md:p-16">
              <p className="mb-6 text-[10px] font-medium uppercase tracking-[0.42em] text-gold-dust">
                The Integrated Report
              </p>
              <h3 className="mb-8 font-serif text-4xl italic leading-tight text-stone-warm md:text-5xl">
                A singular lens for a complex soul.
              </h3>
              <p className="mb-10 text-base font-light leading-relaxed text-stone-warm/60 md:text-lg">
                Our AI does not paste four reports together. It reads each chart, clusters
                agreements, surfaces contradictions, and reasons across four civilizations to
                find the pattern of a single life.
              </p>
              <ul className="space-y-4 text-sm text-stone-warm/80">
                {[
                  "Cross-tradition pattern recognition",
                  "Confidence rating on every conclusion",
                  "Conflicts surfaced, not hidden",
                  "Fifty-year cyclical timeline",
                ].map((line) => (
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
                Begin the ritual
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
                  The Tree of Destiny
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
            The dimensions of a life
          </p>
          <h3 className="font-serif text-3xl italic text-stone-warm md:text-4xl">
            Eight facets, read across four traditions
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {dimensions.map((d) => (
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
          Your reading is written<br />in a language older than <span className="gold-gradient-text">language.</span>
        </h2>
        <p className="mx-auto mb-12 max-w-xl font-light text-stone-warm/60">
          Four minutes of information. A lifetime of pattern. The library is patient — and it
          is waiting.
        </p>
        <Link
          to="/ritual"
          className="group inline-flex overflow-hidden rounded-full border border-gold-dust/30 px-12 py-5 transition-colors hover:border-gold-dust"
        >
          <span className="relative z-10 text-xs font-medium uppercase tracking-[0.32em] text-gold-dust">
            Begin the reading
          </span>
        </Link>
      </section>
    </>
  );
}
