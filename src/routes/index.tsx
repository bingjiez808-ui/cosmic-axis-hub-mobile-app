import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { CuratorLetter } from "@/components/CuratorLetter";
import { ConcernSelector } from "@/components/ConcernSelector";
import { FeatureLibraryShelf } from "@/components/FeatureLibraryShelf";
import { HomePersonalDeskTeaser } from "@/components/HomePersonalDeskTeaser";
import { PlayfulLibrarySection } from "@/components/PlayfulLibrarySection";
import { PostRitualRoomsSection } from "@/components/PostRitualRoomsSection";
import { PremiumReportCta } from "@/components/PremiumReportCta";
import { LibraryEntrance } from "@/components/entrance/LibraryEntrance";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:url", content: "https://fate-nexus-ai.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://fate-nexus-ai.lovable.app/" }],
  }),
  component: LandingPage,
});


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

function LandingPage() {
  const { t, lang } = useLang();
  const { session } = useSupabaseSession();
  const isZh = lang === "zh";
  const isSignedIn = !!session;

  const valuePropZh =
    "不是替你决定命运，而是从学业、事业、爱情、关系、财富与人生阶段，帮你看清反复出现的模式与下一步选择。";
  const valuePropEn =
    "Not deciding your fate for you — helping you see, across study, career, love, relationships, wealth and life stage, the patterns that keep returning and what step to take next.";

  const advantages = [
    { zh: "四大体系交叉阅读", en: "Four traditions read together" },
    { zh: "真实排盘数据", en: "Real chart calculation" },
    { zh: "一次生成永久保存", en: "Generated once, kept forever" },
    { zh: "文化娱乐与自我反思", en: "Cultural reading & self-reflection" },
  ];


  return (
    <>
      <LibraryEntrance />
      {/* ─────────── HERO ─────────── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pt-24 text-center sm:px-6">
        <div className="pointer-events-none absolute h-[820px] w-[820px] rounded-full border border-white/5 animate-slow-rotate" />
        <div className="pointer-events-none absolute h-[600px] w-[600px] rounded-full border border-gold-dust/10 animate-slow-rotate-reverse" />
        <div className="pointer-events-none absolute h-[380px] w-[380px] rounded-full border border-nebula-purple/20 animate-slow-rotate" />

        <HeroLanguageChooser />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
          className="relative z-10 mb-3 text-[10px] font-light uppercase tracking-[0.48em] text-stone-warm/55"
        >
          {isZh ? "命运图书馆 · 导览室" : "Destiny Library · Guide Hall"}
        </motion.p>

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
          data-testid="hero-h1"
          className={`relative z-10 max-w-5xl font-serif text-stone-warm ${
            isZh ? "text-fluid-hero-zh" : "text-fluid-hero"
          }`}
        >
          <span className={isZh ? "hero-zh-line" : "block"}>{t.hero_h1_a}</span>
          <span className={`italic gold-gradient-text ${isZh ? "hero-zh-line" : "block"}`}>
            {t.hero_h1_b}
          </span>
        </motion.h1>

        {/* Value proposition (replaces old signup subtitle) */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.9 }}
          data-testid="hero-valueprop"
          className="relative z-10 mt-8 max-w-2xl px-2 text-base leading-relaxed text-stone-warm/70 md:mt-10"
        >
          {isZh ? valuePropZh : valuePropEn}
        </motion.p>

        {/* Primary + secondary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="relative z-10 mt-8 flex flex-col items-center gap-3 md:mt-10"
        >
          {isSignedIn ? (
            <>
              <Link
                to="/me/home"
                data-testid="hero-cta-primary"
                className="group relative inline-flex overflow-hidden rounded-full border border-gold-dust/40 bg-obsidian/80 px-10 py-4 backdrop-blur-sm transition-colors hover:border-gold-dust md:px-12 md:py-5"
              >
                <span className="relative z-10 text-xs font-medium uppercase tracking-[0.32em] text-gold-dust">
                  {isZh ? "回到我的个人书架" : "Back to my Personal Library"}
                </span>
                <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
              </Link>
              <Link
                to="/ritual"
                data-testid="hero-cta-secondary"
                className="text-[11px] uppercase tracking-[0.32em] text-stone-warm/60 hover:text-gold-dust"
              >
                {isZh ? "新建 / 读取另一张命盘" : "Add or read another chart"}
              </Link>
            </>
          ) : (
            <>
              <a
                href="#concern"
                data-testid="hero-cta-primary"
                className="group relative inline-flex overflow-hidden rounded-full border border-gold-dust/40 bg-obsidian/80 px-10 py-4 backdrop-blur-sm transition-colors hover:border-gold-dust md:px-12 md:py-5"
              >
                <span className="relative z-10 text-xs font-medium uppercase tracking-[0.32em] text-gold-dust">
                  {isZh ? "开启我的阅读" : "Begin my reading"}
                </span>
                <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
              </a>
              <a
                href="#feature-library"
                data-testid="hero-cta-secondary"
                className="text-[11px] uppercase tracking-[0.32em] text-stone-warm/60 hover:text-gold-dust"
              >
                {isZh ? "先看看图书馆能回答什么" : "See what the library can answer first"}
              </a>
            </>
          )}
        </motion.div>


        {/* Trust bar */}
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.4 }}
          data-testid="hero-trustbar"
          className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/45 md:text-[11px]"
        >
          {advantages.map((a) => (
            <li key={a.en} className="flex items-center gap-2">
              <span aria-hidden className="h-1 w-1 rounded-full bg-gold-dust/60" />
              <span>{isZh ? a.zh : a.en}</span>
            </li>
          ))}
        </motion.ul>

        {/* Downgraded old "step into library" CTA */}
        <div className="relative z-10 mt-6">
          <Link
            to="/ritual"
            className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/40 hover:text-gold-dust"
          >
            {t.hero_cta}
          </Link>
        </div>

        <div className="absolute bottom-6 flex flex-col items-center">
          <div className="h-10 w-px bg-gradient-to-b from-transparent to-gold-dust/40" />
          <span className="mt-2 text-[10px] uppercase tracking-[0.32em] text-stone-warm/35">
            {isZh ? "向下：选择你的问题" : "Down: pick your question"}
          </span>
        </div>
      </section>

      {/* ─────────── CONCERN → FEATURE MAPPING ─────────── */}
      <ConcernSelector />

      {/* ─────────── SIX THEMED BOOKS ─────────── */}
      <FeatureLibraryShelf />

      {/* ─────────── PLAYFUL LIBRARY (cross-discipline exhibits) ─────── */}
      <PlayfulLibrarySection />

      {/* ─────────── AFTER-RITUAL · FOUR PRIVATE ROOMS ─────────── */}
      <PostRitualRoomsSection />

      {/* ─────────── TRUST BRIDGE → traditions detail page ─────────── */}
      <section
        id="trust-bridge"
        data-testid="trust-bridge"
        className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center"
      >
        <p className="font-serif text-xl leading-relaxed text-stone-warm/75 md:text-2xl">
          {isZh
            ? "不是用一句星座标签定义你。图书馆综合四种传统体系，从不同角度交叉阅读同一份人生资料。"
            : "Not defining you with a one-line star sign. The library reads the same life data across four traditions, from different angles."}
        </p>
        <Link
          to="/traditions"
          className="mt-6 inline-flex rounded-full border border-gold-dust/40 px-8 py-3 text-[11px] uppercase tracking-[0.32em] text-gold-dust transition hover:bg-gold-dust/10"
        >
          {isZh ? "了解四大体系如何共同阅读" : "See how the four traditions read together"}
        </Link>
        <p
          data-testid="trust-bridge-data-note"
          className="mx-auto mt-4 max-w-2xl text-[11px] leading-relaxed text-stone-warm/45"
        >
          {isZh
            ? "详情页可查看：西方星盘的行星、宫位与相位；印度本命盘、Nakshatra 与 Dasha 大运；八字四柱、十神与大运流年；紫微十二宫、主星与大限流年——每一项都基于真实排盘数据，未接入的部分不会承诺。"
            : "The detail page shows: Western planets, houses and aspects; the Vedic natal chart, Nakshatras and Dasha periods; the BaZi four pillars, ten gods and luck cycles; the Zi Wei twelve palaces, main stars and major limits — all from real calculations. Anything not yet supported is never promised."}
        </p>
      </section>

      {/* ─────────── PERSONAL READING DESK teaser (after-signin value) ─────── */}
      <HomePersonalDeskTeaser />

      {/* ─────────── MEMBERSHIP HINT (single canonical entry) ─────────── */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-[10px] uppercase tracking-[0.36em] text-gold-dust/80">
          {isZh ? "会员能力" : "Membership"}
        </p>
        <h3 className="mt-3 font-serif text-2xl leading-tight text-stone-warm md:text-3xl">
          {isZh
            ? "综合解读永久免费；¥79 高级 AI 深度报告解锁 24 章完整版本。"
            : "The panorama reading is free forever. ¥79 unlocks the 24-chapter premium report."}
        </h3>
        <p className="mx-auto mt-3 max-w-xl text-sm text-stone-warm/55">
          {isZh
            ? "一次生成，永久保存；不是订阅、不自动续费。"
            : "Generated once, kept forever — no subscription, no auto-renew."}
        </p>
        <div className="mt-6 flex justify-center">
          <PremiumReportCta />
        </div>
        <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-stone-warm/45">
          {isZh
            ? "未登录会先带你回到登录页并保留原意图；没有命盘会引导你先开启仪式；已购或生成中都会直接打开对应状态。"
            : "If you aren't signed in we route through login and keep your intent; if you have no chart yet the ritual opens first; already-paid or in-progress reports open in the right state."}
        </p>
      </section>

      {/* ─────────── HISTORICAL ECHO PREVIEW (Curator's letter) ─────────── */}
      <CuratorLetter />
    </>
  );
}

